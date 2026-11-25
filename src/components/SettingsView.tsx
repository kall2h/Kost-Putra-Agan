import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Database,
  Moon,
  Palette,
  Pencil,
  QrCode,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AdminInvite,
  AdminUser,
  MessageTemplate,
  NavPage,
  PropertySettings,
  ReceiptTemplateConfig,
  Room,
  RoomTypeConfig,
  UiColorPreset,
} from '../types/kost';
import {
  applyUiColorPalette,
  normalizeHexColor,
  UI_COLOR_TEMPLATES,
} from '../utils/themePalette';

async function compressQrisImageToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Gagal membaca file QRIS'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Format gambar tidak didukung'));
    el.src = dataUrl;
  });

  const maxWidth = 640;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let quality = 0.85;
  let result = canvas.toDataURL('image/jpeg', quality);
  while (result.length > 350000 && quality > 0.35) {
    quality -= 0.1;
    result = canvas.toDataURL('image/jpeg', quality);
  }
  if (result.length > 420000) {
    throw new Error('Ukuran gambar QRIS terlalu besar setelah dikompresi.');
  }
  return result;
}

type SettingsTabId = 'personalization' | 'property' | 'team' | 'system';

const SETTINGS_TABS: Array<{
  id: SettingsTabId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  {
    id: 'personalization',
    label: 'Profil & Tampilan',
    description: 'Akun admin, tema, dan warna UI',
    icon: Palette,
  },
  {
    id: 'property',
    label: 'Properti & Pembayaran',
    description: 'Identitas kos, rekening, QRIS',
    icon: Building2,
  },
  {
    id: 'team',
    label: 'Tim & Akses',
    description: 'Pengelola aktif & undangan',
    icon: Users,
  },
  {
    id: 'system',
    label: 'Data & Sistem',
    description: 'Status cloud & reset data',
    icon: Database,
  },
];

