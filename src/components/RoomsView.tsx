import React, { useMemo, useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  UserPlus,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { PaymentRecord, Room, RoomTypeConfig } from '../types/kost';
import { DEFAULT_ROOM_TYPES, getRoomDisplayName } from '../data/initialData';
import { formatDateID, formatIDR, getCurrentMonthISO } from '../utils/format';
import { RoomPhotoSlider } from './RoomPhotoSlider';

interface RoomsViewProps {
  rooms: Room[];
  roomTypes: RoomTypeConfig[];
  payments: PaymentRecord[];
  onSelectRoom: (room: Room) => void;
  onOpenCheckIn: (roomNumber: string) => void;
  onEditRoomType: (roomType: RoomTypeConfig) => void;
  onOpenAddRoom: () => void;
}

type StatusFilter = 'all' | 'occupied' | 'vacant' | 'maintenance';

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  roomTypes,
  payments,
  onSelectRoom,
  onOpenCheckIn,
  onEditRoomType,
  onOpenAddRoom,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const activeRoomTypes = roomTypes.length > 0 ? roomTypes : DEFAULT_ROOM_TYPES;
  const activeMonth = getCurrentMonthISO();

  const currentPayments = useMemo(() => {
    const forCurr = payments.filter((p) => p.month === activeMonth);
    if (forCurr.length > 0) return forCurr;
    return payments.filter((p) => p.month === '2026-11');
  }, [payments, activeMonth]);

  const counts = useMemo(
    () => ({
      all: rooms.length,
      occupied: rooms.filter((r) => r.status === 'Terisi').length,
      vacant: rooms.filter((r) => r.status === 'Tersedia').length,
      maintenance: rooms.filter((r) => r.status === 'Perawatan').length,
    }),
    [rooms]
  );

  const tierOptions = useMemo(() => {
    const fromConfig = activeRoomTypes.map((rt) => ({
      value: rt.tier,
      label: rt.displayName?.trim() || rt.tier,
    }));
    const existingTiers = Array.from(new Set(rooms.map((r) => r.tier).filter(Boolean)));
    existingTiers.forEach((tier) => {
      if (!fromConfig.some((item) => item.value === tier)) {
        fromConfig.push({ value: tier, label: tier });
      }
    });
    return fromConfig;
  }, [activeRoomTypes, rooms]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (statusFilter === 'occupied' && room.status !== 'Terisi') return false;
      if (statusFilter === 'vacant' && room.status !== 'Tersedia') return false;
      if (statusFilter === 'maintenance' && room.status !== 'Perawatan') return false;
      if (tierFilter !== 'all' && room.tier !== tierFilter) return false;

      if (!q) return true;
      return (
        room.number.toLowerCase().includes(q) ||
        (room.name?.toLowerCase().includes(q) ?? false) ||
        room.tier.toLowerCase().includes(q) ||
        (room.tenant?.name.toLowerCase().includes(q) ?? false) ||
        (room.tenant?.institution.toLowerCase().includes(q) ?? false) ||
        (room.tenant?.originCity.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rooms, statusFilter, tierFilter, search]);

  const statusTabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'occupied', label: 'Terisi', count: counts.occupied },
    { id: 'vacant', label: 'Tersedia', count: counts.vacant },
    ...(counts.maintenance > 0
      ? [{ id: 'maintenance' as const, label: 'Perawatan', count: counts.maintenance }]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Panel Tipe Kamar */}
      <section aria-label="Panel Tipe Kamar" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeRoomTypes.map((rt) => {
          const isSelected = tierFilter === rt.tier;
          const typeRooms = rooms.filter((r) => r.tier === rt.tier);
          const vacantCount = typeRooms.filter((r) => r.status === 'Tersedia').length;
          const panelName = rt.displayName?.trim() || rt.tier;
          const galleryImages =
            rt.images && rt.images.length > 0
              ? rt.images
              : [{ url: rt.imageUrl, label: panelName }];

          return (
            <div
              key={rt.id}
              className={`rounded-xl surface-card border overflow-hidden flex flex-col transition-colors ${
                isSelected
                  ? 'border-teal-600 dark:border-teal-400 ring-1 ring-teal-500/25'
                  : 'border-slate-200/90 dark:border-white/[0.08]'
              }`}
            >
              <RoomPhotoSlider
                images={galleryImages}
                title={panelName}
                className="h-40 w-full"
                compactControls
              />

              <div className="p-4 flex-1 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setTierFilter(isSelected ? 'all' : rt.tier)}
                  className="text-left space-y-1.5 w-full"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {panelName}
                      </p>
                      <p className="text-xs text-teal-700 dark:text-teal-300 font-medium truncate">
                        {rt.subtitle}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono-num text-sm font-semibold text-slate-900 dark:text-white">
                        {formatIDR(rt.monthlyRate)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        /bln · {rt.areaSqm} m²
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {rt.description}
                  </p>
                </button>

                <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200/70 dark:border-white/[0.07]">
                  <button
                    type="button"
                    onClick={() => setTierFilter(isSelected ? 'all' : rt.tier)}
                    className="font-mono-num text-xs text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                  >
                    {typeRooms.length} unit ·{' '}
                    <span className="text-teal-700 dark:text-teal-300 font-medium">
                      {vacantCount} kosong
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditRoomType(rt)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium"
                  >
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                    <span>Edit Panel</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Toolbar Sejajar (Tanpa Baris Bertumpuk Terpisah) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-x-auto max-w-full">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'nav-active-gradient text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {tab.label}{' '}
                  <span
                    className={`font-mono-num ml-1 ${
                      active ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <select
            id="room-tier-dropdown"
            aria-label="Filter tipe kamar"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 rounded-lg input-surface border text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">Semua Tipe</option>
            {tierOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kamar atau penyewa..."
              aria-label="Cari kamar atau nama penyewa"
              className="w-full pl-9 pr-8 py-2 rounded-lg input-surface border text-xs sm:text-sm placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenAddRoom}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl btn-secondary text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tambah Unit</span>
          </button>

          <div className="flex items-center p-1 rounded-lg surface-card border border-slate-200/90 dark:border-white/[0.08] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Tampilan Grid"
              aria-label="Tampilan Grid"
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Tampilan Tabel"
              aria-label="Tampilan Tabel"
            >
              <List className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredRooms.length === 0 ? (
        <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-8 text-center space-y-2.5">
          <p className="font-display font-medium text-slate-900 dark:text-white">
            Tidak ada unit kamar yang cocok dengan filter ini
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ubah kata kunci pencarian atau pilih status dan tipe kamar lainnya.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setTierFilter('all');
              setSearch('');
            }}
            className="px-4 py-2 rounded-lg btn-primary text-xs font-medium transition-colors"
          >
            Tampilkan Semua Kamar
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredRooms.map((room) => {
            const isOccupied = room.status === 'Terisi' && room.tenant;
            const isMaintenance = room.status === 'Perawatan';
            const payRec = currentPayments.find((p) => p.roomNumber === room.number);

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRoom(room);
                  }
                }}
                className={`group rounded-xl p-4 surface-card border transition-colors cursor-pointer flex flex-col gap-3 ${
                  !isOccupied && !isMaintenance
                    ? 'border-teal-300/80 dark:border-teal-400/30 hover:border-teal-600'
                    : isMaintenance
                    ? 'border-amber-300/80 dark:border-amber-400/30 hover:border-amber-500'
                    : payRec?.status === 'Belum Bayar'
                    ? 'border-rose-200 dark:border-rose-400/25 hover:border-rose-400'
                    : 'border-slate-200/90 dark:border-white/[0.08] hover:border-teal-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
                      {getRoomDisplayName(room)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {room.name?.trim() ? `Unit ${room.number} · ` : ''}
                      {room.tier} · {room.areaSqm} m²
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium whitespace-nowrap ${
                      isOccupied
                        ? payRec?.status === 'Belum Bayar'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                        : isMaintenance
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-teal-700 dark:text-teal-300'
                    }`}
                  >
                    {isOccupied ? payRec?.status ?? 'Terisi' : room.status}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.06] flex-1">
                  {isOccupied && room.tenant ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {room.tenant.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {room.tenant.institution} ·{' '}
                        <span className="font-mono-num">{room.tenant.phone}</span>
                      </p>
                    </>
                  ) : isMaintenance ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      Sedang dalam perawatan
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Siap ditempati penyewa baru
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/70 dark:border-white/[0.06]">
                  <span className="font-mono-num text-sm font-semibold text-slate-900 dark:text-white">
                    {formatIDR(room.monthlyRate)}
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      /bln
                    </span>
                  </span>

                  {isOccupied || isMaintenance ? (
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                      Lihat Detail
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCheckIn(room.number);
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-primary text-xs font-medium"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Check-In</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Kamar</th>
                  <th className="py-3 px-4">Tipe &amp; Luas</th>
                  <th className="py-3 px-4">Penyewa</th>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4">Tgl Masuk</th>
                  <th className="py-3 px-4 text-right">Tarif / Bln</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-sm">
                {filteredRooms.map((room) => {
                  const isOccupied = room.status === 'Terisi' && room.tenant;
                  const isMaintenance = room.status === 'Perawatan';
                  return (
                    <tr
                      key={room.id}
                      onClick={() => onSelectRoom(room)}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                        <span>{getRoomDisplayName(room)}</span>
                        {room.name?.trim() && (
                          <span className="font-mono-num text-xs text-slate-400 ml-1.5">
                            ({room.number})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {room.tier} · {room.areaSqm} m²
                      </td>
                      <td className="py-3 px-4">
                        {isOccupied && room.tenant ? (
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {room.tenant.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                              {room.tenant.institution}
                            </p>
                          </div>
                        ) : isMaintenance ? (
                          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                            Dalam Perawatan
                          </span>
                        ) : (
                          <span className="text-xs text-teal-700 dark:text-teal-300 font-medium">
                            Siap Huni
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-600 dark:text-slate-300">
                        {room.tenant?.phone ?? '-'}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        {room.tenant ? formatDateID(room.tenant.checkInDate) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-medium text-slate-900 dark:text-white">
                        {formatIDR(room.monthlyRate)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        {isOccupied ? (
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Terisi
                          </span>
                        ) : isMaintenance ? (
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Perawatan
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCheckIn(room.number);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-primary text-xs font-medium transition-colors"
                          >
                            Check-In
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};