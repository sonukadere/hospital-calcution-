import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { BillingRecord, BillingStats, UnmatchedServiceItem, BillingMonthSummary } from '../types';
import {
  Upload,
  Download,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  ArrowUpRight,
  AlertTriangle
} from 'lucide-react';

export const ShareManagementPage: React.FC = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [stats, setStats] = useState<BillingStats>({
    totalQty: 0,
    totalGross: 0,
    totalDiscount: 0,
    totalNet: 0,
    totalMasterAmount: 0,
    totalVedaShare: 0,
    totalSodaniShare: 0,
    unmatchedCount: 0,
  });
  const [billingGroups, setBillingGroups] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<BillingMonthSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unmatchedList, setUnmatchedList] = useState<UnmatchedServiceItem[]>([]);
  const [showUnmatchedModal, setShowUnmatchedModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [matchFilter, setMatchFilter] = useState('');
  const [category, setCategory] = useState<'ALL' | 'CT' | 'XRAY' | 'SONO' | 'PATHOLOGY'>('ALL');
  const [modalityCounts, setModalityCounts] = useState({ all: 0, ct: 0, xray: 0, sono: 0, pathology: 0 });

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploadDragActive, setIsUploadDragActive] = useState(false);

  // Quick configure rate modal
  const [quickRateModal, setQuickRateModal] = useState<{
    open: boolean;
    serviceName: string;
    rate: number;
    vedaPct: number;
    sodaniPct: number;
  }>({
    open: false,
    serviceName: '',
    rate: 0,
    vedaPct: 0,
    sodaniPct: 100,
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchRecords = async (page = pagination.page) => {
    try {
      setLoading(true);
      const res = await api.get('/billing/records', {
        params: {
          search,
          monthKey: selectedMonth !== 'ALL' ? selectedMonth : undefined,
          billingGroup: selectedGroup !== 'ALL' ? selectedGroup : undefined,
          isMatched: matchFilter !== '' ? matchFilter : undefined,
          category: category !== 'ALL' ? category : undefined,
          page,
          limit: pagination.limit,
        },
      });

      setRecords(res.data.records || []);
      setStats(res.data.stats || stats);
      setBillingGroups(res.data.billingGroups || []);
      if (res.data.availableMonths) {
        setAvailableMonths(res.data.availableMonths);
      }
      if (res.data.modalityCounts) {
        setModalityCounts(res.data.modalityCounts);
      }
      setPagination(res.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to fetch billing records');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnmatchedServices = async () => {
    try {
      const res = await api.get('/billing/unmatched');
      setUnmatchedList(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch unmatched services:', err);
    }
  };

  useEffect(() => {
    fetchRecords(1);
    fetchUnmatchedServices();
  }, [search, selectedMonth, selectedGroup, matchFilter, category]);

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 6000);
  };

  // Upload Excel Handler
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) {
      showStatus('error', 'Please choose an Excel file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedUploadFile);

    try {
      setUploading(true);
      showStatus('info', 'Uploading and calculating monthly shares...');
      const res = await api.post('/billing/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const detected = res.data.detectedMonths?.[0]?.monthName || 'selected month';
      showStatus(
        'success',
        `Processed ${res.data.totalProcessed} records for ${detected}! (${res.data.skippedCount ? `${res.data.skippedCount} without master rate skipped` : 'All matched'})`
      );

      // Close modal and reset
      setShowUploadModal(false);
      setSelectedUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchRecords(1);
      fetchUnmatchedServices();
    } catch (err: any) {
      showStatus('error', err.message || 'Error processing Excel file');
    } finally {
      setUploading(false);
    }
  };

  const clearUploadFile = () => {
    setSelectedUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectUploadFile = (file: File | null | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      showStatus('error', `"${file.name}" is not a supported file. Please choose an Excel file (.xlsx or .xls).`);
      return;
    }
    setSelectedUploadFile(file);
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsUploadDragActive(false);
    selectUploadFile(e.dataTransfer.files?.[0]);
  };

  // Export to Excel (Scoped to current month filter or explicit target month)
  const handleExport = (targetMonth?: string) => {
    const month = targetMonth !== undefined ? targetMonth : selectedMonth;
    const params = new URLSearchParams();
    if (month && month !== 'ALL') params.append('monthKey', month);
    if (selectedGroup && selectedGroup !== 'ALL') params.append('billingGroup', selectedGroup);
    if (matchFilter) params.append('isMatched', matchFilter);
    if (search) params.append('search', search);
    if (category && category !== 'ALL') params.append('category', category);

    window.open(`/api/billing/export?${params.toString()}`, '_blank');
  };

  // Recalculate
  const handleRecalculate = async () => {
    try {
      setLoading(true);
      const res = await api.post('/billing/recalculate');
      showStatus('success', `Shares recalculated for ${res.data.totalRecords} records.`);
      fetchRecords(pagination.page);
      fetchUnmatchedServices();
    } catch (err: any) {
      showStatus('error', err.message || 'Recalculation failed');
    } finally {
      setLoading(false);
    }
  };

  // Clear specific month
  const handleClearSelectedMonth = async () => {
    if (selectedMonth === 'ALL') {
      if (!window.confirm('Are you sure you want to completely clear ALL billing records across all months?')) return;
      try {
        setLoading(true);
        await api.delete('/billing/clear');
        showStatus('success', 'All billing records have been cleared.');
        fetchRecords(1);
        fetchUnmatchedServices();
      } catch (err: any) {
        showStatus('error', err.message || 'Failed to clear records');
      } finally {
        setLoading(false);
      }
    } else {
      const monthObj = availableMonths.find((m) => m.monthKey === selectedMonth);
      const monthName = monthObj ? monthObj.monthName : selectedMonth;
      if (!window.confirm(`Are you sure you want to delete all billing records for "${monthName}"? Other months will remain untouched.`)) return;

      try {
        setLoading(true);
        const res = await api.delete(`/billing/month/${selectedMonth}`);
        showStatus('success', `Cleared ${res.data.deletedCount} records for ${monthName}.`);
        setSelectedMonth('ALL');
        fetchRecords(1);
        fetchUnmatchedServices();
      } catch (err: any) {
        showStatus('error', err.message || `Failed to delete records for ${monthName}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Quick configure rate for unmatched service
  const handleSaveQuickRate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/master-rates', {
        serviceName: quickRateModal.serviceName,
        masterRate: quickRateModal.rate,
        vedaSharePercent: quickRateModal.vedaPct,
        sodaniSharePercent: quickRateModal.sodaniPct,
      });

      showStatus(
        'success',
        `Master rate saved for "${quickRateModal.serviceName}"! Recalculating shares...`
      );

      setQuickRateModal({ open: false, serviceName: '', rate: 0, vedaPct: 0, sodaniPct: 100 });
      fetchRecords(pagination.page);
      fetchUnmatchedServices();
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to configure master rate');
    }
  };

  // Find currently active month object
  const currentMonthInfo = availableMonths.find((m) => m.monthKey === selectedMonth);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            Monthly Share Distribution Engine
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Billing Share Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload monthly billing Excel sheets, isolate by month, compute Veda & Sodani shares, and export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-sm shadow-emerald-600/30"
          >
            <Upload className="w-4 h-4" />
            Upload Monthly Excel
          </button>

          <button
            onClick={() => handleExport()}
            disabled={records.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-all shadow-xs disabled:opacity-40"
            title={
              selectedMonth !== 'ALL'
                ? `Export ${currentMonthInfo?.monthName || selectedMonth} only`
                : 'Export all months into a single multi-sheet file'
            }
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export Excel
          </button>

          <button
            onClick={handleRecalculate}
            disabled={loading || records.length === 0}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all shadow-xs disabled:opacity-40"
            title="Recalculate All Shares"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {records.length > 0 && (
            <button
              onClick={handleClearSelectedMonth}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium text-xs transition-all shadow-xs"
              title={selectedMonth !== 'ALL' ? `Delete only ${currentMonthInfo?.monthName || selectedMonth} records` : 'Delete all records'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {selectedMonth !== 'ALL' ? `Clear ${currentMonthInfo?.monthName || selectedMonth}` : 'Clear All'}
            </button>
          )}
        </div>
      </div>


      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unmatched Alert Banner */}
      {stats.unmatchedCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {stats.unmatchedCount} Records Have Unmatched Services
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                These services do not have a configured Master Rate in the database. Their shares are currently ₹0.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUnmatchedModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-xs shrink-0 self-start sm:self-auto"
          >
            Review & Configure Rates ({unmatchedList.length})
          </button>
        </div>
      )}

      {/* KPI Summary Cards (Scoped to selected month) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Bills / Items</span>
            {selectedMonth !== 'ALL' && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                {currentMonthInfo?.monthName}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {pagination.total.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Total Qty:</span>
            <span className="font-semibold text-slate-700">{stats.totalQty}</span>
          </div>
        </div>

        {/* Total Net Amount */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Net Billed Amt</span>
            {selectedMonth !== 'ALL' && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                {currentMonthInfo?.monthName}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{stats.totalNet.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span>Gross: ₹{stats.totalGross.toLocaleString()}</span>
          </div>
        </div>

        {/* Veda Share */}
        <div className="bg-gradient-to-br from-blue-50/50 to-white p-5 rounded-2xl border border-blue-200/80 shadow-xs">
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center justify-between">
            <span>Veda Share</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
              Computed
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2 font-mono">
            ₹{stats.totalVedaShare.toLocaleString()}
          </div>
          <div className="text-xs text-blue-600/80 mt-1">
            Based on Master Rate × Veda %
          </div>
        </div>

        {/* Sodani Share */}
        <div className="bg-gradient-to-br from-emerald-50/50 to-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
            <span>Sodani Share</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Computed
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2 font-mono">
            ₹{stats.totalSodaniShare.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600/80 mt-1">
            Based on Master Rate × Sodani %
          </div>
        </div>
      </div>

      {/* Category / Modality Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategory('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Tests
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {modalityCounts.all}
          </span>
        </button>

        <button
          onClick={() => setCategory('CT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'CT'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          CT Scan
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'CT' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {modalityCounts.ct}
          </span>
        </button>

        <button
          onClick={() => setCategory('XRAY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'XRAY'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          X-Ray
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'XRAY' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {modalityCounts.xray}
          </span>
        </button>

        <button
          onClick={() => setCategory('SONO')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'SONO'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Sono / Doppler
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'SONO' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {modalityCounts.sono}
          </span>
        </button>

        <button
          onClick={() => setCategory('PATHOLOGY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'PATHOLOGY'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Pathology / Labs
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'PATHOLOGY' ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-700'
            }`}
          >
            {modalityCounts.pathology}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Patient, Bill No, Service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Month Selector Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-semibold bg-transparent border-none outline-none text-slate-700 cursor-pointer pr-1"
            >
              <option value="ALL">
                All Months ({availableMonths.reduce((acc, m) => acc + m.count, 0)})
              </option>
              {availableMonths.map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {m.monthName} ({m.count})
                </option>
              ))}
            </select>
          </div>

          {/* Billing Group Filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Billing Groups</option>
            {billingGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Match Filter */}
          <select
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="true">Matched Only</option>
            <option value="false">Unmatched Only</option>
          </select>
        </div>
      </div>

      {/* Main 15-Field Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
            <span className="text-sm font-medium">Loading billing data...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="p-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No Billing Data Found</h3>
            <p className="text-sm text-slate-400 max-w-md">
              {selectedMonth !== 'ALL'
                ? `No records found for ${currentMonthInfo?.monthName || selectedMonth}.`
                : 'Upload your monthly billing Excel file to compute and view the 15-column share distribution.'}
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Monthly Excel
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold tracking-wider sticky top-0">
                <tr>
                  <th className="py-3 px-4 text-center">SNo</th>
                  <th className="py-3 px-4">Billing Group</th>
                  <th className="py-3 px-4">Bill/Service Date</th>
                  <th className="py-3 px-4">Bill No.</th>
                  <th className="py-3 px-4">Visit ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Total Amt</th>
                  <th className="py-3 px-4 text-right">Disc Amt</th>
                  <th className="py-3 px-4 text-right">Net Amt</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-center">%</th>
                  <th className="py-3 px-4 text-right text-blue-700 bg-blue-50/40">Veda Share</th>
                  <th className="py-3 px-4 text-right text-emerald-700 bg-emerald-50/40">Sodani Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {records.map((r, idx) => {
                  return (
                    <tr
                      key={r._id || idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !r.isMatched ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* SNo */}
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {r.sNo}
                      </td>

                      {/* Billing Group */}
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                          {r.billingGroup || '—'}
                        </span>
                      </td>

                      {/* Bill/Service Date */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.billServiceDate || '—'}
                      </td>

                      {/* Bill No. */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {r.billNo || '—'}
                      </td>

                      {/* Visit ID */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.visitId || '—'}
                      </td>

                      {/* Patient Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900 uppercase">
                        {r.patientName || '—'}
                      </td>

                      {/* Service Name & Match badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 uppercase">{r.serviceName}</span>
                          {/(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName) ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                              CT
                            </span>
                          ) : /X-?RAY/i.test(r.serviceName) ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              X-RAY
                            </span>
                          ) : /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName) ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              SONO
                            </span>
                          ) : null}
                          {!r.isMatched && (
                            <button
                              onClick={() =>
                                setQuickRateModal({
                                  open: true,
                                  serviceName: r.serviceName,
                                  rate: r.rate || 0,
                                  vedaPct: 0,
                                  sodaniPct: 100,
                                })
                              }
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors flex items-center gap-1"
                              title="Click to configure Master Rate"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              Set Rate
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {r.qty}
                      </td>

                      {/* Total Amt */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{r.totalAmt.toLocaleString()}
                      </td>

                      {/* Disc Amt */}
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        ₹{r.discAmt.toLocaleString()}
                      </td>

                      {/* Net Amt */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{r.netAmt.toLocaleString()}
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{r.rate.toLocaleString()}
                      </td>

                      {/* % */}
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {r.percent !== undefined && r.percent !== null ? String(r.percent) : '—'}
                      </td>

                      {/* Veda Share */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                        ₹{r.vedaShare.toLocaleString()}
                      </td>

                      {/* Sodani Share */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                        ₹{r.sodaniShare.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {records.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRecords(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchRecords(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Monthly Excel Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  Upload Monthly Billing Excel
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => selectUploadFile(e.target.files?.[0])}
                accept=".xlsx, .xls"
                className="hidden"
              />

              {selectedUploadFile ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-800 truncate">
                      {selectedUploadFile.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {(selectedUploadFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearUploadFile}
                    title="Remove file"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsUploadDragActive(true);
                  }}
                  onDragLeave={() => setIsUploadDragActive(false)}
                  onDrop={handleUploadDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isUploadDragActive
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-sm text-slate-700">
                    Browse or drag &amp; drop your Excel file
                  </div>
                  <div className="text-xs text-slate-400">.xlsx or .xls</div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedUploadFile}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  <Upload className={`w-4 h-4 ${uploading ? 'animate-bounce' : ''}`} />
                  {uploading ? 'Processing & Calculating Shares...' : 'Upload & Calculate Shares'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Unmatched Services Modal */}
      {showUnmatchedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Unmatched Services in Uploaded Billing
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure Master Rates for these services to automatically compute Veda and Sodani shares.
                </p>
              </div>
              <button
                onClick={() => setShowUnmatchedModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {unmatchedList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  All services are currently matched!
                </div>
              ) : (
                unmatchedList.map((item) => (
                  <div
                    key={item.serviceName}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900 uppercase">
                        {item.serviceName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        Found in {item.occurrenceCount} record(s) | Sample Rate: ₹{item.sampleRate}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowUnmatchedModal(false);
                        setQuickRateModal({
                          open: true,
                          serviceName: item.serviceName,
                          rate: item.sampleRate || 0,
                          vedaPct: 0,
                          sodaniPct: 100,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Configure Rate
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setShowUnmatchedModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Rate Modal */}
      {quickRateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Set Master Rate
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure share rules for this service.
                </p>
              </div>
              <button
                onClick={() => setQuickRateModal({ ...quickRateModal, open: false })}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickRate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  readOnly
                  value={quickRateModal.serviceName}
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 uppercase cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Master Rate (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={quickRateModal.rate}
                  onChange={(e) =>
                    setQuickRateModal({ ...quickRateModal, rate: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Veda Share %
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="any"
                    value={quickRateModal.vedaPct}
                    onChange={(e) =>
                      setQuickRateModal({ ...quickRateModal, vedaPct: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sodani Share %
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="any"
                    value={quickRateModal.sodaniPct}
                    onChange={(e) =>
                      setQuickRateModal({ ...quickRateModal, sodaniPct: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickRateModal({ ...quickRateModal, open: false })}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all"
                >
                  Save & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
