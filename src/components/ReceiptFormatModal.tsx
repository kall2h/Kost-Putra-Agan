import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  QrCode,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PropertySettings,
  ReceiptAccentTheme,
  ReceiptTemplateConfig,
} from '../types/kost';
import { DEFAULT_RECEIPT_TEMPLATE } from '../data/initialData';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import { formatDateID, formatIDR, formatMonthYear, getCurrentMonthISO, getTodayISO } from '../utils/format';
import { PropertyLogo } from './PropertyLogo';

interface ReceiptFormatModalProps {
  open: boolean;
  template: ReceiptTemplateConfig;
  settings: PropertySettings;
  onClose: () => void;
  onSave: (config: ReceiptTemplateConfig) => Promise<void>;
  onNotify: (msg: string) => void;
}

const ACCENT_PREVIEW: Record<
  ReceiptAccentTheme,
  { bar: string; heading: string; tableHeader: string; label: string }
> = {
  teal: {
    bar: 'bg-teal-700',
    heading: 'text-teal-700',
    tableHeader: 'bg-teal-700 text-white',
    label: 'Emerald Teal (Default)',
  },
  navy: {
    bar: 'bg-blue-900',
    heading: 'text-blue-900',
    tableHeader: 'bg-blue-900 text-white',
    label: 'Classic Navy',
  },
  slate: {
    bar: 'bg-slate-700',
    heading: 'text-slate-700',
    tableHeader: 'bg-slate-700 text-white',
    label: 'Executive Slate',
  },
};

