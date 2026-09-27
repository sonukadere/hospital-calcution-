import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Receipt,
  Download,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ApiClient } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { BillingRecord, BillingGroup, PathologyService } from '../types';

interface BillingPageProps {
  onNewBillClick: () => void;
  onViewBill: (bill: BillingRecord) => void;
  onEditBill: (bill: BillingRecord) => void;
  onDeleteBill: (bill: BillingRecord) => void;
  billingGroups: BillingGroup[];
  services: PathologyService[];
  userRole: string;
  refreshTrigger: number;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  onNewBillClick,
  onViewBill,
  onEditBill,
  onDeleteBill,
  billingGroups,
  services,
  userRole,
  refreshTrigger
}) => {
  const [bills, setBills] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState('billDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/billing', {
        search,
        page,
        limit,
        billingGroup: selectedGroup,
        serviceName: selectedService,
        settlementStatus: selectedStatus,
        startDate,
        endDate,
        sortBy,
        sortOrder
      });

      if (res.success) {
        setBills(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalRecords(res.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching billing records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [search, selectedGroup, selectedService, selectedStatus, startDate, endDate, page, limit, sortBy, sortOrder, refreshTrigger]);

  const handleExportClientExcel = () => {
    const formatted = bills.map((b, i) => ({
      'S.No': b.sNo || (i + 1),
      'Billing Group': b.billingGroup,
      'Bill/Service Date': formatDate(b.billDate),
      'Bill No.': b.billNo,
      'Visit ID': b.visitId,
      'Patient Name': b.patientName,
      'Service Name': b.serviceName,
      'Qty': b.quantity,
      'Rate (₹)': b.rate,
      'Total Amt (₹)': b.totalAmount,
      'Disc Amt (₹)': b.discountAmount,
      'Net Amt (₹)': b.netAmount,
      'SHDPL %': b.shdplPercentage + '%',
      'SHDPL Amount (₹)': b.shdplAmount,
      'Veda Share (₹)': b.vedaShare,
      'Sodani Share (₹)': b.sodaniShare,
      'Remaining Revenue (₹)': b.remainingRevenue,
      'Settlement Status': b.settlementStatus
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Bills');
    XLSX.writeFile(wb, `pathology_billing_filtered_${Date.now()}.xlsx`);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Controls & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-400" />
            <span>Pathology Billing Management</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {totalRecords} records
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time audit-compliant billing register with automated revenue-share calculation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportClientExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export View</span>
          </button>

          <button
            onClick={onNewBillClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Billing Record</span>
          </button>
        </div>
      </div>

      {/* Search & Multi-Filter Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Bill No, Visit ID, Patient Name, Service..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Billing Group Filter */}
          <div>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Billing Groups</option>
              {billingGroups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <select
              value={selectedService}
              onChange={(e) => {
                setSelectedService(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Settlement Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">All Settlement Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_SETTLED">Partially Settled</option>
              <option value="SETTLED">Fully Settled</option>
            </select>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            <span>Filter by Bill Date:</span>
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200"
          />
          {(startDate || endDate || search || selectedGroup !== 'ALL' || selectedService !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearch('');
                setSelectedGroup('ALL');
                setSelectedService('ALL');
                setSelectedStatus('ALL');
                setPage(1);
              }}
              className="text-xs text-teal-400 hover:underline ml-auto"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Main Billing Table with Sticky Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-850 sticky top-0 z-10 border-b border-slate-800 text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('sNo')}>
                  <div className="flex items-center gap-1">S.No <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">Billing Group</th>
                <th className="px-3.5 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('billDate')}>
                  <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap cursor-pointer" onClick={() => handleSort('billNo')}>
                  <div className="flex items-center gap-1">Bill No. <ArrowUpDown className="w-3 h-3 text-slate-500" /></div>
                </th>
                <th className="px-3.5 py-3 whitespace-nowrap">Visit ID</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Patient Name</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Service / Test</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Qty</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Rate</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Gross Amt</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Disc</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right text-teal-400">Net Amt</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right text-teal-300">SHDPL (52%)</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right text-blue-300">Veda (20%)</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right text-amber-300">Sodani (28%)</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-center">Status</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-center sticky right-0 bg-slate-850 shadow-l">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={17} className="text-center py-12 text-slate-400 font-sans">
                    Loading records from database...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={17} className="text-center py-12 text-slate-400 font-sans">
                    No billing records found matching criteria.
                  </td>
                </tr>
              ) : (
                bills.map((bill, index) => (
                  <tr key={bill.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-400">
                      {bill.sNo || ((page - 1) * limit + index + 1)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
                        {bill.billingGroup}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-300 font-sans">
                      {formatDate(bill.billDate)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-white hover:text-teal-400 cursor-pointer" onClick={() => onViewBill(bill)}>
                      {bill.billNo}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-400">
                      {bill.visitId}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-sans font-medium text-slate-100">
                      {bill.patientName}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-sans text-slate-300 max-w-xs truncate">
                      {bill.serviceName}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right">
                      {bill.quantity}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right">
                      {bill.rate}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-slate-300">
                      {formatINR(bill.totalAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-amber-400">
                      {bill.discountAmount ? `-${formatINR(bill.discountAmount)}` : '-'}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-bold text-teal-300">
                      {formatINR(bill.netAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-teal-400 font-medium">
                      {formatINR(bill.shdplAmount)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-blue-300 font-medium">
                      {formatINR(bill.vedaShare)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-right text-amber-300 font-medium">
                      {formatINR(bill.sodaniShare)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          bill.settlementStatus === 'SETTLED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : bill.settlementStatus === 'PARTIALLY_SETTLED'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {bill.settlementStatus}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-center sticky right-0 bg-slate-900 group-hover:bg-slate-800/80">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewBill(bill)}
                          title="View Details"
                          className="p-1 rounded hover:bg-slate-750 text-slate-400 hover:text-teal-400 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditBill(bill)}
                          title="Edit Bill"
                          className="p-1 rounded hover:bg-slate-750 text-slate-400 hover:text-slate-100 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                          <button
                            onClick={() => onDeleteBill(bill)}
                            title="Soft Delete Bill"
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 bg-slate-850 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <strong className="text-slate-200">{bills.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-slate-200">{Math.min(page * limit, totalRecords)}</strong> of{' '}
            <strong className="text-slate-200">{totalRecords}</strong> billing transactions
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300 font-mono">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
