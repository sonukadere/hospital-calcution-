import React, { useState, useEffect } from 'react';
import { PercentSquare, Plus, CheckCircle2, ShieldCheck, AlertCircle, Calendar } from 'lucide-react';
import { ApiClient } from '../api/client';
import { formatDate } from '../utils/formatters';
import { ShareConfig, BillingGroup, PathologyService } from '../types';

interface ShareConfigPageProps {
  billingGroups: BillingGroup[];
  services: PathologyService[];
  userRole: string;
}

export const ShareConfigPage: React.FC<ShareConfigPageProps> = ({ billingGroups, services, userRole }) => {
  const [configs, setConfigs] = useState<ShareConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [partnerName, setPartnerName] = useState('SHDPL');
  const [percentage, setPercentage] = useState(52);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [billingGroupId, setBillingGroupId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/share-configs');
      if (res.success) {
        setConfigs(res.data);
      }
    } catch (err) {
      console.error('Error fetching configs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await ApiClient.post('/share-configs', {
        partnerName,
        percentage,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        billingGroupId: billingGroupId || null,
        serviceId: serviceId || null
      });
      setShowAddModal(false);
      fetchConfigs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save share rule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <PercentSquare className="w-5 h-5 text-teal-400" />
            <span>Revenue Share Configuration Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure dynamic non-hardcoded partner sharing percentages with date-effective rules and group overrides.
          </p>
        </div>

        {userRole === 'SUPER_ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Share Configuration Rule</span>
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-teal-500/30 flex items-start gap-3 text-xs text-slate-300 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white block">Historical Immutability Protected:</span>
          Modifying or creating a share rule takes effect only for transactions dated within the rule's active window.
          Historical billing records permanently retain their snapshot calculations for GAAP compliance.
        </div>
      </div>

      {/* Active Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {configs.map((cfg) => {
          const isShdpl = cfg.partnerName.toUpperCase() === 'SHDPL';
          const isVeda = cfg.partnerName.toUpperCase() === 'VEDA';
          const isSodani = cfg.partnerName.toUpperCase() === 'SODANI';

          return (
            <div
              key={cfg.id}
              className={`p-5 rounded-2xl glass-card border space-y-4 ${
                isShdpl
                  ? 'border-teal-500/40 metric-glow-teal'
                  : isVeda
                  ? 'border-blue-500/40 metric-glow-blue'
                  : isSodani
                  ? 'border-amber-500/40 metric-glow-amber'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-slate-200 uppercase font-mono">
                  {cfg.partnerName}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  {cfg.status}
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-3xl font-extrabold text-white font-mono">
                  {cfg.percentage}%
                </div>
                <div className="text-xs text-slate-400">
                  Revenue Allocation Percentage
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Effective From:</span>
                  <span className="font-mono text-slate-200">{formatDate(cfg.effectiveFrom)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Effective To:</span>
                  <span className="font-mono text-slate-200">{cfg.effectiveTo ? formatDate(cfg.effectiveTo) : 'Indefinite (Active)'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Scope:</span>
                  <span className="text-slate-300 font-semibold">
                    {cfg.billingGroupId ? 'Group Override' : cfg.serviceId ? 'Service Override' : 'Global Default'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Share Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Add Revenue Share Rule</h2>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateConfig} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Partner Name *</label>
                <select
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                >
                  <option value="SHDPL">SHDPL</option>
                  <option value="VEDA">VEDA</option>
                  <option value="SODANI">SODANI</option>
                  <option value="OTHER">OTHER PARTNER</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Share Percentage (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Effective To (Optional)</label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
