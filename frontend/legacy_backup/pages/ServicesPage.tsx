import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Layers,
  Activity,
  ArrowUpDown,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { formatINR } from '../utils/formatters';
import { PathologyService } from '../types';

interface ServicesPageProps {
  userRole: string;
  onRefresh: () => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ userRole, onRefresh }) => {
  const [services, setServices] = useState<PathologyService[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<'name' | 'defaultRate' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Add / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<PathologyService | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Biochemistry');
  const [testCode, setTestCode] = useState('');
  const [defaultRate, setDefaultRate] = useState(350);
  const [shdplRate, setShdplRate] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/services');
      if (res.success) {
        setServices(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleSyncRateList = async () => {
    if (!window.confirm('Re-sync and update all tests and tariffs from sample_data rate lists?')) return;
    setSyncing(true);
    try {
      const res = await ApiClient.post<any>('/services/sync-rate-list', {});
      if (res.success) {
        alert(res.message || 'Rate list successfully synchronized!');
        await fetchServices();
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to sync rate list');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingService(null);
    setName('');
    setCategory('Biochemistry');
    setTestCode('');
    setDefaultRate(350);
    setShdplRate(182);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (s: PathologyService) => {
    setEditingService(s);
    setName(s.name);
    setCategory(s.category);
    setTestCode(s.testCode || '');
    setDefaultRate(s.defaultRate);
    setShdplRate(s.shdplRate || Math.round(s.defaultRate * 0.52 * 100) / 100);
    setShowAddModal(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingService) {
        await ApiClient.put(`/services/${editingService.id}`, {
          name,
          category,
          testCode,
          defaultRate,
          shdplRate
        });
      } else {
        await ApiClient.post('/services', {
          name,
          category,
          testCode,
          defaultRate,
          shdplRate
        });
      }
      setShowAddModal(false);
      await fetchServices();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save test service');
    } finally {
      setSubmitting(false);
    }
  };

  // Derive all unique categories with counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of services) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [services]);

  const uniqueCategories = useMemo(() => {
    return Object.keys(categoryCounts).sort();
  }, [categoryCounts]);

  // Filtered & Sorted services
  const filteredServices = useMemo(() => {
    const q = search.toLowerCase().trim();
    return services
      .filter((s) => {
        const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.testCode && s.testCode.toLowerCase().includes(q)) ||
          s.serviceId.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [services, search, selectedCategory, sortField, sortOrder]);

  // Pagination calculation
  const totalRecords = filteredServices.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, pageSize]);

  const toggleSort = (field: 'name' | 'defaultRate' | 'category') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getCategoryBadgeClass = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('biochem')) return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
    if (c.includes('haemat') || c.includes('hemat')) return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
    if (c.includes('immun')) return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
    if (c.includes('xray') || c.includes('x-ray')) return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
    if (c.includes('ct') || c.includes('scan')) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    if (c.includes('outsource')) return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
    if (c.includes('microbio')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    if (c.includes('serol')) return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const avgTariff = useMemo(() => {
    if (!services.length) return 0;
    const total = services.reduce((acc, s) => acc + s.defaultRate, 0);
    return Math.round(total / services.length);
  }, [services]);

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <span>Pathology & Investigation Service Catalog</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Standard tariff rate list, test codes, diagnostic departments, and SHDPL 52% baseline shares
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <>
              <button
                onClick={handleSyncRateList}
                disabled={syncing}
                title="Re-synchronize tests from sample_data Excel lists"
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing Rate List...' : 'Sync Rate List'}</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 active:scale-95 transition"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Test Service</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Total Services</div>
            <div className="text-base font-bold text-white font-mono">{services.length.toLocaleString()}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Active Tariff Tests</div>
            <div className="text-base font-bold text-emerald-300 font-mono">
              {services.filter((s) => s.status === 'ACTIVE').length.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Departments / Modalities</div>
            <div className="text-base font-bold text-purple-300 font-mono">{uniqueCategories.length}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Average Tariff</div>
            <div className="text-base font-bold text-amber-300 font-mono">{formatINR(avgTariff)}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search test name, code (e.g. 9014910, CBC), department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-850 border border-slate-750 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Selector & Page Size */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Department:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-850 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="ALL">All Departments ({services.length})</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c} ({categoryCounts[c]})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1.5 rounded-lg bg-slate-850 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-lg font-medium transition whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            All ({services.length})
          </button>
          {uniqueCategories.slice(0, 8).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat} ({categoryCounts[cat]})
            </button>
          ))}
          {uniqueCategories.length > 8 && selectedCategory !== 'ALL' && !uniqueCategories.slice(0, 8).includes(selectedCategory) && (
            <button
              onClick={() => setSelectedCategory(selectedCategory)}
              className="px-3 py-1 rounded-lg font-bold bg-teal-500 text-slate-950 whitespace-nowrap"
            >
              {selectedCategory} ({categoryCounts[selectedCategory]})
            </button>
          )}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850/90 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3.5 w-32">Test Code / ID</th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition select-none"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Investigation / Service Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:text-slate-200 transition select-none"
                  onClick={() => toggleSort('category')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Department</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-200 transition select-none"
                  onClick={() => toggleSort('defaultRate')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Standard Tariff (₹)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="px-4 py-3.5 text-right text-teal-300">
                  <span>SHDPL Rate (52%)</span>
                </th>
                <th className="px-4 py-3.5 text-center">Status</th>
                {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                  <th className="px-4 py-3.5 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                    <span>Loading rate list services...</span>
                  </td>
                </tr>
              ) : paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans">
                    <FlaskConical className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <span>No services found matching your criteria.</span>
                  </td>
                </tr>
              ) : (
                paginatedServices.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 text-teal-400 font-bold">
                      <span className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20">
                        {s.testCode || s.serviceId}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryBadgeClass(
                          s.category
                        )}`}
                      >
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-100">
                      {formatINR(s.defaultRate)}
                    </td>
                    <td className="px-4 py-3 text-right text-teal-300 font-bold">
                      {formatINR(s.shdplRate ?? Math.round(s.defaultRate * 0.52 * 100) / 100)}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          title="Edit Service Tariff"
                          className="p-1 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-850/60 text-xs text-slate-400 gap-3">
          <div>
            Showing <span className="text-slate-200 font-semibold">{totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="text-slate-200 font-semibold">{Math.min(currentPage * pageSize, totalRecords)}</span> of{' '}
            <span className="text-slate-200 font-semibold">{totalRecords.toLocaleString()}</span> services
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 text-slate-300 font-mono">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-teal-400" />
                <span>{editingService ? 'Edit Test Service' : 'Add New Investigation / Test'}</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Investigation / Test Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Creatinine Serum"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Test Code / ID</label>
                  <input
                    type="text"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="e.g. 9014910"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono uppercase focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Biochemistry"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Standard Rate (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={defaultRate}
                    onChange={(e) => {
                      const r = parseFloat(e.target.value) || 0;
                      setDefaultRate(r);
                      setShdplRate(Math.round(r * 0.52 * 100) / 100);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">SHDPL Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shdplRate ?? ''}
                    onChange={(e) => setShdplRate(parseFloat(e.target.value) || undefined)}
                    placeholder="Auto 52%"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingService ? 'Update Service' : 'Add Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
