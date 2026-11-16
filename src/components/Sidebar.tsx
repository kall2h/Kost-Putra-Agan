import React from 'react';
import {
  LayoutDashboard,
  BedDouble,
  ReceiptText,
  TrendingUp,
  MessageSquareText,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { NavPage } from '../types/kost';
import { PropertyLogo } from './PropertyLogo';

interface SidebarProps {
  activePage: NavPage;
  onSelectPage: (page: NavPage) => void;
  propertyName: string;
  occupiedCount: number;
  totalRooms: number;
  unpaidCount: number;
  userEmail?: string | null;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: NavPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'rooms', label: 'Kamar & Penyewa', icon: BedDouble },
  { id: 'payments', label: 'Pembayaran', icon: ReceiptText },
  { id: 'finance', label: 'Keuangan', icon: TrendingUp },
  { id: 'messages', label: 'Pesan & WA', icon: MessageSquareText },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  propertyName,
  occupiedCount,
  totalRooms,
  unpaidCount,
  userEmail,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c161a] border-r border-slate-200/80 dark:border-white/[0.08] select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/70 dark:border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <PropertyLogo className="w-8 h-8 rounded-lg" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm tracking-tight text-slate-900 dark:text-white truncate">
              {propertyName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Portal Pengelola
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          aria-label="Tutup navigasi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Menu Utama">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          const badgeCount = item.id === 'payments' ? unpaidCount : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectPage(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-200'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive
                      ? 'text-teal-700 dark:text-teal-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {badgeCount > 0 && (
                <span
                  className={`font-mono-num text-xs font-semibold ${
                    isActive
                      ? 'text-teal-700 dark:text-teal-300'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Occupancy Summary & Account Logout */}
      <div className="p-5 border-t border-slate-200/70 dark:border-white/[0.07] space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Okupansi Kamar
            </span>
            <span className="font-mono-num text-xs font-semibold text-slate-900 dark:text-white">
              {occupancyPct}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full gradient-bar transition-all duration-300"
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
          <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
            {occupiedCount} dari {totalRooms} unit terisi
          </p>
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.07] flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {userEmail ?? 'Admin Kos'}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors shrink-0"
            title="Keluar dari akun admin"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[248px] shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-backdrop-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-[264px] max-w-[80vw] h-full z-10 animate-drawer-left-in">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
