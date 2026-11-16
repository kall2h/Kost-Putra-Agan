import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import { PropertyLogo } from './PropertyLogo';
import { PROPERTY_EXTERIOR_IMG } from '../data/initialData';

interface LoginViewProps {
  mode: 'unauthenticated' | 'verify_email' | 'register_needed';
  userEmail?: string | null;
  defaultDisplayName?: string | null;
  loading: boolean;
  errorMsg: string | null;
  infoMsg?: string | null;
  onClearMessages: () => void;
  onGoogleLogin: () => void;
  onGoogleRegister: (payload: { name: string }) => Promise<void>;
  onEmailLogin: (payload: { email: string; password: string }) => Promise<void>;
  onEmailRegister: (payload: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onCheckEmailVerified: () => Promise<void>;
  onResendVerification: () => Promise<boolean>;
  onPasswordReset: (email: string) => Promise<boolean>;
  onLogout: () => void;
}

const GoogleMark: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29V6.61H1.28A12 12 0 0 0 0 12c0 1.93.46 3.76 1.28 5.39l4-3.1z"
    />
    <path
      fill="#EA4335"
      d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
    />
  </svg>
);

export const LoginView: React.FC<LoginViewProps> = ({
  mode,
  userEmail,
  defaultDisplayName,
  loading,
  errorMsg,
  infoMsg,
  onClearMessages,
  onGoogleLogin,
  onGoogleRegister,
  onEmailLogin,
  onEmailRegister,
  onCheckEmailVerified,
  onResendVerification,
  onPasswordReset,
  onLogout,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [forgotMode, setForgotMode] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Manual register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');

  // Complete profile state
  const [profileName, setProfileName] = useState(defaultDisplayName ?? '');

  // Verification resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (defaultDisplayName && !profileName) {
      setProfileName(defaultDisplayName);
    }
  }, [defaultDisplayName, profileName]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const passwordsMismatch =
    regConfirmPassword.length > 0 && regPassword !== regConfirmPassword;

  const displayedError = localError || errorMsg;

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setForgotMode(false);
    setLocalError(null);
    onClearMessages();
  };

  const openForgotPassword = () => {
    setResetEmail(loginEmail);
    setForgotMode(true);
    setLocalError(null);
    onClearMessages();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setLocalError('Masukkan email dan kata sandi.');
      return;
    }
    await onEmailLogin({ email: loginEmail, password: loginPassword });
  };

  const handleManualRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (regName.trim().length < 2) {
      setLocalError('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (!regEmail.trim()) {
      setLocalError('Email wajib diisi.');
      return;
    }
    if (regPassword.length < 6) {
      setLocalError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setLocalError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    await onEmailRegister({
      name: regName,
      email: regEmail,
      password: regPassword,
    });
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!resetEmail.trim()) {
      setLocalError('Masukkan alamat email Anda.');
      return;
    }
    await onPasswordReset(resetEmail);
  };

  const handleProfileCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (profileName.trim().length < 2) {
      setLocalError('Nama lengkap minimal 2 karakter.');
      return;
    }
    await onGoogleRegister({ name: profileName.trim() });
  };

  const handleResendClick = async () => {
    if (resendCooldown > 0 || loading) return;
    const sent = await onResendVerification();
    if (sent) {
      setResendCooldown(30);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#091215] text-slate-900 dark:text-slate-100">
      {/* Left Clean Architectural Showcase */}
      <aside className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-[#0a1417] flex-col justify-between p-12 xl:p-16 text-white">
        {!heroImgError && (
          <img
            src={PROPERTY_EXTERIOR_IMG}
            alt="Kost Putra Agan"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-80"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#060d0f]/90 via-[#071113]/40 to-[#060d0f]/35"
          aria-hidden="true"
        />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <PropertyLogo className="w-9 h-9" />
          <span className="font-display font-semibold text-base tracking-tight text-white">
            Kost Putra Agan
          </span>
        </div>

        {/* Minimal Editorial Headline */}
        <div className="relative z-10 max-w-lg space-y-2.5">
          <h1 className="font-display text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-[1.18] [text-wrap:balance]">
            Kelola kamar, tagihan, dan kas kost dalam satu tempat.
          </h1>
          <p className="text-sm text-slate-300/90">
            Jagakarsa · Jakarta Selatan
          </p>
        </div>
      </aside>

      {/* Right Full-Height Auth Canvas */}
      <main className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between px-6 py-7 sm:px-12 lg:px-14 xl:px-16 border-l border-slate-200/80 dark:border-white/[0.06]">
        {/* Mobile Brand Header */}
        <div className="flex lg:hidden items-center gap-2.5">
          <PropertyLogo className="w-8 h-8" />
          <span className="font-display font-semibold text-sm text-slate-900 dark:text-white">
            Kost Putra Agan
          </span>
        </div>
        <div className="hidden lg:block" />

        {/* Centered Auth Container */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-8 space-y-6">
          {/* Sub-Flow 1: Email Verification */}
          {mode === 'verify_email' && userEmail && (
            <div className="space-y-5 animate-page-enter">
              <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-300">
                <MailCheck className="w-5 h-5" />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display font-semibold text-2xl tracking-tight text-slate-900 dark:text-white">
                  Verifikasi email Anda
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Buka tautan verifikasi yang dikirim ke{' '}
                  <span className="font-medium text-slate-900 dark:text-white break-all">
                    {userEmail}
                  </span>
                  , lalu klik tombol di bawah.
                </p>
              </div>

              {displayedError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              {infoMsg && (
                <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 flex items-start gap-2 text-xs text-teal-800 dark:text-teal-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={onCheckEmailVerified}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg btn-primary disabled:opacity-60 text-sm font-medium whitespace-nowrap"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Memeriksa...' : 'Saya Sudah Verifikasi'}</span>
                </button>

                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={handleResendClick}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50 text-xs font-medium whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0
                      ? `Kirim Ulang (${resendCooldown}s)`
                      : 'Kirim Ulang Email'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Ganti Akun</span>
              </button>
            </div>
          )}

          {/* Sub-Flow 2: Complete Manager Profile */}
          {mode === 'register_needed' && userEmail && (
            <form onSubmit={handleProfileCompleteSubmit} className="space-y-5 animate-page-enter">
              <div className="space-y-1">
                <h2 className="font-display font-semibold text-2xl tracking-tight text-slate-900 dark:text-white">
                  Lengkapi Profil
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Masukkan nama untuk mengaktifkan akun {userEmail}.
                </p>
              </div>

              {displayedError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Nama lengkap Anda"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg btn-primary disabled:opacity-60 text-sm font-medium whitespace-nowrap"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'Menyimpan...' : 'Aktifkan Akun'}</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Ganti
                </button>
              </div>
            </form>
          )}

          {/* Sub-Flow 3: Forgot Password */}
          {mode === 'unauthenticated' && forgotMode && (
            <form onSubmit={handleForgotSubmit} className="space-y-5 animate-page-enter">
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setLocalError(null);
                  onClearMessages();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </button>

              <div className="space-y-1">
                <h2 className="font-display font-semibold text-2xl tracking-tight text-slate-900 dark:text-white">
                  Reset Kata Sandi
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Kami akan mengirim tautan reset ke email Anda.
                </p>
              </div>

              {displayedError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              {infoMsg && (
                <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 flex items-start gap-2 text-xs text-teal-800 dark:text-teal-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg btn-primary disabled:opacity-60 text-sm font-medium whitespace-nowrap"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? 'Mengirim...' : 'Kirim Tautan Reset'}</span>
              </button>
            </form>
          )}

          {/* Primary Flow: Masuk & Daftar Akun */}
          {mode === 'unauthenticated' && !forgotMode && (
            <div className="space-y-5">
              {/* Underline Tabs */}
              <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'login'
                      ? 'border-teal-700 dark:border-teal-400 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className={`pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'register'
                      ? 'border-teal-700 dark:border-teal-400 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Daftar Akun
                </button>
              </div>

              {/* Concise Title */}
              <div className="space-y-1">
                <h2 className="font-display font-semibold text-2xl tracking-tight text-slate-900 dark:text-white">
                  {activeTab === 'login' ? 'Masuk' : 'Buat Akun'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {activeTab === 'login'
                    ? 'Lanjutkan dengan Google atau email Anda.'
                    : 'Daftar menggunakan Google atau email baru.'}
                </p>
              </div>

              {/* Alerts */}
              {displayedError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              {infoMsg && (
                <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 flex items-start gap-2 text-xs text-teal-800 dark:text-teal-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {/* Google SSO */}
              <button
                type="button"
                disabled={loading}
                onClick={onGoogleLogin}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-medium shadow-2xs disabled:opacity-60 whitespace-nowrap"
              >
                <GoogleMark className="w-4 h-4 shrink-0" />
                <span>
                  {activeTab === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}
                </span>
              </button>

              {/* Minimal Divider */}
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="px-3 text-xs text-slate-400 dark:text-slate-500">atau</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              {/* Manual Forms */}
              {activeTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="nama@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={openForgotPassword}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400"
                      >
                        Lupa kata sandi?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showLoginPwd ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-lg input-surface border text-sm"
                      />
                      <button
                        type="button"
                        aria-label={showLoginPwd ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        onClick={() => setShowLoginPwd((v) => !v)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showLoginPwd ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg btn-primary disabled:opacity-60 text-sm font-medium whitespace-nowrap"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? 'Memproses...' : 'Masuk'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleManualRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Nama Lengkap
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      placeholder="Nama Anda"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="nama@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showRegPwd ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Minimal 6 karakter"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-lg input-surface border text-sm"
                      />
                      <button
                        type="button"
                        aria-label={showRegPwd ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                        onClick={() => setShowRegPwd((v) => !v)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showRegPwd ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-confirm"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Konfirmasi Kata Sandi
                    </label>
                    <input
                      id="reg-confirm"
                      type={showRegPwd ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Ulangi kata sandi"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg input-surface border text-sm"
                    />
                    {passwordsMismatch && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                        Kata sandi belum cocok.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg btn-primary disabled:opacity-60 text-sm font-medium whitespace-nowrap"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{loading ? 'Mendaftarkan...' : 'Daftar'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <footer className="text-[11px] text-slate-400 dark:text-slate-500">
          © Kost Putra Agan
        </footer>
      </main>
    </div>
  );
};
