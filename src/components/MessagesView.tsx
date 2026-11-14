import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  MessageTemplate,
  MessageTemplateCategory,
  PaymentRecord,
  PropertySettings,
  Room,
} from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import {
  buildWhatsAppUrl,
  formatIDR,
  formatMonthYear,
} from '../utils/format';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
  TEMPLATE_VARIABLES,
} from '../utils/messageTemplates';

interface MessagesViewProps {
  templates: MessageTemplate[];
  rooms: Room[];
  payments: PaymentRecord[];
  settings: PropertySettings;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onSaveTemplate: (template: MessageTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onNotify: (msg: string) => void;
}

const CATEGORY_LABELS: Record<MessageTemplateCategory, string> = {
  tagihan: 'Tagihan Bulanan',
  tunggakan: 'Tunggakan',
  lunas: 'Konfirmasi Lunas',
  promo: 'Info Kamar Kosong',
  pengumuman: 'Pengumuman',
  kustom: 'Kustom',
};

export const MessagesView: React.FC<MessagesViewProps> = ({
  templates,
  rooms,
  payments,
  settings,
  selectedMonth,
  onChangeMonth,
  onSaveTemplate,
  onDeleteTemplate,
  onNotify,
}) => {
  const activeTemplates =
    templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;

  const [selectedId, setSelectedId] = useState<string>(activeTemplates[0].id);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] =
    useState<MessageTemplateCategory>('tagihan');
  const [bodyInput, setBodyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [sendMode, setSendMode] = useState<'single' | 'batch'>('single');
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<'unpaid' | 'all_occupied'>('unpaid');
  const [customPreviewText, setCustomPreviewText] = useState<string>('');
  const [isManualEdited, setIsManualEdited] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedTemplate = useMemo(
    () =>
      activeTemplates.find((t) => t.id === selectedId) ?? activeTemplates[0],
    [activeTemplates, selectedId]
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setNameInput(selectedTemplate.name);
    setCategoryInput(selectedTemplate.category);
    setBodyInput(selectedTemplate.body);
    setIsManualEdited(false);
  }, [selectedTemplate]);

