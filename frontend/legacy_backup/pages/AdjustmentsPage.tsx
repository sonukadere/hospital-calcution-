import React, { useState, useEffect } from 'react';
import { Scale, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ApiClient } from '../api/client';
import { formatINR, formatDateTime } from '../utils/formatters';

export const AdjustmentsPage: React.FC = () => {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/adjustments');
      if (res.success) setAdjustments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-400" />
          <span>Controlled Adjustments & Refund Ledger</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Audited log of post-bill refunds, discount adjustments, and share recalibrations with mandatory authorization
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Bill No.</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Adjustment Type</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3">Reason / Justification</th>
                <th className="px-4 py-3">Approved By</th>
                <th className="px-4 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    Loading adjustments...
                  </td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    No adjustments or refunds recorded yet.
                  </td>
                </tr>
              ) : (
                adjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400 font-sans">{formatDateTime(a.createdAt)}</td>
                    <td className="px-4 py-3 font-bold text-teal-400">{a.billingRecord?.billNo}</td>
                    <td className="px-4 py-3 font-sans text-slate-200">{a.billingRecord?.patientName}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-400">{formatINR(a.amount)}</td>
                    <td className="px-4 py-3 font-sans text-slate-300 max-w-xs">{a.reason}</td>
                    <td className="px-4 py-3 font-sans text-slate-400">{a.approvedBy}</td>
                    <td className="px-4 py-3 font-sans text-slate-400">{a.createdBy}</td>
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
