import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { MasterRate, BillingShareRecord } from '../models';

/**
 * Excel import support for the Master Rate List.
 *
 * Endpoints:
 *  POST /api/master-rates/import/preview  - parse + validate an uploaded file, return a preview (no writes)
 *  POST /api/master-rates/import/commit   - re-parse the same file and persist the valid rows
 *  GET  /api/master-rates/import/template - download a blank template workbook
 *
 * The commit step always re-parses the uploaded file, so the preview and the
 * saved data are guaranteed to come from the exact same parsing/validation code.
 */

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'];
const MAX_PREVIEW_ROWS = 500;

type FieldKey = 'serviceName' | 'masterRate' | 'vedaSharePercent' | 'sodaniSharePercent';

const FIELD_LABELS: Record<FieldKey, string> = {
  serviceName: 'Service Name',
  masterRate: 'Master Rate (₹)',
  vedaSharePercent: 'Veda Share %',
  sodaniSharePercent: 'Sodani Share %',
};

// Header patterns, ordered from most specific to most permissive.
const SERVICE_HEADER_PATTERNS: RegExp[] = [
  /^service[ _\-]?name$/i,
  /^service[ _\-]?test[ _\-]?name$/i,
  /^test[ _\-]?name$/i,
  /service[ _\-]?name/i,
  /test[ _\-]?name/i,
  /^(service|test|investigation|item|particulars|description)\b/i,
];

const RATE_HEADER_PATTERNS: RegExp[] = [
  /^master[ _\-]?rate/i,
  /^master[ _\-]?amount/i,
  /^test[ _\-]?amount/i,
  /^test[ _\-]?rate/i,
  /master[ _\-]?rate/i,
  /master[ _\-]?amount/i,
  /^rate(\s*\(.*\))?$/i,
  /^(rate|amount|price|mrp|charge|charges)$/i,
];

// Total / subtotal rows are structural noise in rate lists, never real services.
// The whole cell must be a total label so real tests such as "Total Bilirubin" are kept.
const SUMMARY_ROW_PATTERN =
  /^(sub[\s\-_]*total|grand[\s\-_]*total|billing[\s\-_]*total|amount[\s\-_]*total|net[\s\-_]*total|total|sum)(\s*[:\-–]\s*\S+)?$/i;

const NON_SERVICE_HEADER_PATTERN = /\b(service|test|item)[ _\-]?(id|code|no)\b/i;
const SHARE_HEADER_PATTERN = /veda|sodani|share|sharing|%/i;

interface ParsedRow {
  rowNumber: number;
  serviceName: string;
  masterRate: number | null;
  vedaSharePercent: number;
  sodaniSharePercent: number;
  errors: string[];
  warnings: string[];
}

type RowStatus = 'new' | 'update' | 'duplicate' | 'error';

interface EnrichedRow extends ParsedRow {
  status: RowStatus;
  statusText: string;
  existingMasterRate: number | null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function isBlank(value: any): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

/** Parse a spreadsheet cell into a number. Handles currency symbols, prefixes, commas and stray text. */
function parseNumeric(value: any): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  if (isBlank(value)) return null;

  let text = String(value).trim().toLowerCase();
  if (text.endsWith('%')) text = text.slice(0, -1);

  // Strip currency symbols, grouping separators and whitespace first so that
  // "Rs. 1,450.50" and "INR 2,000" reduce to bare numbers.
  text = text.replace(/[₹$€£,]/g, '').replace(/\s/g, '');
  text = text.replace(/^(rs\.?|inr|mrp|usd|amt\.?|amount)[:.]?/, '');

