import React, { useState, useEffect } from 'react';
import { History, Shield, Search, Filter } from 'lucide-react';
import { ApiClient } from '../api/client';
import { formatDateTime } from '../utils/formatters';
import { AuditLogItem } from '../types';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>('/audit-logs', { module, action, search });
      if (res.success) setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [module, action, search]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-teal-400" />
          <span>System Audit Compliance Log</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable audit trail capturing all user actions, rate changes, settlements, imports, and adjustments
        </p>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by user, record ID, or action content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
        >
          <option value="ALL">All Modules</option>
          <option value="BILLING">Billing</option>
          <option value="SHARE_CONFIG">Share Config</option>
          <option value="SETTLEMENT">Settlement</option>
          <option value="PATIENT">Patient</option>
          <option value="SERVICE">Service</option>
          <option value="IMPORT">Import</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
        >
          <option value="ALL">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
          <option value="SETTLE">SETTLE</option>
          <option value="ADJUST">ADJUST</option>
          <option value="IMPORT">IMPORT</option>
        </select>
      </div>

      {/* Log List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-850 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record ID</th>
                <th className="px-4 py-3">Details / Value Diff</th>
                <th className="px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400 font-sans whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-white whitespace-nowrap">
                      {log.userName || 'System'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-teal-300 font-sans">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.action === 'DELETE'
                            ? 'bg-rose-500/20 text-rose-300'
                            : log.action === 'UPDATE'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate">{log.recordId || '-'}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-md truncate text-[11px]">
                      {log.newValue || log.oldValue || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
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