export const ReceiptFormatModal: React.FC<ReceiptFormatModalProps> = ({
  open,
  template,
  settings,
  onClose,
  onSave,
  onNotify,
}) => {
  const [form, setForm] = useState<ReceiptTemplateConfig>(template);
  const [saving, setSaving] = useState(false);
  const [testingPdf, setTestingPdf] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(template);
    }
  }, [open, template]);

  if (!open) return null;

  const sampleMonth = getCurrentMonthISO();
  const sampleDate = getTodayISO();
  const accentStyle = ACCENT_PREVIEW[form.accentTheme] ?? ACCENT_PREVIEW.teal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSamplePdf = async () => {
    setTestingPdf(true);
    try {
      const filename = await downloadReceiptPdf({
        invoiceNo: 'INV-CONTOH-101',
        roomNumber: '101',
        roomName: 'Kamar 101',
        roomTier: 'Tipe A',
        tenantName: 'Rizky Ramadhan',
        month: sampleMonth,
        amount: 1750000,
        paidDate: sampleDate,
        method: 'Transfer BCA',
        depositAmount: 500000,
        depositStatus: 'Disimpan',
        propertyName: settings.name,
        propertyAddress: settings.address,
        adminName: settings.adminName,
        template: form,
        customRoomNote: 'Contoh catatan khusus profil kamar',
      });
      onNotify(`Contoh PDF ${filename} berhasil diunduh`);
    } finally {
      setTestingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editor Format & Otomasi Kwitansi PDF"
        className="relative z-10 w-full max-w-5xl max-h-[92vh] rounded-2xl bg-gradient-to-b from-white to-[#F4FCFA] dark:from-[#0C1E22] dark:to-[#071418] border border-teal-900/[0.1] dark:border-teal-400/[0.16] shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-teal-900/[0.08] dark:border-teal-400/[0.1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white">
                Format &amp; Otomasi Kwitansi PDF
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atur tampilan kwitansi PDF otomatis beserta opsi pengiriman WhatsApp saat tagihan Lunas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            aria-label="Tutup editor format kwitansi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSave}
          className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left 6 cols: Controls */}
          <div className="lg:col-span-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Judul Kwitansi
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Subjudul / Keterangan
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Warna Aksen Dokumen
                </label>
                <select
                  value={form.accentTheme}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      accentTheme: e.target.value as ReceiptAccentTheme,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                >
                  {Object.entries(ACCENT_PREVIEW).map(([val, meta]) => (
                    <option key={val} value={val}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Label Penanda Tangan
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={form.signerLabel}
                  onChange={(e) => setForm({ ...form, signerLabel: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Baris Fasilitas Termasuk (opsional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={form.includedItemsText}
                onChange={(e) =>
                  setForm({ ...form, includedItemsText: e.target.value })
                }
                placeholder="WiFi 100 Mbps, Air Bersih & Kebersihan Area Bersama"
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Catatan Kaki (Footer Note)
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={form.footerNote}
                onChange={(e) => setForm({ ...form, footerNote: e.target.value })}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              />
            </div>

            {/* Element Toggles */}
            <div className="p-4 rounded-xl bg-white/75 dark:bg-[#081417] border border-teal-900/[0.08] dark:border-teal-400/[0.12] space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Elemen di Dokumen PDF
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.showLogo}
                    onChange={(e) => setForm({ ...form, showLogo: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Tampilkan Logo Properti</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.showAddress}
                    onChange={(e) => setForm({ ...form, showAddress: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Tampilkan Alamat Kos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.showQrVerification}
                    onChange={(e) =>
                      setForm({ ...form, showQrVerification: e.target.checked })
                    }
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Tampilkan QR Verifikasi Link</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.showDepositInfo}
                    onChange={(e) =>
                      setForm({ ...form, showDepositInfo: e.target.checked })
                    }
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Tampilkan Info Deposit</span>
                </label>
              </div>
            </div>

            {/* Automation Toggles */}
            <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-500/[0.08] border border-teal-700/20 dark:border-teal-400/25 space-y-2.5">
              <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-200">
                <Sparkles className="w-3.5 h-3.5" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Otomasi Default Saat Tagihan Lunas
                </p>
              </div>
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoGeneratePdfOnPaid}
                    onChange={(e) =>
                      setForm({ ...form, autoGeneratePdfOnPaid: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    <strong className="font-medium">Auto-Generate &amp; Unduh PDF</strong>{' '}
                    segera setelah tombol Tandai Lunas ditekan
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoOpenReceiptModalOnPaid}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        autoOpenReceiptModalOnPaid: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    <strong className="font-medium">Buka Modal Kwitansi Otomatis</strong>{' '}
                    untuk verifikasi cepat
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoOpenWaOnPaid}
                    onChange={(e) =>
                      setForm({ ...form, autoOpenWaOnPaid: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    <strong className="font-medium">Siapkan Pengiriman WhatsApp</strong>{' '}
                    (otomatis buka panel kirim link PDF ke penyewa)
                  </span>
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pengaturan ini dapat ditimpa khusus per unit kamar melalui panel detail kamar.
              </p>
            </div>
          </div>

          {/* Right 6 cols: Live Receipt Preview */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pratinjau Dokumen Kwitansi PDF
              </p>
              <button
                type="button"
                disabled={testingPdf}
                onClick={handleDownloadSamplePdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-700/25 dark:border-teal-400/25 text-xs font-medium text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-500/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{testingPdf ? 'Membuat...' : 'Unduh Contoh PDF'}</span>
              </button>
            </div>

            <div className="rounded-xl bg-white text-slate-900 border border-slate-200 shadow-sm overflow-hidden">
              <div className={`h-2 w-full ${accentStyle.bar}`} />
              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    {form.showLogo && <PropertyLogo className="w-8 h-8" />}
                    <div>
                      <p className="font-display font-bold text-sm text-slate-950">
                        {settings.name}
                      </p>
                      {form.showAddress && (
                        <p className="text-[11px] text-slate-500 max-w-[200px] leading-snug">
                          {settings.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-[11px] font-bold uppercase tracking-wider ${accentStyle.heading}`}
                    >
                      {form.title || 'KWITANSI SEWA'}
                    </p>
                    {form.subtitle && (
                      <p className="text-[10px] text-slate-500">{form.subtitle}</p>
                    )}
                    <p className="font-mono-num text-[11px] font-semibold text-slate-900 mt-0.5">
                      INV-CONTOH-101
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase text-slate-400">Diterima Dari</p>
                    <p className="font-semibold text-slate-900 mt-0.5">Rizky Ramadhan</p>
                    <p className="text-[11px] text-slate-600">Kamar 101 · Tipe A</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-slate-400">Periode</p>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {formatMonthYear(sampleMonth)}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {formatDateID(sampleDate)} · Transfer BCA
                    </p>
                  </div>
                </div>

                <div>
                  <div
                    className={`px-3 py-1.5 rounded-t-md flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider ${accentStyle.tableHeader}`}
                  >
                    <span>Rincian Tagihan</span>
                    <span>Nominal</span>
                  </div>
                  <div className="border border-t-0 border-slate-200 rounded-b-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Sewa Kamar 101 ({formatMonthYear(sampleMonth)})</span>
                      <span className="font-mono-num font-semibold">
                        {formatIDR(1750000)}
                      </span>
                    </div>
                    {form.includedItemsText.trim() && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="max-w-[75%]">{form.includedItemsText}</span>
                        <span>Termasuk</span>
                      </div>
                    )}
                    {form.showDepositInfo && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Status Deposit (Disimpan)</span>
                        <span className="font-mono-num">{formatIDR(500000)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>LUNAS · TERVERIFIKASI</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">TOTAL DIBAYARKAN</p>
                    <p className="font-mono-num text-lg font-bold text-slate-950">
                      {formatIDR(1750000)}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  {form.showQrVerification ? (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <div className="w-10 h-10 rounded border border-slate-300 flex items-center justify-center bg-slate-50">
                        <QrCode className="w-6 h-6 text-slate-700" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Verifikasi QR Digital</p>
                        <p>Pindai untuk salinan PDF</p>
                      </div>
                    </div>
                  ) : (
                    <span />
                  )}
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">
                      {form.signerLabel || 'Pengelola Properti'}
                    </p>
                    <p className="font-semibold text-slate-900 mt-1">{settings.adminName}</p>
                  </div>
                </div>

                {form.footerNote.trim() && (
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
                    {form.footerNote}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="lg:col-span-12 pt-4 border-t border-teal-900/[0.08] dark:border-teal-400/[0.1] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setForm(DEFAULT_RECEIPT_TEMPLATE)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Format Bawaan</span>
            </button>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg btn-primary text-xs sm:text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Format Kwitansi'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
