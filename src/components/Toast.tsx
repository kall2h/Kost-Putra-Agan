import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#062E31] to-[#0B4A4D] text-white border border-teal-400/25 shadow-lg max-w-sm"
    >
      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
      <p className="text-sm font-medium text-slate-100 leading-snug">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 rounded-md text-slate-400 hover:text-white transition-colors shrink-0"
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
