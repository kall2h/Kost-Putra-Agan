import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Inbox,
  Phone,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { PaymentMethod, Room, TenantApplication } from '../types/kost';
import { formatDateID, formatIDR } from '../utils/format';

interface ApplicationsViewProps {
  applications: TenantApplication[];
  rooms: Room[];
  onApproveApplication: (
    app: TenantApplication,
    payNow: boolean,
    method: PaymentMethod
  ) => Promise<void>;
  onRejectApplication: (appId: string) => Promise<void>;
  onDeleteApplication: (appId: string) => Promise<void>;
  onOpenPublicForm: () => void;
  onNotify: (msg: string) => void;
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  rooms,
  onApproveApplication,
  onRejectApplication,
  onDeleteApplication,
  onOpenPublicForm,
  onNotify,
}) => {
  const [filter, setFilter] = useState<'all' | 'Menunggu' | 'Diterima' | 'Ditolak'>('all');
  const [approvingApp, setApprovingApp] = useState<TenantApplication | null>(null);
  const [payNow, setPayNow] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('Transfer BCA');
  const [busy, setBusy] = useState(false);

  const shareUrl = `${window.location.origin}/?daftar=1`;

  const counts = useMemo(
    () => ({
      all: applications.length,
      Menunggu: applications.filter((a) => a.status === 'Menunggu').length,
      Diterima: applications.filter((a) => a.status === 'Diterima').length,
      Ditolak: applications.filter((a) => a.status === 'Ditolak').length,
    }),
    [applications]
  );

  const filtered = useMemo(() => {
    return applications
      .filter((a) => filter === 'all' || a.status === filter)
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }, [applications, filter]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onNotify('Tautan formulir pendaftaran calon penyewa disalin');
    } catch {
      onNotify(`Tautan formulir: ${shareUrl}`);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvingApp) return;
    setBusy(true);
    try {
      await onApproveApplication(approvingApp, payNow, method);
      setApprovingApp(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Shareable Self-Service Link Card */}
      <section className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Formulir Pendaftaran Mandiri Calon Penyewa
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Bagikan tautan ini kepada calon penghuni agar mereka dapat memilih kamar kosong dan
            mengirim biodata langsung dari ponsel mereka.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-medium"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Salin Link Formulir</span>
          </button>
          <button
            type="button"
            onClick={onOpenPublicForm}
            className="inline-flex items-center gap-2 min-h-[38px] px-4 py-2 rounded-xl btn-secondary text-xs font-medium"
          >
            <span>Pratinjau Form</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] w-fit overflow-x-auto">
        {(['all', 'Menunggu', 'Diterima', 'Ditolak'] as const).map((tab) => {
          const active = filter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                active
                  ? 'nav-active-gradient text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab === 'all' ? 'Semua' : tab}{' '}
              <span
                className={`font-mono-num ml-1 ${
                  active ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Applications List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-12 text-center space-y-3">
          <Inbox className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="font-display font-medium text-slate-900 dark:text-white">
            Belum ada pengajuan pendaftaran masuk
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Saat calon penghuni mengisi formulir pendaftaran mandiri, datanya akan otomatis muncul
            di sini untuk Anda verifikasi.
          </p>
          <button
            type="button"
            onClick={onOpenPublicForm}
            className="min-h-[38px] px-4 py-2 rounded-xl btn-primary text-xs font-medium"
          >
            Buka Formulir Calon Penyewa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((app) => {
            const targetRoom = rooms.find((r) => r.number === app.roomNumber);
            const roomStillAvailable = targetRoom?.status === 'Tersedia';

            return (
              <div
                key={app.id}
                className="rounded-xl surface-card border border-slate-200/90 dark:border-white/[0.08] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-400">
                          Kamar {app.roomNumber}
                        </span>
                        {targetRoom && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                              {formatIDR(targetRoom.monthlyRate)}/bln
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white mt-1">
                        {app.applicantName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {app.institution} · Asal {app.originCity}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        app.status === 'Menunggu'
                          ? 'text-amber-600 dark:text-amber-400'
                          : app.status === 'Diterima'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                    <p className="flex items-center gap-1.5 font-mono-num">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{app.phone}</span>
                    </p>
                    <p>
                      Rencana masuk:{' '}
                      <span className="font-mono-num font-medium text-slate-900 dark:text-white">
                        {formatDateID(app.plannedCheckInDate)}
                      </span>
                    </p>
                    <p className="sm:col-span-2 text-slate-500 dark:text-slate-400">
                      Kontak darurat: {app.emergencyContact}
                    </p>
                    {app.notes && (
                      <p className="sm:col-span-2 text-slate-500 dark:text-slate-400 italic">
                        “{app.notes}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
                  {app.status === 'Menunggu' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onRejectApplication(app.id)}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl btn-secondary text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-700 text-xs font-medium"
                      >
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Tolak</span>
                      </button>

                      {roomStillAvailable ? (
                        <button
                          type="button"
                          onClick={() => setApprovingApp(app)}
                          className="inline-flex items-center gap-1.5 min-h-[36px] px-4 py-1.5 rounded-xl btn-primary text-xs font-medium"
                        >
                          <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Terima &amp; Check-In</span>
                        </button>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Kamar {app.roomNumber} sudah terisi
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Sudah diproses</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteApplication(app.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                        title="Hapus riwayat pengajuan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approvingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/50 animate-backdrop-in"
            onClick={() => !busy && setApprovingApp(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="animate-modal-in relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200 dark:border-white/[0.1] p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
              Konfirmasi Check-In Kamar {approvingApp.roomNumber}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Menerima pengajuan atas nama{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {approvingApp.applicantName}
              </span>{' '}
              akan otomatis menempatkan penyewa di Kamar {approvingApp.roomNumber} dan membuat
              tagihan bulan berjalan.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#081215] border border-slate-200 dark:border-white/[0.08] space-y-3">
              <label className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                <span>Sewa bulan pertama langsung Lunas</span>
                <input
                  type="checkbox"
                  checked={payNow}
                  onChange={(e) => setPayNow(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded"
                />
              </label>
              {payNow && (
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-lg input-surface border text-xs"
                >
                  <option value="Transfer BCA">Transfer BCA</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer Mandiri">Transfer Mandiri</option>
                  <option value="Tunai">Tunai</option>
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setApprovingApp(null)}
                className="min-h-[38px] px-4 py-2 rounded-xl btn-secondary text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmApprove}
                className="min-h-[38px] px-4 py-2 rounded-xl btn-primary disabled:opacity-60 text-xs font-medium"
              >
                {busy ? 'Memproses...' : 'Setujui & Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
