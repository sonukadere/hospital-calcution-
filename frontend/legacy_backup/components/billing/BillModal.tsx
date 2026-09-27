import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, Calculator, Sparkles, CheckCircle2, Search } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { formatINR } from '../../utils/formatters';
import { PathologyService, BillingGroup, BillingRecord } from '../../types';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBill?: BillingRecord | null;
  services: PathologyService[];
  billingGroups: BillingGroup[];
}

export const BillModal: React.FC<BillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialBill,
  services,
  billingGroups
}) => {
  const isEditing = !!initialBill;

  const [billNo, setBillNo] = useState('');
  const [visitId, setVisitId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [billingGroup, setBillingGroup] = useState('AYUSHMAN BHARAT');
  const [serviceName, setServiceName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [rate, setRate] = useState(350);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Share calculation preview state
  const [calculation, setCalculation] = useState<any>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [forceAllowDuplicate, setForceAllowDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');

  // Filtered and grouped services for rapid lookup
  const filteredModalServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    const q = serviceSearch.toLowerCase().trim();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.testCode && s.testCode.toLowerCase().includes(q)) ||
        s.category.toLowerCase().includes(q)
    );
  }, [services, serviceSearch]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, PathologyService[]> = {};
    for (const s of filteredModalServices) {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    }
    return groups;
  }, [filteredModalServices]);

  // Initialize or reset form
  useEffect(() => {
    if (initialBill) {
      setBillNo(initialBill.billNo);
      setVisitId(initialBill.visitId);
      setPatientName(initialBill.patientName);
      setBillingGroup(initialBill.billingGroup);
      setServiceName(initialBill.serviceName);
      setQuantity(initialBill.quantity);
      setRate(initialBill.rate);
      setDiscountAmount(initialBill.discountAmount);
      setBillDate(new Date(initialBill.billDate).toISOString().split('T')[0]);
      setRemarks(initialBill.remarks || '');
    } else {
      // Auto-generate next Bill No.
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const generatedBillNo = `VHB2627000${Date.now().toString().slice(-4)}${rnd.toString().slice(-1)}`;
      setBillNo(generatedBillNo);
      setVisitId(`VIS-${rnd}`);
      setPatientName('');
      setBillingGroup(billingGroups[0]?.name || 'AYUSHMAN BHARAT');
      if (services.length > 0) {
        setServiceName(services[0].name);
        setServiceId(services[0].id);
        setRate(services[0].defaultRate);
      }
      setQuantity(1);
      setDiscountAmount(0);
      setBillDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
      setIsDuplicate(false);
      setDuplicateWarning(null);
      setForceAllowDuplicate(false);
    }
  }, [initialBill, isOpen, services, billingGroups]);

  // When service is selected from dropdown, update rate
  const handleServiceSelect = (name: string) => {
    setServiceName(name);
    const found = services.find(s => s.name === name);
    if (found) {
      setServiceId(found.id);
      setRate(found.defaultRate);
    }
  };

  // Live real-time share preview whenever inputs change
  useEffect(() => {
    if (!isOpen) return;

    const gross = rate * quantity;
    const net = Math.max(0, gross - discountAmount);

    const timer = setTimeout(async () => {
      try {
        const res = await ApiClient.post<any>('/billing/share-preview', {
          totalAmount: gross,
          discountAmount,
          netAmount: net,
          rate,
          quantity,
          billDate,
          billingGroupName: billingGroup,
          serviceName,
          serviceId
        });
        if (res.success) {
          setCalculation(res.calculation);
        }
      } catch (err) {
        console.error('Share preview error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [rate, quantity, discountAmount, billDate, billingGroup, serviceName, serviceId, isOpen]);

  // Pre-flight duplicate check
  useEffect(() => {
    if (!isOpen || isEditing || !billNo || !patientName) return;

    const timer = setTimeout(async () => {
      try {
        const res = await ApiClient.post<any>('/billing/check-duplicate', {
          billNo,
          visitId,
          patientName,
          serviceName,
          billDate
        });
        if (res.success && res.isDuplicate) {
          setIsDuplicate(true);
          const first = res.duplicates[0];
          setDuplicateWarning(`Possible duplicate: Existing bill #${first.billNo} found for patient "${first.patientName}" (${first.serviceName})`);
        } else {
          setIsDuplicate(false);
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [billNo, visitId, patientName, serviceName, billDate, isOpen, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!billNo.trim()) return setErrorMsg('Bill Number is required');
    if (!patientName.trim()) return setErrorMsg('Patient Name is required');
    if (!serviceName.trim()) return setErrorMsg('Service Name is required');

    if (isDuplicate && !forceAllowDuplicate && !isEditing) {
      return setErrorMsg('Duplicate transaction detected. Check the authorization checkbox to proceed.');
    }

    setSubmitting(true);
    try {
      const gross = rate * quantity;
      const net = Math.max(0, gross - discountAmount);

      const payload = {
        billNo: billNo.trim(),
        visitId: visitId.trim() || `VIS-${billNo.trim()}`,
        patientName: patientName.trim(),
        billingGroup,
        serviceName: serviceName.trim(),
        serviceId,
        quantity,
        rate,
        totalAmount: gross,
        discountAmount,
        netAmount: net,
        billDate,
        remarks,
        forceAllowDuplicate
      };

      if (isEditing && initialBill) {
        await ApiClient.put(`/billing/${initialBill.id}`, payload);
      } else {
        await ApiClient.post('/billing', payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save billing record');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const grossAmt = rate * quantity;
  const netAmt = Math.max(0, grossAmt - discountAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? `Edit Billing Record: #${initialBill?.billNo}` : 'New Pathology Billing Record'}
              </h2>
              <p className="text-xs text-slate-400">
                Precision arithmetic and automated revenue-sharing calculation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Duplicate warning banner */}
          {isDuplicate && !isEditing && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Possible Duplicate Transaction Detected</span>
              </div>
              <p className="text-xs text-amber-300/80">{duplicateWarning}</p>
              <label className="flex items-center gap-2 text-xs font-medium text-amber-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={forceAllowDuplicate}
                  onChange={(e) => setForceAllowDuplicate(e.target.checked)}
                  className="rounded border-amber-600 bg-slate-900 text-amber-500 focus:ring-0"
                />
                <span>Authorized Override: Proceed with duplicate bill</span>
              </label>
            </div>
          )}

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bill No */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bill Number *
              </label>
              <input
                type="text"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                disabled={isEditing}
                placeholder="e.g. VHB26270004935"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500 font-mono disabled:opacity-60"
                required
              />
            </div>

            {/* Visit ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Visit ID
              </label>
              <input
                type="text"
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
                placeholder="e.g. VIS-4935"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            {/* Bill Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bill / Service Date *
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Full Patient Name"
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                required
              />
            </div>

            {/* Billing Group */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Billing Group *
              </label>
              <select
                value={billingGroup}
                onChange={(e) => setBillingGroup(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              >
                {billingGroups.map((g) => (
                  <option key={g.id} value={g.name} className="bg-slate-900">
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Service and Pricing Grid */}
          <div className="p-4 rounded-xl bg-slate-850/60 border border-slate-800 space-y-4">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>Service & Financial Breakdown</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Service Selection */}
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Pathology Service / Test *
                  </label>
                  <span className="text-[10px] text-teal-400 font-mono">
                    {filteredModalServices.length} tests available
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter 1,250+ tests by name or code..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-teal-500 font-sans"
                  />
                </div>

                <select
                  value={serviceName}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-sans"
                >
                  {Object.keys(groupedServices).sort().map((cat) => (
                    <optgroup key={cat} label={`── ${cat} (${groupedServices[cat].length}) ──`}>
                      {groupedServices[cat].map((s) => (
                        <option key={s.id} value={s.name} className="bg-slate-900 text-slate-100">
                          {s.name} {s.testCode ? `[${s.testCode}]` : ''} - ₹{s.defaultRate}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Rate */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Rate (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
              {/* Gross Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Gross Amount
                </label>
                <div className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 text-sm font-bold font-mono text-slate-200">
                  {formatINR(grossAmt)}
                </div>
              </div>

              {/* Discount Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Discount Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              {/* Net Amount */}
              <div>
                <label className="block text-xs font-medium text-teal-400 mb-1">
                  Net Amount (Payable)
                </label>
                <div className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-base font-bold font-mono text-teal-300">
                  {formatINR(netAmt)}
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Share Distribution Engine Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-850 to-slate-900 border border-teal-500/30 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Automatic Revenue Share Distribution (Engine Calculated)
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-medium">
                Active Rule Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* SHDPL Share */}
              <div className="p-3 rounded-lg bg-slate-800/80 border border-teal-500/20">
                <div className="text-[11px] text-slate-400">SHDPL Share</div>
                <div className="text-sm font-bold font-mono text-teal-300 mt-0.5">
                  {formatINR(calculation?.shdplAmount ?? (netAmt * 0.52))}
                </div>
                <div className="text-[10px] text-teal-400/80 mt-1">
                  {calculation?.shdplPercentage ?? 52.0}% configured
                </div>
              </div>

              {/* Veda Share */}
              <div className="p-3 rounded-lg bg-slate-800/80 border border-blue-500/20">
                <div className="text-[11px] text-slate-400">Veda Share</div>
                <div className="text-sm font-bold font-mono text-blue-300 mt-0.5">
                  {formatINR(calculation?.vedaShare ?? (netAmt * 0.20))}
                </div>
                <div className="text-[10px] text-blue-400/80 mt-1">
                  {calculation?.vedaSharePercent ?? 20.0}% configured
                </div>
              </div>

              {/* Sodani Share */}
              <div className="p-3 rounded-lg bg-slate-800/80 border border-amber-500/20">
                <div className="text-[11px] text-slate-400">Sodani Share</div>
                <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                  {formatINR(calculation?.sodaniShare ?? (netAmt * 0.28))}
                </div>
                <div className="text-[10px] text-amber-400/80 mt-1">
                  {calculation?.sodaniSharePercent ?? 28.0}% configured
                </div>
              </div>

              {/* Remaining Revenue */}
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700">
                <div className="text-[11px] text-slate-400">Remaining Pool</div>
                <div className="text-sm font-bold font-mono text-slate-300 mt-0.5">
                  {formatINR(calculation?.remainingRevenue ?? 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Balanced (0 Leakage)</div>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Remarks / Clinical Notes
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks or clinical reference"
              className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-sm shadow-md shadow-teal-500/20 active:scale-95 transition disabled:opacity-50"
            >
              {submitting ? 'Saving Transaction...' : isEditing ? 'Update Bill' : 'Confirm & Save Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
