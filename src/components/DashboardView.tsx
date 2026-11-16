import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Wifi,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  MaintenanceLog,
  MessageTemplate,
  MonthlyHistoricalSummary,
  NavPage,
  PaymentRecord,
  PropertySettings,
  Room,
  RoomTypeConfig,
} from '../types/kost';
import {
  DEFAULT_ROOM_TYPES,
  getRoomDisplayName,
  PROPERTY_EXTERIOR_IMG,
} from '../data/initialData';
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
import { CashflowTrendChart } from './CashflowTrendChart';
import { RoomPhotoSlider } from './RoomPhotoSlider';

interface DashboardViewProps {
  rooms: Room[];
  roomTypes: RoomTypeConfig[];
  payments: PaymentRecord[];
  maintenanceLogs: MaintenanceLog[];
  templates: MessageTemplate[];
  activeMonth: string;
  totalExpenseActive: number;
  cashflowHistory: MonthlyHistoricalSummary[];
  settings: PropertySettings;
  onSelectRoom: (room: Room) => void;
  onNavigate: (page: NavPage) => void;
  onMarkPaid: (paymentId: string) => void;
  onCopyReminder: (
    room: Room,
    amount: number,
    payment?: PaymentRecord | null
  ) => void;
  onOpenCheckIn: (roomNumber: string) => void;
  onEditRoomType: (roomType: RoomTypeConfig) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rooms,
  roomTypes,
  payments,
  maintenanceLogs,
  templates,
  activeMonth,
  totalExpenseActive,
  cashflowHistory,
  settings,
  onSelectRoom,
  onNavigate,
  onMarkPaid,
  onCopyReminder,
  onOpenCheckIn,
  onEditRoomType,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<RoomTypeConfig['id'] | null>(
    null
  );