  if (!/^-?\d*\.?\d+$/.test(text)) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse a share cell into a percentage.
 * Handles "20%" / "20 %" literally, and the decimal form used by the hospital
 * rate lists (0.52 => 52%).
 */
function parsePercent(value: any): number | null {
  if (isBlank(value)) return null;
  let parsed = parseNumeric(value);
  if (parsed === null) return null;

  const hasPercentSign = String(value).includes('%');
  if (!hasPercentSign && parsed > 0 && parsed <= 1) {
    parsed = parsed * 100;
  }

  return Math.round(parsed * 100) / 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function findHeaderRowIndex(rawRows: any[][]): number {
  const limit = Math.min(rawRows.length, 15);

  for (let i = 0; i < limit; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const cells = row.map((cell) => (isBlank(cell) ? '' : String(cell).trim()));
    if (cells.filter(Boolean).length < 2) continue;

    const hasService = cells.some((cell) => SERVICE_HEADER_PATTERNS.some((p) => p.test(cell)));
    const hasRate = cells.some((cell) => RATE_HEADER_PATTERNS.some((p) => p.test(cell)));

    if (hasService && hasRate) return i;
  }

  return 0;
}

function buildColumnMapping(headers: string[]): Record<FieldKey, number | null> {
  const mapping: Record<FieldKey, number | null> = {
    serviceName: null,
    masterRate: null,
    vedaSharePercent: null,
    sodaniSharePercent: null,
  };
  const used = new Set<number>();

  const isServiceish = (header: string) =>
    !NON_SERVICE_HEADER_PATTERN.test(header) && SERVICE_HEADER_PATTERNS.some((p) => p.test(header));
  const isShareish = (header: string) => SHARE_HEADER_PATTERN.test(header);
  const isRateish = (header: string) => RATE_HEADER_PATTERNS.some((p) => p.test(header));

  // 1. Service name - must be resolved first so the share pass can avoid "Veda Test Name" style headers.
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i] || used.has(i)) continue;
    if (isServiceish(headers[i])) {
      mapping.serviceName = i;
      used.add(i);
      break;
    }
  }

  // 2. Sodani share % (optional - the app always stores 100 - Veda).
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i] || used.has(i) || isServiceish(headers[i]) || isRateish(headers[i])) continue;
    if (/sodani/i.test(headers[i])) {
      mapping.sodaniSharePercent = i;
      used.add(i);
      break;
    }
  }

  // 3. Veda share % (optional - defaults to 0). Columns that are really rate columns
  //    such as "Test Amount [Veda Hospital (2024)]" are left for the rate pass below.
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i] || used.has(i) || isServiceish(headers[i]) || isRateish(headers[i])) continue;
    if (isShareish(headers[i])) {
      mapping.vedaSharePercent = i;
      used.add(i);
      break;
    }
  }

  // 4. Master rate (required).
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i] || used.has(i)) continue;
    if (isRateish(headers[i])) {
      mapping.masterRate = i;
      used.add(i);
      break;
    }
  }

  return mapping;
}

