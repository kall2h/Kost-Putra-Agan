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
    <div className="flex flex-col h-full bg-gradient-to-b from-white via-[#F5FCFA] to-[#ECF8F6] dark:from-[#071619] dark:via-[#081A1E] dark:to-[#051014] border-r border-teal-900/[0.08] dark:border-teal-400/[0.1] select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-teal-900/[0.07] dark:border-teal-400/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <PropertyLogo className="w-8 h-8 rounded-lg" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm tracking-tight text-slate-900 dark:text-white truncate">
              {propertyName}
            </p>
            <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80 truncate">
              Portal Pengelola Admin
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
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto" aria-label="Menu Utama">
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
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-teal-600/[0.08] dark:hover:bg-teal-400/[0.08] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {badgeCount > 0 && (
                <span
                  className={`font-mono-num text-xs font-semibold ${
                    isActive
                      ? 'text-teal-100'
                      : 'text-amber-600 dark:text-amber-400'
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
      <div className="p-4 border-t border-teal-900/[0.07] dark:border-teal-400/[0.08] space-y-4">
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-teal-50/90 via-white/80 to-cyan-50/80 dark:from-teal-950/55 dark:via-[#0B2024] dark:to-cyan-950/35 border border-teal-600/15 dark:border-teal-400/15">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Okupansi Kamar
            </span>
            <span className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-300">
              {occupancyPct}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-teal-950/10 dark:bg-white/[0.1] overflow-hidden mb-2">
            <div
              className="h-full rounded-full gradient-bar transition-all duration-300"
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
          <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
            {occupiedCount} dari {totalRooms} unit terisi
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
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
      <aside className="hidden lg:block w-[256px] shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-[264px] max-w-[80vw] h-full z-10">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
