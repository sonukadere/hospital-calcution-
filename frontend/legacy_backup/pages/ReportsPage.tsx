import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Printer, Calendar, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ApiClient } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'daily' | 'monthly' | 'group' | 'service' | 'patient'>('daily');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let endpoint = '/reports/daily';
      if (activeReport === 'monthly') endpoint = '/reports/monthly';
      else if (activeReport === 'group') endpoint = '/reports/billing-group';
      else if (activeReport === 'service') endpoint = '/reports/service';
      else if (activeReport === 'patient') endpoint = '/reports/patient';

      const res = await ApiClient.get<any>(endpoint);
      if (res.success) setData(res.data);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${activeReport}_report`);
    XLSX.writeFile(wb, `pathology_${activeReport}_report_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-400" />
            <span>Pathology Financial & Analytical Reports</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated revenue audits, billing groups, service volumes, and patient ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export Report (Excel)</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
        {[
          { id: 'daily', label: 'Daily Ledger Report' },
          { id: 'monthly', label: 'Monthly Executive Summary' },
          { id: 'group', label: 'Billing Group Report' },
          { id: 'service', label: 'Service / Test-wise Report' },
          { id: 'patient', label: 'Patient-wise Report' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-3.5 py-2 rounded-lg font-semibold transition ${
              activeReport === tab.id
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Tables */}
      <div className="p-5 rounded-2xl glass-panel space-y-4">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Generating financial aggregation report...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            {/* 1. Daily Report */}
            {activeReport === 'daily' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 border-b border-slate-800 text-slate-300 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Bills Count</th>
                    <th className="px-4 py-3 text-right">Patients</th>
                    <th className="px-4 py-3 text-right">Gross Amount</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right text-teal-400">Net Revenue</th>
                    <th className="px-4 py-3 text-right text-teal-300">SHDPL (52%)</th>
                    <th className="px-4 py-3 text-right text-blue-300">Veda (20%)</th>
                    <th className="px-4 py-3 text-right text-amber-300">Sodani (28%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
                  {data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-sans font-medium text-slate-100">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5 text-right">{r.totalBills}</td>
                      <td className="px-4 py-2.5 text-right">{r.totalPatients}</td>
                      <td className="px-4 py-2.5 text-right">{formatINR(r.grossAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400">{formatINR(r.discountAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-teal-300">{formatINR(r.netAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-teal-400">{formatINR(r.shdplAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-300">{formatINR(r.vedaShare)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-300">{formatINR(r.sodaniShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 2. Monthly Report */}
            {activeReport === 'monthly' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 border-b border-slate-800 text-slate-300 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">Total Bills</th>
                    <th className="px-4 py-3 text-right">Tests Conducted</th>
                    <th className="px-4 py-3 text-right">Gross Revenue</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right text-teal-400">Net Revenue</th>
                    <th className="px-4 py-3 text-right text-teal-300">SHDPL Share</th>
                    <th className="px-4 py-3 text-right text-blue-300">Veda Share</th>
                    <th className="px-4 py-3 text-right text-amber-300">Sodani Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
                  {data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-bold font-sans text-teal-300">{r.month}</td>
                      <td className="px-4 py-2.5 text-right">{r.totalBills}</td>
                      <td className="px-4 py-2.5 text-right">{r.totalTests}</td>
                      <td className="px-4 py-2.5 text-right">{formatINR(r.grossAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400">{formatINR(r.discountAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-teal-300">{formatINR(r.netAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-teal-400">{formatINR(r.shdplAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-300">{formatINR(r.vedaShare)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-300">{formatINR(r.sodaniShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. Billing Group Report */}
            {activeReport === 'group' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 border-b border-slate-800 text-slate-300 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Billing Group</th>
                    <th className="px-4 py-3 text-right">Bills Count</th>
                    <th className="px-4 py-3 text-right">Tests Conducted</th>
                    <th className="px-4 py-3 text-right">Gross Revenue</th>
                    <th className="px-4 py-3 text-right text-teal-400">Net Revenue</th>
                    <th className="px-4 py-3 text-right text-teal-300">SHDPL Share</th>
                    <th className="px-4 py-3 text-right text-blue-300">Veda Share</th>
                    <th className="px-4 py-3 text-right text-amber-300">Sodani Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
                  {data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-sans font-bold text-white">{r.billingGroup}</td>
                      <td className="px-4 py-2.5 text-right">{r.totalBills}</td>
                      <td className="px-4 py-2.5 text-right">{r.totalTests}</td>
                      <td className="px-4 py-2.5 text-right">{formatINR(r.grossAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-teal-300">{formatINR(r.netAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-teal-400">{formatINR(r.shdplAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-300">{formatINR(r.vedaShare)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-300">{formatINR(r.sodaniShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 4. Service-wise Report */}
            {activeReport === 'service' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 border-b border-slate-800 text-slate-300 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Pathology Test / Service</th>
                    <th className="px-4 py-3 text-right">Tests Conducted</th>
                    <th className="px-4 py-3 text-right">Avg Rate</th>
                    <th className="px-4 py-3 text-right">Gross Total</th>
                    <th className="px-4 py-3 text-right text-teal-400">Net Revenue</th>
                    <th className="px-4 py-3 text-right text-teal-300">SHDPL (52%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
                  {data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-sans font-medium text-slate-100">{r.serviceName}</td>
                      <td className="px-4 py-2.5 text-right">{r.testsCount}</td>
                      <td className="px-4 py-2.5 text-right">{formatINR(r.avgRate)}</td>
                      <td className="px-4 py-2.5 text-right">{formatINR(r.totalGross)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-teal-300">{formatINR(r.totalNet)}</td>
                      <td className="px-4 py-2.5 text-right text-teal-400">{formatINR(r.shdplAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 5. Patient-wise Report */}
            {activeReport === 'patient' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 border-b border-slate-800 text-slate-300 font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Patient ID</th>
                    <th className="px-4 py-3">Patient Name</th>
                    <th className="px-4 py-3">Billing Group</th>
                    <th className="px-4 py-3 text-right">Visits</th>
                    <th className="px-4 py-3 text-right">Tests</th>
                    <th className="px-4 py-3 text-right text-teal-300">Lifetime Billing</th>
                    <th className="px-4 py-3">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
                  {data.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 text-teal-400">{r.patientId}</td>
                      <td className="px-4 py-2.5 font-sans font-medium text-white">{r.patientName}</td>
                      <td className="px-4 py-2.5 font-sans text-slate-300">{r.billingGroup}</td>
                      <td className="px-4 py-2.5 text-right">{r.visitsCount}</td>
                      <td className="px-4 py-2.5 text-right">{r.testsCount}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-teal-300">{formatINR(r.totalBilling)}</td>
                      <td className="px-4 py-2.5 font-sans text-slate-400">{formatDate(r.lastVisitDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
