import React, { useState, useEffect } from 'react';
import { Upload, History, FileCheck, Download } from 'lucide-react';
import { ImportWizard } from '../components/excel/ImportWizard';
import { ApiClient } from '../api/client';
import { formatINR, formatDateTime } from '../utils/formatters';

interface ExcelImportPageProps {
  onImportCompleted: () => void;
}

export const ExcelImportPage: React.FC<ExcelImportPageProps> = ({ onImportCompleted }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/excel/history');
      if (res.success) setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSuccess = () => {
    fetchHistory();
    onImportCompleted();
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Upload className="w-5 h-5 text-teal-400" />
          <span>Excel Data Migration & Reconciliation Suite</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Migrate existing pathology spreadsheets, resolve column headers, prevent duplicates, and verify financial totals
        </p>
      </div>

      {/* Step Wizard Container */}
      <ImportWizard onSuccess={handleSuccess} />

      {/* Migration Log History */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-bold text-white">Migration & Reconciliation Audit History</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">{history.length} batches logged</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-right text-emerald-400">Imported</th>
                <th className="px-4 py-3 text-right text-amber-400">Duplicates</th>
                <th className="px-4 py-3 text-right">Excel Revenue</th>
                <th className="px-4 py-3 text-right text-teal-300">Imported Revenue</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    No Excel migration history recorded yet.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-sans text-slate-400">{formatDateTime(h.createdAt)}</td>
                    <td className="px-4 py-3 font-bold text-white">{h.fileName}</td>
                    <td className="px-4 py-3 text-right">{h.totalRows}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-bold">{h.importedCount}</td>
                    <td className="px-4 py-3 text-right text-amber-400">{h.duplicateCount}</td>
                    <td className="px-4 py-3 text-right">{formatINR(h.totalExcelAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-teal-300">{formatINR(h.totalImportedAmount)}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {h.reconciliationStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
