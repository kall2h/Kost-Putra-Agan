import React, { useEffect, useState } from 'react';
import {
  Building2,
  ChevronRight,
  Copy,
  ExternalLink,
  Pencil,
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
        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-1.5">
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
    <div className="space-y-4">
      {/* Header Properti */}
      <section
        aria-label="Informasi Properti"
        className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden"
      >
        <div className="flex flex-col md:flex-row">
          <div className="relative h-40 md:h-auto md:w-64 lg:w-72 shrink-0 bg-slate-900 overflow-hidden">
            {!heroImgError ? (
              <img
                src={PROPERTY_EXTERIOR_IMG}
                alt={`Tampak depan gedung ${settings.name}`}
                width={640}
                height={420}
                fetchPriority="high"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="md:absolute md:inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="md:absolute md:inset-0 w-full h-full flex flex-col items-center justify-center bg-teal-900 text-teal-100 p-5">
                <Building2 className="w-8 h-8 mb-1.5" aria-hidden="true" />
                <p className="text-sm font-medium text-white text-center">{settings.name}</p>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                  {settings.name}
                </h2>
                <p className="text-xs sm:text-sm text-teal-700 dark:text-teal-300 font-medium mt-0.5">
                  {settings.tagline}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium whitespace-nowrap"
              >
                Edit Profil
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.07] space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p className="leading-relaxed">{settings.address}</p>
              <p className="text-slate-500 dark:text-slate-400">
                WiFi 100 Mbps · CCTV &amp; Akses 24 Jam ·{' '}
                <span className="font-mono-num font-medium text-slate-700 dark:text-slate-200">
                  {rooms.length} Unit Kamar
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ringkasan Metrik Utama (1 Panel Terpadu Tanpa Jarak Kosong) */}
      <section
        aria-label="Ringkasan Metrik Utama"
        className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-white/[0.07]"
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Okupansi Properti</span>
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="text-teal-700 dark:text-teal-300 hover:underline font-medium"
            >
              Kelola Unit
            </button>
          </div>
          <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1.5">
            {occupancyPct}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pemasukan ({formatMonthYear(activeMonth)})</span>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-teal-700 dark:text-teal-300 hover:underline font-medium"
            >
              Tagihan
            </button>
          </div>
          <p className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white mt-1.5">
            {formatIDR(totalIncomeMonth)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-mono-num text-emerald-700 dark:text-emerald-400 font-medium">
              {paidMonth.length}
            </span>{' '}
            dari <span className="font-mono-num">{monthPayments.length}</span> kamar lunas
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Belum Dibayar</span>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-teal-700 dark:text-teal-300 hover:underline font-medium"
            >
              Lihat Daftar
            </button>
          </div>
          <p className="font-mono-num text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-1.5">
            {formatIDR(totalUnpaidMonth)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-mono-num font-medium text-slate-800 dark:text-slate-200">
              {unpaidMonth.length} kamar
            </span>{' '}
            menunggu pelunasan
          </p>
        </div>

        <div className="p-4 sm:p-5 focal-surface">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Laba Bersih ({formatMonthYear(activeMonth)})</span>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-teal-700 dark:text-teal-300 hover:underline font-medium"
            >
              Arus Kas
            </button>
          </div>
          <p className="font-mono-num text-2xl font-semibold text-teal-800 dark:text-teal-300 mt-1.5">
            {formatIDR(netProfitMonth)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Margin operasional{' '}
            <span className="font-mono-num font-semibold text-slate-800 dark:text-slate-200">
              {marginPct}%
            </span>
          </p>
        </div>
      </section>

      {/* Panel Tipe & Unit Kamar */}
      <section className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/[0.07] flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
            Tipe &amp; Daftar Kamar
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('rooms')}
            className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
          >
            Semua Kamar
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
                className="w-full p-4 flex items-center justify-between gap-3 text-left group hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={coverUrl}
                    alt={panelName}
                    width={48}
                    height={44}
                    referrerPolicy="no-referrer"
                    className="w-12 h-11 rounded-lg object-cover border border-slate-200/80 dark:border-white/[0.08] shrink-0 bg-slate-100 dark:bg-slate-800"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-semibold text-sm text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors truncate">
                        {panelName}
                      </span>
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

                <ChevronRight
                  className="w-4 h-4 text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-300 shrink-0 transition-colors"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Baris Bawah: Perlu Tindak Lanjut & Tren Arus Kas (Tanpa Ruang Kosong Tengah) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="xl:col-span-6 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
            <div>
              <h3 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                Perlu Tindak Lanjut
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tagihan {formatMonthYear(activeMonth)} yang belum lunas
              </p>
            </div>
            <span className="font-mono-num text-xs font-semibold text-rose-600 dark:text-rose-400">
              {unpaidMonth.length} Tagihan
            </span>
          </div>

          {unpaidMonth.length === 0 ? (
            <div className="py-4 text-center space-y-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Semua tagihan {formatMonthYear(activeMonth)} sudah lunas
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tidak ada tunggakan aktif bulan ini.
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
                    className="py-2.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
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
                            className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl btn-secondary"
                            title="Salin pesan pengingat WhatsApp"
                            aria-label={`Salin pengingat WhatsApp untuk ${pay.tenantName}`}
                          >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          {roomObj.tenant && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl btn-secondary text-teal-700 dark:text-teal-300"
                              title="Kirim langsung via WhatsApp"
                              aria-label={`Kirim WhatsApp ke ${pay.tenantName}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onMarkPaid(pay.id)}
                        className="min-h-[38px] px-3.5 py-2 rounded-xl btn-primary text-xs font-medium whitespace-nowrap"
                      >
                        Tandai Lunas
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(openMaintenance.length > 0 || availableRooms.length > 0) && (
            <div className="space-y-3 pt-3.5 border-t border-slate-200/80 dark:border-white/[0.07]">
              {openMaintenance.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      Perawatan Aktif ({openMaintenance.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('rooms')}
                      className="text-teal-700 dark:text-teal-300 font-medium hover:underline"
                    >
                      Kelola Unit
                    </button>
                  </div>
                  {openMaintenance.slice(0, 2).map((m) => (
                    <p
                      key={m.id}
                      className="text-xs text-slate-600 dark:text-slate-300 truncate"
                    >
                      Kamar {m.roomNumber}: {m.title} ({m.status})
                    </p>
                  ))}
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
                      Kamar Tersedia:{' '}
                      {availableRooms.map((r) => getRoomDisplayName(r)).join(', ')}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Siap ditempati penyewa baru
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCheckIn(availableRooms[0].number)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl btn-secondary text-teal-700 dark:text-teal-300 text-xs font-medium whitespace-nowrap shrink-0"
                  >
                    Check-In
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="xl:col-span-6 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.07] pb-3">
            <div>
              <h3 className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                Tren Arus Kas 6 Bulan Terakhir
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pemasukan sewa dibandingkan pengeluaran operasional
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
            >
              Buka Rincian
            </button>
          </div>

          <CashflowTrendChart
            data={cashflowHistory}
            height={190}
            activeMonth={activeMonth}
          />
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
              className="fixed inset-0 bg-slate-950/50 animate-backdrop-in"
              onClick={() => setSelectedTypeId(null)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Informasi ${panelName}`}
              className="relative z-10 w-full max-w-3xl max-h-[88vh] rounded-2xl bg-white dark:bg-[#0f1a1e] border border-slate-200/90 dark:border-white/[0.1] shadow-xl flex flex-col overflow-hidden animate-modal-in"
            >
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
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTypeId(null)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                    aria-label="Tutup pop-up tipe kamar"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Deskripsi Tipe Kamar
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {activeModalType.description}
                      </p>
                    </div>
                    {activeModalType.facilities.length > 0 && (
                      <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07]">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                          Fasilitas Standar
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {activeModalType.facilities.join(' · ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                      Daftar Unit Kamar ({typeRooms.length})
                    </h3>
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
