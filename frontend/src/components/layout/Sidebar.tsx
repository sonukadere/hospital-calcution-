import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  FileSpreadsheet,
  BarChart3,
  Settings,
  ShieldPlus,
  Layers,
  Database
} from 'lucide-react';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

function SidebarItem({ to, icon, label, end }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
        }`
      }
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col h-screen sticky top-0 select-none shadow-xs z-30 shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
            <ShieldPlus className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-[15px] tracking-tight text-slate-900 leading-snug truncate">
              Pathology & Diagnostic
            </h1>
            <p className="text-[11px] font-medium text-slate-400 truncate">
              Share Management System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links - each with its own unique route */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
        <SidebarItem
          to="/dashboard"
          icon={<Home className="w-4 h-4" />}
          label="Dashboard"
        />

        <SidebarItem
          to="/master-rates"
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Master Rates"
        />

        <SidebarItem
          to="/share-management"
          icon={<Layers className="w-4 h-4" />}
          label="Share Management"
        />

        <SidebarItem
          to="/billing"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          label="Billing Records"
        />

        <SidebarItem
          to="/reports"
          icon={<BarChart3 className="w-4 h-4" />}
          label="Reports"
        />

        <SidebarItem
          to="/settings"
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
        />
      </div>

      {/* Database Status Footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600 text-[11px] font-semibold">MongoDB Connected</span>
          </div>
          <Database className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
