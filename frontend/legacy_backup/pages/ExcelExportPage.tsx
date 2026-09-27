import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar, Filter, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiClient } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { BillingGroup, PathologyService } from '../types';

interface ExcelExportPageProps {
  billingGroups: BillingGroup[];
  services: PathologyService[];
}

export const ExcelExportPage: React.FC<ExcelExportPageProps> = ({ billingGroups, services }) => {
  const [reportType, setReportType] = useState('ALL_BILLS');
  const [format, setFormat] = useState<'EXCEL' | 'CSV' | 'PDF'>('EXCEL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billingGroup, setBillingGroup] = useState('ALL');
  const [exporting, setExporting] = useState(false);
  const [lastExported, setLastExported] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      if (format === 'EXCEL' && reportType === 'ALL_BILLS') {
        // Direct backend binary stream download for Excel
        const params = new URLSearchParams();
        if (billingGroup !== 'ALL') params.append('billingGroup', billingGroup);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        window.open(`/api/excel/export?${params.toString()}`, '_blank');
        setLastExported(`Exported Billing Register (${new Date().toLocaleTimeString()})`);
        setExporting(false);
        return;
      }

      // Fetch records for client-side formatted export (CSV or PDF)
      let endpoint = '/billing';
      let params: any = { limit: 1000 };
      if (billingGroup !== 'ALL') params.billingGroup = billingGroup;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      if (reportType === 'DAILY') endpoint = '/reports/daily';
      else if (reportType === 'MONTHLY') endpoint = '/reports/monthly';
      else if (reportType === 'GROUP') endpoint = '/reports/billing-group';
      else if (reportType === 'SERVICE') endpoint = '/reports/service';
      else if (reportType === 'PATIENT') endpoint = '/reports/patient';

      const res = await ApiClient.get<any>(endpoint, params);
      const records = res.data || [];

      if (format === 'CSV') {
        const ws = XLSX.utils.json_to_sheet(records);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pathology_${reportType.toLowerCase()}_${Date.now()}.csv`;
        a.click();
      } else if (format === 'PDF') {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Pathology Diagnostic Center - Financial Report', 14, 15);
        doc.setFontSize(10);
        doc.text(`Report: ${reportType} | Exported on: ${new Date().toLocaleString()}`, 14, 22);

        let headers: string[] = [];
        let rows: any[] = [];

        if (reportType === 'ALL_BILLS') {
          headers = ['Bill No', 'Date', 'Patient', 'Group', 'Service', 'Rate', 'Net Amt', 'SHDPL (52%)', 'Veda (20%)', 'Sodani (28%)'];
          rows = records.map((r: any) => [
            r.billNo,
            formatDate(r.billDate),
            r.patientName,
            r.billingGroup,
            r.serviceName,
            formatINR(r.rate),
            formatINR(r.netAmount),
            formatINR(r.shdplAmount),
            formatINR(r.vedaShare),
            formatINR(r.sodaniShare)
          ]);
        } else {
          headers = Object.keys(records[0] || {});
          rows = records.map((r: any) => Object.values(r));
        }

        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: 28,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [15, 118, 110] }
        });

        doc.save(`pathology_${reportType.toLowerCase()}_${Date.now()}.pdf`);
      } else {
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `pathology_${reportType.toLowerCase()}_${Date.now()}.xlsx`);
      }

      setLastExported(`Successfully downloaded ${format} report at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Download className="w-5 h-5 text-teal-400" />
          <span>Financial Data & Reports Export Center</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate formatted Excel, CSV, and PDF downloads with date boundaries and institutional group filters
        </p>
      </div>

      <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        {/* Report Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Select Report Dataset
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'ALL_BILLS', label: 'All Billing Records' },
              { id: 'DAILY', label: 'Date-wise Daily Report' },
              { id: 'MONTHLY', label: 'Monthly Summary' },
              { id: 'GROUP', label: 'Billing Group Report' },
              { id: 'SERVICE', label: 'Service / Test Report' },
              { id: 'PATIENT', label: 'Patient-wise Report' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReportType(r.id)}
                className={`p-3 rounded-xl border text-left transition ${
                  reportType === r.id
                    ? 'border-teal-500/60 bg-teal-500/10 text-teal-300 font-semibold'
                    : 'border-slate-800 bg-slate-850/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs">{r.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Choose Output Format
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'EXCEL', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
              { id: 'CSV', label: 'CSV (.csv)', icon: FileSpreadsheet },
              { id: 'PDF', label: 'Printable PDF', icon: FileText },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id as any)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition ${
                    format === f.id
                      ? 'border-teal-500/60 bg-teal-500/15 text-teal-300 font-bold'
                      : 'border-slate-800 bg-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter boundaries */}
        <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-4">
          <div className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-teal-400" />
            <span>Optional Filter Boundaries</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Billing Group</label>
              <select
                value={billingGroup}
                onChange={(e) => setBillingGroup(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              >
                <option value="ALL">All Groups</option>
                {billingGroups.map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
              />
            </div>
          </div>
        </div>

        {lastExported && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{lastExported}</span>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 active:scale-98 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>{exporting ? 'Generating Document...' : `Export Now as ${format}`}</span>
        </button>
      </div>
    </div>
  );
};
