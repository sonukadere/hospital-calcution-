import React from 'react';
import { X, Receipt, CheckCircle, Clock, ShieldCheck, Scale, Trash2, Edit3, User, Calendar, Tag, AlertCircle } from 'lucide-react';
import { formatINR, formatDateTime, formatDate } from '../../utils/formatters';
import { BillingRecord } from '../../types';

interface BillDetailDrawerProps {
  bill: BillingRecord | null;
  onClose: () => void;
  onEdit: (bill: BillingRecord) => void;
  onDelete: (bill: BillingRecord) => void;
  onAdjustment: (bill: BillingRecord) => void;
  userRole: string;
}

export const BillDetailDrawer: React.FC<BillDetailDrawerProps> = ({
  bill,
  onClose,
  onEdit,
  onDelete,
  onAdjustment,
  userRole
}) => {
  if (!bill) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono">{bill.billNo}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    bill.settlementStatus === 'SETTLED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : bill.settlementStatus === 'PARTIALLY_SETTLED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-750 text-slate-400 border border-slate-700'
                  }`}
                >
                  {bill.settlementStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400">Visit ID: {bill.visitId} | S.No: {bill.sNo || '-'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Patient & Group banner */}
          <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                <User className="w-4 h-4 text-teal-400" />
                <span>{bill.patientName}</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-300 text-xs font-semibold">
                {bill.billingGroup}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Bill Date: {formatDate(bill.billDate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                <span>Service: {bill.serviceName}</span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="p-4 rounded-xl bg-slate-850/50 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Financial Breakdown
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Rate x Quantity ({bill.rate} x {bill.quantity}):</span>
                <span className="font-mono text-slate-200">{formatINR(bill.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Discount Amount:</span>
                <span className="font-mono text-amber-400">-{formatINR(bill.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-800 text-teal-300">
                <span>Net Payable Amount:</span>
                <span className="font-mono">{formatINR(bill.netAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400 pt-1">
                <span>Settled Amount to Date:</span>
                <span className="font-mono text-emerald-400">{formatINR(bill.settledAmount)}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Partner Share Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-850 to-slate-900 border border-teal-500/30 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Calculated Share Allocation</span>
              </h3>
              <span className="text-[10px] text-teal-300 font-mono">Precision 2-Decimal</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-lg bg-slate-800/80 border border-teal-500/20">
                <div className="text-[10px] text-slate-400">SHDPL Share</div>
                <div className="text-sm font-bold font-mono text-teal-300 mt-0.5">
                  {formatINR(bill.shdplAmount)}
                </div>
                <div className="text-[10px] text-teal-400/80 mt-1">{bill.shdplPercentage}%</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/80 border border-blue-500/20">
                <div className="text-[10px] text-slate-400">Veda Share</div>
                <div className="text-sm font-bold font-mono text-blue-300 mt-0.5">
                  {formatINR(bill.vedaShare)}
                </div>
                <div className="text-[10px] text-blue-400/80 mt-1">{bill.vedaSharePercent}%</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/80 border border-amber-500/20">
                <div className="text-[10px] text-slate-400">Sodani Share</div>
                <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                  {formatINR(bill.sodaniShare)}
                </div>
                <div className="text-[10px] text-amber-400/80 mt-1">{bill.sodaniSharePercent}%</div>
              </div>
            </div>
          </div>

          {/* Remarks & System Metadata */}
          <div className="text-xs text-slate-400 space-y-1.5 p-3 rounded-lg bg-slate-850/40 border border-slate-800">
            <div>
              <strong className="text-slate-300">Remarks:</strong> {bill.remarks || 'None'}
            </div>
            <div>
              <strong className="text-slate-300">Created By:</strong> {bill.createdByName || 'System'} on {formatDateTime(bill.createdAt)}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-850/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(userRole === 'SUPER_ADMIN' || userRole === 'ACCOUNTANT') && (
              <button
                onClick={() => onAdjustment(bill)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>Adjust / Refund</span>
              </button>
            )}
            {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
              <button
                onClick={() => onDelete(bill)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>

          <button
            onClick={() => onEdit(bill)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold transition shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Record</span>
          </button>
        </div>
      </div>
    </div>
  );
};
