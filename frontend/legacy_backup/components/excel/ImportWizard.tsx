import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  RotateCcw,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { formatINR } from '../../utils/formatters';
import { ImportPreviewData, ImportResultData } from '../../types';

interface ImportWizardProps {
  onSuccess: () => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResultData | null>(null);

  // Standard legacy field definitions
  const systemFields = [
    { key: 'billNo', label: 'Bill No. *', required: true },
    { key: 'patientName', label: 'Patient Name *', required: true },
    { key: 'serviceName', label: 'Service / Test Name *', required: true },
    { key: 'billingGroup', label: 'Billing Group', required: false },
    { key: 'billDate', label: 'Bill / Service Date', required: false },
    { key: 'visitId', label: 'Visit ID', required: false },
    { key: 'quantity', label: 'Quantity (Qty)', required: false },
    { key: 'rate', label: 'Rate (₹)', required: false },
    { key: 'totalAmount', label: 'Total Amount (Gross)', required: false },
    { key: 'discountAmount', label: 'Discount Amount (Disc Amt)', required: false },
    { key: 'netAmount', label: 'Net Amount (Net Amt)', required: false },
    { key: 'shdplPercentage', label: 'SHDPL %', required: false },
    { key: 'shdplAmount', label: 'SHDPL Amount', required: false },
    { key: 'vedaShare', label: 'Veda Share', required: false },
    { key: 'sodaniShare', label: 'Sodani Share', required: false },
  ];

