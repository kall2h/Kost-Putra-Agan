import React, { useEffect, useState } from 'react';
import { BedDouble, X } from 'lucide-react';
import { Room, RoomTier, RoomTypeConfig } from '../types/kost';
import { DEFAULT_ROOM_TYPES } from '../data/initialData';
import { CurrencyInput } from './CurrencyInput';

interface AddRoomModalProps {
  open: boolean;
  existingRooms: Room[];
  roomTypes: RoomTypeConfig[];
  onClose: () => void;
  onSubmit: (payload: {
    number: string;
    name?: string;
    floor: number;
    tier: RoomTier;
    monthlyRate: number;
    areaSqm: number;
    facilities: string[];
  }) => Promise<void>;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  open,
  existingRooms,
  roomTypes,
  onClose,
  onSubmit,
}) => {
  const activeTypes = roomTypes.length > 0 ? roomTypes : DEFAULT_ROOM_TYPES;
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [floor, setFloor] = useState(1);
  const [tier, setTier] = useState<RoomTier>('Tipe A');
  const [monthlyRate, setMonthlyRate] = useState(1750000);
  const [areaSqm, setAreaSqm] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const numericCodes = existingRooms
      .map((r) => parseInt(r.number, 10))
      .filter((n) => !Number.isNaN(n));
    const maxNum = numericCodes.length > 0 ? Math.max(...numericCodes) : 208;
    const suggested = String(maxNum + 1);
    setNumber(suggested);
    setName('');
    setFloor(suggested.startsWith('2') ? 2 : suggested.startsWith('3') ? 3 : 1);
    const defaultType = activeTypes[0];
    setTier(defaultType.tier);
    setMonthlyRate(defaultType.monthlyRate);
    setAreaSqm(defaultType.areaSqm);
    setError(null);
  }, [open, existingRooms, activeTypes]);

  if (!open) return null;

  const handleTierChange = (nextTier: RoomTier) => {
    setTier(nextTier);
    const preset = activeTypes.find((t) => t.tier === nextTier);
    if (preset) {
      setMonthlyRate(preset.monthlyRate);
      setAreaSqm(preset.areaSqm);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = number.trim().replace(/[^a-zA-Z0-9-]/g, '');
    if (!cleanNum) {
      setError('Nomor unit kamar wajib diisi (huruf/angka, contoh: 209 atau 301).');
      return;
    }
    const duplicate = existingRooms.some(
      (r) => r.number.toLowerCase() === cleanNum.toLowerCase()
    );
    if (duplicate) {
      setError(`Unit ${cleanNum} sudah terdaftar. Gunakan nomor unit lain.`);
      return;
    }

    const preset = activeTypes.find((t) => t.tier === tier) ?? activeTypes[0];
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        number: cleanNum,
        name: name.trim() || undefined,
        floor,
        tier,
        monthlyRate,
        areaSqm,
        facilities: preset.facilities,
      });
      onClose();
    } finally {
      setSaving(false);
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
        aria-labelledby="add-room-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BedDouble className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2
              id="add-room-title"
              className="font-display font-semibold text-base text-slate-900 dark:text-white"
            >
              Tambah Unit Kamar Baru
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nomor Unit *
              </label>
              <input
                type="text"
                required
                maxLength={10}
                placeholder="Contoh: 209"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Lantai
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Nama Kamar (Opsional)
            </label>
            <input
              type="text"
              maxLength={60}
              placeholder="Contoh: Kamar 209 Balkon Timur"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Tipe Kamar
            </label>
            <select
              value={tier}
              onChange={(e) => handleTierChange(e.target.value as RoomTier)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            >
              {activeTypes.map((rt) => (
                <option key={rt.id} value={rt.tier}>
                  {rt.displayName?.trim() || rt.tier} · {rt.subtitle}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Tarif / Bulan (Rp)
              </label>
              <CurrencyInput
                value={monthlyRate}
                onChange={setMonthlyRate}
                aria-label="Tarif per Bulan (Rp)"
                className="w-full pr-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Luas Kamar (m²)
              </label>
              <input
                type="number"
                min={4}
                max={100}
                value={areaSqm}
                onChange={(e) => setAreaSqm(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl btn-secondary text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] px-5 py-2 rounded-xl btn-primary text-sm font-medium"
            >
              {saving ? 'Menyimpan...' : 'Tambah Kamar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
