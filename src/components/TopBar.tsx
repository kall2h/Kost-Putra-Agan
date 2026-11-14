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
  onPrimaryAction,
  onNavigateSettings,
}) => {
  return (
    <header className="h-16 sticky top-0 z-30 bg-white/75 dark:bg-[#061316]/80 backdrop-blur-md border-b border-teal-900/[0.08] dark:border-teal-400/[0.1] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Zone 1: Mobile Menu + Contextual Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-teal-500/10 transition-colors"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {propertyName}
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">
            {PAGE_TITLES[activePage]}
          </h1>
        </div>
      </div>

      {/* Zone 2 & 3: Utility Controls + Primary Action */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-lg border border-teal-900/10 dark:border-teal-400/15 bg-white/80 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50/70 dark:hover:bg-white/[0.08] transition-colors"
          title={theme === 'dark' ? 'Ubah ke Tema Terang' : 'Ubah ke Tema Gelap'}
          aria-label={theme === 'dark' ? 'Ubah ke Tema Terang' : 'Ubah ke Tema Gelap'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {activePage !== 'settings' && activePage !== 'messages' && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{PRIMARY_CTA[activePage]}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onNavigateSettings}
          className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-lg border border-teal-900/10 dark:border-teal-400/15 bg-white/80 dark:bg-white/[0.04] hover:bg-teal-50/60 dark:hover:bg-white/[0.08] transition-colors whitespace-nowrap shrink-0"
          title="Pengaturan Akun & Properti"
        >
          <span className="w-7 h-7 rounded-md bg-gradient-to-br from-[#0F766E] to-[#0D9488] text-white font-display font-semibold text-xs flex items-center justify-center">
            {adminInitials}
          </span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {adminName}
          </span>
        </button>
      </div>
    </header>
  );
};
