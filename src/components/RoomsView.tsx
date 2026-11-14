import React, { useMemo, useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  UserPlus,
  BedDouble,
  Pencil,
  Plus,
  Wrench,
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

type RoomFilter =
  | 'all'
  | 'occupied'
  | 'vacant'
  | 'maintenance'
  | 'tipeA'
  | 'tipeB'
  | 'tipeC';

export const RoomsView: React.FC<RoomsViewProps> = ({
  rooms,
  roomTypes,
  payments,
  onSelectRoom,
  onOpenCheckIn,
  onEditRoomType,
  onOpenAddRoom,
}) => {
  const [filter, setFilter] = useState<RoomFilter>('all');
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
      tipeA: rooms.filter((r) => r.tier === 'Tipe A').length,
      tipeB: rooms.filter((r) => r.tier === 'Tipe B').length,
      tipeC: rooms.filter((r) => r.tier === 'Tipe C').length,
    }),
    [rooms]
  );

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (filter === 'occupied' && room.status !== 'Terisi') return false;
      if (filter === 'vacant' && room.status !== 'Tersedia') return false;
      if (filter === 'maintenance' && room.status !== 'Perawatan') return false;
      if (filter === 'tipeA' && room.tier !== 'Tipe A') return false;
      if (filter === 'tipeB' && room.tier !== 'Tipe B') return false;
      if (filter === 'tipeC' && room.tier !== 'Tipe C') return false;

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
  }, [rooms, filter, search]);

  const typeLabel = (id: 'tipe-a' | 'tipe-b' | 'tipe-c', fallback: string) =>
    activeRoomTypes.find((t) => t.id === id)?.displayName?.trim() || fallback;

  const filterTabs: { id: RoomFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'occupied', label: 'Terisi', count: counts.occupied },
    { id: 'vacant', label: 'Tersedia', count: counts.vacant },
    ...(counts.maintenance > 0
      ? [{ id: 'maintenance' as const, label: 'Perawatan', count: counts.maintenance }]
      : []),
    { id: 'tipeA', label: typeLabel('tipe-a', 'Tipe A'), count: counts.tipeA },
    { id: 'tipeB', label: typeLabel('tipe-b', 'Tipe B'), count: counts.tipeB },
    { id: 'tipeC', label: typeLabel('tipe-c', 'Tipe C'), count: counts.tipeC },
  ];

  return (
    <div className="space-y-6">
      {/* Editable Room Type Panels with Google-Review Style Photo Slider */}
      <section aria-label="Panel Tipe Kamar" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeRoomTypes.map((rt) => {
          const typeFilterId: RoomFilter =
            rt.id === 'tipe-a' ? 'tipeA' : rt.id === 'tipe-b' ? 'tipeB' : 'tipeC';
          const isSelected = filter === typeFilterId;
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
              className={`rounded-xl surface-card border overflow-hidden flex flex-col transition-all ${
                isSelected
                  ? 'border-teal-600 dark:border-teal-400 ring-1 ring-teal-500/30'
                  : 'border-teal-900/[0.08] dark:border-teal-400/[0.12]'
              }`}
            >
              <RoomPhotoSlider
                images={galleryImages}
                title={panelName}
                className="h-44 w-full"
                compactControls
              />

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div
                  onClick={() => setFilter(isSelected ? 'all' : typeFilterId)}
                  className="space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-wide truncate">
                        {panelName.toUpperCase()}
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
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-teal-900/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setFilter(isSelected ? 'all' : typeFilterId)}
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
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-teal-700/20 dark:border-teal-400/25 bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-500/10 dark:to-emerald-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Panel</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] overflow-x-auto">
          {filterTabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? 'nav-active-gradient text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-teal-500/[0.08]'
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

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kamar, nama penyewa..."
              className="w-full pl-9 pr-8 py-2 rounded-lg surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-600 dark:focus:border-teal-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenAddRoom}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-700/20 dark:border-teal-400/25 bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-500/10 dark:to-emerald-500/10 text-teal-800 dark:text-teal-200 hover:border-teal-600 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Unit</span>
          </button>

          <div className="flex items-center p-1 rounded-lg surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Tampilan Grid"
              aria-label="Tampilan Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Tampilan Tabel"
              aria-label="Tampilan Tabel"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredRooms.length === 0 ? (
        <div className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] p-12 text-center space-y-3">
          <BedDouble className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto" />
          <p className="font-display font-medium text-slate-900 dark:text-white">
            Tidak ada unit kamar yang cocok
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Coba ubah kata kunci pencarian atau pilih filter status kamar lainnya.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setSearch('');
            }}
            className="px-4 py-2 rounded-lg btn-primary text-xs font-medium transition-all"
          >
            Tampilkan Semua Kamar
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                className={`group rounded-xl p-5 border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4 ${
                  isOccupied
                    ? 'surface-card border-teal-900/[0.08] dark:border-teal-400/[0.12] hover:border-teal-500/40'
                    : isMaintenance
                    ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/35 dark:to-orange-950/20 border-amber-300/80 dark:border-amber-400/30 hover:border-amber-500'
                    : 'bg-gradient-to-br from-teal-50/90 via-emerald-50/50 to-cyan-50/40 dark:from-teal-950/50 dark:via-[#0A2024] dark:to-cyan-950/30 border-teal-300/80 dark:border-teal-400/30 hover:border-teal-500'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
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
                            : 'text-emerald-600 dark:text-emerald-400'
                          : isMaintenance
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      {isOccupied ? payRec?.status ?? 'Terisi' : room.status}
                    </span>
                  </div>

                  {isOccupied && room.tenant ? (
                    <div className="pt-3 border-t border-teal-900/[0.06] dark:border-white/[0.06]">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {room.tenant.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {room.tenant.institution}
                      </p>
                      <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {room.tenant.phone}
                      </p>
                    </div>
                  ) : isMaintenance ? (
                    <div className="pt-3 border-t border-amber-500/20 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      <span>Sedang dalam perbaikan / perawatan.</span>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-teal-600/15 dark:border-teal-400/20">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Unit bersih &amp; siap ditempati penyewa baru.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-teal-900/[0.06] dark:border-white/[0.06]">
                  <span className="font-mono-num text-sm font-semibold text-slate-900 dark:text-white">
                    {formatIDR(room.monthlyRate)}
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      /bln
                    </span>
                  </span>

                  {isOccupied || isMaintenance ? (
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300 group-hover:translate-x-0.5 transition-transform">
                      Detail →
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCheckIn(room.number);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-primary text-xs font-medium transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Check-In</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl surface-card border border-teal-900/[0.08] dark:border-teal-400/[0.12] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-teal-900/[0.07] dark:border-teal-400/[0.1] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Kamar</th>
                  <th className="py-3 px-4">Tipe &amp; Luas</th>
                  <th className="py-3 px-4">Penyewa</th>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4">Tgl Masuk</th>
                  <th className="py-3 px-4 text-right">Tarif / Bln</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-900/[0.05] dark:divide-white/[0.05] text-sm">
                {filteredRooms.map((room) => {
                  const isOccupied = room.status === 'Terisi' && room.tenant;
                  const isMaintenance = room.status === 'Perawatan';
                  return (
                    <tr
                      key={room.id}
                      onClick={() => onSelectRoom(room)}
                      className="hover:bg-teal-500/[0.04] cursor-pointer transition-colors"
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
                        {room.tenant?.phone ?? '—'}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        {room.tenant ? formatDateID(room.tenant.checkInDate) : '—'}
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-primary text-xs font-medium transition-all"
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
