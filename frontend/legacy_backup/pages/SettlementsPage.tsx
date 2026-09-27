import React, { useState, useEffect } from 'react';
import { Landmark, Plus, CheckCircle, Clock, ArrowUpRight, ShieldCheck, Download } from 'lucide-react';
import { ApiClient } from '../api/client';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';
import { SettlementOverview } from '../types';
import { SettlementModal } from '../components/settlement/SettlementModal';

interface SettlementsPageProps {
  userRole: string;
}

export const SettlementsPage: React.FC<SettlementsPageProps> = ({ userRole }) => {
  const [overview, setOverview] = useState<SettlementOverview | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState('SHDPL');
  const [unsettledTarget, setUnsettledTarget] = useState(0);

  const fetchSettlementData = async () => {
    setLoading(true);
    try {
      const [overviewRes, listRes] = await Promise.all([
        ApiClient.get<any>('/settlements/overview'),
        ApiClient.get<any>('/settlements')
      ]);
      if (overviewRes.success) setOverview(overviewRes.data);
      if (listRes.success) setSettlements(listRes.data);
    } catch (err) {
      console.error('Settlements error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlementData();
  }, []);

  const openSettle = (partner: string, unsettled: number) => {
    setSelectedPartner(partner);
    setUnsettledTarget(unsettled);
    setIsModalOpen(true);
  };

  const partners = overview?.partners;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5 text-teal-400" />
            <span>Revenue Share Settlement & Payout Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track settled liabilities, outstanding partner shares, and record bank NEFT/RTGS payouts
          </p>
        </div>

        {(userRole === 'SUPER_ADMIN' || userRole === 'ACCOUNTANT') && (
          <button
            onClick={() => openSettle('SHDPL', partners?.SHDPL?.unsettled || 0)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Settlement Payout</span>
          </button>
        )}
      </div>

      {/* Partner Liability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SHDPL */}
        <div className="p-5 rounded-2xl glass-card border border-teal-500/40 metric-glow-teal space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white font-mono">SHDPL (52% Share)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300">
              Primary Partner
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-850/60">
              <div className="text-slate-400 text-[11px]">Total Share Earned</div>
              <div className="text-base font-bold font-mono text-white mt-1">
                {formatINR(partners?.SHDPL?.totalShare || 0)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850/60">
              <div className="text-slate-400 text-[11px]">Settled to Date</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                {formatINR(partners?.SHDPL?.settled || 0)}
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-rose-300/90 font-medium">Unsettled Balance</div>
              <div className="text-lg font-extrabold font-mono text-rose-400">
                {formatINR(partners?.SHDPL?.unsettled || 0)}
              </div>
            </div>
            <button
              onClick={() => openSettle('SHDPL', partners?.SHDPL?.unsettled || 0)}
              className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-xs transition"
            >
              Settle
            </button>
          </div>
        </div>

        {/* VEDA */}
        <div className="p-5 rounded-2xl glass-card border border-blue-500/40 metric-glow-blue space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white font-mono">VEDA (20% Share)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
              Partner
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-850/60">
              <div className="text-slate-400 text-[11px]">Total Share Earned</div>
              <div className="text-base font-bold font-mono text-white mt-1">
                {formatINR(partners?.VEDA?.totalShare || 0)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850/60">
              <div className="text-slate-400 text-[11px]">Settled to Date</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                {formatINR(partners?.VEDA?.settled || 0)}
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-rose-300/90 font-medium">Unsettled Balance</div>
              <div className="text-lg font-extrabold font-mono text-rose-400">
                {formatINR(partners?.VEDA?.unsettled || 0)}
              </div>
            </div>
            <button
              onClick={() => openSettle('VEDA', partners?.VEDA?.unsettled || 0)}
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-slate-950 font-bold text-xs transition"
            >
              Settle
            </button>
          </div>
        </div>

        {/* SODANI */}
        <div className="p-5 rounded-2xl glass-card border border-amber-500/40 metric-glow-amber space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white font-mono">SODANI (28% Share)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
              Partner
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-850/60">
              <div className="text-slate-400 text-[11px]">Total Share Earned</div>
              <div className="text-base font-bold font-mono text-white mt-1">
                {formatINR(partners?.SODANI?.totalShare || 0)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-850/60">
              <div className="text-slate-400 text-[11px]">Settled to Date</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                {formatINR(partners?.SODANI?.settled || 0)}
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-rose-300/90 font-medium">Unsettled Balance</div>
              <div className="text-lg font-extrabold font-mono text-rose-400">
                {formatINR(partners?.SODANI?.unsettled || 0)}
              </div>
            </div>
            <button
              onClick={() => openSettle('SODANI', partners?.SODANI?.unsettled || 0)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition"
            >
              Settle
            </button>
          </div>
        </div>
      </div>

      {/* Settlements Transaction Ledger */}
      <div className="p-5 rounded-2xl glass-panel space-y-4">
        <h2 className="text-sm font-bold text-white">Settlement Payout History</h2>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Settlement Ref</th>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3">Txn / UTR Ref</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                    No settlement records found.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-teal-400">{s.settlementRef}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-200">
                        {s.partnerName}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400">{formatDate(s.paymentDate)}</td>
                    <td className="px-4 py-3 font-sans text-slate-300">{s.paymentMode}</td>
                    <td className="px-4 py-3 text-slate-400">{s.transactionRef || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      {formatINR(s.totalAmount)}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400">{s.createdByName || 'Accountant'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SettlementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSettlementData}
        defaultPartner={selectedPartner}
        unsettledAmount={unsettledTarget}
      />
    </div>
  );
};