  useEffect(() => {
    if (!selectedTypeId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedTypeId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedTypeId]);

  const monthPayments = payments.filter((p) => p.month === activeMonth);
  const paidMonth = monthPayments.filter((p) => p.status === 'Lunas');
  const unpaidMonth = monthPayments.filter((p) => p.status === 'Belum Bayar');

  const totalIncomeMonth = paidMonth.reduce(
    (acc, p) => acc + p.amount + (p.lateFee ?? 0),
    0
  );
  const totalUnpaidMonth = unpaidMonth.reduce(
    (acc, p) => acc + p.amount + (p.lateFee ?? 0),
    0
  );
  const netProfitMonth = totalIncomeMonth - totalExpenseActive;
  const marginPct =
    totalIncomeMonth > 0
      ? ((netProfitMonth / totalIncomeMonth) * 100).toFixed(1)
      : '0.0';

  const occupiedRooms = rooms.filter((r) => r.status === 'Terisi');
  const availableRooms = rooms.filter((r) => r.status === 'Tersedia');
  const openMaintenance = maintenanceLogs.filter((m) => m.status !== 'Selesai');
  const occupancyPct =
    rooms.length > 0 ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0;

  const activeRoomTypes = roomTypes.length > 0 ? roomTypes : DEFAULT_ROOM_TYPES;
  const activeModalType = selectedTypeId
    ? activeRoomTypes.find((rt) => rt.id === selectedTypeId) ?? null
    : null;
  const activeTemplates =
    templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;

  const getRoomPaymentStatus = (roomNumber: string) => {
    const rec = monthPayments.find((p) => p.roomNumber === roomNumber);
    return rec?.status ?? null;
  };

  const renderRoomTile = (room: Room) => {
    const payStatus = getRoomPaymentStatus(room.number);
    const isVacant = room.status === 'Tersedia';
    const isMaintenance = room.status === 'Perawatan';
    const isUnpaid = payStatus === 'Belum Bayar';
    const customName = room.name?.trim();

    return (
      <button
        key={room.id}
        type="button"
        onClick={() => onSelectRoom(room)}
        className={`group text-left p-3.5 rounded-lg border transition-colors ${
          isUnpaid
            ? 'bg-rose-50/40 dark:bg-rose-500/[0.06] border-rose-200/90 dark:border-rose-400/25 hover:border-rose-400'
            : isVacant
            ? 'bg-teal-50/35 dark:bg-teal-500/[0.06] border-teal-200/90 dark:border-teal-400/25 hover:border-teal-500'
            : 'bg-slate-50/60 dark:bg-white/[0.02] border-slate-200/90 dark:border-white/[0.08] hover:border-teal-500/50 dark:hover:border-teal-400/35'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-num text-sm font-semibold text-slate-900 dark:text-white truncate">
            {customName ? customName : room.number}
          </span>
          <span
            className={`text-[11px] font-medium shrink-0 ${
              isVacant
                ? 'text-teal-700 dark:text-teal-300'
                : isMaintenance
                ? 'text-amber-700 dark:text-amber-300'
                : isUnpaid
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {isVacant
              ? 'Kosong'
              : isMaintenance
              ? 'Perawatan'
              : payStatus ?? 'Terisi'}
          </span>
        </div>
        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-2">
          {room.tenant
            ? room.tenant.name
            : isMaintenance
            ? 'Dalam Perbaikan'
            : 'Siap Huni'}
        </p>
        <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          {customName ? `Unit ${room.number} · ` : ''}
          {formatIDR(room.monthlyRate)}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Property Header Banner (Gambar Kost Putra Agan & Alamat) */}
      <section
        aria-label="Informasi Properti"
        className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden"
      >
        <div className="flex flex-col md:flex-row">
          <div className="relative h-44 md:h-auto md:min-h-[160px] md:w-72 lg:w-80 shrink-0 bg-slate-900 overflow-hidden">
            {!heroImgError ? (
              <img
                src={PROPERTY_EXTERIOR_IMG}
                alt={`Tampak depan gedung ${settings.name}`}
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="md:absolute md:inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="md:absolute md:inset-0 w-full h-full flex flex-col items-center justify-center bg-teal-900 text-teal-100 p-6">
                <Building2 className="w-9 h-9 mb-1.5" />
                <p className="text-sm font-medium text-white text-center">{settings.name}</p>
              </div>
            )}
          </div>

          <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display font-semibold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                  {settings.name}
                </h1>
                <p className="text-xs sm:text-sm text-teal-700 dark:text-teal-300 font-medium mt-0.5">
                  {settings.tagline}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors whitespace-nowrap"
              >
                <span>Edit Profil Properti</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-white/[0.07] text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{settings.address}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>WiFi 100 Mbps</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>CCTV &amp; Akses 24 Jam</span>
                </span>
                <span className="font-mono-num text-slate-600 dark:text-slate-300">
                  Total {rooms.length} Unit Kamar
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Executive KPI Strip (4 Panel di Bawah Header) */}
      <section
        aria-label="Ringkasan Metrik Utama"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="p-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Okupansi Properti</span>
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>Unit</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-mono-num text-2xl sm:text-[28px] font-semibold text-slate-900 dark:text-white mt-2">
            {occupancyPct}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            <span className="font-mono-num text-slate-800 dark:text-slate-200 font-medium">
              {occupiedRooms.length}
            </span>{' '}
            terisi ·{' '}
            <span className="font-mono-num text-teal-700 dark:text-teal-300 font-medium">
              {availableRooms.length}
            </span>{' '}
            siap huni
          </p>
        </div>

        <div className="p-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pemasukan ({formatMonthYear(activeMonth)})</span>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>Tagihan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-mono-num text-2xl sm:text-[26px] font-semibold text-slate-900 dark:text-white mt-2">
            {formatIDR(totalIncomeMonth)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            <span className="font-mono-num text-emerald-700 dark:text-emerald-400 font-medium">
              {paidMonth.length}
            </span>{' '}
            dari <span className="font-mono-num">{monthPayments.length}</span> kamar lunas
          </p>
        </div>

        <div className="p-5 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tagihan Belum Bayar</span>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>Lihat</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-mono-num text-2xl sm:text-[26px] font-semibold text-rose-600 dark:text-rose-400 mt-2">
            {formatIDR(totalUnpaidMonth)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            <span className="font-mono-num font-medium text-slate-800 dark:text-slate-200">
              {unpaidMonth.length} kamar
            </span>{' '}
            menunggu pelunasan
          </p>
        </div>

        {/* Signature Calm Gradient Focal KPI */}
        <div className="p-5 rounded-xl gradient-hero-card border border-teal-800/20">
          <div className="flex items-center justify-between text-xs text-teal-100">
            <span>Laba Bersih ({formatMonthYear(activeMonth)})</span>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-white/90 hover:text-white inline-flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>Arus Kas</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-mono-num text-2xl sm:text-[26px] font-semibold text-white mt-2">
            {formatIDR(netProfitMonth)}
          </p>
          <p className="text-xs text-teal-100/90 mt-1.5">
            Margin operasional{' '}
            <span className="font-mono-num font-semibold text-white">
              {marginPct}%
            </span>
          </p>
        </div>
      </section>

      {/* Panel Tipe & Unit Kamar: 1 Panel Terpadu 3 Kolom Sejajar (Tipe A | Tipe B | Tipe C) */}
      <section className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Panel Tipe &amp; Unit Kamar
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Klik salah satu tipe kamar untuk melihat rincian fasilitas, foto, dan daftar unit kamar
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('rooms')}
            className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:text-teal-600 dark:hover:text-teal-200 inline-flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <span>Semua Kamar</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-white/[0.07]">
          {activeRoomTypes.map((rt) => {
            const typeRooms = rooms.filter((r) => r.tier === rt.tier);
            const panelName = rt.displayName?.trim() || rt.tier;
            const coverUrl =
              rt.images && rt.images.length > 0 ? rt.images[0].url : rt.imageUrl;

            return (
              <button
                key={rt.id}
                type="button"
                onClick={() => setSelectedTypeId(rt.id)}
                className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left group hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={coverUrl}
                    alt={panelName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-11 rounded-lg object-cover border border-slate-200/80 dark:border-white/[0.08] shrink-0 bg-slate-100 dark:bg-slate-800"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors truncate">
                        {panelName}
                      </h3>
                      <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {rt.subtitle}
                      </span>
                    </div>
                    <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {formatIDR(rt.monthlyRate)}/bln · {rt.areaSqm} m² ·{' '}
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {typeRooms.length} unit
                      </span>
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-300 group-hover:translate-x-0.5 shrink-0 transition-all" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Baris Bawah Sejajar: Perlu Tindak Lanjut & Tren Arus Kas (Equal Height) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <section className="xl:col-span-6 h-full rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
              <div>
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Perlu Tindak Lanjut
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tagihan sewa {formatMonthYear(activeMonth)} yang belum lunas
                </p>
              </div>
              <span className="font-mono-num text-xs font-semibold text-rose-600 dark:text-rose-400">
                {unpaidMonth.length} Tagihan
              </span>
            </div>

            {unpaidMonth.length === 0 ? (
              <div className="flex-1 py-6 flex flex-col items-center justify-center text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Seluruh Tagihan {formatMonthYear(activeMonth)} Lunas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kolektibilitas bulan ini mencapai 100%.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                {unpaidMonth.map((pay) => {
                  const roomObj = rooms.find((r) => r.number === pay.roomNumber);
                  const total = pay.amount + (pay.lateFee ?? 0);
                  const dueDay = roomObj?.tenant?.dueDay ?? settings.defaultDueDay;
                  const dueInfo = getDueStatusInfo(pay.month, dueDay);

                  const tpl =
                    dueInfo.tone === 'overdue'
                      ? activeTemplates.find((t) => t.category === 'tunggakan') ??
                        activeTemplates[0]
                      : activeTemplates.find((t) => t.category === 'tagihan') ??
                        activeTemplates[0];
                  const waText = roomObj
                    ? renderMessageTemplate(tpl.body, {
                        settings,
                        room: roomObj,
                        payment: pay,
                        month: pay.month,
                      })
                    : '';
                  const waUrl = roomObj?.tenant
                    ? buildWhatsAppUrl(roomObj.tenant.phone, waText)
                    : '#';

                  return (
                    <div
                      key={pay.id}
                      className="py-3 first:pt-0.5 last:pb-0.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-300">
                            {roomObj ? getRoomDisplayName(roomObj) : `Kamar ${pay.roomNumber}`}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {pay.tenantName}
                          </span>
                        </div>
                        <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatIDR(total)} ·{' '}
                          <span
                            className={
                              dueInfo.tone === 'overdue'
                                ? 'text-rose-600 dark:text-rose-400 font-medium'
                                : dueInfo.tone === 'due_soon'
                                ? 'text-amber-600 dark:text-amber-300 font-medium'
                                : ''
                            }
                          >
                            {dueInfo.label}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {roomObj && (
                          <>
                            <button
                              type="button"
                              onClick={() => onCopyReminder(roomObj, total, pay)}
                              className="p-2 rounded-lg border border-slate-200 dark:border-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
                              title="Salin pesan pengingat WhatsApp"
                              aria-label={`Salin pengingat WhatsApp untuk ${pay.tenantName}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {roomObj.tenant && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg border border-slate-200 dark:border-white/[0.12] text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
                                title="Kirim langsung via WhatsApp"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onMarkPaid(pay.id)}
                          className="px-3 py-1.5 rounded-lg btn-primary text-xs font-medium transition-colors whitespace-nowrap"
                        >
                          Tandai Lunas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(openMaintenance.length > 0 || availableRooms.length > 0) && (
            <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.07]">
              {openMaintenance.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Perawatan Aktif ({openMaintenance.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('rooms')}
                      className="text-teal-700 dark:text-teal-300 font-medium hover:underline"
                    >
                      Kelola Unit
                    </button>
                  </div>
                  <div className="space-y-1">
                    {openMaintenance.slice(0, 2).map((m) => (
                      <p
                        key={m.id}
                        className="text-xs text-slate-600 dark:text-slate-300 truncate"
                      >
                        • Kamar {m.roomNumber}: {m.title} ({m.status})
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {availableRooms.length > 0 && (
                <div
                  className={`flex items-center justify-between gap-3 ${
                    openMaintenance.length > 0
                      ? 'pt-2.5 border-t border-slate-200/70 dark:border-white/[0.06]'
                      : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      Kamar Tersedia: {availableRooms.map((r) => getRoomDisplayName(r)).join(', ')}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Siap untuk ditempati penyewa baru
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCheckIn(availableRooms[0].number)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-teal-700 dark:text-teal-300 hover:border-teal-600 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  >
                    Check-In
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="xl:col-span-6 h-full rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Tren Arus Kas 6 Bulan Terakhir
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Perbandingan realisasi pemasukan sewa terhadap beban operasional
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:text-teal-600 dark:hover:text-teal-200 inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <span>Buka Rincian</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="my-auto">
            <CashflowTrendChart
              data={cashflowHistory}
              height={220}
              activeMonth={activeMonth}
            />
          </div>
        </section>
      </div>

      {/* Pop-Up Detail Tipe & Unit Kamar */}
      {activeModalType && (() => {
        const typeRooms = rooms.filter((r) => r.tier === activeModalType.tier);
        const occupiedCount = typeRooms.filter((r) => r.status === 'Terisi').length;
        const panelName = activeModalType.displayName?.trim() || activeModalType.tier;
        const galleryImages =
          activeModalType.images && activeModalType.images.length > 0
            ? activeModalType.images
            : [{ url: activeModalType.imageUrl, label: panelName }];

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-backdrop-in"
              onClick={() => setSelectedTypeId(null)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Informasi ${panelName}`}
              className="relative z-10 w-full max-w-3xl max-h-[88vh] rounded-2xl bg-white dark:bg-[#0f1a1e] border border-slate-200/90 dark:border-white/[0.1] shadow-xl flex flex-col overflow-hidden animate-modal-in"
            >
              {/* Pop-up Header */}
              <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                      {panelName}
                    </h2>
                    <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300 truncate">
                      {activeModalType.subtitle}
                    </span>
                  </div>
                  <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatIDR(activeModalType.monthlyRate)}/bln · {activeModalType.areaSqm} m² ·{' '}
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {occupiedCount}/{typeRooms.length} Terisi
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditRoomType(activeModalType)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-300 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTypeId(null)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                    aria-label="Tutup pop-up tipe kamar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Pop-up Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  <div className="md:col-span-6">
                    <RoomPhotoSlider
                      images={galleryImages}
                      title={panelName}
                      className="w-full aspect-[4/3] rounded-xl border border-slate-200/90 dark:border-white/[0.08]"
                    />
                  </div>
                  <div className="md:col-span-6 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                        Deskripsi Tipe Kamar
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {activeModalType.description}
                      </p>
                    </div>
                    {activeModalType.facilities.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.07]">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                          Fasilitas Standar
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {activeModalType.facilities.join(' · ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Daftar Unit Kamar di Tipe Ini */}
                <div className="pt-5 border-t border-slate-200/80 dark:border-white/[0.08] space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                        Daftar Unit Kamar ({typeRooms.length})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Klik unit kamar untuk lihat detail penyewa, kwitansi, atau tindak lanjut tagihan
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        Lunas
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        Belum Bayar
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-teal-700 dark:text-teal-300 font-medium">
                        Kosong
                      </span>
                    </div>
                  </div>

                  {typeRooms.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-white/[0.1] rounded-xl">
                      Belum ada unit kamar pada {panelName}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {typeRooms.map(renderRoomTile)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
