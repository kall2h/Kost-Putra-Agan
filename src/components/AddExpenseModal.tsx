import React, { useEffect, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { ExpenseCategory, ExpenseRecord } from '../types/kost';
import { formatIDR, getTodayISO } from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface AddExpenseModalProps {
  open: boolean;
  editingExpense?: ExpenseRecord | null;
  onClose: () => void;
  onSubmit: (payload: {
    id?: string;
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void> | void;
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'Listrik', label: 'Listrik PLN & Token' },
  { value: 'Air', label: 'Air PDAM & Filter' },
  { value: 'Bahan', label: 'Keperluan Kost & Kebersihan' },
  { value: 'Tagihan', label: 'WiFi & Iuran Lingkungan' },
  { value: 'Lainnya', label: 'Perawatan & Lainnya' },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  open,
  editingExpense,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Bahan');
  const [amount, setAmount] = useState(250000);
  const [date, setDate] = useState(() => getTodayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingExpense) {
      setTitle(editingExpense.title);
      setCategory(editingExpense.category);
      setAmount(editingExpense.amount);
      setDate(editingExpense.date);
      setNotes(editingExpense.notes ?? '');
    } else {
      setTitle('');
      setCategory('Bahan');
      setAmount(250000);
      setDate(getTodayISO());
      setNotes('');
    }
  }, [open, editingExpense]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2 || amount <= 0) return;
    setSaving(true);
    try {
      await onSubmit({
        id: editingExpense?.id,
        title: title.trim(),
        category,
        amount,
        date,
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
        aria-labelledby="add-expense-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowUpRight
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <h2
              id="add-expense-title"
              className="font-display font-semibold text-base text-slate-900 dark:text-white"
            >
              {editingExpense ? 'Edit Pengeluaran Kost' : 'Catat Pengeluaran Kost'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup modal pengeluaran"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="expense-title"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Keperluan / Deskripsi *
            </label>
            <input
              id="expense-title"
              type="text"
              required
              minLength={2}
              maxLength={160}
              placeholder="Contoh: Beli alat kebersihan & cuci AC"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="expense-category"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Kategori Keperluan
              </label>
              <select
                id="expense-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="expense-amount"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Nominal (Rp)
              </label>
              <CurrencyInput
                id="expense-amount"
                value={amount}
                onChange={setAmount}
                aria-label="Nominal Pengeluaran (Rp)"
                className="w-full pr-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="expense-date"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Tanggal Transaksi
            </label>
            <input
              id="expense-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="expense-notes"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Catatan (Opsional)
            </label>
            <input
              id="expense-notes"
              type="text"
              maxLength={300}
              placeholder="Detail teknisi atau nomor nota"
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
                : editingExpense
                ? 'Simpan Perubahan'
                : `Simpan Pengeluaran (${formatIDR(amount)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
