import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Calendar, Phone, MapPin, Receipt, ArrowRight, Eye, UserCheck } from 'lucide-react';
import { ApiClient } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Patient, BillingGroup } from '../types';

interface PatientsPageProps {
  billingGroups: BillingGroup[];
  onViewBillingHistory: (patientName: string) => void;
}

export const PatientsPage: React.FC<PatientsPageProps> = ({ billingGroups, onViewBillingHistory }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatientDetail, setSelectedPatientDetail] = useState<any | null>(null);

  // New patient state
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('MALE');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [billingGroupId, setBillingGroupId] = useState('AYUSHMAN BHARAT');
  const [submitting, setSubmitting] = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/patients', { search });
      if (res.success) setPatients(res.data);
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [search]);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await ApiClient.post('/patients', {
        name,
        age: age ? Number(age) : null,
        gender,
        mobile,
        address,
        referringDoctor,
        billingGroupId
      });
      setShowAddModal(false);
      setName('');
      setAge('');
      setMobile('');
      setAddress('');
      setReferringDoctor('');
      fetchPatients();
    } catch (err: any) {
      alert(err.message || 'Failed to create patient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPatient = async (p: Patient) => {
    try {
      const res = await ApiClient.get<any>(`/patients/${p.id}`);
      if (res.success) setSelectedPatientDetail(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            <span>Patient & Visit Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Registered patients, visit history logs, tests performed, and lifetime billing volume
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient name, ID, or mobile number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Patient Cards / Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Patient ID</th>
                <th className="px-4 py-3">Patient Name</th>
                <th className="px-4 py-3">Age / Gender</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Billing Group</th>
                <th className="px-4 py-3">Referring Doctor</th>
                <th className="px-4 py-3 text-right">Total Visits</th>
                <th className="px-4 py-3 text-right text-teal-300">Lifetime Billing</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    Loading patient profiles...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    No patients registered yet.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-teal-400 font-bold">{p.patientId}</td>
                    <td className="px-4 py-3 font-sans font-medium text-white">{p.name}</td>
                    <td className="px-4 py-3 font-sans text-slate-400">
                      {p.age ? `${p.age} Y` : '-'} / {p.gender || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.mobile || '-'}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {p.billingGroupId || 'PRIVATE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-300">{p.referringDoctor || 'Self / OPD'}</td>
                    <td className="px-4 py-3 text-right text-slate-200">{p.totalVisits}</td>
                    <td className="px-4 py-3 text-right font-bold text-teal-300">{formatINR(p.totalAmount)}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewPatient(p)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs transition"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => onViewBillingHistory(p.name)}
                          className="px-2.5 py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs transition"
                        >
                          Bills
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Profile Drawer */}
      {selectedPatientDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedPatientDetail.name}</h2>
                <p className="text-xs text-teal-400 font-mono">{selectedPatientDetail.patientId}</p>
              </div>
              <button
                onClick={() => setSelectedPatientDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-850">
                <span className="text-slate-400">Total Visits:</span>
                <span className="font-bold text-white block mt-1">{selectedPatientDetail.summary?.totalVisits}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-850">
                <span className="text-slate-400">Lifetime Spent:</span>
                <span className="font-bold text-teal-300 block mt-1 font-mono">
                  {formatINR(selectedPatientDetail.summary?.totalAmount)}
                </span>
              </div>
            </div>

            {/* Previous Tests Performed */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase">Tests & Investigations Performed</h3>
              <div className="flex flex-wrap gap-1.5">
                {(selectedPatientDetail.summary?.uniqueTests || []).map((t: string) => (
                  <span key={t} className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-300 text-xs font-medium border border-teal-500/20">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Billing History list */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase">Billing Ledger History</h3>
              <div className="space-y-1.5 text-xs font-mono">
                {selectedPatientDetail.billingRecords?.map((b: any) => (
                  <div key={b.id} className="p-3 rounded-lg bg-slate-850 border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">{b.billNo}</div>
                      <div className="text-[11px] text-slate-400 font-sans">{b.serviceName} ({formatDate(b.billDate)})</div>
                    </div>
                    <div className="text-right">
                      <div className="text-teal-300 font-bold">{formatINR(b.netAmount)}</div>
                      <div className="text-[10px] text-slate-400">{b.settlementStatus}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Register Patient Profile</h2>
            <form onSubmit={handleCreatePatient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mobile Contact</label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Referring Doctor</label>
                <input
                  type="text"
                  value={referringDoctor}
                  onChange={(e) => setReferringDoctor(e.target.value)}
                  placeholder="e.g. Dr. V.K. Singhal"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Billing Group</label>
                <select
                  value={billingGroupId}
                  onChange={(e) => setBillingGroupId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                >
                  {billingGroups.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
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
                  {submitting ? 'Registering...' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
