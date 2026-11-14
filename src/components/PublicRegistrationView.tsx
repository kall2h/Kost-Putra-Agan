import React, { useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Wifi,
  ShieldCheck,
  ArrowLeft,
  Send,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { PropertySettings, Room } from '../types/kost';
import { PROPERTY_EXTERIOR_IMG } from '../data/initialData';
import { PropertyLogo } from './PropertyLogo';
import { formatIDR } from '../utils/format';

interface PublicRegistrationViewProps {
  rooms: Room[];
  settings: PropertySettings;
  isAdminLoggedIn: boolean;
  onSubmitApplication: (payload: {
    roomNumber: string;
    applicantName: string;
    phone: string;
    institution: string;
    originCity: string;
    plannedCheckInDate: string;
    emergencyContact: string;
    notes?: string;
  }) => Promise<string>;
  onBackToAdmin: () => void;
}

export const PublicRegistrationView: React.FC<PublicRegistrationViewProps> = ({
  rooms,
  settings,
  isAdminLoggedIn,
  onSubmitApplication,
  onBackToAdmin,
}) => {
  const availableRooms = rooms.filter((r) => r.status === 'Tersedia');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>(
    availableRooms[0]?.number ?? ''
  );
  const [applicantName, setApplicantName] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('Politeknik Negeri Media Kreatif');
  const [originCity, setOriginCity] = useState('');
  const [plannedCheckInDate, setPlannedCheckInDate] = useState('2026-11-16');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const activeRoom =
    availableRooms.find((r) => r.number === selectedRoomNumber) ?? availableRooms[0] ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const id = await onSubmitApplication({
        roomNumber: activeRoom.number,
        applicantName,
        phone,
        institution,
        originCity,
        plannedCheckInDate,
        emergencyContact,
        notes: notes.trim() || undefined,
      });
      setSubmittedId(id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? 'Gagal mengirim pendaftaran. Pastikan data terisi lengkap dan kamar masih tersedia.'
          : 'Terjadi kesalahan saat mengirim formulir.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900">
      {/* Clean 3-Zone Top Bar */}
      <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <PropertyLogo className="w-8 h-8 rounded-lg" />
          <span className="font-display font-semibold text-base text-slate-900 whitespace-nowrap">
            {settings.name}
          </span>
        </div>

        <button
          type="button"
          onClick={onBackToAdmin}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isAdminLoggedIn ? 'Kembali ke Dashboard' : 'Portal Pengelola'}</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Property Overview Split */}
        <section className="rounded-2xl overflow-hidden bg-white border border-slate-200/90 grid grid-cols-1 md:grid-cols-12 items-stretch shadow-xs">
          <div className="md:col-span-5 relative min-h-[220px] bg-slate-900">
            {!imgError ? (
              <img
                src={PROPERTY_EXTERIOR_IMG}
                alt={`Gedung ${settings.name}`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full lg:h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Building2 className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-4">
            <p className="text-xs font-semibold text-teal-700">
              Pendaftaran Calon Penghuni
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 leading-tight [text-wrap:balance]">
              {settings.name} — {settings.tagline}
            </h1>
            <div className="space-y-2 text-xs sm:text-sm text-slate-600">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-slate-500 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-teal-600" />
                  WiFi 100 Mbps
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  Kamar Mandi Dalam & AC
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Form or Success Confirmation */}
        {submittedId ? (
          <section className="rounded-2xl bg-white border border-slate-200 p-8 text-center max-w-xl mx-auto space-y-5 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto" />
            <div className="space-y-2">
              <h2 className="font-display font-semibold text-xl text-slate-900">
                Pendaftaran Berhasil Dikirim
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Terima kasih <span className="font-semibold text-slate-900">{applicantName}</span>.
                Pengajuan sewa untuk{' '}
                <span className="font-mono-num text-teal-700 font-semibold">
                  Kamar {activeRoom?.number}
                </span>{' '}
                telah masuk ke sistem pengelola {settings.name}.
              </p>
              <p className="font-mono-num text-xs text-slate-400">
                Nomor Referensi: {submittedId}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`https://wa.me/${settings.whatsappAdmin}?text=${encodeURIComponent(
                  `Halo Admin ${settings.name}, saya ${applicantName} baru saja mengisi formulir pendaftaran online untuk Kamar ${activeRoom?.number} (Ref: ${submittedId}). Mohon konfirmasinya.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
              >
                <span>Konfirmasi via WhatsApp Admin</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setSubmittedId(null);
                  setApplicantName('');
                  setPhone('');
                  setOriginCity('');
                  setEmergencyContact('');
                  setNotes('');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
              >
                Kirim Pengajuan Lain
              </button>
            </div>
          </section>
        ) : availableRooms.length === 0 ? (
          <section className="rounded-2xl bg-white border border-slate-200 p-10 text-center space-y-3">
            <p className="font-display font-semibold text-lg text-slate-900">
              Semua Unit Kamar Saat Ini Terisi Penuh
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Seluruh {settings.totalRooms} kamar di {settings.name} sedang terisi. Silakan hubungi
              admin via WhatsApp untuk masuk daftar tunggu.
            </p>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Step 1: Pick Room */}
            <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/90 p-6 space-y-4 shadow-xs">
              <div>
                <h2 className="font-display font-semibold text-base text-slate-900">
                  1. Pilih Kamar Tersedia ({availableRooms.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih unit kamar yang ingin Anda tempati
                </p>
              </div>

              <div className="space-y-2.5">
                {availableRooms.map((room) => {
                  const selected = activeRoom?.number === room.number;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoomNumber(room.number)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        selected
                          ? 'bg-teal-50/70 border-teal-600'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-num font-semibold text-sm text-slate-900">
                          Kamar {room.number}
                        </span>
                        <span className="font-mono-num text-sm font-semibold text-teal-700">
                          {formatIDR(room.monthlyRate)}/bln
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Lantai {room.floor} · {room.tier} · {room.areaSqm} m²
                      </p>
                    </button>
                  );
                })}
              </div>

              {activeRoom && (
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  <p className="text-xs font-medium text-slate-700">
                    Fasilitas Kamar {activeRoom.number}:
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {activeRoom.facilities.join(' · ')}
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Applicant Biodata */}
            <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/90 p-6 space-y-5 shadow-xs">
              <div>
                <h2 className="font-display font-semibold text-base text-slate-900">
                  2. Isi Biodata Calon Penghuni
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Data dikirim langsung secara aman ke pengelola {settings.name}
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Sesuai KTP"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Nomor WhatsApp Aktif *
                  </label>
                  <input
                    type="tel"
                    required
                    minLength={6}
                    maxLength={30}
                    placeholder="0812-xxxx-xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono-num text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Kampus / Tempat Kerja *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Kota Asal *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Contoh: Bandung"
                    value={originCity}
                    onChange={(e) => setOriginCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Rencana Tanggal Masuk *
                  </label>
                  <input
                    type="date"
                    required
                    value={plannedCheckInDate}
                    onChange={(e) => setPlannedCheckInDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono-num text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Kontak Darurat (Orang Tua/Wali) *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={120}
                    placeholder="Nama & No. HP Wali"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="Contoh: Bawa kendaraan motor / rencana survei lokasi terlebih dahulu"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-teal-600 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !activeRoom}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Mengirim Pendaftaran...'
                    : `Ajukan Sewa Kamar ${activeRoom?.number ?? ''}`}
                </span>
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
