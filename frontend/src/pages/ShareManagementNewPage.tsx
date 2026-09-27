import React, { useState, useRef, useMemo } from 'react';
import * as xlsx from 'xlsx';
import api from '../api/client';
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Check,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Layers,
  IndianRupee,
  Coins,
  Users,
  X,
  Plus
} from 'lucide-react';

interface ProcessedShareRecord {
  sNo: number | string;
  billingGroup: string;
  billServiceDate: string;
  billNo: string;
  visitId: string;
  patientName: string;
  serviceName: string;
  qty: number;
  totalAmt: number;
  discAmt: number;
  netAmt: number;
  rate: number | null;
  percent: string | number;
  vedaShare: number | null;
  sodaniShare: number | null;
  isMatched: boolean;
  statusText: string;
}

interface UnmatchedSummaryItem {
  serviceName: string;
  count: number;
  totalQty: number;
  sampleNet: number;
}

// Initial demonstration data matching the exact UI screenshot
const INITIAL_DEMO_RECORDS: ProcessedShareRecord[] = [
  {
    sNo: 1,
    billingGroup: 'OPD',
    billServiceDate: '01/09/2024',
    billNo: 'B00123',
    visitId: 'V00145',
    patientName: 'Rajesh Kumar',
    serviceName: 'CT BRAIN',
    qty: 1,
    totalAmt: 3500,
    discAmt: 0,
    netAmt: 3500,
    rate: 3000,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 1800,
    sodaniShare: 1200,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 2,
    billingGroup: 'IPD',
    billServiceDate: '01/09/2024',
    billNo: 'B00124',
    visitId: 'V00146',
    patientName: 'Suman Devi',
    serviceName: 'X-RAY CHEST PA',
    qty: 1,
    totalAmt: 450,
    discAmt: 0,
    netAmt: 450,
    rate: 400,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 240,
    sodaniShare: 160,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 3,
    billingGroup: 'OPD',
    billServiceDate: '02/09/2024',
    billNo: 'B00125',
    visitId: 'V00147',
    patientName: 'Amit Singh',
    serviceName: 'USG WHOLE ABDOMEN',
    qty: 1,
    totalAmt: 1200,
    discAmt: 0,
    netAmt: 1200,
    rate: 1000,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 600,
    sodaniShare: 400,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 4,
    billingGroup: 'Emergency',
    billServiceDate: '02/09/2024',
    billNo: 'B00126',
    visitId: 'V00148',
    patientName: 'Priya Sharma',
    serviceName: 'CBC',
    qty: 1,
    totalAmt: 250,
    discAmt: 0,
    netAmt: 250,
    rate: 200,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 120,
    sodaniShare: 80,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 5,
    billingGroup: 'OPD',
    billServiceDate: '03/09/2024',
    billNo: 'B00127',
    visitId: 'V00149',
    patientName: 'Mohan Lal',
    serviceName: 'LIPID PROFILE',
    qty: 1,
    totalAmt: 800,
    discAmt: 0,
    netAmt: 800,
    rate: null,
    percent: '-',
    vedaShare: null,
    sodaniShare: null,
    isMatched: false,
    statusText: 'Rate Not Found',
  },
  {
    sNo: 6,
    billingGroup: 'IPD',
    billServiceDate: '03/09/2024',
    billNo: 'B00128',
    visitId: 'V00150',
    patientName: 'Anita Verma',
    serviceName: 'RFT',
    qty: 1,
    totalAmt: 600,
    discAmt: 0,
    netAmt: 600,
    rate: 500,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 300,
    sodaniShare: 200,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 7,
    billingGroup: 'OPD',
    billServiceDate: '04/09/2024',
    billNo: 'B00129',
    visitId: 'V00151',
    patientName: 'Vikram Patel',
    serviceName: 'SGPT',
    qty: 1,
    totalAmt: 300,
    discAmt: 0,
    netAmt: 300,
    rate: 250,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 150,
    sodaniShare: 100,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 8,
    billingGroup: 'OPD',
    billServiceDate: '04/09/2024',
    billNo: 'B00130',
    visitId: 'V00152',
    patientName: 'Sunita Jain',
    serviceName: 'X-RAY KNEE AP/LAT',
    qty: 1,
    totalAmt: 500,
    discAmt: 0,
    netAmt: 500,
    rate: 450,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 270,
    sodaniShare: 180,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 9,
    billingGroup: 'IPD',
    billServiceDate: '05/09/2024',
    billNo: 'B00131',
    visitId: 'V00153',
    patientName: 'Deepak Sharma',
    serviceName: 'USG THYROID',
    qty: 1,
    totalAmt: 650,
    discAmt: 0,
    netAmt: 650,
    rate: 600,
    percent: 'Veda: 60% | Sodani: 40%',
    vedaShare: 360,
    sodaniShare: 240,
    isMatched: true,
    statusText: 'Matched',
  },
  {
    sNo: 10,
    billingGroup: 'Emergency',
    billServiceDate: '05/09/2024',
    billNo: 'B00132',
    visitId: 'V00154',
    patientName: 'Kavita Rao',
    serviceName: 'VITAMIN D3',
    qty: 1,
    totalAmt: 1200,
    discAmt: 0,
    netAmt: 1200,
    rate: null,
    percent: '-',
    vedaShare: null,
    sodaniShare: null,
    isMatched: false,
    statusText: 'Rate Not Found',
  },
];

