import React, { useEffect, useState } from 'react';
import {
  Building2,
  Copy,
  ExternalLink,
  MessageSquareText,
  Pencil,
  RotateCcw,
  Save,
  Sun,
  Moon,
  UserPlus,
  Trash2,
  ShieldCheck,
  SlidersHorizontal,
  FileText,
  QrCode,
  Upload,
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
} from '../types/kost';
import { DEFAULT_ROOM_TYPES, getRoomDisplayName } from '../data/initialData';
import { buildWhatsAppUrl, formatIDR } from '../utils/format';
import { DEFAULT_MESSAGE_TEMPLATES, renderMessageTemplate } from '../utils/messageTemplates';

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

interface SettingsViewProps {
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
  rooms: Room[];
  roomTypes: RoomTypeConfig[];
  templates: MessageTemplate[];
  registeredAdmins: AdminUser[];
  adminInvites: AdminInvite[];
  currentUserUid: string;
  currentUserEmail: string;
  onSaveSettings: (updated: PropertySettings) => Promise<void> | void;
  onResetDemo: () => Promise<void> | void;
  onRemoveRegisteredAdmin: (uid: string) => Promise<void>;
  onAddAdminInvite: (email: string, name: string) => Promise<void>;
  onRemoveAdminInvite: (email: string) => Promise<void>;
  onEditRoomType: (roomType: RoomTypeConfig) => void;
  onOpenReceiptFormat: () => void;
  onNavigate: (page: NavPage) => void;
  onNotify: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  receiptTemplate,
  rooms,
  roomTypes,
  templates,
  registeredAdmins,
  adminInvites,
  currentUserUid,
  onSaveSettings,
  onResetDemo,
  onRemoveRegisteredAdmin,
  onAddAdminInvite,
  onRemoveAdminInvite,
  onEditRoomType,
  onOpenReceiptFormat,
  onNavigate,
  onNotify,
}) => {
  const [form, setForm] = useState<PropertySettings>(settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [typeImgErrors, setTypeImgErrors] = useState<Record<string, boolean>>({});
  const qrisInputRef = React.useRef<HTMLInputElement>(null);

  const activeRoomTypes = roomTypes.length > 0 ? roomTypes : DEFAULT_ROOM_TYPES;
  const activeTemplates = templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const availableRooms = rooms.filter((r) => r.status === 'Tersedia');

  const promoTemplate =
    activeTemplates.find((t) => t.category === 'promo') ??
    DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === 'promo')!;

  const promoText = renderMessageTemplate(promoTemplate.body, {
    settings: form,
    availableRooms,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    onNotify('Pengaturan properti berhasil disimpan ke cloud');
  };

  const handleThemeSwitch = async (theme: 'dark' | 'light') => {
    const next = { ...form, theme };
    setForm(next);
    await onSaveSettings(next);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    setInviting(true);
    try {
      await onAddAdminInvite(inviteEmail.trim().toLowerCase(), inviteName.trim());
      setInviteEmail('');
      setInviteName('');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyPromo = async () => {
    try {
      await navigator.clipboard.writeText(promoText);
      onNotify('Teks info ketersediaan kamar berhasil disalin untuk WhatsApp');
    } catch {
      onNotify('Teks promosi siap digunakan');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left 7 Cols: Settings Form */}
      <form
        onSubmit={handleSubmit}
        className="xl:col-span-7 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-6"
      >
        <div className="border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Profil &amp; Konfigurasi Properti
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tersinkronisasi otomatis ke seluruh perangkat tim pengelola admin
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Nama Properti Kos
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Slogan / Tagline
            </label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Alamat Lengkap Properti
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
          />
        </div>

        {/* Saluran Pembayaran Default (Bank Transfer, QRIS & Link) */}
        <div className="p-4 rounded-xl bg-white/70 dark:bg-[#081417] border border-teal-900/[0.08] dark:border-teal-400/[0.12] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Saluran Pembayaran Default (Link Tagihan &amp; WA)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ditampilkan otomatis di halaman Link Pembayaran penyewa &amp; variabel pesan WA
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nama Bank
              </label>
              <input
                type="text"
                maxLength={50}
                placeholder="BCA"
                value={form.paymentBankName}
                onChange={(e) => setForm({ ...form, paymentBankName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nomor Rekening
              </label>
              <input
                type="text"
                maxLength={60}
                placeholder="5420-8812-30"
                value={form.paymentBankAccount}
                onChange={(e) =>
                  setForm({ ...form, paymentBankAccount: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Atas Nama Rekening
              </label>
              <input
                type="text"
                maxLength={80}
                placeholder="Azka Pratama"
                value={form.paymentBankHolder}
                onChange={(e) =>
                  setForm({ ...form, paymentBankHolder: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Ringkasan Teks Rekening (untuk WA)
              </label>
              <input
                type="text"
                maxLength={240}
                placeholder="BCA 5420-8812-30 a.n. Azka Pratama"
                value={form.paymentAccountInfo}
                onChange={(e) =>
                  setForm({ ...form, paymentAccountInfo: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                Link Payment Gateway / E-Wallet (opsional)
              </label>
              <input
                type="url"
                maxLength={300}
                placeholder="https://..."
                value={form.externalPaymentLink}
                onChange={(e) =>
                  setForm({ ...form, externalPaymentLink: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
              />
            </div>
          </div>

          {/* QRIS Upload / URL */}
          <div className="space-y-2 pt-1 border-t border-teal-900/[0.06] dark:border-white/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-teal-700/25 dark:border-teal-400/25 text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                >
                  <Upload className="w-3 h-3" />
                  <span>{uploadingQris ? 'Memproses...' : 'Unggah Foto QRIS'}</span>
                </button>
                {form.qrisImageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, qrisImageUrl: '' }))}
                    className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Hapus QRIS
                  </button>
                )}
              </div>
            </div>

            {form.qrisImageUrl && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-[#050E11] border border-teal-900/[0.08]">
                <img
                  src={form.qrisImageUrl}
                  alt="Preview QRIS"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded object-contain bg-white border border-slate-200"
                />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    QRIS Terpasang
                  </p>
                  <p>Akan otomatis ditampilkan pada halaman Link Pembayaran penyewa.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Nama Pengelola
            </label>
            <input
              type="text"
              value={form.adminName}
              onChange={(e) =>
                setForm({
                  ...form,
                  adminName: e.target.value,
                  adminInitials:
                    e.target.value
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'AZ',
                })
              }
              className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              WhatsApp Pengelola
            </label>
            <input
              type="text"
              value={form.whatsappAdmin}
              onChange={(e) => setForm({ ...form, whatsappAdmin: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg input-surface border font-mono-num text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Tanggal Jatuh Tempo
            </label>
            <input
              type="number"
              min={1}
              max={28}
              value={form.defaultDueDay}
              onChange={(e) => setForm({ ...form, defaultDueDay: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-lg input-surface border font-mono-num text-sm"
            />
          </div>
        </div>

        {/* Theme Switcher */}
        <div className="pt-2 border-t border-teal-900/[0.07] dark:border-teal-400/[0.1] space-y-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Tema Tampilan Antarmuka
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleThemeSwitch('light')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                form.theme === 'light'
                  ? 'nav-active-gradient border-transparent text-white'
                  : 'bg-white/60 dark:bg-[#081316] border-teal-900/10 dark:border-teal-400/15 text-slate-700 dark:text-slate-300 hover:bg-teal-50/70 dark:hover:bg-white/[0.05]'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Terang (Gradient)</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeSwitch('dark')}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                form.theme === 'dark'
                  ? 'nav-active-gradient border-transparent text-white'
                  : 'bg-white/60 dark:bg-[#081316] border-teal-900/10 dark:border-teal-400/15 text-slate-700 dark:text-slate-300 hover:bg-teal-50/70 dark:hover:bg-white/[0.05]'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Gelap (Emerald)</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-teal-900/[0.07] dark:border-teal-400/[0.1]">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Atur Ulang Data Demo</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 dark:text-rose-400">
                Reset database cloud ke awal?
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetDemo();
                }}
                className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium"
              >
                Ya, Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-white/[0.1] text-xs"
              >
                Batal
              </button>
            </div>
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-sm font-medium transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Right 5 Cols: Otomasi Kwitansi PDF + Panel Tipe Kamar + Multi-Admin + Promo */}
      <div className="xl:col-span-5 space-y-6">
        {/* Format & Otomasi Kwitansi PDF */}
        <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-3.5">
          <div className="flex items-start justify-between gap-3 border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Kwitansi PDF Otomatis
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Format dokumen PDF otomatis saat tagihan ditandai Lunas
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenReceiptFormat}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg btn-primary text-xs font-medium shrink-0"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Format</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-[#081417] border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Judul Dokumen</p>
              <p className="font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                {receiptTemplate.title}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-[#081417] border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Otomasi Lunas</p>
              <p className="font-semibold text-teal-700 dark:text-teal-300 truncate mt-0.5">
                {receiptTemplate.autoGeneratePdfOnPaid
                  ? 'Auto-Unduh PDF Aktif'
                  : 'Manual'}
              </p>
            </div>
          </div>
        </section>

        {/* Panel & Harga Tipe Kamar (TIPE A / B / C) */}
        <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-4">
          <div className="border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Panel &amp; Harga Tipe Kamar
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Atur tarif bulanan, foto, dan deskripsi untuk Tipe A, Tipe B, dan Tipe C
            </p>
          </div>

          <div className="space-y-3">
            {activeRoomTypes.map((rt) => {
              const hasErr = typeImgErrors[rt.id];
              const panelName = rt.displayName?.trim() || rt.tier;
              const coverImg = rt.images?.[0]?.url || rt.imageUrl;
              const photoCount = rt.images?.length || 1;
              return (
                <div
                  key={rt.id}
                  className="p-3 rounded-xl bg-white/70 dark:bg-[#081417] border border-teal-900/[0.08] dark:border-teal-400/[0.12] flex items-center gap-3"
                >
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-teal-900/[0.08]">
                    {!hasErr && coverImg ? (
                      <img
                        src={coverImg}
                        alt={panelName}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setTypeImgErrors((prev) => ({ ...prev, [rt.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#06383B] to-[#0D9488] text-white">
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {panelName.toUpperCase()} · {rt.subtitle}
                    </p>
                    <p className="font-mono-num text-xs text-teal-700 dark:text-teal-300 font-medium mt-0.5">
                      {formatIDR(rt.monthlyRate)}/bln · {rt.areaSqm} m² · {photoCount} foto
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {rt.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditRoomType(rt)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-700/20 dark:border-teal-400/25 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 shrink-0 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Modifikasi</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Multi-Admin Team Access */}
        <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-4">
          <div className="border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Tim Pengelola &amp; Akses Admin
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar akun pengelola aktif dan undangan email Google
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Admin Terdaftar ({registeredAdmins.length})
            </p>
            {registeredAdmins.map((adm) => {
              const isSelf = adm.uid === currentUserUid;
              return (
                <div
                  key={adm.uid}
                  className="px-3.5 py-2.5 rounded-lg bg-white/70 dark:bg-[#081417] border border-teal-900/[0.08] dark:border-teal-400/[0.12] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {adm.name} {isSelf ? '(Anda)' : ''}
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {adm.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-teal-700 dark:text-teal-300">
                      {adm.role === 'owner' ? 'Pemilik' : 'Admin'}
                    </span>
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => onRemoveRegisteredAdmin(adm.uid)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                        title="Hapus akses admin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {adminInvites.map((inv) => (
              <div
                key={inv.email}
                className="px-3.5 py-2.5 rounded-lg bg-white/50 dark:bg-[#081417] border border-dashed border-teal-700/25 dark:border-teal-400/25 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {inv.name} (Undangan)
                  </p>
                  <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {inv.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAdminInvite(inv.email)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors shrink-0"
                  title="Batalkan undangan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleInviteSubmit}
            className="space-y-2.5 pt-2 border-t border-teal-900/[0.07] dark:border-teal-400/[0.1]"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Undang Penjaga / Pengelola via Email Google
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                placeholder="Nama penjaga / staff"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
              />
              <input
                type="email"
                required
                placeholder="email@gmail.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg btn-primary text-xs font-medium transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{inviting ? 'Menambahkan...' : 'Undang Email Pengelola'}</span>
            </button>
          </form>
        </section>

        {/* Gradient Promotional Broadcast Card */}
        <section className="rounded-xl gradient-hero-card border border-teal-500/30 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/15 pb-3">
            <div>
              <p className="text-xs font-medium text-teal-200">
                Info Ketersediaan Real-Time
              </p>
              <h3 className="font-display font-semibold text-base text-white mt-0.5">
                {form.name}
              </h3>
            </div>
            <span className="font-mono-num text-sm font-semibold text-white">
              {availableRooms.length} Kosong
            </span>
          </div>

          <p className="text-xs text-teal-50/90 leading-relaxed">
            {form.tagline} · {form.address}
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-teal-100">
              Unit Siap Huni Saat Ini:
            </p>
            {availableRooms.length === 0 ? (
              <p className="text-xs text-teal-100/80">
                Semua {rooms.length} unit sedang terisi atau dalam perawatan.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableRooms.map((r) => (
                  <div
                    key={r.id}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 flex items-center justify-between gap-2"
                  >
                    <span className="font-mono-num text-xs font-semibold text-white truncate">
                      {getRoomDisplayName(r)}
                    </span>
                    <span className="font-mono-num text-[11px] text-teal-100 shrink-0">
                      {formatIDR(r.monthlyRate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyPromo}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white text-[#06383B] hover:bg-teal-50 text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Info</span>
            </button>
            <a
              href={buildWhatsAppUrl('', promoText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Teruskan WA</span>
            </a>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('messages')}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-teal-100 hover:text-white underline-offset-4 hover:underline"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Modifikasi Format Pesan di Pusat Pesan &amp; WA</span>
          </button>
        </section>
      </div>
    </div>
  );
};