function parseDataRows(
  rawRows: any[][],
  headerRowIndex: number,
  mapping: Record<FieldKey, number | null>
): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const firstSeenAt = new Map<string, number>();

  const read = (row: any[], field: FieldKey) =>
    mapping[field] === null ? undefined : row[mapping[field] as number];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const raw = rawRows[r];
    if (!Array.isArray(raw)) continue;

    const rawName = read(raw, 'serviceName');
    const rawRate = read(raw, 'masterRate');

    if (isBlank(rawName) && isBlank(rawRate)) continue; // blank spacer row

    const rowNumber = r + 1;
    const serviceName = isBlank(rawName) ? '' : String(rawName).trim();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (serviceName && SUMMARY_ROW_PATTERN.test(serviceName)) continue;

    if (!serviceName) {
      errors.push('Service Name is missing');
    }

    // Master Rate
    let masterRate: number | null = null;
    if (isBlank(rawRate)) {
      errors.push('Master Rate is missing');
    } else {
      masterRate = parseNumeric(rawRate);
      if (masterRate === null) {
        errors.push(`Master Rate "${String(rawRate).trim()}" is not a valid number`);
      } else if (masterRate < 0) {
        errors.push(`Master Rate cannot be negative (found ${masterRate})`);
        masterRate = null;
      }
    }

    // Share percentages
    const rawVeda = read(raw, 'vedaSharePercent');
    const rawSodani = read(raw, 'sodaniSharePercent');
    const vedaProvided = !isBlank(rawVeda);
    const sodaniProvided = !isBlank(rawSodani);

    let vedaPct: number | null = vedaProvided ? parsePercent(rawVeda) : null;
    let sodaniPct: number | null = sodaniProvided ? parsePercent(rawSodani) : null;

    if (vedaProvided && vedaPct === null) {
      errors.push(`Veda Share % "${String(rawVeda).trim()}" is not a valid number`);
    } else if (vedaPct !== null && (vedaPct < 0 || vedaPct > 100)) {
      errors.push(`Veda Share % must be between 0 and 100 (found ${vedaPct})`);
      vedaPct = null;
    }

    if (sodaniProvided && sodaniPct === null) {
      warnings.push(`Sodani Share % "${String(rawSodani).trim()}" is not a valid number - ignored`);
      sodaniPct = null;
    } else if (sodaniPct !== null && (sodaniPct < 0 || sodaniPct > 100)) {
      warnings.push(`Sodani Share % must be between 0 and 100 (found ${sodaniPct}) - ignored`);
      sodaniPct = null;
    }

    if (vedaPct === null && sodaniPct !== null) {
      vedaPct = round2(100 - sodaniPct);
      warnings.push(`Veda Share % derived as 100 − Sodani (${vedaPct}%)`);
    }

    const finalVedaPct = vedaPct === null ? 0 : vedaPct;
    const finalSodaniPct = round2(100 - finalVedaPct);

    if (vedaPct !== null && sodaniPct !== null && Math.abs(sodaniPct - finalSodaniPct) > 0.01) {
      warnings.push(
        `Sodani Share % column (${sodaniPct}%) does not match 100 − Veda (${finalSodaniPct}%) - using ${finalSodaniPct}%`
      );
    }

    // Duplicate detection inside the uploaded file (case/whitespace insensitive).
    if (serviceName) {
      const key = normalizeText(serviceName);
      const previous = firstSeenAt.get(key);
      if (previous !== undefined) {
        errors.push(`Duplicate of the same service already listed at row ${previous}`);
      } else {
        firstSeenAt.set(key, rowNumber);
      }
    }

    rows.push({
      rowNumber,
      serviceName,
      masterRate,
      vedaSharePercent: finalVedaPct,
      sodaniSharePercent: finalSodaniPct,
      errors,
      warnings,
    });
  }

  return rows;
}

interface ParsedWorkbook {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  headers: string[];
  headerRowIndex: number;
  mapping: Record<FieldKey, number | null>;
  mappingLabels: Record<FieldKey, string | null>;
  rows: ParsedRow[];
}

function parseWorkbook(buffer: Buffer, fileName: string): ParsedWorkbook {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw Object.assign(new Error('Excel file has no sheets'), { statusCode: 400 });
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
  if (rawRows.length === 0) {
    throw Object.assign(new Error('Excel sheet is empty'), { statusCode: 400 });
  }

  const headerRowIndex = findHeaderRowIndex(rawRows);
  const headers = (rawRows[headerRowIndex] || []).map((cell) => (isBlank(cell) ? '' : String(cell).trim()));
  const mapping = buildColumnMapping(headers);
  const rows = parseDataRows(rawRows, headerRowIndex, mapping);

  const detected = headers.filter(Boolean);
  if (mapping.serviceName === null) {
    throw Object.assign(
      new Error(
        `Could not find a "${FIELD_LABELS.serviceName}" column. Detected headers: ${
          detected.length ? detected.join(', ') : '(none)'
        }`
      ),
      { statusCode: 400 }
    );
  }
  if (mapping.masterRate === null) {
    throw Object.assign(
      new Error(
        `Could not find a "${FIELD_LABELS.masterRate}" column. Detected headers: ${
          detected.length ? detected.join(', ') : '(none)'
        }`
      ),
      { statusCode: 400 }
    );
  }

  const mappingLabels = (Object.keys(mapping) as FieldKey[]).reduce(
    (acc, key) => {
      const idx = mapping[key];
      acc[key] = idx === null ? null : headers[idx] || `Column ${idx + 1}`;
      return acc;
    },
    {} as Record<FieldKey, string | null>
  );

  return {
    fileName,
    sheetName,
    sheetNames: workbook.SheetNames,
    headers,
    headerRowIndex,
    mapping,
    mappingLabels,
    rows,
  };
}

