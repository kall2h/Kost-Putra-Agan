import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Globe,
  Landmark,
  Link2,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  MessageTemplate,
  PaymentLinkRecord,
  PaymentMethod,
  PaymentRecord,
  PropertySettings,
  ReceiptTemplateConfig,
  Room,
} from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import {
  buildWhatsAppUrl,
  formatIDR,
  formatMonthYear,
  getDueStatusInfo,
} from '../utils/format';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
} from '../utils/messageTemplates';
import {
  buildShareablePaymentUrl,
  getEffectivePublicBaseUrl,
  isPreviewHostOrigin,
  normalizePublicBaseUrl,
  resolveRoomPaymentProfile,
} from '../utils/receiptPdf';
import { CurrencyInput } from './CurrencyInput';

interface PaymentLinkModalProps {
  open: boolean;
  selectedMonth: string;
  initialPayment?: PaymentRecord | null;
  initialRoom?: Room | null;
  payments: PaymentRecord[];
  rooms: Room[];
  paymentLinksById: Record<string, PaymentLinkRecord>;
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
  templates: MessageTemplate[];
  onClose: () => void;
  onCreateOrUpdateLink: (payload: {
    room: Room;
    month: string;
    existingPayment?: PaymentRecord | null;
    amount: number;
    lateFee?: number;
    notes?: string;
    preferredMethod: PaymentMethod;
    externalPaymentLink?: string;
  }) => Promise<{ payment: PaymentRecord; linkId: string }>;
  onSavePublicAppUrl?: (url: string) => Promise<void>;
  onMarkPaid: (paymentId: string) => Promise<void> | void;
  onNotify: (msg: string) => void;
}

