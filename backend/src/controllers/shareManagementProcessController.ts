import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { store } from '../store/inMemoryStore';

// Format Excel serial date to readable string
function formatExcelDate(value: any): string {
  if (!value) return '';

  if (typeof value === 'number') {
    const utc_days = Math.floor(value - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const fractional_day = value - Math.floor(value) + 0.0000001;
    const total_seconds = Math.floor(86400 * fractional_day);
    const seconds = total_seconds % 60;
    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor((total_seconds - hours * 3600) / 60);

    const date = new Date(
      date_info.getFullYear(),
      date_info.getMonth(),
      date_info.getDate(),
      hours,
      minutes,
      seconds
    );

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(value).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
}

// Normalize strings for lookup
function normalizeText(text: any): string {
  if (!text) return '';
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

export const processShareManagementExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel file (.xlsx or .xls)' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: 'Excel file has no sheets' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'Excel sheet is empty' });
    }

    // Locate header row dynamically
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;
      const joined = row.map((cell) => String(cell).toLowerCase().trim()).join(' ');
      if (
        (joined.includes('service') || joined.includes('patient') || joined.includes('bill')) &&
        (joined.includes('sno') || joined.includes('sr') || joined.includes('rate') || joined.includes('group'))
      ) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
    }

    const headers = rawRows[headerRowIndex].map((h) => String(h || '').trim());

    // Map column names to index
    const colIndex: { [key: string]: number } = {};
    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().trim();
      if (lower === 'sno' || lower === 's.no' || lower === 's.no.' || lower === 'sr no' || lower === 'sr. no.') {
        colIndex['sNo'] = idx;
      } else if (lower.includes('billing group') || lower === 'group') {
        colIndex['billingGroup'] = idx;
      } else if (lower.includes('bill/service date') || lower.includes('service date') || lower.includes('bill date')) {
        colIndex['billDate'] = idx;
      } else if (lower === 'bill no.' || lower === 'bill no' || lower.includes('bill no')) {
        colIndex['billNo'] = idx;
      } else if (lower.includes('visit id') || lower === 'visitid') {
        colIndex['visitId'] = idx;
      } else if (lower.includes('patient name') || lower === 'patient') {
        colIndex['patientName'] = idx;
      } else if (lower.includes('service name') || lower.includes('test name') || lower === 'service') {
        colIndex['serviceName'] = idx;
      } else if (lower === 'qty' || lower === 'quantity') {
        colIndex['qty'] = idx;
      } else if (lower === 'total amt' || lower === 'total amount' || lower === 'gross amt') {
        colIndex['totalAmt'] = idx;
      } else if (lower === 'disc amt' || lower === 'discount amt' || lower === 'disc') {
        colIndex['discAmt'] = idx;
      } else if (lower === 'net amt' || lower === 'net amount') {
        colIndex['netAmt'] = idx;
      } else if (lower === 'rate') {
        colIndex['rate'] = idx;
      } else if (lower === '%' || lower === 'percentage') {
        colIndex['percent'] = idx;
      }
    });

    if (colIndex['serviceName'] === undefined) {
      return res.status(400).json({
        error: `Could not find 'Service Name' header. Detected headers: ${headers.filter(Boolean).join(', ')}`,
      });
    }

    // Load Master Rates into lookup map
    const masterRates = store.findAllMasterRates();
    const rateMap = new Map<string, { masterRate: number; vedaPct: number; sodaniPct: number }>();
    masterRates.forEach((mr) => {
      const vedaPct = Math.min(100, Math.max(0, Number(mr.vedaSharePercent) || 0));
      const sodaniPct = Math.max(0, 100 - vedaPct);
      rateMap.set(normalizeText(mr.serviceName), {
        masterRate: mr.masterRate,
        vedaPct,
        sodaniPct,
      });
    });

    const processedRows: any[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let itemRowCounter = 0;

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawServiceName = row[colIndex['serviceName']];
      if (!rawServiceName || String(rawServiceName).trim() === '') continue;

      const serviceName = String(rawServiceName).trim();
      itemRowCounter++;

      const rawSNo = colIndex['sNo'] !== undefined ? row[colIndex['sNo']] : undefined;
      const sNo = rawSNo !== undefined && rawSNo !== null && String(rawSNo).trim() !== ''
        ? (isNaN(Number(rawSNo)) ? String(rawSNo).trim() : Number(rawSNo))
        : itemRowCounter;

      const billingGroup = colIndex['billingGroup'] !== undefined ? String(row[colIndex['billingGroup']] || '').trim() : '';
      const rawDate = colIndex['billDate'] !== undefined ? row[colIndex['billDate']] : undefined;
      const billServiceDate = formatExcelDate(rawDate);
      const billNo = colIndex['billNo'] !== undefined ? String(row[colIndex['billNo']] || '').trim() : '';
      const visitId = colIndex['visitId'] !== undefined ? String(row[colIndex['visitId']] || '').trim() : '';
      const patientName = colIndex['patientName'] !== undefined ? String(row[colIndex['patientName']] || '').trim() : '';
      const qty = colIndex['qty'] !== undefined ? Number(row[colIndex['qty']]) || 1 : 1;
      const totalAmt = colIndex['totalAmt'] !== undefined ? Number(row[colIndex['totalAmt']]) || 0 : 0;
      const discAmt = colIndex['discAmt'] !== undefined ? Number(row[colIndex['discAmt']]) || 0 : 0;
      const netAmt = colIndex['netAmt'] !== undefined ? Number(row[colIndex['netAmt']]) || (totalAmt - discAmt) : 0;

      // Match with Master Rate database
      const normService = normalizeText(serviceName);
      const matched = rateMap.get(normService);

      if (matched && matched.masterRate > 0) {
        matchedCount++;
        const masterRate = matched.masterRate;
        const vedaSharePercent = Math.min(100, Math.max(0, matched.vedaPct));
        // Sodani Share % = 100% - Veda Share %
        const sodaniSharePercent = Math.max(0, 100 - vedaSharePercent);

        // Formula: Master Amount = Rate × Qty
        const masterAmount = Math.round(masterRate * qty * 100) / 100;
        // Formula: Veda Share Amount = Master Amount × Veda % / 100
        const vedaShare = Math.round(((masterAmount * vedaSharePercent) / 100) * 100) / 100;
        // Formula: Sodani Share Amount = Master Amount × Sodani % / 100
        const sodaniShare = Math.round(((masterAmount * sodaniSharePercent) / 100) * 100) / 100;

        // Display both percentages clearly: Veda: 60% | Sodani: 40%
        const displayPercent = `Veda: ${vedaSharePercent}% | Sodani: ${sodaniSharePercent}%`;

        processedRows.push({
          sNo,
          billingGroup,
          billServiceDate,
          billNo,
          visitId,
          patientName,
          serviceName,
          qty,
          totalAmt,
          discAmt,
          netAmt,
          rate: masterRate,
          percent: displayPercent,
          vedaShare,
          sodaniShare,
          vedaSharePercent,
          sodaniSharePercent,
          isMatched: true,
          statusText: 'Matched',
        });
      } else {
        unmatchedCount++;
        // If not found in Master Rate:
        processedRows.push({
          sNo,
          billingGroup,
          billServiceDate,
          billNo,
          visitId,
          patientName,
          serviceName,
          qty,
          totalAmt,
          discAmt,
          netAmt,
          rate: null,
          percent: '-',
          vedaShare: null,
          sodaniShare: null,
          vedaSharePercent: 0,
          sodaniSharePercent: 0,
          isMatched: false,
          statusText: 'Rate Not Found',
        });
      }
    }

    return res.json({
      fileName: req.file.originalname,
      totalRecords: processedRows.length,
      matchedCount,
      unmatchedCount,
      rows: processedRows,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error processing Excel file' });
  }
};
