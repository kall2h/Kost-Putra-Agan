import React, { useEffect, useRef } from 'react';
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseMobile();
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLButtonElement>('[data-mobile-nav-trigger]')?.focus();
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const closeMobileAndRestoreFocus = () => {
    onCloseMobile();
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[data-mobile-nav-trigger]')?.focus();
    });
  };

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c161a] border-r border-slate-200 dark:border-white/[0.08] select-none">
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <PropertyLogo className="w-9 h-9 rounded-md" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-slate-900 dark:text-white truncate">
              {propertyName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Portal Pengelola
            </p>
          </div>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeMobileAndRestoreFocus}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          aria-label="Tutup navigasi"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu Utama">
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
                closeMobileAndRestoreFocus();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between min-h-11 px-3.5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? 'nav-active-gradient font-semibold'
                  : 'font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
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
                  className={`font-mono-num text-xs tabular-nums ${
                    isActive
                      ? 'text-teal-50'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200 dark:border-white/[0.07] space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-300">
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
          <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {occupiedCount} dari {totalRooms} unit terisi
          </p>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-white/[0.07] flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {userEmail ?? 'Admin Kos'}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 dark:text-slate-400 dark:hover:text-rose-400 transition-colors shrink-0"
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
            className="fixed inset-0 bg-slate-950/45 animate-backdrop-in"
            onClick={closeMobileAndRestoreFocus}
            aria-hidden="true"
          />
          <aside
            id="mobile-navigation"
            className="relative w-[264px] max-w-[80vw] h-full z-10 animate-drawer-left-in"
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi utama"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
