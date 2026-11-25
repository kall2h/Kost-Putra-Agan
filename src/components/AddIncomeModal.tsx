import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, X } from 'lucide-react';
import { IncomeCategory, IncomeRecord, PaymentMethod } from '../types/kost';
import { formatIDR, getTodayISO } from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface AddIncomeModalProps {
  open: boolean;
  editingIncome?: IncomeRecord | null;
  onClose: () => void;
  onSubmit: (payload: {
    id?: string;
    title: string;
    category: IncomeCategory;
    amount: number;
    date: string;
    method?: PaymentMethod;
    notes?: string;
  }) => Promise<void> | void;
}

const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'Uang Kost', label: 'Uang Kost (Tambahan / Harian)' },
  { value: 'Parkir', label: 'Parkir Kendaraan' },
  { value: 'Laundry', label: 'Jasa Laundry' },
  { value: 'Deposit', label: 'Deposit / Jaminan' },
  { value: 'Lainnya', label: 'Pemasukan Lainnya' },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'Transfer BCA',
  'QRIS',
  'Transfer Mandiri',
  'Tunai',
];

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  open,
  editingIncome,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IncomeCategory>('Uang Kost');
  const [amount, setAmount] = useState(250000);
  const [date, setDate] = useState(() => getTodayISO());
  const [method, setMethod] = useState<PaymentMethod>('Transfer BCA');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingIncome) {
      setTitle(editingIncome.title);
      setCategory(editingIncome.category);
      setAmount(editingIncome.amount);
      setDate(editingIncome.date);
      setMethod(editingIncome.method ?? 'Transfer BCA');
      setNotes(editingIncome.notes ?? '');
    } else {
      setTitle('');
      setCategory('Uang Kost');
      setAmount(250000);
      setDate(getTodayISO());
      setMethod('Transfer BCA');
      setNotes('');
    }
  }, [open, editingIncome]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2 || amount <= 0) return;
    setSaving(true);
    try {
      await onSubmit({
        id: editingIncome?.id,
        title: title.trim(),
        category,
        amount,
        date,
        method,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/55 animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="income-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowDownLeft
              className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <h2
              id="income-modal-title"
              className="font-display font-semibold text-base text-slate-900 dark:text-white"
            >
              {editingIncome ? 'Edit Catatan Pemasukan' : 'Catat Pemasukan Kost'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup modal pemasukan"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="income-title"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Sumber / Keterangan Pemasukan *
            </label>
            <input
              id="income-title"
              type="text"
              required
              minLength={2}
              maxLength={160}
              placeholder="Contoh: Sewa tamu harian atau Iuran parkir motor"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="income-category"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Kategori Pemasukan
              </label>
              <select
                id="income-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as IncomeCategory)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              >
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="income-amount"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Nominal (Rp)
              </label>
              <CurrencyInput
                id="income-amount"
                value={amount}
                onChange={setAmount}
                aria-label="Nominal Pemasukan (Rp)"
                className="w-full pr-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="income-date"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Tanggal Transaksi
              </label>
              <input
                id="income-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="income-method"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Metode Penerimaan
              </label>
              <select
                id="income-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="income-notes"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Catatan (Opsional)
            </label>
            <input
              id="income-notes"
              type="text"
              maxLength={300}
              placeholder="Nomor kamar atau detail tambahan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl btn-secondary text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || title.trim().length < 2 || amount <= 0}
              className="min-h-[40px] px-5 py-2 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
            >
              {saving
                ? 'Menyimpan...'
                : editingIncome
                ? 'Simpan Perubahan'
                : `Simpan Pemasukan (${formatIDR(amount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
