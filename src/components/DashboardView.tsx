import React, { useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Wifi,
  ShieldCheck,
  Wrench,
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
        className={`group text-left p-3.5 rounded-xl border transition-all duration-150 ${
          isVacant
            ? 'bg-gradient-to-br from-teal-50/90 to-emerald-50/50 dark:from-teal-500/[0.12] dark:to-emerald-500/[0.04] border-teal-300/80 dark:border-teal-400/30 hover:border-teal-500'
            : isMaintenance
            ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/40 dark:from-amber-500/[0.12] dark:to-orange-500/[0.04] border-amber-300/80 dark:border-amber-400/30 hover:border-amber-500'
            : isUnpaid
            ? 'bg-gradient-to-br from-rose-50/90 to-orange-50/40 dark:from-rose-500/[0.12] dark:to-orange-500/[0.04] border-rose-200 dark:border-rose-400/30 hover:border-rose-400'
            : 'bg-gradient-to-br from-white to-slate-50/80 dark:from-white/[0.04] dark:to-white/[0.01] border-teal-900/[0.08] dark:border-teal-400/[0.1] hover:border-teal-600/30 dark:hover:border-teal-400/30'
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
                : 'text-emerald-600 dark:text-emerald-400'
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
    <div className="space-y-6">
      {/* Executive KPI Strip */}
      <section
        aria-label="Ringkasan Metrik Utama"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="p-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Okupansi Properti</span>
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 inline-flex items-center gap-0.5 font-medium transition-colors"
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

        <div className="p-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pemasukan ({formatMonthYear(activeMonth)})</span>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 inline-flex items-center gap-0.5 font-medium transition-colors"
            >
              <span>Tagihan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="font-mono-num text-2xl sm:text-[26px] font-semibold text-slate-900 dark:text-white mt-2">
            {formatIDR(totalIncomeMonth)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            <span className="font-mono-num text-emerald-600 dark:text-emerald-400 font-medium">
              {paidMonth.length}
            </span>{' '}
            dari <span className="font-mono-num">{monthPayments.length}</span> kamar lunas
          </p>
        </div>

        <div className="p-5 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tagihan Belum Bayar</span>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 inline-flex items-center gap-0.5 font-medium transition-colors"
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

        {/* Highlighted Signature Gradient KPI Card */}
        <div className="p-5 rounded-xl gradient-hero-card border border-teal-500/30">
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

      {/* Main Architectural Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Panel Tipe Kamar */}
        <section className="xl:col-span-7 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-4">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Panel Tipe &amp; Unit Kamar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kelola harga, foto, &amp; deskripsi tiap tipe kamar atau klik unit untuk detail
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Lunas</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">Belum Bayar</span>
              <span aria-hidden="true">·</span>
              <span className="text-teal-700 dark:text-teal-300 font-medium">Kosong</span>
            </div>
          </div>

          <div className="space-y-6">
            {activeRoomTypes.map((rt) => {
              const typeRooms = rooms.filter((r) => r.tier === rt.tier);
              const occupiedCount = typeRooms.filter((r) => r.status === 'Terisi').length;
              const panelName = rt.displayName?.trim() || rt.tier;
              const galleryImages =
                rt.images && rt.images.length > 0
                  ? rt.images
                  : [{ url: rt.imageUrl, label: panelName }];

              return (
                <div
                  key={rt.id}
                  className="rounded-xl border border-teal-900/[0.08] dark:border-teal-400/[0.12] bg-white/50 dark:bg-white/[0.02] p-4 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <RoomPhotoSlider
                      images={galleryImages}
                      title={panelName}
                      className="w-full sm:w-52 aspect-[4/3] rounded-lg border border-teal-900/[0.1] dark:border-teal-400/[0.15] shrink-0"
                      compactControls
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-wide">
                              {panelName.toUpperCase()}
                            </h3>
                            <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                            <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                              {rt.subtitle}
                            </span>
                          </div>
                          <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatIDR(rt.monthlyRate)}/bln · {rt.areaSqm} m² ·{' '}
                            <span className="text-slate-800 dark:text-slate-200 font-medium">
                              {occupiedCount}/{typeRooms.length} Terisi
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onEditRoomType(rt)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-700/20 dark:border-teal-400/25 bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-500/10 dark:to-emerald-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium transition-colors shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit Panel &amp; Galeri</span>
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {rt.description}
                      </p>
                    </div>
                  </div>

                  {typeRooms.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                      Belum ada unit kamar pada {panelName}. Anda dapat memindahkan unit melalui
                      detail kamar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {typeRooms.map(renderRoomTile)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right 5 Cols: Prioritas Penagihan + Maintenance Alert + Property Spotlight */}
        <div className="xl:col-span-5 space-y-6">
          {/* Prioritas Tagihan */}
          <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] pb-3">
              <div>
                <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                  Perlu Tindak Lanjut
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tagihan sewa {formatMonthYear(activeMonth)} yang belum lunas
                </p>
              </div>
              <span className="font-mono-num text-xs font-medium text-rose-600 dark:text-rose-400">
                {unpaidMonth.length} Tagihan
              </span>
            </div>

            {unpaidMonth.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Seluruh Tagihan {formatMonthYear(activeMonth)} Lunas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kolektibilitas bulan ini mencapai 100%.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-teal-900/[0.06] dark:divide-white/[0.06]">
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
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-wrap items-center justify-between gap-3"
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
                              className="p-2 rounded-lg border border-teal-900/10 dark:border-teal-400/15 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-white/[0.05] transition-colors"
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
                                className="p-2 rounded-lg border border-teal-700/20 dark:border-teal-400/25 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors"
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
                          className="px-3 py-1.5 rounded-lg btn-primary text-xs font-medium transition-all whitespace-nowrap"
                        >
                          Tandai Lunas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Open Maintenance Summary */}
            {openMaintenance.length > 0 && (
              <div className="pt-3 border-t border-teal-900/[0.07] dark:border-teal-400/[0.1] space-y-2">
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
                  {openMaintenance.slice(0, 3).map((m) => (
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

            {/* Quick Vacant Room Invite */}
            {availableRooms.length > 0 && (
              <div className="pt-3 border-t border-teal-900/[0.07] dark:border-teal-400/[0.1] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Kamar Tersedia: {availableRooms.map((r) => getRoomDisplayName(r)).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Siap untuk ditempati penyewa baru
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCheckIn(availableRooms[0].number)}
                  className="px-3 py-1.5 rounded-lg border border-teal-700/25 dark:border-teal-400/25 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-500/10 dark:to-emerald-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                >
                  Check-In
                </button>
              </div>
            )}
          </section>

          {/* Property Architectural Spotlight */}
          <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] overflow-hidden">
            <div className="relative h-44 w-full bg-gradient-to-br from-[#06383B] to-[#0D9488]">
              {!heroImgError ? (
                <img
                  src={PROPERTY_EXTERIOR_IMG}
                  alt="Tampak depan gedung modern Kost Putra Agan"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-teal-100">
                  <Building2 className="w-10 h-10 mb-2" />
                  <p className="text-sm font-medium text-white">{settings.name}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#04181A]/90 via-[#072B2E]/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="font-display font-semibold text-base">{settings.name}</p>
                <p className="text-xs text-teal-100 mt-0.5">{settings.tagline}</p>
              </div>
            </div>

            <div className="p-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </div>
              <div className="flex items-center gap-4 pt-1 text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  WiFi 100 Mbps
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  CCTV &amp; Akses 24 Jam
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom 6-Month Cashflow Overview */}
      <section className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
            <span>Buka Rincian Keuangan</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <CashflowTrendChart data={cashflowHistory} height={220} />
      </section>
    </div>
  );
};