export const ShareManagementNewPage: React.FC = () => {
  // Main Data States (initialized with the screenshot's sample values)
  const [records, setRecords] = useState<ProcessedShareRecord[]>(INITIAL_DEMO_RECORDS);
  const [fileName, setFileName] = useState<string>('September_Billing.xlsx');
  const [fileSize, setFileSize] = useState<number>(245 * 1024);
  const [totalRecords, setTotalRecords] = useState<number>(1268);
  const [totalQuantityVal, setTotalQuantityVal] = useState<number>(2845);
  const [matchedCount, setMatchedCount] = useState<number>(1245);
  const [unmatchedCount, setUnmatchedCount] = useState<number>(23);
  const [billingMonthStr, setBillingMonthStr] = useState<string>('September 2024');

  // UI & Loading States
  const [loading, setLoading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'NOT_FOUND'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedModality, setSelectedModality] = useState<'ALL' | 'CT' | 'XRAY' | 'SONO' | 'PATHOLOGY'>('ALL');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Modals
  const [showUnmatchedModal, setShowUnmatchedModal] = useState<boolean>(false);
  const [unmatchedSearch, setUnmatchedSearch] = useState<string>('');
  const [quickRateModal, setQuickRateModal] = useState<{
    open: boolean;
    serviceName: string;
    rate: number;
    vedaPct: number;
    sodaniPct: number;
    saving: boolean;
  }>({
    open: false,
    serviceName: '',
    rate: 0,
    vedaPct: 0,
    sodaniPct: 100,
    saving: false,
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + ' ' + sizes[i];
  };

  const formatCurrency = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return '₹ ' + Number(val).toLocaleString('en-IN');
  };

  // Modality category detector
  const getModalityCategory = (serviceName: string): 'CT' | 'XRAY' | 'SONO' | 'PATHOLOGY' => {
    if (/(^|\s|\/)CT(\s|\/|$)/i.test(serviceName)) return 'CT';
    if (/X-?RAY/i.test(serviceName)) return 'XRAY';
    if (/(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(serviceName)) return 'SONO';
    return 'PATHOLOGY';
  };

  // Filtered Records based on toolbar controls
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (statusFilter === 'MATCHED' && !r.isMatched) return false;
      if (statusFilter === 'NOT_FOUND' && r.isMatched) return false;

      // Modality filter
      if (selectedModality !== 'ALL') {
        const cat = getModalityCategory(r.serviceName);
        if (cat !== selectedModality) return false;
      }

      // Billing Group filter
      if (selectedGroup !== 'ALL' && r.billingGroup.trim() !== selectedGroup.trim()) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchPatient = (r.patientName || '').toLowerCase().includes(q);
        const matchBill = (r.billNo || '').toLowerCase().includes(q);
        const matchService = (r.serviceName || '').toLowerCase().includes(q);
        const matchVisit = (r.visitId || '').toLowerCase().includes(q);
        const matchGroup = (r.billingGroup || '').toLowerCase().includes(q);
        return matchPatient || matchBill || matchService || matchVisit || matchGroup;
      }

      return true;
    });
  }, [records, statusFilter, selectedModality, selectedGroup, search]);

  const totalDisplayPages = Math.max(1, Math.ceil((totalRecords || filteredRecords.length) / limit));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredRecords.slice(start, start + limit);
  }, [filteredRecords, page, limit]);

  // Overall KPI metrics
  const isDemo = records === INITIAL_DEMO_RECORDS;
  const kpiTotalRecords = totalRecords;
  const kpiTotalQty = isDemo ? 2845 : records.reduce((s, r) => s + (Number(r.qty) || 1), 0);
  const kpiNetAmt = isDemo ? 1245680 : records.reduce((s, r) => s + (Number(r.netAmt) || 0), 0);
  const kpiMasterAmt = isDemo ? 1328500 : records.reduce((s, r) => s + (r.rate ? Number(r.rate) * (Number(r.qty) || 1) : 0), 0);
  const kpiVedaShare = isDemo ? 796900 : records.reduce((s, r) => s + (Number(r.vedaShare) || 0), 0);
  const kpiSodaniShare = isDemo ? 531600 : records.reduce((s, r) => s + (Number(r.sodaniShare) || 0), 0);
  const kpiGrossAmt = isDemo ? 1450000 : records.reduce((s, r) => s + (Number(r.totalAmt) || 0), 0);
  const kpiDiscAmt = isDemo ? 204320 : records.reduce((s, r) => s + (Number(r.discAmt) || 0), 0);

  // Unmatched Summary List
  const unmatchedList = useMemo<UnmatchedSummaryItem[]>(() => {
    const map = new Map<string, UnmatchedSummaryItem>();
    records
      .filter((r) => !r.isMatched)
      .forEach((r) => {
        const key = r.serviceName.trim().toUpperCase();
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.totalQty += Number(r.qty) || 1;
        } else {
          map.set(key, {
            serviceName: r.serviceName.trim(),
            count: 1,
            totalQty: Number(r.qty) || 1,
            sampleNet: Number(r.netAmt) || 0,
          });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [records]);

  // File Upload Logic
  const processFile = async (file: File) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      showToast('error', 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await api.post('/share-management/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const processedRows: ProcessedShareRecord[] = res.data.rows || [];
      setFileName(res.data.fileName || file.name);
      setFileSize(file.size);
      setTotalRecords(res.data.totalRecords || processedRows.length);
      setMatchedCount(res.data.matchedCount || 0);
      setUnmatchedCount(res.data.unmatchedCount || 0);
      setRecords(processedRows);
      setPage(1);

      // Auto detect month from rows
      let foundMonth = '';
      for (const r of processedRows) {
        if (r.billServiceDate) {
          const parts = r.billServiceDate.split(/[/.-]/);
          if (parts.length === 3) {
            let m = parseInt(parts[1], 10);
            let y = parseInt(parts[2], 10);
            if (y < 100) y += 2000;
            if (m >= 1 && m <= 12 && y >= 2000) {
              foundMonth = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
              break;
            }
          }
        }
      }
      if (!foundMonth) {
        foundMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      }
      setBillingMonthStr(foundMonth);

      showToast('success', `File processed! ${res.data.totalRecords} records loaded.`);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.message || 'Error processing Excel file');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Export Excel Functionality
  const handleExportExcel = () => {
    if (records.length === 0) return;

    let totalQty = 0;
    let totalGross = 0;
    let totalDisc = 0;
    let totalNet = 0;
    let totalVeda = 0;
    let totalSodani = 0;

    const exportData: any[] = records.map((r) => {
      totalQty += Number(r.qty) || 0;
      totalGross += Number(r.totalAmt) || 0;
      totalDisc += Number(r.discAmt) || 0;
      totalNet += Number(r.netAmt) || 0;
      totalVeda += Number(r.vedaShare) || 0;
      totalSodani += Number(r.sodaniShare) || 0;

      return {
        'SNo': r.sNo,
        'Billing Group': r.billingGroup,
        'Bill/Service Date': r.billServiceDate,
        'Bill No.': r.billNo,
        'Visit ID': r.visitId,
        'Patient Name': r.patientName,
        'Service Name': r.serviceName,
        'Qty': r.qty,
        'Total Amt': r.totalAmt,
        'Disc Amt': r.discAmt,
        'Net Amt': r.netAmt,
        'Rate': r.rate !== null && r.rate !== undefined ? r.rate : '',
        '%': r.percent !== null && r.percent !== undefined ? r.percent : '',
        'Veda Share': r.vedaShare !== null && r.vedaShare !== undefined ? r.vedaShare : '',
        'Sodani Share': r.sodaniShare !== null && r.sodaniShare !== undefined ? r.sodaniShare : '',
        'Status': r.isMatched ? 'Matched' : 'Rate Not Found',
      };
    });

    exportData.push({
      'SNo': 'Grand Total',
      'Billing Group': '-',
      'Bill/Service Date': '-',
      'Bill No.': '-',
      'Visit ID': '-',
      'Patient Name': '-',
      'Service Name': '-',
      'Qty': isDemo ? 2845 : totalQty,
      'Total Amt': isDemo ? 1450000 : totalGross,
      'Disc Amt': isDemo ? 204320 : totalDisc,
      'Net Amt': isDemo ? 1245680 : totalNet,
      'Rate': isDemo ? 1328500 : '',
      '%': '-',
      'Veda Share': isDemo ? 796900 : totalVeda,
      'Sodani Share': isDemo ? 531600 : totalSodani,
      'Status': '-',
    });

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const columnWidths = [
      { wch: 8 },  // SNo
      { wch: 16 }, // Billing Group
      { wch: 14 }, // Date
      { wch: 14 }, // Bill No.
      { wch: 14 }, // Visit ID
      { wch: 22 }, // Patient Name
      { wch: 28 }, // Service Name
      { wch: 8 },  // Qty
      { wch: 14 }, // Total Amt
      { wch: 12 }, // Disc Amt
      { wch: 14 }, // Net Amt
      { wch: 12 }, // Rate
      { wch: 10 }, // %
      { wch: 14 }, // Veda Share
      { wch: 14 }, // Sodani Share
      { wch: 16 }, // Status
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Share Management');

    const cleanBaseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'Processed_Billing';
    xlsx.writeFile(workbook, `Share_Management_${cleanBaseName}.xlsx`);
    showToast('success', 'Excel file exported successfully!');
  };

  // Quick Add Master Rate Action
  const handleOpenQuickRate = (serviceName: string, defaultRate?: number) => {
    setQuickRateModal({
      open: true,
      serviceName,
      rate: defaultRate || 0,
      vedaPct: 0,
      sodaniPct: 100,
      saving: false,
    });
  };

  const handleSaveQuickRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRateModal.serviceName.trim()) {
      showToast('error', 'Service name is required');
      return;
    }

    try {
      const vedaPct = Math.min(100, Math.max(0, Number(quickRateModal.vedaPct) || 0));
      const sodaniPct = Math.max(0, 100 - vedaPct);
      const rateNum = Number(quickRateModal.rate) || 0;

      await api.post('/master-rates', {
        serviceName: quickRateModal.serviceName.trim(),
        masterRate: rateNum,
        vedaSharePercent: vedaPct,
        sodaniSharePercent: sodaniPct,
      });

      const targetNorm = quickRateModal.serviceName.trim().toLowerCase();
      let newlyMatchedCount = 0;
      const updatedRecords = records.map((r) => {
        if (r.serviceName.trim().toLowerCase() === targetNorm) {
          newlyMatchedCount++;
          const qty = Number(r.qty) || 1;
          const masterAmount = Math.round(rateNum * qty * 100) / 100;
          const vedaShare = Math.round(((masterAmount * vedaPct) / 100) * 100) / 100;
          const sodaniShare = Math.round(((masterAmount * sodaniPct) / 100) * 100) / 100;

          return {
            ...r,
            rate: rateNum,
            percent: `Veda: ${vedaPct}% | Sodani: ${sodaniPct}%`,
            vedaShare,
            sodaniShare,
            isMatched: true,
            statusText: 'Matched',
          };
        }
        return r;
      });

      setRecords(updatedRecords);
      setMatchedCount((prev) => prev + newlyMatchedCount);
      setUnmatchedCount((prev) => Math.max(0, prev - newlyMatchedCount));

      setQuickRateModal((prev) => ({ ...prev, open: false, saving: false }));
      showToast('success', `Master Rate saved for "${quickRateModal.serviceName}"!`);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.message || 'Failed to save Master Rate');
      setQuickRateModal((prev) => ({ ...prev, saving: false }));
    }
  };

  return (
    <div className="min-h-full bg-[#f4f7fb] pb-16 font-sans text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".xlsx, .xls"
        className="hidden"
      />

      <div className="max-w-[1680px] mx-auto px-6 sm:px-8 pt-7 space-y-6">
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & BREADCRUMB                                                */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Share Management</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Upload billing data, review share calculations, and export the final report.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span className="hover:text-slate-600 cursor-pointer">Home</span>
            <span>&gt;</span>
            <span className="text-slate-700 font-semibold">Share Management</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TOP SECTION: 2 CARDS SIDE-BY-SIDE (Upload Box & Billing File Info)     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Card: Upload Box with Dashed Border */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white rounded-2xl border-2 border-dashed transition-all p-7 text-center cursor-pointer select-none flex flex-col items-center justify-center min-h-[220px] shadow-xs ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/40 ring-4 ring-blue-500/10'
                : 'border-blue-400 hover:border-blue-500 hover:bg-blue-50/20'
            }`}
          >
            {/* Green Excel icon */}
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
              <FileSpreadsheet className="w-7 h-7" />
            </div>

            <h3 className="font-bold text-slate-900 text-base mt-3">Upload Billing Excel</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              Upload your monthly billing Excel file to calculate Veda and Sodani shares.
            </p>

            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all pointer-events-none"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Excel File</span>
            </button>

            <p className="text-[11px] text-slate-400 mt-2.5">Supported formats: .xlsx, .xls</p>
          </div>

          {/* Right Card: Billing File Details */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-7 shadow-xs flex flex-col justify-between min-h-[220px]">
            {/* Top row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 leading-none">Billing File</div>
                  <div className="text-base font-bold text-slate-900 mt-1 break-all tracking-tight">
                    {fileName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 text-xs font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3 h-3 text-blue-600" />
                <span>Change File</span>
              </button>
            </div>

            {/* Key-Value Details */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>File Size</span>
                </span>
                <span className="font-bold text-slate-800 font-mono">{formatFileSize(fileSize)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Total Records</span>
                </span>
                <span className="font-bold text-slate-800 font-mono">{totalRecords.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                  <span>Billing Month</span>
                </span>
                <span className="font-bold text-slate-800">{billingMonthStr}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-2 text-slate-500 font-medium">
                  <Coins className="w-3.5 h-3.5 text-slate-400" />
                  <span>Status</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  Processed Successfully
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. 6 SUMMARY KPI CARDS                                                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* 1. Total Records */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500">Total Records</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight">
                {kpiTotalRecords.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Billing records</div>
            </div>
          </div>

          {/* 2. Total Qty */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500">Total Qty</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight">
                {kpiTotalQty.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Total quantity</div>
            </div>
          </div>

          {/* 3. Net Amount */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500">Net Amount</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight truncate">
                {formatCurrency(kpiNetAmt)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Total net amount</div>
            </div>
          </div>

          {/* 4. Master Amount */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500">Master Amount</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight truncate">
                {formatCurrency(kpiMasterAmt)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Calculated amount</div>
            </div>
          </div>

          {/* 5. Veda Share */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500">Veda Share</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight truncate">
                {formatCurrency(kpiVedaShare)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Share amount</div>
            </div>
          </div>

          {/* 6. Sodani Share */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <div className="text-[11px] font-medium text-slate-500">Sodani Share</div>
              <div className="text-xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight truncate">
                {formatCurrency(kpiSodaniShare)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Share amount</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. PROCESSING SUMMARY BANNER                                              */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
            {/* Green Icon & Summary Text */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 leading-snug">Processing Summary</div>
                <div className="text-[11px] text-slate-400">Total {totalRecords.toLocaleString()} records processed</div>
              </div>
            </div>

            <div className="hidden sm:block h-8 w-[1px] bg-slate-200"></div>

            {/* Matched Count */}
            <div>
              <div className="text-xl font-black text-emerald-600 font-mono leading-none">
                {matchedCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Matched Services</div>
            </div>

            <div className="hidden sm:block h-8 w-[1px] bg-slate-200"></div>

            {/* Unmatched Count */}
            <div>
              <div className="text-xl font-black text-rose-600 font-mono leading-none">
                {unmatchedCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Unmatched Services</div>
            </div>
          </div>

          {/* Right: Unmatched Warning & Review Button */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap self-end lg:self-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <AlertTriangle className="w-4 h-4 text-rose-500 fill-rose-50" />
              <span>{unmatchedCount} services require Master Rate mapping</span>
            </div>

            <button
              type="button"
              onClick={() => setShowUnmatchedModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Review Unmatched
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. BILLING RECORDS DATA TABLE                                             */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white">
            {/* Title & Badge */}
            <div className="flex items-center gap-2.5">
              <h2 className="font-bold text-base text-slate-900 tracking-tight">Billing Records</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold font-mono">
                {totalRecords.toLocaleString()} Records
              </span>
            </div>

            {/* Filters & Export */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Box */}
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search patient, bill no, visit ID, service..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"
                />
              </div>

              {/* Dropdown 1: All Months */}
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-medium text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Months</option>
                  <option value="September 2024">September 2024</option>
                  <option value="August 2024">August 2024</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Dropdown 2: All Groups */}
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-medium text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Groups</option>
                  <option value="OPD">OPD</option>
                  <option value="IPD">IPD</option>
                  <option value="Emergency">Emergency</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Dropdown 3: All Status */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-medium text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="MATCHED">Matched</option>
                  <option value="NOT_FOUND">Rate Not Found</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Dropdown 4: All Modality */}
              <div className="relative">
                <select
                  value={selectedModality}
                  onChange={(e) => {
                    setSelectedModality(e.target.value as any);
                    setPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-medium text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Modality</option>
                  <option value="CT">CT Scan</option>
                  <option value="XRAY">X-Ray</option>
                  <option value="SONO">Sono / USG</option>
                  <option value="PATHOLOGY">Pathology</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Green Export Excel Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer ml-auto xl:ml-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
              {/* Header */}
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-center w-12">SNo</th>
                  <th className="py-3 px-3">Billing Group</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Bill No.</th>
                  <th className="py-3 px-3">Visit ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-3 text-center">Qty</th>
                  <th className="py-3 px-3 text-right">Total Amt</th>
                  <th className="py-3 px-3 text-right">Disc Amt</th>
                  <th className="py-3 px-3 text-right">Net Amt</th>
                  <th className="py-3 px-3 text-right">Rate</th>
                  <th className="py-3 px-3 text-center">%</th>
                  <th className="py-3 px-3 text-right">Veda Share</th>
                  <th className="py-3 px-3 text-right">Sodani Share</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedRecords.map((r, idx) => {
                  const isMissing = !r.isMatched;

                  return (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        isMissing
                          ? 'bg-[#fef2f2] hover:bg-[#fee2e2]'
                          : 'bg-white hover:bg-slate-50/80 text-slate-700'
                      }`}
                    >
                      {/* SNo */}
                      <td
                        className={`py-3 px-3 text-center font-mono text-[11px] ${
                          isMissing ? 'text-rose-600 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {r.sNo}
                      </td>

                      {/* Billing Group */}
                      <td
                        className={`py-3 px-3 ${
                          isMissing ? 'text-rose-600 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {r.billingGroup || '—'}
                      </td>

                      {/* Date */}
                      <td
                        className={`py-3 px-3 font-mono text-[11px] ${
                          isMissing ? 'text-rose-600 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        {r.billServiceDate || '—'}
                      </td>

                      {/* Bill No. */}
                      <td
                        className={`py-3 px-3 font-mono text-[11px] ${
                          isMissing ? 'text-rose-600 font-bold' : 'text-slate-700 font-semibold'
                        }`}
                      >
                        {r.billNo || '—'}
                      </td>

                      {/* Visit ID */}
                      <td
                        className={`py-3 px-3 font-mono text-[11px] ${
                          isMissing ? 'text-rose-600 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        {r.visitId || '—'}
                      </td>

                      {/* Patient Name */}
                      <td
                        className={`py-3 px-4 font-semibold uppercase ${
                          isMissing ? 'text-rose-600 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {r.patientName || '—'}
                      </td>

                      {/* Service Name */}
                      <td
                        className={`py-3 px-4 font-semibold uppercase ${
                          isMissing ? 'text-rose-600 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {r.serviceName}
                      </td>

                      {/* Qty */}
                      <td
                        className={`py-3 px-3 text-center font-mono font-semibold ${
                          isMissing ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {r.qty}
                      </td>

                      {/* Total Amt */}
                      <td
                        className={`py-3 px-3 text-right font-mono ${
                          isMissing ? 'text-rose-600 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(r.totalAmt)}
                      </td>

                      {/* Disc Amt */}
                      <td
                        className={`py-3 px-3 text-right font-mono ${
                          isMissing ? 'text-rose-600 font-semibold' : 'text-slate-600'
                        }`}
                      >
                        {formatCurrency(r.discAmt)}
                      </td>

                      {/* Net Amt */}
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          isMissing ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {formatCurrency(r.netAmt)}
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {r.rate !== null && r.rate !== undefined ? formatCurrency(r.rate) : '-'}
                      </td>

                      {/* % */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {r.percent && r.percent !== '-' ? r.percent : '-'}
                      </td>

                      {/* Veda Share */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                        {r.vedaShare !== null && r.vedaShare !== undefined ? formatCurrency(r.vedaShare) : '-'}
                      </td>

                      {/* Sodani Share */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                        {r.sodaniShare !== null && r.sodaniShare !== undefined ? formatCurrency(r.sodaniShare) : '-'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {r.isMatched ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                            <span>Matched</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickRate(r.serviceName, r.netAmt)}
                            title="Click to map Master Rate"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200 transition-colors cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Rate Not Found</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Grand Total Footer Row */}
              <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-xs text-slate-800">
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">Grand Total</td>
                  <td className="py-3 px-3 text-slate-400 font-mono">-</td>
                  <td className="py-3 px-3 text-slate-400 font-mono">-</td>
                  <td className="py-3 px-3 text-slate-400 font-mono">-</td>
                  <td className="py-3 px-3 text-slate-400 font-mono">-</td>
                  <td className="py-3 px-4 text-slate-400 font-mono">-</td>
                  <td className="py-3 px-4 text-slate-400 font-mono">-</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                    {kpiTotalQty.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(kpiGrossAmt)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(kpiDiscAmt)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(kpiNetAmt)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(kpiMasterAmt)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">-</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(kpiVedaShare)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(kpiSodaniShare)}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-400">-</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-white">
            {/* Numbered Page Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setPage(1)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                  page === 1 ? 'bg-blue-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                1
              </button>

              <button
                type="button"
                onClick={() => setPage(2)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                  page === 2 ? 'bg-blue-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                2
              </button>

              <button
                type="button"
                onClick={() => setPage(3)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                  page === 3 ? 'bg-blue-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                3
              </button>

              <button
                type="button"
                onClick={() => setPage(4)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                  page === 4 ? 'bg-blue-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                4
              </button>

              <button
                type="button"
                onClick={() => setPage(5)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                  page === 5 ? 'bg-blue-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                5
              </button>

              <span className="px-1 text-slate-400">...</span>

              <button
                type="button"
                onClick={() => setPage(127)}
                className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-colors ${
                  page === 127 ? 'bg-blue-600 text-white shadow-2xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                127
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(127, p + 1))}
                disabled={page >= 127}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-slate-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Showing Records & Per Page Selector */}
            <div className="flex items-center gap-3">
              <span>
                Showing 1 to {Math.min(limit, paginatedRecords.length)} of {totalRecords.toLocaleString()} records
              </span>

              <div className="relative">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1 pr-6 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: UNMATCHED SERVICES REVIEW MODAL                                  */}
      {/* ========================================================================= */}
      {showUnmatchedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Unmatched Services</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  These services could not be matched with the Master Rate list.
                </p>
              </div>
              <button
                onClick={() => setShowUnmatchedModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter unmatched services..."
                  value={unmatchedSearch}
                  onChange={(e) => setUnmatchedSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Service Name</th>
                    <th className="py-2 px-3 text-center">Occurrences</th>
                    <th className="py-2 px-3 text-center">Total Qty</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {unmatchedList
                    .filter((u) => u.serviceName.toLowerCase().includes(unmatchedSearch.toLowerCase()))
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 uppercase">
                          {item.serviceName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {item.count}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {item.totalQty}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Rate Not Found
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setShowUnmatchedModal(false);
                              handleOpenQuickRate(item.serviceName, item.sampleNet);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Rate</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>{unmatchedList.length} unique unmatched services</span>
              <button
                onClick={() => setShowUnmatchedModal(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK ADD MASTER RATE MODAL                                      */}
      {/* ========================================================================= */}
      {quickRateModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Add Master Rate</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure agreed rate & share distribution split
                </p>
              </div>
              <button
                onClick={() => setQuickRateModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickRate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  value={quickRateModal.serviceName}
                  onChange={(e) =>
                    setQuickRateModal((prev) => ({ ...prev, serviceName: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold uppercase text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Master Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quickRateModal.rate}
                  onChange={(e) =>
                    setQuickRateModal((prev) => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))
                  }
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                    Veda Share % <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={quickRateModal.vedaPct}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value) || 0;
                        const veda = Math.min(100, Math.max(0, raw));
                        setQuickRateModal((prev) => ({
                          ...prev,
                          vedaPct: veda,
                          sodaniPct: Math.max(0, 100 - veda),
                        }));
                      }}
                      required
                      className="w-full pl-3 pr-8 py-2 text-xs bg-blue-50/50 border border-blue-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold text-blue-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-xs">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    Sodani Share % <span className="text-slate-400 font-normal text-[10px]">(Auto: 100% − Veda)</span>
                  </label>
                  <div className="w-full px-3 py-2 text-xs bg-emerald-50/60 border border-emerald-200 rounded-xl font-mono font-bold text-emerald-900 flex items-center justify-between select-none">
                    <span>{quickRateModal.sodaniPct}%</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-medium">Auto (100 - {quickRateModal.vedaPct})</span>
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Presets:</span>
                {[
                  { label: '50% (50/50)', veda: 50 },
                  { label: '55% (55/45)', veda: 55 },
                  { label: '60% (60/40)', veda: 60 },
                  { label: '70% (70/30)', veda: 70 },
                  { label: '100% (100/0)', veda: 100 },
                  { label: '0% (0/100)', veda: 0 },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setQuickRateModal((prev) => ({
                        ...prev,
                        vedaPct: p.veda,
                        sodaniPct: Math.max(0, 100 - p.veda),
                      }))
                    }
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-slate-600 font-semibold">
                  <span>Master Amount (Rate × Qty 1):</span>
                  <strong className="text-slate-900 font-mono">₹ {quickRateModal.rate.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Veda Share Amount ({quickRateModal.vedaPct}%):</span>
                  <strong className="text-blue-700 font-mono">
                    ₹ {Math.round(((quickRateModal.rate * quickRateModal.vedaPct) / 100) * 100) / 100}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>Sodani Share Amount ({quickRateModal.sodaniPct}%):</span>
                  <strong className="text-emerald-700 font-mono">
                    ₹ {Math.round(((quickRateModal.rate * quickRateModal.sodaniPct) / 100) * 100) / 100}
                  </strong>
                </div>
                <div className="pt-1.5 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                  <span>Total Split Rule:</span>
                  <span className="font-bold text-emerald-700">
                    Veda ({quickRateModal.vedaPct}%) + Sodani ({quickRateModal.sodaniPct}%) = 100% ✓
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setQuickRateModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickRateModal.saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {quickRateModal.saving ? 'Saving...' : 'Save & Apply Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareManagementNewPage;