  const occupiedRooms = useMemo(
    () => rooms.filter((r) => r.status === 'Terisi' && r.tenant),
    [rooms]
  );
  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'Tersedia'),
    [rooms]
  );

  useEffect(() => {
    if (occupiedRooms.length === 0) return;
    if (!targetRoomId || !occupiedRooms.some((r) => r.id === targetRoomId)) {
      const unpaidInMonth = payments.find(
        (p) => p.month === selectedMonth && p.status === 'Belum Bayar'
      );
      const preferred = unpaidInMonth
        ? occupiedRooms.find((r) => r.number === unpaidInMonth.roomNumber)
        : occupiedRooms[0];
      setTargetRoomId((preferred ?? occupiedRooms[0]).id);
    }
  }, [occupiedRooms, payments, selectedMonth, targetRoomId]);

  const monthOptions = useMemo(() => {
    const set = new Set(payments.map((p) => p.month));
    set.add(selectedMonth);
    return Array.from(set).sort().reverse();
  }, [payments, selectedMonth]);

  const targetRoom = useMemo(
    () => occupiedRooms.find((r) => r.id === targetRoomId) ?? occupiedRooms[0] ?? null,
    [occupiedRooms, targetRoomId]
  );

  const targetPayment = useMemo(() => {
    if (!targetRoom) return null;
    return (
      payments.find(
        (p) => p.month === selectedMonth && p.roomNumber === targetRoom.number
      ) ?? null
    );
  }, [payments, selectedMonth, targetRoom]);

  const autoRenderedPreview = useMemo(
    () =>
      renderMessageTemplate(bodyInput, {
        settings,
        room: targetRoom,
        payment: targetPayment,
        availableRooms,
        month: selectedMonth,
      }),
    [bodyInput, settings, targetRoom, targetPayment, availableRooms, selectedMonth]
  );

  useEffect(() => {
    if (!isManualEdited) {
      setCustomPreviewText(autoRenderedPreview);
    }
  }, [autoRenderedPreview, isManualEdited]);

  const activePreviewText = isManualEdited
    ? customPreviewText
    : autoRenderedPreview;

  const isBuiltIn = DEFAULT_MESSAGE_TEMPLATES.some((d) => d.id === selectedId);

  const handleInsertVariable = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setBodyInput((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${token}`);
      return;
    }
    const start = el.selectionStart ?? bodyInput.length;
    const end = el.selectionEnd ?? bodyInput.length;
    const next = bodyInput.slice(0, start) + token + bodyInput.slice(end);
    setBodyInput(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !bodyInput.trim()) return;
    setSaving(true);
    try {
      await onSaveTemplate({
        id: selectedId,
        name: nameInput.trim(),
        category: categoryInput,
        body: bodyInput.trim(),
      });
      setIsManualEdited(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewTemplate = async () => {
    const newId = `tpl-custom-${Date.now()}`;
    const newTpl: MessageTemplate = {
      id: newId,
      name: 'Template Pesan Baru',
      category: 'kustom',
      body: 'Halo *{nama_penyewa}* ({nama_kamar}),\n\nIni pesan dari pengelola *{nama_kos}*.\nTerima kasih.',
    };
    await onSaveTemplate(newTpl);
    setSelectedId(newId);
  };

  const handleResetDefault = async () => {
    const def = DEFAULT_MESSAGE_TEMPLATES.find((d) => d.id === selectedId);
    if (!def) return;
    await onSaveTemplate(def);
    setNameInput(def.name);
    setCategoryInput(def.category);
    setBodyInput(def.body);
    setIsManualEdited(false);
  };

  const handleDeleteCurrent = async () => {
    if (isBuiltIn) return;
    await onDeleteTemplate(selectedId);
    setSelectedId(DEFAULT_MESSAGE_TEMPLATES[0].id);
  };

  const handleCopyText = async (text: string, label = 'Pesan WhatsApp') => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(`${label} berhasil disalin ke clipboard`);
    } catch {
      onNotify(`${label} siap diteruskan`);
    }
  };

  const batchItems = useMemo(() => {
    const list =
      batchFilter === 'unpaid'
        ? occupiedRooms.filter((r) => {
            const p = payments.find(
              (pay) => pay.month === selectedMonth && pay.roomNumber === r.number
            );
            return p ? p.status === 'Belum Bayar' : true;
          })
        : occupiedRooms;

    return list.map((room) => {
      const pay =
        payments.find(
          (p) => p.month === selectedMonth && p.roomNumber === room.number
        ) ?? null;
      const text = renderMessageTemplate(bodyInput, {
        settings,
        room,
        payment: pay,
        availableRooms,
        month: selectedMonth,
      });
      const phone = room.tenant?.phone ?? '';
      return {
        room,
        payment: pay,
        phone,
        text,
        waUrl: buildWhatsAppUrl(phone, text),
      };
    });
  }, [batchFilter, occupiedRooms, payments, selectedMonth, bodyInput, settings, availableRooms]);

  const handleDownloadTxt = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(`File ${filename} berhasil diunduh`);
  };

  const handleExportBatchTxt = () => {
    const sections = batchItems.map(
      (item, idx) =>
        `=== [${idx + 1}] ${getRoomDisplayName(item.room)} — ${
          item.room.tenant?.name ?? '-'
        } (${item.phone}) ===\n${item.text}`
    );
    const header = `EKSPOR PESAN WHATSAPP — ${settings.name.toUpperCase()}\nTemplate: ${nameInput}\nPeriode: ${formatMonthYear(
      selectedMonth
    )}\nTotal Penerima: ${batchItems.length}\n\n`;
    handleDownloadTxt(
      header + sections.join('\n\n----------------------------------------\n\n'),
      `pesan-wa-${selectedMonth}-${categoryInput}.txt`
    );
  };

  const handleExportBatchCsv = () => {
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const header = 'Kamar,Penyewa,No_WhatsApp,Nominal,Pesan_Siap_Kirim,Link_WhatsApp\n';
    const rows = batchItems.map((item) => {
      const total =
        (item.payment?.amount ?? item.room.monthlyRate) +
        (item.payment?.lateFee ?? 0);
      return [
        escapeCsv(getRoomDisplayName(item.room)),
        escapeCsv(item.room.tenant?.name ?? '-'),
        escapeCsv(item.phone),
        String(total),
        escapeCsv(item.text),
        escapeCsv(item.waUrl),
      ].join(',');
    });
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `broadcast-wa-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('Daftar pesan & link WhatsApp berhasil diekspor (CSV)');
  };

  const singleWaPhone =
    categoryInput === 'promo' ? '' : targetRoom?.tenant?.phone ?? '';
  const singleWaUrl = buildWhatsAppUrl(singleWaPhone, activePreviewText);

  return (
    <div className="space-y-6">
      {/* Top Template Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {activeTemplates.map((tpl) => {
            const active = tpl.id === selectedId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedId(tpl.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                  active
                    ? 'nav-active-gradient border-transparent text-white'
                    : 'surface-card border-teal-900/[0.08] dark:border-teal-400/[0.12] text-slate-700 dark:text-slate-200 hover:border-teal-500/40'
                }`}
              >
                {tpl.name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleCreateNewTemplate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-700/20 dark:border-teal-400/25 bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-500/10 dark:to-emerald-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Template Kustom</span>
        </button>
      </div>

      {/* Main Split: Editor (7 cols) + Live Preview & Export/Forward WA (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Template Modifier */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-7 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <div>
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Modifikasi Format Pesan
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ubah kata-kata atau sisipkan variabel otomatis agar langsung terisi data kamar &amp; penyewa
                </p>
              </div>
            </div>

            {isBuiltIn ? (
              <button
                type="button"
                onClick={handleResetDefault}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Bawaan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Template</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nama Template
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg input-surface border text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Kategori Penggunaan
              </label>
              <select
                value={categoryInput}
                onChange={(e) =>
                  setCategoryInput(e.target.value as MessageTemplateCategory)
                }
                className="w-full px-3.5 py-2 rounded-lg input-surface border text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clickable Smart Variable Inserter */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Sisipkan Variabel Otomatis (klik untuk memasukkan ke posisi kursor):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => handleInsertVariable(v.key)}
                  title={`Contoh hasil: ${v.example}`}
                  className="px-2.5 py-1 rounded-md border border-teal-700/20 dark:border-teal-400/20 bg-teal-50/70 dark:bg-teal-500/[0.08] text-[11px] font-mono-num font-medium text-teal-800 dark:text-teal-200 hover:border-teal-600 transition-colors"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Isi Pesan (mendukung format *tebal* WhatsApp)
              </label>
              <span className="font-mono-num text-[11px] text-slate-400">
                {bodyInput.length}/2500
              </span>
            </div>
            <textarea
              ref={textareaRef}
              required
              rows={11}
              maxLength={2500}
              value={bodyInput}
              onChange={(e) => setBodyInput(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl input-surface border text-sm leading-relaxed font-sans"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-teal-900/[0.07] dark:border-teal-400/[0.1]">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
              Info rekening aktif: <span className="font-medium text-slate-700 dark:text-slate-200">{settings.paymentAccountInfo || 'Belum diatur'}</span>
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-sm font-medium transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Template'}</span>
            </button>
          </div>
        </form>

        {/* Right 5 cols: Preview, Export & Teruskan ke WhatsApp */}
        <section className="xl:col-span-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Preview &amp; Teruskan ke WhatsApp
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kirim satuan langsung ke nomor penyewa atau ekspor massal
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100/90 dark:bg-white/[0.05] border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
              <button
                type="button"
                onClick={() => setSendMode('single')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  sendMode === 'single'
                    ? 'nav-active-gradient text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Satuan
              </button>
              <button
                type="button"
                onClick={() => setSendMode('batch')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  sendMode === 'batch'
                    ? 'nav-active-gradient text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Massal
              </button>
            </div>
          </div>

          {/* Month & Target Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Periode Tagihan
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-xs font-medium"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthYear(m)}
                  </option>
                ))}
              </select>
            </div>

            {sendMode === 'single' ? (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Pilih Kamar / Penyewa
                </label>
                <select
                  value={targetRoom?.id ?? ''}
                  onChange={(e) => {
                    setTargetRoomId(e.target.value);
                    setIsManualEdited(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-xs font-medium"
                >
                  {occupiedRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {getRoomDisplayName(r)} — {r.tenant?.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Target Penerima Massal
                </label>
                <select
                  value={batchFilter}
                  onChange={(e) =>
                    setBatchFilter(e.target.value as 'unpaid' | 'all_occupied')
                  }
                  className="w-full px-3 py-2 rounded-lg input-surface border text-xs font-medium"
                >
                  <option value="unpaid">Belum Bayar Bulan Ini</option>
                  <option value="all_occupied">Semua Penghuni Aktif</option>
                </select>
              </div>
            )}
          </div>

          {sendMode === 'single' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Hasil Pesan (bisa diedit lagi sebelum kirim):
                  </span>
                  {isManualEdited && (
                    <button
                      type="button"
                      onClick={() => setIsManualEdited(false)}
                      className="text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
                    >
                      Sinkronkan ulang
                    </button>
                  )}
                </div>
                <textarea
                  rows={10}
                  value={activePreviewText}
                  onChange={(e) => {
                    setCustomPreviewText(e.target.value);
                    setIsManualEdited(true);
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-[#061A1E] dark:to-[#041216] border border-teal-700/20 dark:border-teal-400/20 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none focus:border-teal-600"
                />
                {targetRoom?.tenant && categoryInput !== 'promo' && (
                  <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                    Tujuan WA: {targetRoom.tenant.name} ({targetRoom.tenant.phone})
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCopyText(activePreviewText)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-teal-900/15 dark:border-teal-400/20 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Teks</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownloadTxt(
                      activePreviewText,
                      `pesan-${targetRoom?.number ?? 'kos'}-${selectedMonth}.txt`
                    )
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-teal-900/15 dark:border-teal-400/20 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor .TXT</span>
                </button>

                <a
                  href={singleWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg btn-primary text-xs font-medium transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka WhatsApp</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={batchItems.length === 0}
                  onClick={handleExportBatchTxt}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg btn-primary text-xs font-medium disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Paket (.TXT)</span>
                </button>
                <button
                  type="button"
                  disabled={batchItems.length === 0}
                  onClick={handleExportBatchCsv}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-teal-700/20 dark:border-teal-400/25 text-xs font-medium text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor CSV + Link WA</span>
                </button>
              </div>

              {batchItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                  Tidak ada penerima untuk filter ini pada periode {formatMonthYear(selectedMonth)}.
                </p>
              ) : (
                <div className="max-h-[340px] overflow-y-auto divide-y divide-teal-900/[0.06] dark:divide-white/[0.06] border border-teal-900/[0.08] dark:border-teal-400/[0.12] rounded-xl bg-white/60 dark:bg-[#081417]">
                  {batchItems.map((item) => {
                    const total =
                      (item.payment?.amount ?? item.room.monthlyRate) +
                      (item.payment?.lateFee ?? 0);
                    return (
                      <div
                        key={item.room.id}
                        className="p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {getRoomDisplayName(item.room)} · {item.room.tenant?.name}
                          </p>
                          <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                            {item.phone} · {formatIDR(total)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                item.text,
                                `Pesan ${item.room.tenant?.name ?? item.room.number}`
                              )
                            }
                            className="p-1.5 rounded-lg border border-teal-900/10 dark:border-teal-400/15 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-white/[0.06]"
                            title="Salin pesan"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={item.waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg btn-primary text-[11px] font-medium"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Kirim WA</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
