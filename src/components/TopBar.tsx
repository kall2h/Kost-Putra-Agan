import React from 'react';
import { Menu, Plus, Sun, Moon } from 'lucide-react';
import { NavPage } from '../types/kost';

interface TopBarProps {
  activePage: NavPage;
  propertyName: string;
  adminName: string;
  adminInitials: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
  mobileNavOpen: boolean;
  onPrimaryAction: () => void;
  onNavigateSettings: () => void;
}

const PAGE_TITLES: Record<NavPage, string> = {
  dashboard: 'Ringkasan Properti',
  rooms: 'Kamar & Penyewa',
  payments: 'Pembayaran Sewa',
  finance: 'Keuangan & Arus Kas',
  messages: 'Pusat Pesan & WhatsApp',
  settings: 'Pengaturan Properti',
};

const PRIMARY_CTA: Record<NavPage, string> = {
  dashboard: 'Catat Pembayaran',
  rooms: 'Check-In Penyewa',
  payments: 'Catat Pembayaran',
  finance: 'Catat Pengeluaran',
  messages: 'Template Baru',
  settings: 'Simpan Pengaturan',
};

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  propertyName,
  adminName,
  adminInitials,
  theme,
  onToggleTheme,
  onOpenMobileNav,
  mobileNavOpen,
  onPrimaryAction,
  onNavigateSettings,
}) => {
  return (
    <header className="h-16 sticky top-0 z-30 glass-surface border-b border-slate-200/75 dark:border-white/[0.09] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Zone 1: Mobile Menu + Contextual Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          id="mobile-nav-trigger"
          data-mobile-nav-trigger
          className="lg:hidden min-w-10 min-h-10 inline-flex items-center justify-center -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Buka menu navigasi"
          aria-controls="mobile-navigation"
          aria-expanded={mobileNavOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
            {propertyName}
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white truncate">
            {PAGE_TITLES[activePage]}
          </h1>
        </div>
      </div>

      {/* Zone 2 & 3: Utility Controls + Primary Action */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          className="min-w-10 min-h-10 inline-flex items-center justify-center rounded-xl btn-secondary transition-colors"
          title={theme === 'dark' ? 'Ubah ke Tema Terang' : 'Ubah ke Tema Gelap'}
          aria-label={theme === 'dark' ? 'Ubah ke Tema Terang' : 'Ubah ke Tema Gelap'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {activePage !== 'settings' && activePage !== 'messages' && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="min-h-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-primary text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{PRIMARY_CTA[activePage]}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onNavigateSettings}
          className="hidden sm:inline-flex min-h-10 items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-xl btn-secondary whitespace-nowrap shrink-0"
          title="Pengaturan Akun & Properti"
        >
          <span className="w-7 h-7 rounded-lg gradient-hero-card font-display font-semibold text-xs flex items-center justify-center">
            {adminInitials}
          </span>
          <span className="text-xs font-medium">
            {adminName}
          </span>
        </button>
      </div>
    </header>
  );
};
