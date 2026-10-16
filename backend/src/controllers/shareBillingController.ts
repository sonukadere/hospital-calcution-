import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { store } from '../store/inMemoryStore';

// Format Excel serial date to readable string
function formatExcelDate(value: any): { formatted: string; date?: Date } {
  if (!value) return { formatted: '' };

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

    return { formatted: `${day}/${month}/${year}`, date };
  }

  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return { formatted: `${day}/${month}/${year}`, date: value };
  }

  const str = String(value).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return { formatted: `${day}/${month}/${year}`, date: parsed };
  }

  return { formatted: str };
}

// Extract Month Name and Month Key
function extractMonthInfo(
  date?: Date,
  dateStr?: string,
  filename?: string,
  userMonth?: string
): { monthName: string; monthKey: string } {
  if (userMonth && userMonth.trim() !== '') {
    const cleaned = userMonth.trim();
    if (/^\d{4}-\d{2}$/.test(cleaned)) {
      const [y, m] = cleaned.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return {
        monthName: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        monthKey: cleaned,
      };
    }
    return {
      monthName: cleaned,
      monthKey: cleaned.toLowerCase().replace(/\s+/g, '-'),
    };
  }

  if (date instanceof Date && !isNaN(date.getTime())) {
    const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return { monthName, monthKey: `${y}-${m}` };
  }

  if (dateStr) {
    const parts = dateStr.split(/[/.-]/);
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12 && y >= 2000) {
        const dt = new Date(y, m - 1, d || 1);
        const monthName = dt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return { monthName, monthKey: `${y}-${String(m).padStart(2, '0')}` };
      }
    }
  }

  if (filename) {
    const matchMmYy = filename.match(/(\d{1,2})[-_](\d{2,4})/);
    if (matchMmYy) {
      let m = parseInt(matchMmYy[1], 10);
      let y = parseInt(matchMmYy[2], 10);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12) {
        const dt = new Date(y, m - 1, 1);
        return {
          monthName: dt.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          monthKey: `${y}-${String(m).padStart(2, '0')}`,
        };
      }
    }
  }

  const now = new Date();
  return {
    monthName: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

// Normalize strings for matching
function normalizeText(text: any): string {
  if (!text) return '';
  return String(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Upload & Process Excel File with Monthly Segregation (In-Memory)
export const uploadAndProcessExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel file (.xlsx or .xls)' });
    }

    const { targetMonth, replaceMode = 'month' } = req.body;

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
      } else if (lower.includes('veda share')) {
        colIndex['vedaShare'] = idx;
      } else if (lower.includes('sodani share')) {
        colIndex['sodaniShare'] = idx;
      }
    });

    if (colIndex['serviceName'] === undefined) {
      return res.status(400).json({
        error: `Could not find 'Service Name' header. Detected headers: ${headers.filter(Boolean).join(', ')}`,
      });
    }

    // Load all master rates from in-memory store into lookup map
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

    const recordsToInsert: any[] = [];
    const skippedServicesSet = new Set<string>();
    let matchedCount = 0;
    let skippedCount = 0;

    const monthFrequencyMap = new Map<string, { count: number; name: string }>();

    let itemRowIndex = 0;

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawServiceName = row[colIndex['serviceName']];
      if (!rawServiceName || String(rawServiceName).trim() === '') continue;

      const serviceName = String(rawServiceName).trim();
      const rawSNo = colIndex['sNo'] !== undefined ? row[colIndex['sNo']] : undefined;
      itemRowIndex++;
      const sNo = rawSNo !== undefined && rawSNo !== null && String(rawSNo).trim() !== ''
        ? (isNaN(Number(rawSNo)) ? String(rawSNo).trim() : Number(rawSNo))
        : itemRowIndex;
      const billingGroup = colIndex['billingGroup'] !== undefined ? String(row[colIndex['billingGroup']] || '').trim() : '';
      const rawDate = colIndex['billDate'] !== undefined ? row[colIndex['billDate']] : undefined;
      const { formatted: billServiceDate, date: billDateRaw } = formatExcelDate(rawDate);

      const { monthName, monthKey } = extractMonthInfo(
        billDateRaw,
        billServiceDate,
        req.file!.originalname,
        targetMonth
      );

      const existingCount = monthFrequencyMap.get(monthKey)?.count || 0;
      monthFrequencyMap.set(monthKey, { count: existingCount + 1, name: monthName });

      const billNo = colIndex['billNo'] !== undefined ? String(row[colIndex['billNo']] || '').trim() : '';
      const visitId = colIndex['visitId'] !== undefined ? String(row[colIndex['visitId']] || '').trim() : '';
      const patientName = colIndex['patientName'] !== undefined ? String(row[colIndex['patientName']] || '').trim() : '';
      const qty = colIndex['qty'] !== undefined ? Number(row[colIndex['qty']]) || 1 : 1;
      const totalAmt = colIndex['totalAmt'] !== undefined ? Number(row[colIndex['totalAmt']]) || 0 : 0;
      const discAmt = colIndex['discAmt'] !== undefined ? Number(row[colIndex['discAmt']]) || 0 : 0;
      const netAmt = colIndex['netAmt'] !== undefined ? Number(row[colIndex['netAmt']]) || (totalAmt - discAmt) : 0;
      const rate = colIndex['rate'] !== undefined ? Number(row[colIndex['rate']]) || 0 : 0;

      // Match with Master Rate
      const normService = normalizeText(serviceName);
      const matchedRate = rateMap.get(normService);

      let masterRate = 0;
      let vedaSharePercent = 0;
      let sodaniSharePercent = 0;
      let masterAmount = 0;
      let vedaShare = 0;
      let sodaniShare = 0;
      let percent = 'Unmatched (0%)';
      let isMatched = false;

      if (matchedRate && matchedRate.masterRate && matchedRate.masterRate > 0) {
        masterRate = matchedRate.masterRate;
        vedaSharePercent = Math.min(100, Math.max(0, matchedRate.vedaPct));
        sodaniSharePercent = Math.max(0, 100 - vedaSharePercent);
        masterAmount = Math.round(masterRate * qty * 100) / 100;
        vedaShare = Math.round(((masterAmount * vedaSharePercent) / 100) * 100) / 100;
        sodaniShare = Math.round(((masterAmount * sodaniSharePercent) / 100) * 100) / 100;
        percent = `Veda: ${vedaSharePercent}% | Sodani: ${sodaniSharePercent}%`;
        isMatched = true;
        matchedCount++;
      } else {
        skippedCount++;
        skippedServicesSet.add(serviceName);
      }

      recordsToInsert.push({
        sNo,
        rowIndex: itemRowIndex,
        billingGroup,
        billServiceDate,
        billDateRaw,
        billNo,
        visitId,
        patientName,
        serviceName,
        qty,
        totalAmt,
        discAmt,
        netAmt,
        rate: masterRate > 0 ? masterRate : rate,
        percent,
        masterRate,
        masterAmount,
        vedaSharePercent,
        sodaniSharePercent,
        vedaShare,
        sodaniShare,
        isMatched,
        billingMonth: monthName,
        billingMonthKey: monthKey,
        batchName: req.file!.originalname,
        batchId: 'default',
      });
    }

    const uploadedMonthKeys = Array.from(monthFrequencyMap.keys());

    // Handle replacement modes (in-memory)
    if (replaceMode === 'all') {
      store.clearAllBillingRecords();
    } else if (replaceMode === 'month' && uploadedMonthKeys.length > 0) {
      store.deleteBillingByMonthKeys(uploadedMonthKeys);
    }

    if (recordsToInsert.length > 0) {
      store.insertBillingRecords(recordsToInsert);
    }

    return res.json({
      message: 'Monthly Excel processing completed successfully',
      totalProcessed: recordsToInsert.length,
      matchedCount,
      skippedCount,
      skippedServices: Array.from(skippedServicesSet),
      detectedMonths: Array.from(monthFrequencyMap.entries()).map(([key, val]) => ({
        monthKey: key,
        monthName: val.name,
        recordCount: val.count,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error processing Excel file' });
  }
};

// Query Processed Billing Records with Monthly filtering & statistics (In-Memory)
export const getBillingRecords = async (req: Request, res: Response) => {
  try {
    const {
      search,
      billingGroup,
      monthKey,
      isMatched,
      category,
      page = 1,
      limit = 50,
      sortBy = 'rowIndex',
      sortOrder = 'asc',
    } = req.query;

    const result = store.findBillingRecords({
      search: search as string,
      billingGroup: billingGroup as string,
      monthKey: monthKey as string,
      isMatched: isMatched as string,
      category: category as string,
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 50,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching billing records' });
  }
};

// Recalculate all billing records against current Master Rates (In-Memory)
export const recalculateAllBilling = async (_req: Request, res: Response) => {
  try {
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

    const allRecords = store.getAllBillingRecords();
    let matchedCount = 0;
    let unmatchedCount = 0;

    allRecords.forEach((rec) => {
      const normService = normalizeText(rec.serviceName);
      const matched = rateMap.get(normService);

      if (matched && matched.masterRate > 0) {
        matchedCount++;
        const qty = rec.qty || 1;
        const vedaPct = Math.min(100, Math.max(0, matched.vedaPct));
        const sodaniPct = Math.max(0, 100 - vedaPct);
        const masterAmount = Math.round(matched.masterRate * qty * 100) / 100;
        const vedaShare = Math.round(((masterAmount * vedaPct) / 100) * 100) / 100;
        const sodaniShare = Math.round(((masterAmount * sodaniPct) / 100) * 100) / 100;
        const percent = `Veda: ${vedaPct}% | Sodani: ${sodaniPct}%`;

        rec.rate = matched.masterRate;
        store.updateBillingRecordsForService(rec.serviceName, matched.masterRate, vedaPct, sodaniPct);
      } else {
        unmatchedCount++;
        rec.rate = 0;
        rec.masterRate = 0;
        rec.masterAmount = 0;
        rec.vedaSharePercent = 0;
        rec.sodaniSharePercent = 0;
        rec.vedaShare = 0;
        rec.sodaniShare = 0;
        rec.percent = 'Unmatched (0%)';
        rec.isMatched = false;
      }
    });

    return res.json({
      message: 'Recalculation completed successfully',
      totalRecords: allRecords.length,
      matchedCount,
      unmatchedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error recalculating billing shares' });
  }
};

/**
 * Center-align all columns, cells and headers in the generated Excel workbook buffer
 * by updating OpenXML styles.xml and worksheet cell/col styles.
 */
function applyCenterAlignmentToExcel(rawBuffer: Buffer): Buffer {
  try {
    const cfb = (xlsx as any).CFB.read(rawBuffer, { type: 'buffer' });
    if (!cfb || !cfb.FileIndex || !cfb.FullPaths) return rawBuffer;

    // 1. Locate styles.xml
    let stylesFileIndex = -1;
    for (let i = 0; i < cfb.FileIndex.length; i++) {
      const fullPath = (cfb.FullPaths[i] || '').toLowerCase();
      const name = (cfb.FileIndex[i]?.name || '').toLowerCase();
      if (name === 'styles.xml' || fullPath.endsWith('styles.xml')) {
        stylesFileIndex = i;
        break;
      }
    }

    if (stylesFileIndex === -1) return rawBuffer;

    const stylesEntry = cfb.FileIndex[stylesFileIndex];
    let stylesXml = Buffer.isBuffer(stylesEntry.content)
      ? stylesEntry.content.toString('utf8')
      : String(stylesEntry.content || '');

    const cellXfsRegex = /<cellXfs\s+count="(\d+)">([\s\S]*?)<\/cellXfs>/;
    const match = stylesXml.match(cellXfsRegex);
    if (!match) return rawBuffer;

    const currentCount = parseInt(match[1], 10);
    const centerStyleIndex = currentCount; // New style is at index currentCount
    const newXf = `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`;

    stylesXml = stylesXml.replace(cellXfsRegex, `<cellXfs count="${currentCount + 1}">$2${newXf}</cellXfs>`);
    stylesEntry.content = Buffer.from(stylesXml, 'utf8');
    stylesEntry.size = stylesEntry.content.length;

    // Match all cells in all columns (e.g. A1, G2, I5, N10, etc.)
    const cellRegex = /<c\s+r="([A-Z]+\d+)"([^>]*?)(\/?)>/g;

    // 2. Modify all worksheet XML files
    for (let i = 0; i < cfb.FileIndex.length; i++) {
      const fullPath = (cfb.FullPaths[i] || '').toLowerCase();
      const name = (cfb.FileIndex[i]?.name || '').toLowerCase();
      if (fullPath.includes('worksheets') && (name.endsWith('.xml') || fullPath.endsWith('.xml'))) {
        const sheetEntry = cfb.FileIndex[i];
        let sheetXml = Buffer.isBuffer(sheetEntry.content)
          ? sheetEntry.content.toString('utf8')
          : String(sheetEntry.content || '');

        // Update all cells with center style index
        sheetXml = sheetXml.replace(cellRegex, (fullMatch: string, ref: string, rest: string, slash: string) => {
          if (/ s="\d+"/.test(rest)) {
            return fullMatch.replace(/ s="\d+"/, ` s="${centerStyleIndex}"`);
          } else {
            return `<c r="${ref}" s="${centerStyleIndex}"${rest}${slash ? '/>' : '>'}`;
          }
        });

        // Also update column definitions to center
        sheetXml = sheetXml.replace(/<col\s+([^>]*?)(\/?)>/g, (fullMatch: string, rest: string, slash: string) => {
          if (/ style="\d+"/.test(rest)) {
            return fullMatch.replace(/ style="\d+"/, ` style="${centerStyleIndex}"`);
          } else {
            return `<col style="${centerStyleIndex}" ${rest}${slash ? '/>' : '>'}`;
          }
        });

        sheetEntry.content = Buffer.from(sheetXml, 'utf8');
        sheetEntry.size = sheetEntry.content.length;
      }
    }

    const modifiedBuffer = (xlsx as any).CFB.write(cfb, { type: 'buffer', fileType: 'zip' });
    return Buffer.isBuffer(modifiedBuffer) ? modifiedBuffer : Buffer.from(modifiedBuffer);
  } catch (err) {
    console.error('applyCenterAlignmentToExcel error:', err);
    return rawBuffer;
  }
}

// Export records to Excel (.xlsx) (In-Memory)
export const exportBillingExcel = async (req: Request, res: Response) => {
  try {
    const { billingGroup, isMatched, search, category, monthKey } = req.query;

    const records = store.getBillingRecordsForExport({
      search: search as string,
      billingGroup: billingGroup as string,
      monthKey: monthKey as string,
      isMatched: isMatched as string,
      category: category as string,
    });

    const columnWidths = [
      { wch: 8 },  // SNo
      { wch: 22 }, // Billing Group
      { wch: 18 }, // Bill/Service Date
      { wch: 18 }, // Bill No.
      { wch: 18 }, // Visit ID
      { wch: 26 }, // Patient Name
      { wch: 34 }, // Service Name
      { wch: 8 },  // Qty
      { wch: 14 }, // Total Amt
      { wch: 12 }, // Disc Amt
      { wch: 14 }, // Net Amt
      { wch: 12 }, // Rate
      { wch: 30 }, // %
      { wch: 16 }, // Veda Share
      { wch: 16 }, // Sodani Share
    ];

    const buildSheetData = (recs: typeof records) => {
      let totalQty = 0;
      let totalGross = 0;
      let totalDisc = 0;
      let totalNet = 0;
      let totalVeda = 0;
      let totalSodani = 0;

      const rows: any[] = recs.map((rec) => {
        totalQty += Number(rec.qty) || 0;
        totalGross += Number(rec.totalAmt) || 0;
        totalDisc += Number(rec.discAmt) || 0;
        totalNet += Number(rec.netAmt) || 0;
        totalVeda += Number(rec.vedaShare) || 0;
        totalSodani += Number(rec.sodaniShare) || 0;

        return {
          'SNo': rec.sNo,
          'Billing Group': rec.billingGroup,
          'Bill/Service Date': rec.billServiceDate,
          'Bill No.': rec.billNo,
          'Visit ID': rec.visitId,
          'Patient Name': rec.patientName,
          'Service Name': rec.serviceName,
          'Qty': rec.qty,
          'Total Amt': rec.totalAmt,
          'Disc Amt': rec.discAmt,
          'Net Amt': rec.netAmt,
          'Rate': rec.rate || rec.masterRate || '',
          '%': rec.percent,
          'Veda Share': rec.vedaShare,
          'Sodani Share': rec.sodaniShare,
        };
      });

      rows.push({
        'SNo': 'TOTAL',
        'Billing Group': '',
        'Bill/Service Date': '',
        'Bill No.': '',
        'Visit ID': '',
        'Patient Name': 'GRAND TOTAL',
        'Service Name': `${recs.length} Bills / Items`,
        'Qty': Math.round(totalQty * 100) / 100,
        'Total Amt': Math.round(totalGross * 100) / 100,
        'Disc Amt': Math.round(totalDisc * 100) / 100,
        'Net Amt': Math.round(totalNet * 100) / 100,
        'Rate': '',
        '%': '',
        'Veda Share': Math.round(totalVeda * 100) / 100,
        'Sodani Share': Math.round(totalSodani * 100) / 100,
      });

      return rows;
    };

    const workbook = xlsx.utils.book_new();
    let filename = '';

    if (monthKey && monthKey !== 'ALL') {
      const monthName = records[0]?.billingMonth || String(monthKey || 'Month');
      const sheetName = monthName.replace(/[\/\\?*:[\]]/g, '').substring(0, 31);
      const sheetData = buildSheetData(records);
      const worksheet = xlsx.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = columnWidths;
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

      filename = `Billing_Share_${monthName.replace(/[\s/\\?%*:|"<>]/g, '_')}.xlsx`;
    } else {
      const allSheetData = buildSheetData(records);
      const allWorksheet = xlsx.utils.json_to_sheet(allSheetData);
      allWorksheet['!cols'] = columnWidths;
      xlsx.utils.book_append_sheet(workbook, allWorksheet, 'All Combined');

      const monthGroups = new Map<string, typeof records>();
      records.forEach((r) => {
        const m = r.billingMonth || 'Other';
        if (!monthGroups.has(m)) monthGroups.set(m, []);
        monthGroups.get(m)!.push(r);
      });

      monthGroups.forEach((mRecords, mName) => {
        const cleanName = mName.replace(/[\/\\?*:[\]]/g, '').substring(0, 31);
        const mSheetData = buildSheetData(mRecords);
        const mWorksheet = xlsx.utils.json_to_sheet(mSheetData);
        mWorksheet['!cols'] = columnWidths;
        xlsx.utils.book_append_sheet(workbook, mWorksheet, cleanName);
      });

      filename = `Billing_Share_All_Months_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }

    const rawBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const buffer = applyCenterAlignmentToExcel(rawBuffer);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error exporting Excel file' });
  }
};

// Clear records for a specific month (In-Memory)
export const deleteMonthRecords = async (req: Request, res: Response) => {
  try {
    const monthKey = req.params.monthKey as string;
    if (!monthKey) {
      return res.status(400).json({ error: 'Month key is required' });
    }

    const deletedCount = store.deleteBillingByMonthKey(monthKey);
    return res.json({
      message: `Records for month ${monthKey} cleared successfully`,
      deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error clearing month records' });
  }
};

// Clear all billing records (In-Memory)
export const clearBillingRecords = async (_req: Request, res: Response) => {
  try {
    const deletedCount = store.clearAllBillingRecords();
    return res.json({
      message: 'All billing share records cleared successfully',
      deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error clearing billing records' });
  }
};

// Get list of distinct unmatched services (In-Memory)
export const getUnmatchedServices = async (_req: Request, res: Response) => {
  try {
    const unmatched = store.getUnmatchedServices();
    return res.json(unmatched);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching unmatched services' });
  }
};
