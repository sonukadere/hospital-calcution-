import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FileSpreadsheet,
  Layers,
  Cpu,
  Sparkles,
  X
} from 'lucide-react';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  end?: boolean;
  onClick?: () => void;
}

function SidebarItem({ to, icon, label, badge, end, onClick }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
        }`
      }
    >
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const sidebarContent = (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-[15px] tracking-tight text-slate-900 leading-snug truncate">
              Pathology Share
            </h1>
            <p className="text-[11px] font-medium text-slate-400 truncate">
              Billing & Share Calculator
            </p>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Operations
        </div>
        <SidebarItem
          to="/share-management"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          label="Share Management"
          onClick={onClose}
        />
        <SidebarItem
          to="/master-rates"
          icon={<Layers className="w-4 h-4" />}
          label="Master Rates"
          badge="1,409"
          onClick={onClose}
        />
      </div>

      {/* In-Memory Mode Indicator */}
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <div className="text-[11px] font-bold text-slate-800">In-Memory Mode</div>
              <div className="text-[10px] text-slate-500">Zero Database • High Speed</div>
            </div>
          </div>
          <Cpu className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-slate-200/90 flex-col h-screen sticky top-0 shadow-xs z-30 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl md:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
