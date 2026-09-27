import React, { useState } from 'react';
import { X, Scale, AlertTriangle } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { formatINR } from '../../utils/formatters';
import { BillingRecord } from '../../types';

interface AdjustmentModalProps {
  bill: BillingRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdjustmentModal: React.FC<AdjustmentModalProps> = ({
  bill,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [type, setType] = useState('REFUND');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('Dr. Sharma (Medical Director)');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !bill) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) return setErrorMsg('Amount must be greater than zero');
    if (!reason.trim()) return setErrorMsg('Adjustment reason is strictly required');

    setLoading(true);
    try {
      await ApiClient.post('/adjustments', {
        billingRecordId: bill.id,
        type,
        amount,
        reason: reason.trim(),
        approvedBy
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Record Controlled Adjustment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-800/60 text-xs text-slate-300 space-y-1 font-mono">
            <div>Bill No: <strong>{bill.billNo}</strong></div>
            <div>Patient: <strong>{bill.patientName}</strong></div>
            <div>Current Net Amount: <strong>{formatINR(bill.netAmount)}</strong></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Adjustment Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="REFUND">Patient Refund</option>
              <option value="DISCOUNT_ADJUSTMENT">Post-Bill Discount Adjustment</option>
              <option value="BILLING_CORRECTION">Billing Correction</option>
              <option value="SHARE_ADJUSTMENT">Partner Share Adjustment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Adjustment Amount (₹) *
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={bill.netAmount}
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 50"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Approval Authority
            </label>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Reason / Compliance Justification *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detailed reason for auditing purposes..."
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs active:scale-95 transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
