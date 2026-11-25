import React, { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { ExpenseCategory } from '../types/kost';
import { formatIDR } from '../utils/format';
import { CurrencyInput } from './CurrencyInput';

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    notes?: string;
  }) => void;
}

const CATEGORIES: ExpenseCategory[] = ['Listrik', 'Air', 'Bahan', 'Tagihan', 'Lainnya'];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Bahan');
  const [amount, setAmount] = useState(250000);
  const [date, setDate] = useState('2026-11-14');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) return;
    onSubmit({
      title: title.trim(),
      category,
      amount,
      date,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setNotes('');
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
        aria-labelledby="add-expense-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2
              id="add-expense-title"
              className="font-display font-semibold text-base text-slate-900 dark:text-white"
            >
              Catat Pengeluaran Operasional
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
              Keperluan / Deskripsi *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Servis AC Kamar 203"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nominal (Rp)
              </label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                aria-label="Nominal Pengeluaran (Rp)"
                className="w-full pr-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border font-mono-num text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Detail teknisi atau nomor nota"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
            />
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
              disabled={amount <= 0}
              className="min-h-[40px] px-5 py-2 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
            >
              Simpan Pengeluaran ({formatIDR(amount)})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