function validateUpload(req: Request): { buffer: Buffer; fileName: string } {
  if (!req.file) {
    throw Object.assign(new Error('Please upload an Excel file (.xlsx or .xls)'), { statusCode: 400 });
  }

  const fileName = req.file.originalname || 'upload.xlsx';
  const lower = fileName.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw Object.assign(
      new Error(`Unsupported file type. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`),
      { statusCode: 400 }
    );
  }

  return { buffer: req.file.buffer, fileName };
}

async function enrichRows(rows: ParsedRow[]): Promise<EnrichedRow[]> {
  const existingRates = await MasterRate.find({}).select('serviceName masterRate');
  const existingByName = new Map<string, { masterRate: number }>();
  existingRates.forEach((mr) => {
    existingByName.set(normalizeText(mr.serviceName), { masterRate: mr.masterRate });
  });

  return rows.map((row) => {
    const existing = row.serviceName ? existingByName.get(normalizeText(row.serviceName)) : undefined;

    let status: RowStatus;
    let statusText: string;

    if (row.errors.length > 0) {
      status = 'error';
      statusText = row.errors[0];
    } else if (existing) {
      status = 'update';
      statusText = `Update existing (₹${existing.masterRate.toLocaleString()})`;
    } else {
      status = 'new';
      statusText = 'New';
    }

    return {
      ...row,
      status,
      statusText,
      existingMasterRate: existing ? existing.masterRate : null,
    };
  });
}

function buildSummary(rows: EnrichedRow[]) {
  return {
    totalDataRows: rows.length,
    validCount: rows.filter((r) => r.status === 'new' || r.status === 'update').length,
    newCount: rows.filter((r) => r.status === 'new').length,
    updateCount: rows.filter((r) => r.status === 'update').length,
    invalidCount: rows.filter((r) => r.status === 'error').length,
    errorMessages: rows
      .filter((r) => r.errors.length > 0)
      .slice(0, 50)
      .map((r) => `Row ${r.rowNumber}: ${r.errors.join(' ')}`),
  };
}

