import React, { useState } from 'react';
import { Building2, Plus, Percent, ShieldCheck } from 'lucide-react';
import { ApiClient } from '../api/client';
import { BillingGroup } from '../types';

interface BillingGroupsPageProps {
  billingGroups: BillingGroup[];
  userRole: string;
  onRefresh: () => void;
}

export const BillingGroupsPage: React.FC<BillingGroupsPageProps> = ({ billingGroups, userRole, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [defaultDiscount, setDefaultDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.post('/billing-groups', {
        name,
        code,
        defaultDiscountPercent: defaultDiscount
      });
      setShowAddModal(false);
      setName('');
      setCode('');
      setDefaultDiscount(0);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            <span>Billing Group Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure institutional programs (Ayushman Bharat, CGHS, Corporate, Private, Insurance)
          </p>
        </div>

        {userRole === 'SUPER_ADMIN' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Billing Group</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {billingGroups.map((g) => (
          <div key={g.id} className="p-5 rounded-2xl glass-card border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 text-teal-300 font-mono">
                {g.code}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                {g.status}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">{g.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Default Discount Tariff: <strong className="text-teal-400">{g.defaultDiscountPercent}%</strong>
              </p>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Create Billing Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Group Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. RAILWAYS HEALTH SCHEME"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Group Code *</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. RHS"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Default Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultDiscount}
                  onChange={(e) => setDefaultDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono"
                />
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
                  {submitting ? 'Creating...' : 'Save Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
