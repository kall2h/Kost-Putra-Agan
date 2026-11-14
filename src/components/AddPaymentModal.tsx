import React, { useEffect, useState } from 'react';
import { X, ReceiptText } from 'lucide-react';
import { PaymentMethod, Room } from '../types/kost';
import { getRoomDisplayName } from '../data/initialData';
import { formatIDR, getTodayISO } from '../utils/format';

interface AddPaymentModalProps {
  open: boolean;
  occupiedRooms: Room[];
  selectedMonth: string;
  onClose: () => void;
  onSubmit: (payload: {
    roomNumber: string;
    tenantName: string;
    month: string;
    amount: number;
    lateFee?: number;
    paidDate: string;
    method: PaymentMethod;
    notes?: string;
  }) => void;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  open,
  occupiedRooms,
  selectedMonth,
  onClose,
  onSubmit,
}) => {
  const [roomNumber, setRoomNumber] = useState('');
  const [amount, setAmount] = useState(1750000);
  const [lateFee, setLateFee] = useState(0);
  const [paidDate, setPaidDate] = useState(getTodayISO());
  const [method, setMethod] = useState<PaymentMethod>('Transfer BCA');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || occupiedRooms.length === 0) return;
    const first = occupiedRooms[0];
    setRoomNumber(first.number);
    setAmount(first.monthlyRate);
    setLateFee(0);
    setPaidDate(getTodayISO());
    setNotes('');
  }, [open, occupiedRooms]);

  if (!open) return null;

  const selectedRoom = occupiedRooms.find((r) => r.number === roomNumber);

  const handleRoomChange = (num: string) => {
    setRoomNumber(num);
    const found = occupiedRooms.find((r) => r.number === num);
    if (found) setAmount(found.monthlyRate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom?.tenant) return;
    onSubmit({
      roomNumber: selectedRoom.number,
      tenantName: selectedRoom.tenant.name,
      month: selectedMonth,
      amount,
      lateFee: lateFee > 0 ? lateFee : undefined,
      paidDate,
      method,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-payment-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-gradient-to-b from-white to-[#F4FCFA] dark:from-[#0C1E22] dark:to-[#071418] border border-teal-900/[0.1] dark:border-teal-400/[0.16] shadow-xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-teal-900/[0.08] dark:border-teal-400/[0.1] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ReceiptText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2
              id="add-payment-title"
              className="font-display font-semibold text-base text-slate-900 dark:text-white"
            >
              Catat Pembayaran Sewa
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
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Kamar & Penyewa
            </label>
            <select
              value={roomNumber}
              onChange={(e) => handleRoomChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            >
              {occupiedRooms.map((r) => (
                <option key={r.id} value={r.number}>
                  {getRoomDisplayName(r)} — {r.tenant?.name} ({formatIDR(r.monthlyRate)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nominal Sewa (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Denda Telat (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={lateFee}
                onChange={(e) => setLateFee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Tanggal Bayar
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
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
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              maxLength={300}
              placeholder="Misal: Transfer a.n. Orang Tua"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg btn-primary text-sm font-medium transition-colors"
            >
              Simpan Lunas ({formatIDR(amount + lateFee)})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