export const PaymentLinkModal: React.FC<PaymentLinkModalProps> = ({
  open,
  selectedMonth,
  initialPayment,
  initialRoom,
  payments,
  rooms,
  paymentLinksById,
  settings,
  receiptTemplate,
  templates,
  onClose,
  onCreateOrUpdateLink,
  onSavePublicAppUrl,
  onMarkPaid,
  onNotify,
}) => {
  const occupiedRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.status === 'Terisi' && r.tenant)
        .sort((a, b) => a.number.localeCompare(b.number)),
    [rooms]
  );

  const monthPayments = useMemo(
    () => payments.filter((p) => p.month === selectedMonth),
    [payments, selectedMonth]
  );

  const selectableTargets = useMemo(() => {
    const items: {
      roomNumber: string;
      room: Room;
      payment: PaymentRecord | null;
    }[] = [];
    const seenRooms = new Set<string>();

    // Prioritize unpaid invoices first
    const sortedPayments = [...monthPayments].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Belum Bayar' ? -1 : 1;
      return a.roomNumber.localeCompare(b.roomNumber);
    });

    for (const pay of sortedPayments) {
      const r = rooms.find((item) => item.number === pay.roomNumber);
      if (!r) continue;
      seenRooms.add(r.number);
      items.push({ roomNumber: r.number, room: r, payment: pay });
    }

    for (const r of occupiedRooms) {
      if (!seenRooms.has(r.number)) {
        items.push({ roomNumber: r.number, room: r, payment: null });
      }
    }
    return items;
  }, [monthPayments, occupiedRooms, rooms]);

  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [amount, setAmount] = useState(0);
  const [lateFee, setLateFee] = useState(0);
  const [preferredMethod, setPreferredMethod] =
    useState<PaymentMethod>('Transfer BCA');
  const [externalLink, setExternalLink] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    payment: PaymentRecord;
    linkId: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [editingDomain, setEditingDomain] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);

  // Reset form when modal opens or initial target changes
  useEffect(() => {
    if (!open) return;
    const defaultRoomNo =
      initialPayment?.roomNumber ||
      initialRoom?.number ||
      selectableTargets[0]?.roomNumber ||
      '';
    setSelectedRoomNumber(defaultRoomNo);
    setCreatedResult(null);
    setCopiedUrl(false);
    setDomainInput(settings.publicAppUrl ?? '');
    setEditingDomain(
      isPreviewHostOrigin() && !normalizePublicBaseUrl(settings.publicAppUrl)
    );
  }, [open, initialPayment, initialRoom, selectableTargets, settings.publicAppUrl]);

  const activeTarget = useMemo(
    () =>
      selectableTargets.find((t) => t.roomNumber === selectedRoomNumber) ??
      selectableTargets[0] ??
      null,
    [selectableTargets, selectedRoomNumber]
  );

  // Sync field defaults whenever selected room changes
  useEffect(() => {
    if (!open || !activeTarget) return;
    const { room, payment } = activeTarget;
    const resolved = resolveRoomPaymentProfile(room, settings, receiptTemplate);
    const existingLink = payment?.paymentLinkId
      ? paymentLinksById[payment.paymentLinkId]
      : undefined;

    setAmount(payment?.amount ?? room.monthlyRate);
    setLateFee(payment?.lateFee ?? 0);
    setNotes(payment?.notes ?? '');
    setPreferredMethod(
      ((existingLink?.preferredMethod || resolved.preferredMethod) as PaymentMethod) ??
        'Transfer BCA'
    );
    setExternalLink(
      existingLink?.externalPaymentLink || resolved.externalPaymentLink || ''
    );
    setCreatedResult(null);
  }, [open, activeTarget?.roomNumber]);

  const currentPayment =
    createdResult && createdResult.payment.roomNumber === activeTarget?.roomNumber
      ? createdResult.payment
      : activeTarget?.payment ?? null;

  const activeLinkId =
    (createdResult && createdResult.payment.roomNumber === activeTarget?.roomNumber
      ? createdResult.linkId
      : undefined) ||
    currentPayment?.paymentLinkId ||
    '';

  const effectiveBaseUrl = getEffectivePublicBaseUrl(settings.publicAppUrl);
  const previewOriginDetected =
    isPreviewHostOrigin() && !normalizePublicBaseUrl(settings.publicAppUrl);

  const liveLinkRecord = activeLinkId ? paymentLinksById[activeLinkId] : undefined;
  const shareUrl = activeLinkId
    ? buildShareablePaymentUrl(activeLinkId, settings.publicAppUrl)
    : '';

  useEffect(() => {
    if (!open || !shareUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(shareUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  useEffect(() => {
    if (!copiedUrl) return;
    const timer = window.setTimeout(() => setCopiedUrl(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copiedUrl]);

  if (!open) return null;

  const grandTotal = (amount || 0) + (lateFee || 0);
  const resolvedProfile = activeTarget
    ? resolveRoomPaymentProfile(activeTarget.room, settings, receiptTemplate)
    : null;

  const isPaid =
    currentPayment?.status === 'Lunas' || liveLinkRecord?.status === 'Lunas';
  const isPendingVerify =
    !isPaid && liveLinkRecord?.status === 'Menunggu Verifikasi';

  const activeTemplates =
    templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;
  const dueDay = activeTarget?.room.tenant?.dueDay ?? settings.defaultDueDay;
  const dueInfo = getDueStatusInfo(selectedMonth, dueDay);

  const targetTplCategory = isPaid
    ? 'lunas'
    : dueInfo.tone === 'overdue'
    ? 'tunggakan'
    : 'tagihan';
  const chosenTemplate =
    activeTemplates.find((t) => t.category === targetTplCategory) ??
    DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === targetTplCategory) ??
    activeTemplates[0];

  const previewPayment: PaymentRecord | null = activeTarget
    ? {
        id: currentPayment?.id || `pay-${selectedMonth}-${activeTarget.room.number}`,
        invoiceNo:
          currentPayment?.invoiceNo ||
          `INV/KPA/${selectedMonth.replace('-', '/')}/${activeTarget.room.number}`,
        roomNumber: activeTarget.room.number,
        tenantName:
          currentPayment?.tenantName ||
          activeTarget.room.tenant?.name ||
          `Penghuni ${activeTarget.room.number}`,
        month: selectedMonth,
        amount: amount || 0,
        lateFee: lateFee > 0 ? lateFee : undefined,
        paidDate: currentPayment?.paidDate ?? null,
        status: isPaid ? 'Lunas' : 'Belum Bayar',
        method: currentPayment?.method ?? preferredMethod,
        notes: notes.trim() || undefined,
        paymentLinkId: activeLinkId || undefined,
      }
    : null;

  const waMessage =
    activeTarget && previewPayment
      ? renderMessageTemplate(chosenTemplate.body, {
          settings,
          room: activeTarget.room,
          payment: previewPayment,
          month: selectedMonth,
          paymentUrl: shareUrl || undefined,
        })
      : '';

  const waUrl =
    activeTarget?.room.tenant?.phone && waMessage
      ? buildWhatsAppUrl(activeTarget.room.tenant.phone, waMessage)
      : '';

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTarget) return;
    setSaving(true);
    try {
      const res = await onCreateOrUpdateLink({
        room: activeTarget.room,
        month: selectedMonth,
        existingPayment: activeTarget.payment,
        amount,
        lateFee: lateFee > 0 ? lateFee : undefined,
        notes: notes.trim() || undefined,
        preferredMethod,
        externalPaymentLink: externalLink.trim() || undefined,
      });
      setCreatedResult(res);
      const url = buildShareablePaymentUrl(res.linkId, settings.publicAppUrl);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedUrl(true);
        onNotify(
          `Link pembayaran ${getRoomDisplayName(activeTarget.room)} dibuat & disalin`
        );
      } catch {
        onNotify(
          `Link pembayaran ${getRoomDisplayName(activeTarget.room)} siap dibagikan`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrlOnly = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      onNotify('Tautan pembayaran disalin ke clipboard');
    } catch {
      onNotify(`Tautan siap dibagikan: ${shareUrl}`);
    }
  };

  const handleCopyWaText = async () => {
    if (!waMessage) return;
    try {
      await navigator.clipboard.writeText(waMessage);
      onNotify('Pesan tagihan lengkap dengan link pembayaran disalin');
    } catch {
      onNotify('Pesan tagihan siap dikirim');
    }
  };

  const handleVerifyNow = async () => {
    if (!currentPayment) return;
    setVerifying(true);
    try {
      await onMarkPaid(currentPayment.id);
      onClose();
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveDomain = async () => {
    if (!onSavePublicAppUrl) return;
    setSavingDomain(true);
    try {
      await onSavePublicAppUrl(domainInput);
      setEditingDomain(false);
    } finally {
      setSavingDomain(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/50 animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-link-modal-title"
        className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl surface-card border border-slate-200/90 dark:border-white/[0.1] shadow-2xl overflow-hidden animate-modal-in"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl nav-active-gradient text-white flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="payment-link-modal-title"
                className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate"
              >
                Buat Link Pembayaran &amp; Kwitansi Otomatis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Periode {formatMonthYear(selectedMonth)} · Sinkron real-time dengan status lunas &amp; kwitansi PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup modal link pembayaran"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        {selectableTargets.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Belum Ada Kamar Terisi atau Tagihan Aktif
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Lakukan check-in penyewa terlebih dahulu di menu Kamar untuk membuat link pembayaran bulanan.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-white/[0.08]">
            {/* Left Form */}
            <form
              onSubmit={handleSubmitCreate}
              className="lg:col-span-7 p-6 space-y-5"
            >
              <div>
                <label
                  htmlFor="pl-room-select"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Pilih Kamar &amp; Penyewa
                </label>
                <select
                  id="pl-room-select"
                  value={activeTarget?.roomNumber ?? ''}
                  onChange={(e) => setSelectedRoomNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl input-surface border text-sm font-medium"
                >
                  {selectableTargets.map((item) => {
                    const statusLabel = item.payment
                      ? item.payment.status === 'Lunas'
                        ? 'Lunas'
                        : item.payment.paymentLinkId
                        ? 'Ada Link'
                        : 'Belum Bayar'
                      : 'Buat Tagihan + Link';
                    return (
                      <option key={item.roomNumber} value={item.roomNumber}>
                        {getRoomDisplayName(item.room)} ·{' '}
                        {item.payment?.tenantName ||
                          item.room.tenant?.name ||
                          'Penghuni'}{' '}
                        ({statusLabel})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pl-amount"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Nominal Sewa Pokok (Rp)
                  </label>
                  <CurrencyInput
                    id="pl-amount"
                    value={amount}
                    onChange={setAmount}
                    className="w-full pr-3.5 py-2.5 rounded-xl input-surface border font-mono-num text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pl-late-fee"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Denda Keterlambatan (Opsional)
                  </label>
                  <CurrencyInput
                    id="pl-late-fee"
                    value={lateFee}
                    onChange={setLateFee}
                    className="w-full pr-3.5 py-2.5 rounded-xl input-surface border font-mono-num text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="pl-method"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Metode Utama di Halaman Bayar
                  </label>
                  <select
                    id="pl-method"
                    value={preferredMethod}
                    onChange={(e) =>
                      setPreferredMethod(e.target.value as PaymentMethod)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl input-surface border text-sm"
                  >
                    <option value="Transfer BCA">Transfer BCA</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Transfer Mandiri">Transfer Mandiri</option>
                    <option value="Tunai">Tunai</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="pl-external-link"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                  >
                    Link Gateway / E-Wallet (Opsional)
                  </label>
                  <input
                    id="pl-external-link"
                    type="url"
                    maxLength={300}
                    placeholder="https://..."
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl input-surface border text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="pl-notes"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  Catatan Tagihan (Opsional)
                </label>
                <input
                  id="pl-notes"
                  type="text"
                  maxLength={300}
                  placeholder="Misal: Termasuk tambahan biaya listrik / parkir"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl input-surface border text-sm"
                />
              </div>

              {/* Active Channel Summary */}
              {resolvedProfile && (
                <div className="rounded-xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.07] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                      <Landmark className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      Saluran Tersedia untuk Penyewa
                    </span>
                    <span className="font-mono-num font-semibold text-teal-700 dark:text-teal-300">
                      Total: {formatIDR(grandTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {resolvedProfile.accountNumber
                      ? `${resolvedProfile.bankName} ${resolvedProfile.accountNumber} a.n. ${resolvedProfile.accountHolder}`
                      : 'Rekening belum diisi di Pengaturan'}
                    {resolvedProfile.qrisImageUrl ? ' · QRIS Aktif' : ''}
                    {externalLink.trim() ? ' · Link Gateway Eksternal' : ''}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-200/70 dark:border-white/[0.06]">
                    Saat pembayaran terverifikasi, status tagihan otomatis berubah menjadi{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Lunas
                    </span>
                    , kwitansi PDF langsung dibuat dan tampil real-time di halaman penyewa.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] px-4 py-2 rounded-xl btn-secondary text-xs sm:text-sm font-medium"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving || !activeTarget}
                  className="min-h-[40px] inline-flex items-center gap-2 px-5 py-2 rounded-xl btn-primary text-xs sm:text-sm font-semibold disabled:opacity-50"
                >
                  <Link2 className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {saving
                      ? 'Menyiapkan Link...'
                      : activeLinkId
                      ? 'Perbarui & Salin Link'
                      : 'Buat & Salin Link Pembayaran'}
                  </span>
                </button>
              </div>
            </form>

            {/* Right Preview & Share Panel */}
            <div className="lg:col-span-5 p-6 bg-slate-50/70 dark:bg-white/[0.02] flex flex-col justify-between gap-5">
              {/* Domain Vercel Configuration Bar */}
              <div
                className={`rounded-xl border p-3.5 space-y-2.5 ${
                  previewOriginDetected
                    ? 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-300/80 dark:border-amber-400/30'
                    : 'bg-white dark:bg-[#0d181c] border-slate-200/80 dark:border-white/[0.08]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Globe
                      className={`w-3.5 h-3.5 shrink-0 ${
                        previewOriginDetected
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-teal-600 dark:text-teal-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {previewOriginDetected
                        ? 'Link Masih Mengarah ke Preview AI Studio'
                        : 'Domain Tujuan Link'}
                    </span>
                  </div>
                  {onSavePublicAppUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingDomain((v) => !v)}
                      className="text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline shrink-0"
                    >
                      {editingDomain ? 'Tutup' : 'Ubah Domain'}
                    </button>
                  )}
                </div>

                {!editingDomain ? (
                  <p className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {effectiveBaseUrl || '-'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label
                      htmlFor="pl-vercel-domain-input"
                      className="block text-[11px] text-slate-600 dark:text-slate-300 leading-snug"
                    >
                      Masukkan URL website Vercel Anda agar link tidak mengarah ke AI Studio:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="pl-vercel-domain-input"
                        type="url"
                        maxLength={200}
                        placeholder="https://nama-web-anda.vercel.app"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                      />
                      <button
                        type="button"
                        disabled={savingDomain}
                        onClick={handleSaveDomain}
                        className="px-3 py-1.5 rounded-lg btn-primary text-xs font-medium shrink-0 disabled:opacity-50"
                      >
                        {savingDomain ? 'Simpan...' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {shareUrl ? (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Tautan Pembayaran Siap
                      </span>
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Lunas</span>
                        </span>
                      ) : isPendingVerify ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
                          <Clock3 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Menunggu Verifikasi</span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Aktif · Belum Bayar
                        </span>
                      )}
                    </div>

                    {isPendingVerify && liveLinkRecord && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/80 dark:border-amber-400/30 p-3.5 space-y-2.5">
                        <p className="text-xs font-medium text-amber-950 dark:text-amber-200">
                          Penyewa mengonfirmasi pembayaran via{' '}
                          <span className="font-semibold">
                            {liveLinkRecord.confirmationMethod || 'Transfer'}
                          </span>
                          {liveLinkRecord.confirmationNote
                            ? ` (${liveLinkRecord.confirmationNote})`
                            : ''}
                          .
                        </p>
                        <button
                          type="button"
                          disabled={verifying}
                          onClick={handleVerifyNow}
                          className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl btn-primary text-xs font-semibold"
                        >
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {verifying
                              ? 'Memverifikasi...'
                              : 'Verifikasi Lunas & Kirim Kwitansi'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* QR Preview */}
                    <div className="rounded-xl bg-white dark:bg-[#0d181c] border border-slate-200/80 dark:border-white/[0.08] p-4 flex items-center gap-4">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="QR Link Pembayaran"
                          className="w-24 h-24 rounded-lg border border-slate-200 p-1 bg-white shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-white/[0.04] flex items-center justify-center shrink-0">
                          <QrCode className="w-8 h-8 text-slate-400" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 truncate">
                          {previewPayment?.invoiceNo}
                        </p>
                        <p className="font-display font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {previewPayment?.tenantName}
                        </p>
                        <p className="font-mono-num text-base font-bold text-teal-700 dark:text-teal-300">
                          {formatIDR(grandTotal)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Scan QR atau salin tautan di bawah
                        </p>
                      </div>
                    </div>

                    {/* Copy URL Box */}
                    <div className="space-y-2">
                      <label
                        htmlFor="pl-generated-url"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-300"
                      >
                        Tautan Pembayaran &amp; Kwitansi
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="pl-generated-url"
                          type="text"
                          readOnly
                          value={shareUrl}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl input-surface border font-mono-num text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleCopyUrlOnly}
                          className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl btn-secondary text-xs font-medium shrink-0"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                              <span>Disalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Share Actions */}
                  <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl btn-primary text-xs sm:text-sm font-semibold"
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {isPaid
                            ? 'Kirim Kwitansi ke WhatsApp'
                            : 'Kirim Tagihan + Link ke WhatsApp'}
                        </span>
                      </a>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCopyWaText}
                        className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl btn-secondary text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Salin Pesan WA</span>
                      </button>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl btn-secondary text-xs font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Buka Halaman</span>
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <div className="my-auto text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200/80 dark:border-teal-400/20 flex items-center justify-center mx-auto text-teal-700 dark:text-teal-300">
                    <QrCode className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                      Belum Ada Link untuk Tagihan Ini
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                      Periksa nominal dan metode pembayaran di samping, lalu klik{' '}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Buat &amp; Salin Link Pembayaran
                      </span>{' '}
                      untuk menghasilkan tautan &amp; kode QR khusus penyewa.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
