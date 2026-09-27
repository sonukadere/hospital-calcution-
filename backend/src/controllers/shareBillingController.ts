import { Request, Response } from 'express';
import * as xlsx from 'xlsx';
import { MasterRate, BillingShareRecord } from '../models';

// Format Excel serial date to readable string
function formatExcelDate(value: any): { formatted: string; date?: Date } {
  if (!value) return { formatted: '' };

  if (typeof value === 'number') {
    // Excel serial date to JS Date
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

// Extract Month Name and Month Key (e.g. "August 2026", "2026-08")
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

// Upload & Process Excel File with Monthly Segregation
export const uploadAndProcessExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel file (.xlsx or .xls)' });
    }

    const { targetMonth, replaceMode = 'month' } = req.body;
    // replaceMode can be:
    // - 'month' (default: replaces only records for this file's month)
    // - 'all' (wipes all billing records)
    // - 'append' (appends without deleting previous)

    // Read workbook from buffer
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

    // Load all master rates into lookup map
    const masterRates = await MasterRate.find({});
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

    // Track detected months in the sheet
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

      // Determine month for this record
      const { monthName, monthKey } = extractMonthInfo(
        billDateRaw,
        billServiceDate,
        req.file.originalname,
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

      // Skip record if master rate or share rate is unknown
      if (!matchedRate || !matchedRate.masterRate || matchedRate.masterRate <= 0) {
        skippedCount++;
        skippedServicesSet.add(serviceName);
        continue;
      }

      const masterRate = matchedRate.masterRate;
      const vedaSharePercent = Math.min(100, Math.max(0, matchedRate.vedaPct));
      const sodaniSharePercent = Math.max(0, 100 - vedaSharePercent);

      // Master Amount = Master Rate × Qty
      const masterAmount = Math.round(masterRate * qty * 100) / 100;
      // Veda Share = Master Amount × Veda Share % / 100
      const vedaShare = Math.round(((masterAmount * vedaSharePercent) / 100) * 100) / 100;
      // Sodani Share = Master Amount × Sodani Share % / 100
      const sodaniShare = Math.round(((masterAmount * sodaniSharePercent) / 100) * 100) / 100;
      const percent = `Veda: ${vedaSharePercent}% | Sodani: ${sodaniSharePercent}%`;

      matchedCount++;

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
        rate,
        percent,
        masterRate,
        masterAmount,
        vedaSharePercent,
        sodaniSharePercent,
        vedaShare,
        sodaniShare,
        isMatched: true,
        billingMonth: monthName,
        billingMonthKey: monthKey,
        batchName: req.file.originalname,
      });
    }

    // Determine the distinct month keys in this upload
    const uploadedMonthKeys = Array.from(monthFrequencyMap.keys());

    // Handle replacement modes
    if (replaceMode === 'all') {
      await BillingShareRecord.deleteMany({});
    } else if (replaceMode === 'month' && uploadedMonthKeys.length > 0) {
      // Delete existing records only for the month(s) being uploaded
      await BillingShareRecord.deleteMany({ billingMonthKey: { $in: uploadedMonthKeys } });
    }

    if (recordsToInsert.length > 0) {
      await BillingShareRecord.insertMany(recordsToInsert);
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

// Query Processed Billing Records with Monthly filtering & statistics
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

    const query: any = {};

    if (monthKey && typeof monthKey === 'string' && monthKey !== 'ALL') {
      query.billingMonthKey = monthKey.trim();
    }

    if (search && typeof search === 'string') {
      const trimmed = search.trim();
      query.$or = [
        { patientName: { $regex: trimmed, $options: 'i' } },
        { billNo: { $regex: trimmed, $options: 'i' } },
        { visitId: { $regex: trimmed, $options: 'i' } },
        { serviceName: { $regex: trimmed, $options: 'i' } },
      ];
    }

    if (billingGroup && typeof billingGroup === 'string' && billingGroup !== 'ALL') {
      query.billingGroup = billingGroup.trim();
    }

    if (isMatched !== undefined && isMatched !== '') {
      query.isMatched = isMatched === 'true';
    }

    if (category === 'CT') {
      query.serviceName = { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' };
    } else if (category === 'XRAY') {
      query.serviceName = { $regex: 'X-?RAY', $options: 'i' };
    } else if (category === 'SONO') {
      query.serviceName = { $regex: '(SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' };
    } else if (category === 'PATHOLOGY') {
      query.serviceName = { $not: { $regex: '((^|\\s|/)CT(\\s|/|$)|X-?RAY|SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' } };
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;
    const sortField = sortBy === 'sNo' || sortBy === 'rowIndex' ? 'rowIndex' : (sortBy as string);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const [records, total] = await Promise.all([
      BillingShareRecord.find(query)
        .sort({ [sortField]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limitNum),
      BillingShareRecord.countDocuments(query),
    ]);

    // Aggregate summary stats for the current filter (including month)
    const statsAgg = await BillingShareRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQty: { $sum: '$qty' },
          totalGross: { $sum: '$totalAmt' },
          totalDiscount: { $sum: '$discAmt' },
          totalNet: { $sum: '$netAmt' },
          totalMasterAmount: { $sum: '$masterAmount' },
          totalVedaShare: { $sum: '$vedaShare' },
          totalSodaniShare: { $sum: '$sodaniShare' },
          unmatchedCount: {
            $sum: { $cond: [{ $eq: ['$isMatched', false] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = statsAgg[0] || {
      totalQty: 0,
      totalGross: 0,
      totalDiscount: 0,
      totalNet: 0,
      totalMasterAmount: 0,
      totalVedaShare: 0,
      totalSodaniShare: 0,
      unmatchedCount: 0,
    };

    stats.totalGross = Math.round(stats.totalGross * 100) / 100;
    stats.totalDiscount = Math.round(stats.totalDiscount * 100) / 100;
    stats.totalNet = Math.round(stats.totalNet * 100) / 100;
    stats.totalMasterAmount = Math.round(stats.totalMasterAmount * 100) / 100;
    stats.totalVedaShare = Math.round(stats.totalVedaShare * 100) / 100;
    stats.totalSodaniShare = Math.round(stats.totalSodaniShare * 100) / 100;

    // Modality category counts (scoped to current month filter if set)
    const modalityFilter: any = (typeof monthKey === 'string' && monthKey !== 'ALL') ? { billingMonthKey: monthKey } : {};
    const [allCount, ctCount, xrayCount, sonoCount] = await Promise.all([
      BillingShareRecord.countDocuments(modalityFilter),
      BillingShareRecord.countDocuments({ ...modalityFilter, serviceName: { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' } }),
      BillingShareRecord.countDocuments({ ...modalityFilter, serviceName: { $regex: 'X-?RAY', $options: 'i' } }),
      BillingShareRecord.countDocuments({ ...modalityFilter, serviceName: { $regex: '(SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' } }),
    ]);

    const modalityCounts = {
      all: allCount,
      ct: ctCount,
      xray: xrayCount,
      sono: sonoCount,
      pathology: Math.max(0, allCount - ctCount - xrayCount - sonoCount),
    };

    // Aggregate all available months in DB with record counts and share totals
    const monthsAgg = await BillingShareRecord.aggregate([
      {
        $group: {
          _id: {
            monthKey: { $ifNull: ['$billingMonthKey', 'unknown'] },
            monthName: { $ifNull: ['$billingMonth', 'Unknown Month'] },
          },
          count: { $sum: 1 },
          totalNet: { $sum: '$netAmt' },
          totalVeda: { $sum: '$vedaShare' },
          totalSodani: { $sum: '$sodaniShare' },
        },
      },
      { $sort: { '_id.monthKey': -1 } },
    ]);

    const availableMonths = monthsAgg.map((m) => ({
      monthKey: m._id.monthKey,
      monthName: m._id.monthName,
      count: m.count,
      totalNet: Math.round(m.totalNet * 100) / 100,
      totalVeda: Math.round(m.totalVeda * 100) / 100,
      totalSodani: Math.round(m.totalSodani * 100) / 100,
    }));

    // Billing groups list for filtering
    const billingGroups = await BillingShareRecord.distinct('billingGroup', modalityFilter);

    return res.json({
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      stats,
      billingGroups: billingGroups.filter(Boolean),
      availableMonths,
      modalityCounts,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching billing records' });
  }
};

// Recalculate all billing records against current Master Rates
export const recalculateAllBilling = async (_req: Request, res: Response) => {
  try {
    const masterRates = await MasterRate.find({});
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

    const allRecords = await BillingShareRecord.find({});
    let matchedCount = 0;
    let unmatchedCount = 0;

    const bulkOps = allRecords.map((rec) => {
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

        return {
          updateOne: {
            filter: { _id: rec._id },
            update: {
              $set: {
                masterRate: matched.masterRate,
                masterAmount,
                vedaSharePercent: vedaPct,
                sodaniSharePercent: sodaniPct,
                percent,
                vedaShare,
                sodaniShare,
                isMatched: true,
              },
            },
          },
        };
      } else {
        unmatchedCount++;
        return {
          deleteOne: {
            filter: { _id: rec._id },
          },
        };
      }
    });

    if (bulkOps.length > 0) {
      await BillingShareRecord.bulkWrite(bulkOps);
    }

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

// Export records to Excel (.xlsx) with the 15 required fields & optional Month scoping
export const exportBillingExcel = async (req: Request, res: Response) => {
  try {
    const { billingGroup, isMatched, search, category, monthKey } = req.query;
    const query: any = {};

    if (monthKey && typeof monthKey === 'string' && monthKey !== 'ALL') {
      query.billingMonthKey = monthKey.trim();
    }

    if (search && typeof search === 'string') {
      const trimmed = search.trim();
      query.$or = [
        { patientName: { $regex: trimmed, $options: 'i' } },
        { billNo: { $regex: trimmed, $options: 'i' } },
        { visitId: { $regex: trimmed, $options: 'i' } },
        { serviceName: { $regex: trimmed, $options: 'i' } },
      ];
    }

    if (billingGroup && typeof billingGroup === 'string' && billingGroup !== 'ALL') {
      query.billingGroup = billingGroup.trim();
    }

    if (isMatched !== undefined && isMatched !== '') {
      query.isMatched = isMatched === 'true';
    }

    if (category === 'CT') {
      query.serviceName = { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' };
    } else if (category === 'XRAY') {
      query.serviceName = { $regex: 'X-?RAY', $options: 'i' };
    } else if (category === 'SONO') {
      query.serviceName = { $regex: '(SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' };
    } else if (category === 'PATHOLOGY') {
      query.serviceName = { $not: { $regex: '((^|\\s|/)CT(\\s|/|$)|X-?RAY|SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' } };
    }

    const records = await BillingShareRecord.find(query).sort({ rowIndex: 1, _id: 1 });

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
      { wch: 10 }, // %
      { wch: 16 }, // Veda Share
      { wch: 16 }, // Sodani Share
    ];

    // Helper to format rows and append grand total row
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
          'Rate': rec.rate,
          '%': rec.percent,
          'Veda Share': rec.vedaShare,
          'Sodani Share': rec.sodaniShare,
        };
      });

      // Append Total Row
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
      // Single month export
      const monthName = records[0]?.billingMonth || String(monthKey || 'Month');
      const sheetName = monthName.replace(/[\/\\?*:[\]]/g, '').substring(0, 31);
      const sheetData = buildSheetData(records);
      const worksheet = xlsx.utils.json_to_sheet(sheetData);
      worksheet['!cols'] = columnWidths;
      xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

      filename = `Billing_Share_${monthName.replace(/[\s/\\?%*:|"<>]/g, '_')}.xlsx`;
    } else {
      // Multi-sheet workbook: All Combined + individual monthly sheets
      const allSheetData = buildSheetData(records);
      const allWorksheet = xlsx.utils.json_to_sheet(allSheetData);
      allWorksheet['!cols'] = columnWidths;
      xlsx.utils.book_append_sheet(workbook, allWorksheet, 'All Combined');

      // Group records by billingMonth
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

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error exporting Excel file' });
  }
};

// Clear records for a specific month
export const deleteMonthRecords = async (req: Request, res: Response) => {
  try {
    const { monthKey } = req.params;
    if (!monthKey) {
      return res.status(400).json({ error: 'Month key is required' });
    }

    const result = await BillingShareRecord.deleteMany({ billingMonthKey: monthKey });
    return res.json({
      message: `Records for month ${monthKey} cleared successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error clearing month records' });
  }
};

// Clear all billing records
export const clearBillingRecords = async (_req: Request, res: Response) => {
  try {
    const result = await BillingShareRecord.deleteMany({});
    return res.json({
      message: 'All billing share records cleared successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error clearing billing records' });
  }
};

// Get list of distinct unmatched services
export const getUnmatchedServices = async (_req: Request, res: Response) => {
  try {
    const unmatched = await BillingShareRecord.aggregate([
      { $match: { isMatched: false } },
      {
        $group: {
          _id: '$serviceName',
          count: { $sum: 1 },
          sampleRate: { $first: '$rate' },
          sampleQty: { $sum: '$qty' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return res.json(
      unmatched.map((u) => ({
        serviceName: u._id,
        occurrenceCount: u.count,
        sampleRate: u.sampleRate,
        totalQty: u.sampleQty,
      }))
    );
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching unmatched services' });
  }
};