  // Handle file drop / select
  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await ApiClient.uploadFile<any>('/excel/preview', formData);
      if (res.success) {
        setPreviewData(res.data);
        setColumnMapping(res.data.suggestedMapping || {});
        setStep(2);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to read Excel file');
    } finally {
      setLoading(false);
    }
  };

  // Run the import commit
  const handleCommitImport = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(columnMapping));

      const res = await ApiClient.uploadFile<any>('/excel/import', formData);
      if (res.success) {
        setImportResult(res.data);
        setStep(3);
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setImportResult(null);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6">
      {/* Wizard Step Indicator */}
      <div className="flex items-center justify-between max-w-2xl mx-auto px-4">
        {[
          { num: 1, label: 'Upload File' },
          { num: 2, label: 'Map & Preview' },
          { num: 3, label: 'Reconciliation' }
        ].map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.num
                    ? 'bg-teal-500 text-slate-950 ring-4 ring-teal-500/20'
                    : step > s.num
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-xs font-semibold ${step >= s.num ? 'text-slate-200' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
            {idx < 2 && <div className={`flex-1 h-0.5 mx-4 ${step > idx + 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />}
          </React.Fragment>
        ))}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-3 max-w-2xl mx-auto">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Upload Legacy Pathology Excel Sheet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Directly imports historical billing registers, patient records, visits, and calculates exact partner shares.
            </p>
          </div>

          <label className="block border-2 border-dashed border-slate-700 hover:border-teal-500/60 rounded-2xl p-8 cursor-pointer transition group bg-slate-850/40">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              className="hidden"
            />
            <Upload className="w-10 h-10 text-slate-400 group-hover:text-teal-400 mx-auto transition mb-3" />
            <span className="text-sm font-semibold text-slate-200 block">
              {loading ? 'Reading and analyzing spreadsheet...' : 'Click to browse or drag & drop Excel (.xlsx / .xls / .csv)'}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">
              Supports standard pathology format with Bill No, Visit ID, Qty, Total Amt, Net Amt, SHDPL%
            </span>
          </label>

          {/* Download Sample Template */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-400">Need the sample template?</span>
            <a
              href="/api/excel/download-sample"
              download="pathology_sample_migration.xlsx"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 underline underline-offset-4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Pathology Migration Sample Excel</span>
            </a>
          </div>
        </div>
      )}

      {/* STEP 2: Map & Preview */}
      {step === 2 && previewData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>File Analysis:</span>
                <span className="text-teal-400 font-mono">{previewData.fileName}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Detected {previewData.totalRows} data rows | Total Excel Gross: {formatINR(previewData.totalExcelGross)} | Net: {formatINR(previewData.totalExcelNet)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Change File
              </button>
              <button
                onClick={handleCommitImport}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition disabled:opacity-50"
              >
                {loading ? 'Processing & Calculating...' : 'Proceed with Import'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Column Mapping Section */}
          <div className="p-4 rounded-xl bg-slate-850/60 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Column Auto-Mapping Verification</span>
              <span className="text-[11px] text-teal-400 font-normal">
                Review or adjust matches below
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {systemFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400 truncate">
                    {f.label}
                  </label>
                  <select
                    value={columnMapping[f.key] || ''}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, [f.key]: e.target.value })
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 border focus:outline-none focus:border-teal-500 ${
                      columnMapping[f.key] ? 'border-teal-500/40 text-teal-200' : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    <option value="">-- Ignore --</option>
                    {previewData.detectedHeaders.map((h) => (
                      <option key={h} value={h} className="bg-slate-900">
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>First 10 Data Rows Preview</span>
              <span>Showing {previewData.previewRows.length} of {previewData.totalRows} rows</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-850 sticky top-0 border-b border-slate-800 text-slate-300">
                  <tr>
                    {previewData.detectedHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 whitespace-nowrap font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                  {previewData.previewRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      {previewData.detectedHeaders.map((h) => (
                        <td key={h} className="px-3 py-1.5 whitespace-nowrap">
                          {String(r[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Reconciliation Report */}
      {step === 3 && importResult && (
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl animate-in fade-in duration-300">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <FileCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Excel Migration & Reconciliation Report</h3>
            <p className="text-xs text-slate-400">
              Audit log reference: #{importResult.importLogId}
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${
                importResult.discrepancyAmount === 0 && importResult.invalidCount === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {importResult.discrepancyAmount === 0 && importResult.invalidCount === 0
                ? '100% RECONCILED - ZERO FINANCIAL DISCREPANCY'
                : `IMPORT COMPLETED WITH ${importResult.duplicateCount} DUPLICATES FILTERED`}
            </span>
          </div>

          {/* Reconciliation Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">Total Rows in Excel</div>
              <div className="text-xl font-bold text-white mt-1">{importResult.totalRows}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center">
              <div className="text-xs text-emerald-300">Imported & Saved</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{importResult.importedCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center">
              <div className="text-xs text-amber-300">Duplicates Filtered</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{importResult.duplicateCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-center">
              <div className="text-xs text-rose-300">Invalid Rows</div>
              <div className="text-xl font-bold text-rose-400 mt-1">{importResult.invalidCount}</div>
            </div>
          </div>

          {/* Financial Totals Reconciliation */}
          <div className="p-5 rounded-xl bg-slate-850/80 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Financial Reconciliation Comparison
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Excel Total Revenue:</span>
                <span className="font-mono font-bold text-slate-200">
                  {formatINR(importResult.totalExcelAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Database Stored Net Revenue:</span>
                <span className="font-mono font-bold text-teal-300">
                  {formatINR(importResult.totalImportedAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 text-base">
                <span className="font-semibold text-slate-300">Reconciliation Discrepancy:</span>
                <span
                  className={`font-mono font-bold ${
                    importResult.discrepancyAmount === 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {formatINR(importResult.discrepancyAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Error / Duplicates Log */}
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                Detailed Log ({importResult.errors.length} notices)
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs text-slate-300">
                {importResult.errors.map((e, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-850 border border-slate-800 flex items-center justify-between"
                  >
                    <span>
                      Row #{e.rowNumber}: <strong className="text-slate-100">{e.billNo || e.patientName}</strong>
                    </span>
                    <span className="text-amber-400/90">{e.errorReason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-4 pt-4 border-t border-slate-800">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Import Another File</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
