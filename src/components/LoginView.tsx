import React, { useEffect, useState } from 'react';
import {
  LogIn,
  UserPlus,
  LogOut,
  MapPin,
  Wifi,
  ShieldCheck,
} from 'lucide-react';
import { PropertyLogo } from './PropertyLogo';
import { PROPERTY_EXTERIOR_IMG } from '../data/initialData';

interface LoginViewProps {
  mode: 'unauthenticated' | 'register_needed';
  userEmail?: string | null;
  defaultDisplayName?: string | null;
  loading: boolean;
  errorMsg: string | null;
  onGoogleLogin: () => void;
  onGoogleRegister: (payload: { name: string }) => Promise<void>;
  onLogout: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  mode,
  userEmail,
  defaultDisplayName,
  loading,
  errorMsg,
  onGoogleLogin,
  onGoogleRegister,
  onLogout,
}) => {
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    mode === 'register_needed' ? 'register' : 'login'
  );
  const [name, setName] = useState(defaultDisplayName ?? '');

  useEffect(() => {
    if (mode === 'register_needed') {
      setActiveTab('register');
    }
  }, [mode]);

  useEffect(() => {
    if (defaultDisplayName && !name) {
      setName(defaultDisplayName);
    }
  }, [defaultDisplayName, name]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onGoogleRegister({
      name: name.trim(),
    });
  };

  return (
    <div className="min-h-screen text-slate-900 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Brand Gradient Showcase */}
      <div className="hidden lg:flex lg:col-span-7 relative overflow-hidden bg-gradient-to-br from-[#041C1E] via-[#093E41] to-[#0D9488] flex-col justify-between p-12 text-white">
        {!imgError && (
          <img
            src={PROPERTY_EXTERIOR_IMG}
            alt="Eksterior Modern Kost Putra Agan"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-luminosity"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-tr from-[#031719]/95 via-[#07363A]/80 to-[#0D9488]/65"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3">
          <PropertyLogo className="w-10 h-10" />
          <div>
            <p className="font-display font-semibold text-base text-white">Kost Putra Agan</p>
            <p className="text-xs text-teal-200/90">Portal Manajemen Pengelola</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-5">
          <h1 className="font-display text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-tight [text-wrap:balance]">
            Kendali Penuh Operasional Kost dalam Satu Dashboard.
          </h1>
          <p className="text-sm text-teal-50/90 leading-relaxed">
            Kelola keterisian kamar Tipe A, Tipe B &amp; Tipe C, atur tarif &amp; deskripsi
            kamar, catat penyewa masuk dan keluar, serta pantau arus kas properti secara real-time.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-teal-100">
            <span className="inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-300" />
              Dekat Kampus Polimedia (±5 Menit)
            </span>
            <span className="inline-flex items-center gap-2">
              <Wifi className="w-4 h-4 text-teal-300" />
              16 Unit Terkelola
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              Akses Multi-Pengelola
            </span>
          </div>
        </div>

        <p className="relative z-10 text-xs text-teal-200/80">
          Kost Putra Agan · Nyaman, Strategis, dan Terpercaya
        </p>
      </div>

      {/* Right Login & Register Panel */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex lg:hidden items-center gap-3">
            <PropertyLogo className="w-9 h-9" />
            <div>
              <p className="font-display font-semibold text-base text-slate-900">
                Kost Putra Agan
              </p>
              <p className="text-xs text-slate-500">Portal Pengelola</p>
            </div>
          </div>

          <div className="rounded-2xl surface-card border border-teal-900/[0.08] p-6 sm:p-8 space-y-6">
            {/* Segmented Switch: Masuk vs Daftar Admin */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-teal-950/[0.05]">
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'login'
                    ? 'nav-active-gradient text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk Pengelola
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'register'
                    ? 'nav-active-gradient text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daftar Admin Baru
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed">
                {errorMsg}
              </div>
            )}

            {activeTab === 'login' ? (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display font-semibold text-xl text-slate-900">
                    Masuk Portal Pengelola
                  </h2>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                    Gunakan akun Google Anda untuk membuka dashboard administrasi Kost Putra Agan.
                  </p>
                </div>

                {mode === 'register_needed' && userEmail ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Akun <span className="font-mono-num font-semibold">{userEmail}</span> belum
                      terdaftar sebagai pengelola. Silakan lengkapi pendaftaran pada tab{' '}
                      <span className="font-semibold">Daftar Admin Baru</span>.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('register')}
                        className="px-3.5 py-1.5 rounded-lg btn-primary text-xs font-medium"
                      >
                        Lanjut Daftar
                      </button>
                      <button
                        type="button"
                        onClick={onLogout}
                        className="px-3.5 py-1.5 rounded-lg border border-amber-300 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Ganti Akun
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={onGoogleLogin}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl btn-primary disabled:opacity-60 text-sm font-medium transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{loading ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <h2 className="font-display font-semibold text-xl text-slate-900">
                    Daftar Pengelola Baru
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {mode === 'register_needed' && userEmail
                      ? `Lengkapi profil pengelola untuk akun ${userEmail}.`
                      : 'Daftarkan akun Google Anda untuk ikut mengelola properti Kost Putra Agan.'}
                  </p>
                </div>

                {mode === 'register_needed' && userEmail && (
                  <div className="px-3.5 py-2.5 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-between gap-2">
                    <span className="font-mono-num text-xs text-teal-800 truncate">
                      {userEmail}
                    </span>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-slate-900 shrink-0"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Ganti</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Nama Lengkap Pengelola *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Contoh: Azka Pratama"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Langsung hubungkan akun Google tanpa kode registrasi untuk mulai mengelola kamar
                  dan pembayaran Kost Putra Agan.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl btn-primary disabled:opacity-60 text-sm font-medium transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Mendaftarkan Akun...'
                      : mode === 'register_needed' && userEmail
                      ? 'Aktifkan Akun Pengelola'
                      : 'Daftar & Masuk dengan Google'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