export const previewMasterRateExcel = async (req: Request, res: Response) => {
  try {
    const { buffer, fileName } = validateUpload(req);
    const parsed = parseWorkbook(buffer, fileName);

    if (parsed.rows.length === 0) {
      return res.status(400).json({
        error: `No data rows found in sheet "${parsed.sheetName}". Add at least one service row below the header and try again.`,
      });
    }

    const rows = await enrichRows(parsed.rows);

    return res.json({
      fileName: parsed.fileName,
      sheetName: parsed.sheetName,
      sheetNames: parsed.sheetNames,
      headerRowIndex: parsed.headerRowIndex,
      headersDetected: parsed.headers.filter(Boolean),
      mapping: parsed.mappingLabels,
      rows: rows.slice(0, MAX_PREVIEW_ROWS),
      previewLimit: MAX_PREVIEW_ROWS,
      truncated: rows.length > MAX_PREVIEW_ROWS,
      ...buildSummary(rows),
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Failed to read the Excel file' });
  }
};

export const importMasterRateExcel = async (req: Request, res: Response) => {
  try {
    const { buffer, fileName } = validateUpload(req);
    const skipExisting = String(req.body?.skipExisting) === 'true';

    const parsed = parseWorkbook(buffer, fileName);
    const rows = await enrichRows(parsed.rows);
    const summary = buildSummary(rows);

    if (summary.validCount === 0) {
      return res.status(400).json({
        error: `No valid rows to import. ${summary.invalidCount} row(s) failed validation.`,
        ...summary,
      });
    }

    const existingRates = await MasterRate.find({}).select('_id serviceName');
    const existingByName = new Map<string, string>();
    existingRates.forEach((mr) => {
      existingByName.set(normalizeText(mr.serviceName), String(mr._id));
    });

    const operations: any[] = [];
    const changedEntries: Array<{
      serviceName: string;
      masterRate: number;
      vedaPct: number;
      sodaniPct: number;
    }> = [];
    let inserted = 0;
    let updated = 0;
    let skippedExisting = 0;

    for (const row of rows) {
      if (row.status === 'error') continue;

      const existingId = existingByName.get(normalizeText(row.serviceName));
      const masterRate = row.masterRate as number;
      const values = {
        masterRate,
        vedaSharePercent: row.vedaSharePercent,
        sodaniSharePercent: row.sodaniSharePercent,
      };

      if (existingId) {
        if (skipExisting) {
          skippedExisting++;
          continue;
        }
        operations.push({
          updateOne: {
            filter: { _id: existingId },
            update: { $set: values },
          },
        });
        updated++;
      } else {
        operations.push({
          updateOne: {
            filter: { serviceName: row.serviceName },
            update: { $set: { serviceName: row.serviceName, ...values } },
            upsert: true,
          },
        });
        existingByName.set(normalizeText(row.serviceName), `__new_${inserted}`);
        inserted++;
      }

      changedEntries.push({
        serviceName: row.serviceName,
        masterRate,
        vedaPct: row.vedaSharePercent,
        sodaniPct: row.sodaniSharePercent,
      });
    }

    if (operations.length > 0) {
      await MasterRate.bulkWrite(operations, { ordered: false });
    }

    await recalculateBillingRecords(changedEntries);

    return res.json({
      message: `Imported ${inserted + updated} master rate(s) from ${fileName}`,
      fileName,
      inserted,
      updated,
      skippedExisting,
      skippedInvalid: summary.invalidCount,
      ...summary,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Failed to import the Excel file' });
  }
};

export const downloadMasterRateTemplate = async (_req: Request, res: Response) => {
  try {
    const sheet = xlsx.utils.json_to_sheet([
      { 'Service Name': 'CREATININE SERUM', 'Master Rate (₹)': 250, 'Veda Share %': 20 },
      { 'Service Name': 'COMPLETE BLOOD COUNT (CBC)', 'Master Rate (₹)': 350, 'Veda Share %': 30 },
      { 'Service Name': 'CT SCAN - BRAIN PLAIN', 'Master Rate (₹)': 1200, 'Veda Share %': 20 },
    ]);
    sheet['!cols'] = [{ wch: 42 }, { wch: 16 }, { wch: 16 }];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, 'Master Rates');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="master-rate-import-template.xlsx"');
    return res.send(buffer);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to build the template file' });
  }
};

/**
 * Recompute shares for billing records belonging to the imported services.
 * Uses the same formulas as the single-record master rate handlers, but resolves
 * every affected service in a single query + bulkWrite.
 */
async function recalculateBillingRecords(
  entries: Array<{ serviceName: string; masterRate: number; vedaPct: number; sodaniPct: number }>
) {
  if (entries.length === 0) return;

  const lookup = new Map<string, (typeof entries)[number]>();
  entries.forEach((entry) => lookup.set(normalizeText(entry.serviceName), entry));

  const pattern = new RegExp(`^(${entries.map((e) => escapeRegex(e.serviceName)).join('|')})$`, 'i');
  const records = await BillingShareRecord.find({ serviceName: pattern });

  const operations = records
    .map((rec) => {
      const entry = lookup.get(normalizeText(rec.serviceName));
      if (!entry) return null;

      const qty = rec.qty || 1;
      const masterAmount = round2(entry.masterRate * qty);
      const vedaShare = round2((masterAmount * entry.vedaPct) / 100);
      const sodaniShare = round2((masterAmount * entry.sodaniPct) / 100);

      return {
        updateOne: {
          filter: { _id: rec._id },
          update: {
            $set: {
              masterRate: entry.masterRate,
              masterAmount,
              vedaSharePercent: entry.vedaPct,
              sodaniSharePercent: entry.sodaniPct,
              percent: `Veda: ${entry.vedaPct}% | Sodani: ${entry.sodaniPct}%`,
              vedaShare,
              sodaniShare,
              isMatched: true,
            },
          },
        },
      };
    })
    .filter(Boolean) as any[];

  if (operations.length > 0) {
    await BillingShareRecord.bulkWrite(operations);
  }
}
