import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { MasterRate } from '../types';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Settings2,
  RefreshCw,
  Sparkles,
  Calculator,
  AlertTriangle,
  X,
  Check,
  Percent,
  Upload,
  FileSpreadsheet,
  Download,
  Loader2
} from 'lucide-react';

type ImportRowStatus = 'new' | 'update' | 'error';

interface ImportPreviewRow {
  rowNumber: number;
  serviceName: string;
  masterRate: number | null;
  vedaSharePercent: number;
  sodaniSharePercent: number;
  status: ImportRowStatus;
  statusText: string;
  existingMasterRate: number | null;
  errors: string[];
  warnings: string[];
}

interface ImportPreview {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  headerRowIndex: number;
  headersDetected: string[];
  mapping: Record<string, string | null>;
  rows: ImportPreviewRow[];
  previewLimit: number;
  truncated: boolean;
  totalDataRows: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  invalidCount: number;
  errorMessages: string[];
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'];

export const MasterRatePage: React.FC = () => {
  const [rates, setRates] = useState<MasterRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | 'CT' | 'XRAY' | 'SONO' | 'PATHOLOGY'>('ALL');
  const [categoryCounts, setCategoryCounts] = useState({ all: 0, ct: 0, xray: 0, sono: 0, pathology: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<MasterRate | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Excel Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [skipExisting, setSkipExisting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    serviceName: '',
    masterRate: 0,
    vedaSharePercent: 0,
    sodaniSharePercent: 100,
  });

  const fetchRates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/master-rates', {
        params: {
          search,
          category: category !== 'ALL' ? category : undefined,
        },
      });
      setRates(res.data.rates || []);
      if (res.data.counts) {
        setCategoryCounts(res.data.counts);
      }
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to fetch master rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [search, category]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleOpenAdd = () => {
    setEditingRate(null);
    setFormData({
      serviceName: '',
      masterRate: 0,
      vedaSharePercent: 0,
      sodaniSharePercent: 100,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rate: MasterRate) => {
    setEditingRate(rate);
    setFormData({
      serviceName: rate.serviceName,
      masterRate: rate.masterRate,
      vedaSharePercent: rate.vedaSharePercent,
      sodaniSharePercent: rate.sodaniSharePercent,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serviceName.trim()) {
      showStatus('error', 'Service Name is required');
      return;
    }

    try {
      if (editingRate) {
        await api.put(`/master-rates/${editingRate._id}`, formData);
        showStatus('success', `Master Rate for "${formData.serviceName}" updated successfully`);
      } else {
        await api.post('/master-rates', formData);
        showStatus('success', `Master Rate for "${formData.serviceName}" created successfully`);
      }
      setIsModalOpen(false);
      fetchRates();
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to save master rate');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete Master Rate for "${name}"?`)) return;
    try {
      await api.delete(`/master-rates/${id}`);
      showStatus('success', `Master rate "${name}" deleted`);
      fetchRates();
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to delete master rate');
    }
  };

  const handleRecalculate = async () => {
    try {
      setIsRecalculating(true);
      const res = await api.post('/billing/recalculate');
      showStatus('success', `Recalculation complete! ${res.data.matchedCount} records matched.`);
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to recalculate billing shares');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('WARNING: This will delete ALL Master Rate configurations. Are you sure?')) return;
    try {
      await api.delete('/master-rates');
      showStatus('success', 'All master rates have been cleared.');
      fetchRates();
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to clear master rates');
    }
  };

  /* ---------------- Excel Import ---------------- */

  const resetImport = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportError(null);
    setIsPreviewing(false);
    setIsImporting(false);
    setSkipExisting(false);
    setIsDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeImport = () => {
    setIsImportOpen(false);
    resetImport();
  };

  const handleOpenImport = () => {
    resetImport();
    setIsImportOpen(true);
  };

  const selectFile = (file: File | null | undefined) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      setImportPreview(null);
      setImportError(`"${file.name}" is not a supported file. Please choose an Excel file (.xlsx or .xls).`);
      return;
    }

    setImportFile(file);
    setImportPreview(null);
    setImportError(null);
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      setImportError('Please select an Excel file first.');
      return;
    }

    try {
      setIsPreviewing(true);
      setImportError(null);

      const formData = new FormData();
      formData.append('file', importFile);

      const res = await api.post('/master-rates/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportPreview(res.data);
    } catch (err: any) {
      setImportPreview(null);
      setImportError(err.message || 'Could not read the Excel file. Please check the file and try again.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importFile || !importPreview) return;

    try {
      setIsImporting(true);
      setImportError(null);

      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('skipExisting', String(skipExisting));

      const res = await api.post('/master-rates/import/commit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { inserted = 0, updated = 0, skippedExisting = 0, skippedInvalid = 0 } = res.data || {};

      const parts = [`${inserted} added`, `${updated} updated`];
      if (skippedExisting > 0) parts.push(`${skippedExisting} already existing (skipped)`);
      if (skippedInvalid > 0) parts.push(`${skippedInvalid} invalid (skipped)`);

      showStatus('success', `Excel import complete from "${importFile.name}" - ${parts.join(', ')}.`);
      closeImport();
      fetchRates();
    } catch (err: any) {
      setImportError(err.message || 'Import failed. No records were changed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider mb-1">
            <Settings2 className="w-4 h-4" />
            Database Configuration
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Master Rate Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
            Set Master Rate and Share % (Veda & Sodani) for each service. All billing calculations strictly use this database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50"
            title="Recalculate existing billing records with current master rates"
          >
            <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Recalculate All</span>
          </button>

          <button
            onClick={handleOpenImport}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs sm:text-sm transition-all shadow-xs"
            title="Import Master Rates from an Excel file"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-sm shadow-emerald-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Master Rate</span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category / Modality Filter Tabs */}
      {/* Category / Modality Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar">
        <button
          onClick={() => setCategory('ALL')}
          className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Services
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {categoryCounts.all}
          </span>
        </button>

        <button
          onClick={() => setCategory('CT')}
          className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
            {categoryCounts.ct}
          </span>
        </button>

        <button
          onClick={() => setCategory('XRAY')}
          className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
            {categoryCounts.xray}
          </span>
        </button>

        <button
          onClick={() => setCategory('SONO')}
          className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
            {categoryCounts.sono}
          </span>
        </button>

        <button
          onClick={() => setCategory('PATHOLOGY')}
          className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            category === 'PATHOLOGY'
              ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Pathology / Other
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              category === 'PATHOLOGY' ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-700'
            }`}
          >
            {categoryCounts.pathology}
          </span>
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Service Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-semibold text-slate-500 px-3 py-1.5 bg-slate-100 rounded-lg">
            {rates.length} Services Displayed
          </span>
          {rates.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-3 py-1.5 hover:bg-rose-50 rounded-lg transition-colors"
            >
              Clear All Rates
            </button>
          )}
        </div>
      </div>

      {/* Rates Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-sm">Loading Master Rates...</span>
          </div>
        ) : rates.length === 0 ? (
          <div className="p-12 sm:p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">No Master Rates Configured</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Add services with their Master Rate, Veda Share %, and Sodani Share % to automatically calculate shares during billing uploads.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm hover:bg-emerald-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add First Service Rate
            </button>
          </div>
        ) : (
          <div>
            <div className="md:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 font-medium flex items-center justify-between">
              <span>👉 Scroll sideways to view all columns & actions</span>
              <span className="font-mono text-[10px] bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded">6 Columns</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap min-w-[720px]">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 uppercase text-xs tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-6">Service Name</th>
                  <th className="py-3.5 px-6 text-right">Master Rate (₹)</th>
                  <th className="py-3.5 px-6 text-center">Veda Share %</th>
                  <th className="py-3.5 px-6 text-center">Sodani Share %</th>
                  <th className="py-3.5 px-6 text-right">Sample Share (Qty 1)</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rates.map((rate) => {
                  const masterAmt = rate.masterRate * 1;
                  const vedaAmt = Math.round(((masterAmt * rate.vedaSharePercent) / 100) * 100) / 100;
                  const sodaniAmt = Math.round(((masterAmt * rate.sodaniSharePercent) / 100) * 100) / 100;

                  return (
                    <tr key={rate._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{rate.serviceName}</span>
                          {/(^|\s|\/)CT(\s|\/|$)/i.test(rate.serviceName) ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                              CT
                            </span>
                          ) : /X-?RAY/i.test(rate.serviceName) ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              X-RAY
                            </span>
                          ) : /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(rate.serviceName) ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              SONO
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              PATHO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono text-slate-900 font-semibold">
                        ₹{rate.masterRate.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 text-center font-mono">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {rate.vedaSharePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-center font-mono">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rate.sodaniSharePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono text-xs text-slate-500">
                        <span className="text-blue-700 font-semibold">Veda: ₹{vedaAmt}</span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        <span className="text-emerald-700 font-semibold">Sodani: ₹{sodaniAmt}</span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(rate)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rate._id, rate.serviceName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  {editingRate ? 'Edit Master Rate' : 'New Master Rate'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the master rate and share percentages for share distribution.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CREATININE SERUM"
                  value={formData.serviceName}
                  onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Master Rate (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={formData.masterRate}
                  onChange={(e) => setFormData({ ...formData, masterRate: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Veda Share % <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="any"
                      placeholder="0"
                      value={formData.vedaSharePercent}
                      onChange={(e) => {
                        const veda = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                        setFormData({
                          ...formData,
                          vedaSharePercent: veda,
                          sodaniSharePercent: Math.max(0, 100 - veda),
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-semibold"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sodani Share % <span className="text-slate-400 font-normal text-[11px]">(Auto: 100% − Veda)</span>
                  </label>
                  <div className="w-full px-3.5 py-2.5 text-sm bg-emerald-50/60 border border-emerald-200 rounded-xl font-mono font-bold text-emerald-800 flex items-center justify-between select-none">
                    <span>{formData.sodaniSharePercent}%</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold">Auto</span>
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-600 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                  Calculation Preview (for Qty = 1):
                </span>
                <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
                  <div className="p-2 rounded-lg bg-white border border-slate-200/60">
                    <div className="text-[10px] text-slate-400 uppercase">Master Amt</div>
                    <div className="font-bold text-slate-800">₹{formData.masterRate}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-200/60">
                    <div className="text-[10px] text-blue-600 uppercase">Veda Share</div>
                    <div className="font-bold text-blue-800">
                      ₹{Math.round(((formData.masterRate * formData.vedaSharePercent) / 100) * 100) / 100}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-200/60">
                    <div className="text-[10px] text-emerald-600 uppercase">Sodani Share</div>
                    <div className="font-bold text-emerald-800">
                      ₹{Math.round(((formData.masterRate * formData.sodaniSharePercent) / 100) * 100) / 100}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all"
                >
                  {editingRate ? 'Update Rate' : 'Save Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Upload Excel - Master Rates
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Import service names, master rates and share percentages from an Excel file. Review the
                  preview before importing.
                </p>
              </div>
              <button
                onClick={closeImport}
                disabled={isImporting}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Step 1: File selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Choose Excel File
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal normal-case">
                    (.xlsx or .xls - the first sheet is read)
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  className="hidden"
                  onChange={(e) => selectFile(e.target.files?.[0])}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={() => setIsDragActive(false)}
                  onDrop={handleImportDrop}
                  className={`p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-300 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/40'
                  }`}
                >
                  {importFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <FileSpreadsheet className="w-5 h-5" />
                      <span className="text-sm font-semibold">{importFile.name}</span>
                      <span className="text-xs text-slate-400 font-mono">
                        ({(importFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-500">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-sm font-semibold">
                        Click to browse or drag &amp; drop your Excel file here
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <a
                    href="/api/master-rates/import/template"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download template
                  </a>

                  <button
                    onClick={handlePreviewImport}
                    disabled={isPreviewing || isImporting || !importFile}
                    className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    {isPreviewing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Reading File...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Preview Data
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {importError && (
                <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-sm font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Step 2: Preview */}
              {importPreview && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Review &amp; Confirm
                    </span>
                  </div>

                  {/* File + column mapping summary */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        {importPreview.fileName}
                      </span>
                      <span className="text-slate-500">
                        Sheet: <span className="font-semibold text-slate-700">{importPreview.sheetName}</span>
                      </span>
                      <span className="text-slate-500">
                        Header row:{' '}
                        <span className="font-mono font-semibold text-slate-700">
                          {importPreview.headerRowIndex + 1}
                        </span>
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          ['Service Name', importPreview.mapping.serviceName],
                          ['Master Rate', importPreview.mapping.masterRate],
                          ['Veda Share %', importPreview.mapping.vedaSharePercent],
                          ['Sodani Share %', importPreview.mapping.sodaniSharePercent],
                        ] as const
                      ).map(([label, source]) => (
                        <div key={label} className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {label}
                          </span>
                          <span
                            className={`font-mono font-semibold truncate ${
                              source ? 'text-slate-800' : 'text-amber-600'
                            }`}
                            title={source || 'Not found in file'}
                          >
                            {source || 'Not in file'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div className="text-lg font-bold text-slate-900 font-mono leading-none">
                        {importPreview.totalDataRows}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                        Rows Found
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                      <div className="text-lg font-bold text-emerald-700 font-mono leading-none">
                        {importPreview.newCount}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">
                        New
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
                      <div className="text-lg font-bold text-blue-700 font-mono leading-none">
                        {importPreview.updateCount}
                      </div>
                      <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1">
                        Update
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                      <div className="text-lg font-bold text-rose-700 font-mono leading-none">
                        {importPreview.invalidCount}
                      </div>
                      <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">
                        Errors
                      </div>
                    </div>
                  </div>

                  {/* Validation errors */}
                  {importPreview.errorMessages.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {importPreview.invalidCount} row(s) will be skipped due to errors
                      </div>
                      <ul className="space-y-0.5 max-h-28 overflow-y-auto text-[11px] text-rose-700 font-mono">
                        {importPreview.errorMessages.map((msg, i) => (
                          <li key={i}>• {msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Duplicate handling */}
                  {importPreview.updateCount > 0 && (
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={skipExisting}
                        onChange={(e) => setSkipExisting(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-amber-600 shrink-0"
                      />
                      <span className="text-xs text-amber-900 leading-relaxed">
                        <span className="font-bold">Skip {importPreview.updateCount} service(s) that already exist</span>{' '}
                        <span className="text-amber-700">
                          (leave unchecked to overwrite their Master Rate and share %)
                        </span>
                      </span>
                    </label>
                  )}

                  {/* Row preview table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider font-semibold sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Row</th>
                            <th className="py-2 px-3">Service Name</th>
                            <th className="py-2 px-3 text-right">Master Rate</th>
                            <th className="py-2 px-3 text-center">Veda %</th>
                            <th className="py-2 px-3 text-center">Sodani %</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {importPreview.rows.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={
                                row.status === 'error'
                                  ? 'bg-rose-50/50'
                                  : row.status === 'update'
                                  ? 'bg-blue-50/30'
                                  : ''
                              }
                            >
                              <td className="py-2 px-3 font-mono text-slate-400">{row.rowNumber}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                <div className="flex flex-col">
                                  <span>{row.serviceName || <span className="text-rose-600 italic">—</span>}</span>
                                  {row.warnings.length > 0 && (
                                    <span className="text-[10px] text-amber-600 font-normal mt-0.5">
                                      {row.warnings.join(' ')}
                                    </span>
                                  )}
                                  {row.errors.length > 0 && (
                                    <span className="text-[10px] text-rose-600 font-normal mt-0.5">
                                      {row.errors.join(' ')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono">
                                {row.masterRate === null ? (
                                  <span className="text-rose-500">—</span>
                                ) : (
                                  `₹${row.masterRate.toLocaleString()}`
                                )}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-blue-700">
                                {row.vedaSharePercent}%
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-emerald-700">
                                {row.sodaniSharePercent}%
                              </td>
                              <td className="py-2 px-3">
                                {row.status === 'new' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    New
                                  </span>
                                )}
                                {row.status === 'update' && (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                    title={row.statusText}
                                  >
                                    Update
                                  </span>
                                )}
                                {row.status === 'error' && (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                                    title={row.statusText}
                                  >
                                    Skip
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importPreview.truncated && (
                      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-medium">
                        Showing first {importPreview.previewLimit} of {importPreview.totalDataRows} rows. All{' '}
                        {importPreview.validCount} valid row(s) will still be imported.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50">
              <span className="text-[11px] text-slate-500 font-medium">
                {importPreview
                  ? `${importPreview.validCount} of ${importPreview.totalDataRows} row(s) ready to import`
                  : 'Select a file and preview the data before importing.'}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={closeImport}
                  disabled={isImporting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommitImport}
                  disabled={isImporting || !importPreview || importPreview.validCount === 0}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-40 inline-flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Import {importPreview ? `${importPreview.validCount} Row(s)` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
