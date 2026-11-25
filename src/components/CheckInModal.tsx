import React, { useEffect, useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { DepositStatus, PaymentMethod, Room, Tenant } from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import { formatIDR, getTodayISO } from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface CheckInModalProps {
  open: boolean;
  availableRooms: Room[];
  preselectedRoomNumber: string | null;
  defaultDueDay: number;
  onClose: () => void;
  onSubmit: (payload: {
    roomNumber: string;
    tenant: Omit<Tenant, 'id'>;
    monthlyRate: number;
    payNow: boolean;
    method: PaymentMethod;
  }) => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  open,
  availableRooms,
  preselectedRoomNumber,
  defaultDueDay,
  onClose,
  onSubmit,
}) => {
  const [roomNumber, setRoomNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('Politeknik Negeri Media Kreatif');
  const [originCity, setOriginCity] = useState('');
  const [checkInDate, setCheckInDate] = useState(getTodayISO());
  const [dueDay, setDueDay] = useState(defaultDueDay);
  const [monthlyRate, setMonthlyRate] = useState(1750000);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositStatus, setDepositStatus] = useState<DepositStatus>('Disimpan');
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('Transfer BCA');

  useEffect(() => {
    if (!open) return;
    const chosen =
      availableRooms.find((r) => r.number === preselectedRoomNumber) || availableRooms[0];
    if (chosen) {
      setRoomNumber(chosen.number);
      setMonthlyRate(chosen.monthlyRate);
    }
    setName('');
    setPhone('');
    setOriginCity('');
    setCheckInDate(getTodayISO());
    setDueDay(defaultDueDay);
    setEmergencyContact('');
    setDepositAmount(0);
    setDepositStatus('Disimpan');
    setNotes('');
  }, [open, preselectedRoomNumber, availableRooms, defaultDueDay]);

  if (!open) return null;

  const handleRoomChange = (num: string) => {
    setRoomNumber(num);
    const found = availableRooms.find((r) => r.number === num);
    if (found) setMonthlyRate(found.monthlyRate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber || !name.trim()) return;
    onSubmit({
      roomNumber,
      monthlyRate,
      payNow,
      method,
      tenant: {
        name: name.trim(),
        phone: phone.trim() || '0812-0000-0000',
        institution: institution.trim() || 'Mahasiswa / Karyawan',
        originCity: originCity.trim() || 'Jakarta',
        checkInDate,
        dueDay,
        emergencyContact: emergencyContact.trim() || 'Belum dicatat',
        depositAmount: depositAmount > 0 ? depositAmount : undefined,
        depositStatus: depositAmount > 0 ? depositStatus : undefined,
        notes: notes.trim() || undefined,
      },
    });
    onClose();
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
        aria-labelledby="checkin-modal-title"
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2
              id="checkin-modal-title"
              className="font-display font-semibold text-base text-slate-900 dark:text-white"
            >
              Check-In Penyewa Baru
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

        {availableRooms.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Seluruh kamar saat ini sedang terisi atau dalam perawatan.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg btn-primary text-sm font-medium"
            >
              Mengerti
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Pilih Kamar Kosong
                </label>
                <select
                  value={roomNumber}
                  onChange={(e) => handleRoomChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                >
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {getRoomDisplayName(r)} · {r.tier} ({formatIDR(r.monthlyRate)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Tarif Bulanan (Rp)
                </label>
                <CurrencyInput
                  value={monthlyRate}
                  onChange={setMonthlyRate}
                  aria-label="Tarif Bulanan (Rp)"
                  className="w-full pr-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Nama Lengkap Penyewa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rafi Ramadhan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="0812-xxxx-xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Kampus / Instansi
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Kota Asal
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Bandung"
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Tanggal Masuk
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Tgl Jatuh Tempo
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Kontak Darurat
                </label>
                <input
                  type="text"
                  placeholder="Nama & No. HP"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                />
              </div>
            </div>

            {/* Deposit & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Uang Jaminan / Deposit (Rp)
                </label>
                <CurrencyInput
                  value={depositAmount}
                  onChange={setDepositAmount}
                  aria-label="Uang Jaminan / Deposit (Rp)"
                  className="w-full pr-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Status Deposit
                </label>
                <select
                  value={depositStatus}
                  disabled={depositAmount <= 0}
                  onChange={(e) => setDepositStatus(e.target.value as DepositStatus)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-sm disabled:opacity-50"
                >
                  <option value="Disimpan">Sudah Diterima (Disimpan)</option>
                  <option value="Belum Bayar">Belum Dibayar</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                maxLength={300}
                placeholder="Misal: Parkir motor slot A, titip kunci cadangan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Pembayaran Sewa Bulan Pertama Langsung Lunas
                </span>
                <input
                  type="checkbox"
                  checked={payNow}
                  onChange={(e) => setPayNow(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded"
                />
              </label>

              {payNow && (
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
                  >
                    <option value="Transfer BCA">Transfer BCA</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Transfer Mandiri">Transfer Mandiri</option>
                    <option value="Tunai">Tunai</option>
                  </select>
                </div>
              )}
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
                className="min-h-[40px] px-5 py-2 rounded-xl btn-primary text-sm font-medium"
              >
                Simpan &amp; Check-In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