interface SettingsViewProps {
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
  rooms: Room[];
  roomTypes?: RoomTypeConfig[];
  templates?: MessageTemplate[];
  registeredAdmins: AdminUser[];
  adminInvites: AdminInvite[];
  currentUserUid: string;
  currentUserEmail: string;
  onSaveSettings: (updated: PropertySettings) => Promise<void> | void;
  onResetDemo: () => Promise<void> | void;
  onRemoveRegisteredAdmin: (uid: string) => Promise<void>;
  onUpdateAdminRole: (
    uid: string,
    name: string,
    role: 'owner' | 'staff'
  ) => Promise<void>;
  onAddAdminInvite: (
    email: string,
    name: string,
    role: 'owner' | 'staff'
  ) => Promise<void>;
  onRemoveAdminInvite: (email: string) => Promise<void>;
  onEditRoomType?: (roomType: RoomTypeConfig) => void;
  onOpenReceiptFormat: () => void;
  onNavigate?: (page: NavPage) => void;
  onNotify: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  receiptTemplate,
  rooms,
  registeredAdmins,
  adminInvites,
  currentUserUid,
  currentUserEmail,
  onSaveSettings,
  onResetDemo,
  onRemoveRegisteredAdmin,
  onUpdateAdminRole,
  onAddAdminInvite,
  onRemoveAdminInvite,
  onOpenReceiptFormat,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('personalization');
  const [form, setForm] = useState<PropertySettings>(settings);
  const [customHexDraft, setCustomHexDraft] = useState<string>(
    normalizeHexColor(settings.uiCustomColor)
  );
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'staff'>('staff');
  const [inviting, setInviting] = useState(false);
  const [uploadingQris, setUploadingQris] = useState(false);
  const qrisInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(settings);
    setCustomHexDraft(normalizeHexColor(settings.uiCustomColor));
  }, [settings]);

  const currentAdminRecord = registeredAdmins.find((a) => a.uid === currentUserUid);
  const currentRoleLabel = currentAdminRecord?.role === 'owner' ? 'Pemilik' : 'Admin';
  const activePreset: UiColorPreset = form.uiColorPreset ?? 'emerald';

  const handleSaveForm = async (e: React.FormEvent, successMsg: string) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedHex = normalizeHexColor(customHexDraft);
      const next: PropertySettings = {
        ...form,
        uiColorPreset: activePreset,
        uiCustomColor: normalizedHex,
      };
      setForm(next);
      await onSaveSettings(next);
      onNotify(successMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeSwitch = async (theme: 'dark' | 'light') => {
    const next = { ...form, theme };
    setForm(next);
    await onSaveSettings(next);
    onNotify(theme === 'dark' ? 'Tema gelap diaktifkan' : 'Tema terang diaktifkan');
  };

  const handleSelectColorPreset = async (preset: Exclude<UiColorPreset, 'custom'>) => {
    const tpl = UI_COLOR_TEMPLATES.find((t) => t.id === preset);
    const next: PropertySettings = {
      ...form,
      uiColorPreset: preset,
      uiCustomColor: tpl?.primaryHex ?? '#0f766e',
    };
    setForm(next);
    setCustomHexDraft(next.uiCustomColor ?? '#0f766e');
    applyUiColorPalette(preset, next.uiCustomColor);
    await onSaveSettings(next);
    onNotify(`Template warna "${tpl?.name ?? 'Default'}" diterapkan`);
  };

  const handleLiveCustomColor = (hexValue: string) => {
    setCustomHexDraft(hexValue);
    if (/^#[0-9a-fA-F]{6}$/.test(hexValue)) {
      const clean = hexValue.toLowerCase();
      setForm((prev) => ({
        ...prev,
        uiColorPreset: 'custom',
        uiCustomColor: clean,
      }));
      applyUiColorPalette('custom', clean);
    }
  };

  const handleApplyCustomColor = async () => {
    const clean = normalizeHexColor(customHexDraft);
    setCustomHexDraft(clean);
    const next: PropertySettings = {
      ...form,
      uiColorPreset: 'custom',
      uiCustomColor: clean,
    };
    setForm(next);
    applyUiColorPalette('custom', clean);
    await onSaveSettings(next);
    onNotify(`Warna aksen kustom ${clean.toUpperCase()} disimpan`);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    try {
      await onAddAdminInvite(
        inviteEmail.trim().toLowerCase(),
        inviteName.trim(),
        inviteRole
      );
      setInviteEmail('');
      setInviteName('');
      setInviteRole('staff');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Navigation Rail (Standard SaaS Settings Pattern) */}
      <nav
        aria-label="Kategori Pengaturan"
        className="lg:col-span-3 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-2 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors shrink-0 lg:w-full ${
                isActive
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                }`}
                aria-hidden={true}
              />
              <div className="min-w-0">
                <p className="text-xs sm:text-[13px] font-semibold leading-tight whitespace-nowrap">
                  {tab.label}
                </p>
                <p
                  className={`hidden lg:block text-[11px] mt-0.5 truncate ${
                    isActive
                      ? 'text-white/80'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <div className="lg:col-span-9 min-w-0">
        {/* TAB 1: Profil & Tampilan (Personalisasi Admin + Warna UI) */}
        {activeTab === 'personalization' && (
          <form
            onSubmit={(e) =>
              handleSaveForm(e, 'Personalisasi admin & tampilan berhasil disimpan')
            }
            className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 space-y-6"
          >
            {/* Header Profil Admin */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/[0.07] pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl nav-active-gradient flex items-center justify-center font-display font-bold text-base text-white shrink-0">
                  {form.adminInitials || 'AD'}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white truncate">
                    {form.adminName || 'Pengelola'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    <span>{currentRoleLabel}</span>
                    {currentUserEmail && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono-num">{currentUserEmail}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                <UserCog className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Akun Aktif</span>
              </span>
            </div>

            {/* Identitas Pengelola */}
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Identitas Pengelola
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Nama dan inisial tampil di bilah atas serta penandatangan kwitansi digital.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="admin-name-input"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Nama Pengelola
                  </label>
                  <input
                    id="admin-name-input"
                    type="text"
                    required
                    maxLength={80}
                    value={form.adminName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const autoInitials =
                        val
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'AD';
                      setForm({
                        ...form,
                        adminName: val,
                        adminInitials: autoInitials,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="admin-initials-input"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Inisial Avatar
                  </label>
                  <input
                    id="admin-initials-input"
                    type="text"
                    required
                    maxLength={4}
                    value={form.adminInitials}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        adminInitials: e.target.value.toUpperCase().slice(0, 4),
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm font-semibold uppercase"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label
                    htmlFor="admin-wa-input"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    WhatsApp Admin
                  </label>
                  <input
                    id="admin-wa-input"
                    type="text"
                    maxLength={30}
                    value={form.whatsappAdmin}
                    onChange={(e) =>
                      setForm({ ...form, whatsappAdmin: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg input-surface border font-mono-num text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Mode Tampilan (Terang / Gelap) */}
            <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.07] space-y-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Mode Tampilan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pilih tampilan terang untuk pencahayaan siang atau gelap agar nyaman di malam hari.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => handleThemeSwitch('light')}
                  className={`flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium ${
                    form.theme === 'light'
                      ? 'nav-active-gradient text-white'
                      : 'btn-secondary'
                  }`}
                >
                  <Sun className="w-4 h-4" aria-hidden="true" />
                  <span>Tema Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeSwitch('dark')}
                  className={`flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium ${
                    form.theme === 'dark'
                      ? 'nav-active-gradient text-white'
                      : 'btn-secondary'
                  }`}
                >
                  <Moon className="w-4 h-4" aria-hidden="true" />
                  <span>Tema Gelap</span>
                </button>
              </div>
            </div>

            {/* Template Warna UI & Warna Aksen Kustom */}
            <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.07] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Template Warna UI
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Mengubah warna tombol utama, navigasi aktif, grafik, dan sorotan seluruh dashboard.
                  </p>
                </div>
                {activePreset !== 'emerald' && (
                  <button
                    type="button"
                    onClick={() => handleSelectColorPreset('emerald')}
                    className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline"
                  >
                    Kembalikan Default
                  </button>
                )}
              </div>

              {/* 6 Preset Templates */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {UI_COLOR_TEMPLATES.map((tpl) => {
                  const selected = activePreset === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectColorPreset(tpl.id)}
                      aria-pressed={selected}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                        selected
                          ? 'border-teal-600 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-500/[0.1]'
                          : 'border-slate-200/90 dark:border-white/[0.09] bg-slate-50/40 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="flex items-center shrink-0 mt-0.5" aria-hidden="true">
                        <span
                          className="w-5 h-5 rounded-md border border-black/10"
                          style={{ backgroundColor: tpl.primaryHex }}
                        />
                        <span
                          className="w-3.5 h-5 -ml-1.5 rounded-r-md border border-black/10"
                          style={{ backgroundColor: tpl.secondaryHex }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {tpl.name}
                          </p>
                          {selected && (
                            <Check
                              className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300 shrink-0"
                              aria-hidden={true}
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {tpl.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Color Picker */}
              <div className="pt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="custom-accent-picker"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Warna Kustom
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-accent-picker"
                      type="color"
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(customHexDraft)
                          ? customHexDraft
                          : '#0f766e'
                      }
                      onChange={(e) => handleLiveCustomColor(e.target.value)}
                      className="w-11 h-10 p-1 rounded-lg border border-slate-200 dark:border-white/[0.14] bg-white dark:bg-[#081215] cursor-pointer"
                      aria-label="Pemilih warna aksen kustom"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={customHexDraft.toUpperCase()}
                      onChange={(e) => {
                        const v = e.target.value;
                        handleLiveCustomColor(v.startsWith('#') ? v : `#${v}`);
                      }}
                      aria-label="Kode hex warna kustom"
                      placeholder="#0F766E"
                      className="w-28 px-3 py-2 rounded-lg input-surface border font-mono-num text-xs uppercase"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustomColor}
                  className="min-h-[40px] px-4 py-2 rounded-xl btn-secondary text-xs font-medium"
                >
                  Terapkan Warna Kustom
                </button>
              </div>

              {/* Live Preview Strip */}
              <div className="rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Pratinjau Langsung Komponen
                  </span>
                  <span className="font-mono-num text-[11px] text-teal-700 dark:text-teal-300 font-medium">
                    Okupansi 75% · Aktif
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center px-3.5 py-2 rounded-xl nav-active-gradient text-xs font-medium">
                    Menu Aktif
                  </span>
                  <span className="inline-flex items-center px-3.5 py-2 rounded-xl btn-primary text-xs font-medium">
                    Tombol Utama
                  </span>
                  <span className="inline-flex items-center px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium">
                    Tombol Sekunder
                  </span>
                  <div className="flex-1 min-w-[120px] h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                    <div className="h-full w-3/4 rounded-full gradient-bar" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Save */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-200/80 dark:border-white/[0.07]">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl btn-primary text-sm font-medium disabled:opacity-60"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Personalisasi'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Properti & Pembayaran */}
        {activeTab === 'property' && (
          <form
            onSubmit={(e) =>
              handleSaveForm(e, 'Profil properti & saluran pembayaran disimpan ke cloud')
            }
            className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 space-y-6"
          >
            <div className="border-b border-slate-200/80 dark:border-white/[0.07] pb-4">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Properti &amp; Saluran Pembayaran
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Identitas kos, rekening bank, QRIS, jatuh tempo, dan format kwitansi otomatis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prop-name-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Nama Properti Kos
                </label>
                <input
                  id="prop-name-input"
                  type="text"
                  required
                  maxLength={80}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="prop-tagline-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Slogan / Tagline
                </label>
                <input
                  id="prop-tagline-input"
                  type="text"
                  maxLength={140}
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="prop-address-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Alamat Lengkap Properti
                </label>
                <input
                  id="prop-address-input"
                  type="text"
                  maxLength={200}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="prop-due-day"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Tanggal Jatuh Tempo Default
                </label>
                <input
                  id="prop-due-day"
                  type="number"
                  min={1}
                  max={28}
                  value={form.defaultDueDay}
                  onChange={(e) =>
                    setForm({ ...form, defaultDueDay: Number(e.target.value) })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg input-surface border font-mono-num text-sm"
                />
              </div>
            </div>

            {/* Rekening & QRIS */}
            <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.07] space-y-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Saluran Pembayaran Default
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tampil di halaman Link Pembayaran penyewa dan variabel pesan WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="prop-bank-name"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Nama Bank
                  </label>
                  <input
                    id="prop-bank-name"
                    type="text"
                    maxLength={50}
                    placeholder="BCA"
                    value={form.paymentBankName}
                    onChange={(e) =>
                      setForm({ ...form, paymentBankName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg input-surface border text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prop-bank-acc"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Nomor Rekening
                  </label>
                  <input
                    id="prop-bank-acc"
                    type="text"
                    maxLength={60}
                    placeholder="5420-8812-30"
                    value={form.paymentBankAccount}
                    onChange={(e) =>
                      setForm({ ...form, paymentBankAccount: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prop-bank-holder"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Atas Nama Rekening
                  </label>
                  <input
                    id="prop-bank-holder"
                    type="text"
                    maxLength={80}
                    placeholder="Azka Pratama"
                    value={form.paymentBankHolder}
                    onChange={(e) =>
                      setForm({ ...form, paymentBankHolder: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg input-surface border text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="prop-acc-summary"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Ringkasan Teks Rekening (WA)
                  </label>
                  <input
                    id="prop-acc-summary"
                    type="text"
                    maxLength={240}
                    placeholder="BCA 5420-8812-30 a.n. Azka Pratama"
                    value={form.paymentAccountInfo}
                    onChange={(e) =>
                      setForm({ ...form, paymentAccountInfo: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg input-surface border text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prop-ext-link"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Link Payment Gateway / E-Wallet (opsional)
                  </label>
                  <input
                    id="prop-ext-link"
                    type="url"
                    maxLength={300}
                    placeholder="https://..."
                    value={form.externalPaymentLink}
                    onChange={(e) =>
                      setForm({ ...form, externalPaymentLink: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg input-surface border text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* QRIS Upload */}
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <QrCode
                      className="w-4 h-4 text-teal-700 dark:text-teal-300"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Gambar QRIS Properti (opsional)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={qrisInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingQris(true);
                        try {
                          const compressed = await compressQrisImageToDataUrl(file);
                          setForm((prev) => ({ ...prev, qrisImageUrl: compressed }));
                          onNotify('Gambar QRIS siap disimpan (klik Simpan Pengaturan)');
                        } catch (err) {
                          onNotify(
                            err instanceof Error
                              ? err.message
                              : 'Gagal memproses gambar QRIS'
                          );
                        } finally {
                          setUploadingQris(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingQris}
                      onClick={() => qrisInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{uploadingQris ? 'Memproses...' : 'Unggah QRIS'}</span>
                    </button>
                    {form.qrisImageUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, qrisImageUrl: '' }))}
                        className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline px-1.5"
                      >
                        Hapus QRIS
                      </button>
                    )}
                  </div>
                </div>

                {form.qrisImageUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={form.qrisImageUrl}
                      alt="Preview QRIS properti"
                      width={56}
                      height={56}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      QRIS aktif dan tampil otomatis di halaman Link Pembayaran penyewa.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Ringkasan Format Kwitansi Digital */}
            <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Format Kwitansi PDF Otomatis
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {receiptTemplate.title} ·{' '}
                  <span className="text-teal-700 dark:text-teal-300 font-medium">
                    {receiptTemplate.autoGeneratePdfOnPaid
                      ? 'Auto-Unduh PDF Aktif'
                      : 'Manual'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenReceiptFormat}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Edit Format Kwitansi</span>
              </button>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-200/80 dark:border-white/[0.07]">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl btn-primary text-sm font-medium disabled:opacity-60"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Properti'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: Tim & Akses Admin */}
        {activeTab === 'team' && (
          <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.07] pb-4">
              <div>
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Tim Pengelola &amp; Akses Admin
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kelola akun pengelola yang berwenang mengakses dashboard properti.
                </p>
              </div>
              <span className="font-mono-num text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                {registeredAdmins.length} aktif
              </span>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
              {registeredAdmins.map((adm) => {
                const isSelf = adm.uid === currentUserUid;
                return (
                  <div
                    key={adm.uid}
                    className="py-3 first:pt-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {adm.name} {isSelf ? '(Anda)' : ''}
                      </p>
                      <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {adm.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                        {adm.role === 'owner' ? 'Pemilik' : 'Admin'}
                      </span>
                      {!isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAdminRole(
                                adm.uid,
                                adm.name,
                                adm.role === 'owner' ? 'staff' : 'owner'
                              )
                            }
                            className="min-h-[34px] px-3 py-1 rounded-xl btn-secondary text-xs font-medium"
                          >
                            {adm.role === 'owner' ? 'Set Admin' : 'Set Pemilik'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveRegisteredAdmin(adm.uid)}
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                            title="Hapus akses admin"
                            aria-label={`Hapus akses ${adm.name}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {adminInvites.map((inv) => (
                <div
                  key={inv.email}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {inv.name} ·{' '}
                      <span className="text-teal-700 dark:text-teal-300 font-medium">
                        {inv.role === 'owner' ? 'Pemilik' : 'Admin'}
                      </span>{' '}
                      · Menunggu Login
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {inv.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAdminInvite(inv.email)}
                    className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors shrink-0"
                    title="Batalkan undangan"
                    aria-label={`Batalkan undangan ${inv.email}`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleInviteSubmit}
              className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-white/[0.07]"
            >
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Undang Pengelola Baru via Email Google
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap"
                  aria-label="Nama lengkap pengelola"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg input-surface border text-xs sm:text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="email@gmail.com"
                  aria-label="Email Google pengelola"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg input-surface border text-xs sm:text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'owner' | 'staff')}
                  aria-label="Peran pengelola"
                  className="w-full px-3.5 py-2 rounded-lg input-surface border text-xs sm:text-sm font-medium"
                >
                  <option value="staff">Penjaga / Admin</option>
                  <option value="owner">Pemilik (Owner)</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl btn-primary text-xs sm:text-sm font-medium disabled:opacity-60"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {inviting
                      ? 'Menambahkan...'
                      : `Undang sebagai ${inviteRole === 'owner' ? 'Pemilik' : 'Admin'}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: Data & Sistem */}
        {activeTab === 'system' && (
          <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-200/80 dark:border-white/[0.07] pb-4">
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Data &amp; Sistem
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Informasi penyimpanan cloud dan pengaturan ulang data awal.
              </p>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-xs sm:text-sm">
              <div className="py-3 first:pt-0 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Sinkronisasi Database
                </span>
                <span className="font-medium text-teal-700 dark:text-teal-300">
                  Firebase Cloud Aktif
                </span>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Unit Kamar Terkelola
                </span>
                <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                  {rooms.length} unit
                </span>
              </div>
              <div className="py-3 last:pb-0 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">
                  Akun Terhubung
                </span>
                <span className="font-mono-num text-slate-900 dark:text-white truncate">
                  {currentUserEmail || '-'}
                </span>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-rose-600 dark:text-rose-400">
                  Atur Ulang Data Demo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Mengembalikan seluruh data kamar, penyewa, dan transaksi ke contoh awal.
                </p>
              </div>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Atur Ulang Data</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(false);
                      onResetDemo();
                    }}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
                  >
                    Ya, Reset Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
