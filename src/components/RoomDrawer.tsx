import React, { useEffect, useState } from 'react';
import {
  X,
  Phone,
  MapPin,
  Calendar,
  UserPlus,
  LogOut,
  CheckCircle2,
  ReceiptText,
  Copy,
  Pencil,
  Save,
  ExternalLink,
  Trash2,
  Wrench,
  History,
  Plus,
  Shield,
  CreditCard,
  Link2,
} from 'lucide-react';
import {
  DepositStatus,
  MaintenanceCategory,
  MaintenanceLog,
  MaintenanceStatus,
  MessageTemplate,
  PaymentMethod,
  PaymentRecord,
  PropertySettings,
  ReceiptTemplateConfig,
  Room,
  RoomReceiptProfile,
  RoomStatus,
  RoomTier,
  RoomTypeConfig,
  Tenant,
  TenantHistoryRecord,
} from '../types/kost';
import {
  DEFAULT_ROOM_TYPES,
  getRoomDisplayName,
  ROOM_DELUXE_IMG,
} from '../data/initialData';
import {
  buildWhatsAppUrl,
  formatDateID,
  formatIDR,
  formatMonthYear,
  getDueStatusInfo,
  getTodayISO,
} from '../utils/format';
import { DEFAULT_MESSAGE_TEMPLATES, renderMessageTemplate } from '../utils/messageTemplates';
import { buildShareablePaymentUrl, resolveRoomPaymentProfile } from '../utils/receiptPdf';
import { RoomPhotoSlider } from './RoomPhotoSlider';
import { CurrencyInput } from './CurrencyInput';

interface RoomDrawerProps {
  room: Room | null;
  roomTypes: RoomTypeConfig[];
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
  templates: MessageTemplate[];
  currentMonthPayment: PaymentRecord | null;
  maintenanceLogs: MaintenanceLog[];
  tenantHistory: TenantHistoryRecord[];
  onClose: () => void;
  onOpenCheckIn: (roomNumber: string) => void;
  onCheckOut: (room: Room, depositReturnStatus?: DepositStatus) => Promise<void> | void;
  onMarkPaid: (paymentId: string) => void;
  onOpenReceipt: (payment: PaymentRecord) => void;
  onCopyReminder: (room: Room, amount: number, payment?: PaymentRecord | null) => void;
  onSaveRoomReceiptProfile: (
    roomId: string,
    profile: RoomReceiptProfile
  ) => Promise<void>;
  onCreateAndCopyPaymentLink: (
    payment: PaymentRecord,
    room?: Room | null
  ) => Promise<void>;
  onUpdateRoomUnit: (
    roomId: string,
    payload: {
      name?: string;
      tier: RoomTier;
      monthlyRate: number;
      areaSqm: number;
      facilities: string[];
      status?: RoomStatus;
    }
  ) => Promise<void>;
  onDeleteRoomUnit: (roomId: string) => Promise<void>;
  onUpdateTenant: (
    roomId: string,
    roomNumber: string,
    tenant: Omit<Tenant, 'id'>
  ) => Promise<void>;
  onAddMaintenanceLog: (payload: {
    roomId: string;
    roomNumber: string;
    title: string;
    category: MaintenanceCategory;
    status: MaintenanceStatus;
    cost: number;
    reportedDate: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateMaintenanceLog: (
    logId: string,
    payload: {
      title: string;
      category: MaintenanceCategory;
      status: MaintenanceStatus;
      cost: number;
      reportedDate: string;
      notes?: string;
    }
  ) => Promise<void>;
  onDeleteMaintenanceLog: (logId: string) => Promise<void>;
}

const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  'AC',
  'Listrik',
  'Air & Sanitasi',
  'Kunci & Pintu',
  'Kebersihan',
  'Lainnya',
];

export const RoomDrawer: React.FC<RoomDrawerProps> = ({
  room,
  roomTypes,
  settings,
  receiptTemplate,
  templates,
  currentMonthPayment,
  maintenanceLogs,
  tenantHistory,
  onClose,
  onOpenCheckIn,
  onCheckOut,
  onMarkPaid,
  onOpenReceipt,
  onCopyReminder,
  onSaveRoomReceiptProfile,
  onCreateAndCopyPaymentLink,
  onUpdateRoomUnit,
  onDeleteRoomUnit,
  onUpdateTenant,
  onAddMaintenanceLog,
  onUpdateMaintenanceLog,
  onDeleteMaintenanceLog,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'maintenance' | 'history'>('info');
  const [confirmCheckOut, setConfirmCheckOut] = useState(false);
  const [checkoutDepositStatus, setCheckoutDepositStatus] =
    useState<DepositStatus>('Dikembalikan');
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);

  // Room Unit Editor State
  const [editingUnit, setEditingUnit] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitTier, setUnitTier] = useState<RoomTier>('Tipe A');
  const [unitRate, setUnitRate] = useState(1750000);
  const [unitStatus, setUnitStatus] = useState<RoomStatus>('Tersedia');
  const [savingUnit, setSavingUnit] = useState(false);

  // Room Receipt & Payment Profile State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileUseCustom, setProfileUseCustom] = useState(false);
  const [profileMethod, setProfileMethod] = useState<PaymentMethod>('Transfer BCA');
  const [profileBankName, setProfileBankName] = useState('');
  const [profileAccountNumber, setProfileAccountNumber] = useState('');
  const [profileAccountHolder, setProfileAccountHolder] = useState('');
  const [profilePaymentUrl, setProfilePaymentUrl] = useState('');
  const [profileAutoPdf, setProfileAutoPdf] = useState(true);
  const [profileAutoWa, setProfileAutoWa] = useState(true);
  const [profileCustomNote, setProfileCustomNote] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);

  // Tenant Inline Editor State
  const [editingTenant, setEditingTenant] = useState(false);
  const [tName, setTName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tInstitution, setTInstitution] = useState('');
  const [tOriginCity, setTOriginCity] = useState('');
  const [tCheckInDate, setTCheckInDate] = useState('');
  const [tDueDay, setTDueDay] = useState(10);
  const [tEmergency, setTEmergency] = useState('');
  const [tDepositAmount, setTDepositAmount] = useState(0);
  const [tDepositStatus, setTDepositStatus] = useState<DepositStatus>('Disimpan');
  const [tNotes, setTNotes] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  // Maintenance Form State
  const [addingMnt, setAddingMnt] = useState(false);
  const [mntTitle, setMntTitle] = useState('');
  const [mntCat, setMntCat] = useState<MaintenanceCategory>('AC');
  const [mntStatus, setMntStatus] = useState<MaintenanceStatus>('Dilaporkan');
  const [mntCost, setMntCost] = useState(0);
  const [mntDate, setMntDate] = useState(getTodayISO());
  const [mntNotes, setMntNotes] = useState('');
  const [savingMnt, setSavingMnt] = useState(false);

  const activeRoomTypes = roomTypes.length > 0 ? roomTypes : DEFAULT_ROOM_TYPES;
  const matchedType = room
    ? activeRoomTypes.find((rt) => rt.tier === room.tier) ?? activeRoomTypes[0]
    : undefined;

  useEffect(() => {
    if (!room) return;
    setActiveTab('info');
    setUnitName(room.name?.trim() || `Kamar ${room.number}`);
    setUnitTier(room.tier);
    setUnitRate(room.monthlyRate);
    setUnitStatus(room.status);
    setEditingUnit(false);
    setEditingProfile(false);
    setConfirmCheckOut(false);
    setConfirmDeleteRoom(false);
    setEditingTenant(false);
    setAddingMnt(false);

    const rp = room.receiptProfile;
    setProfileUseCustom(Boolean(rp?.useCustom));
    setProfileMethod(rp?.preferredMethod ?? 'Transfer BCA');
    setProfileBankName(rp?.bankName ?? settings.paymentBankName ?? '');
    setProfileAccountNumber(rp?.accountNumber ?? settings.paymentBankAccount ?? '');
    setProfileAccountHolder(rp?.accountHolder ?? settings.paymentBankHolder ?? '');
    setProfilePaymentUrl(rp?.customPaymentUrl ?? '');
    setProfileAutoPdf(
      rp ? Boolean(rp.autoPdfOnPaid) : receiptTemplate.autoGeneratePdfOnPaid
    );
    setProfileAutoWa(
      rp ? Boolean(rp.autoOpenWaOnPaid) : receiptTemplate.autoOpenWaOnPaid
    );
    setProfileCustomNote(rp?.customReceiptNote ?? '');

    if (room.tenant) {
      setTName(room.tenant.name);
      setTPhone(room.tenant.phone);
      setTInstitution(room.tenant.institution);
      setTOriginCity(room.tenant.originCity);
      setTCheckInDate(room.tenant.checkInDate);
      setTDueDay(room.tenant.dueDay);
      setTEmergency(room.tenant.emergencyContact);
      setTDepositAmount(room.tenant.depositAmount ?? 0);
      setTDepositStatus(room.tenant.depositStatus ?? 'Disimpan');
      setTNotes(room.tenant.notes ?? '');
    }
  }, [room, settings, receiptTemplate]);

  if (!room) return null;

  const resolvedProfile = resolveRoomPaymentProfile(room, settings, receiptTemplate);

  const isOccupied = room.status === 'Terisi' && room.tenant;
  const displayName = getRoomDisplayName(room);
  const panelLabel = matchedType?.displayName?.trim() || room.tier;
  const galleryImages =
    matchedType?.images && matchedType.images.length > 0
      ? matchedType.images
      : [{ url: matchedType?.imageUrl || ROOM_DELUXE_IMG, label: panelLabel }];

  const roomMaintenance = maintenanceLogs.filter(
    (m) => m.roomId === room.id || m.roomNumber === room.number
  );
  const roomHistory = tenantHistory.filter(
    (h) => h.roomId === room.id || h.roomNumber === room.number
  );

  const handleTierSelect = (nextTier: RoomTier) => {
    setUnitTier(nextTier);
    const preset = activeRoomTypes.find((rt) => rt.tier === nextTier);
    if (preset) {
      setUnitRate(preset.monthlyRate);
    }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUnit(true);
    try {
      const preset = activeRoomTypes.find((rt) => rt.tier === unitTier);
      const trimmedName = unitName.trim();
      const defaultName = `Kamar ${room.number}`;
      await onUpdateRoomUnit(room.id, {
        name: trimmedName && trimmedName !== defaultName ? trimmedName : '',
        tier: unitTier,
        monthlyRate: unitRate,
        areaSqm: preset?.areaSqm ?? room.areaSqm,
        facilities: preset?.facilities ?? room.facilities,
        status: isOccupied ? 'Terisi' : unitStatus,
      });
      setEditingUnit(false);
    } finally {
      setSavingUnit(false);
    }
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tName.trim()) return;
    setSavingTenant(true);
    try {
      await onUpdateTenant(room.id, room.number, {
        name: tName.trim(),
        phone: tPhone.trim() || '-',
        institution: tInstitution.trim() || '-',
        originCity: tOriginCity.trim() || '-',
        checkInDate: tCheckInDate || getTodayISO(),
        dueDay: tDueDay,
        emergencyContact: tEmergency.trim() || '-',
        depositAmount: tDepositAmount > 0 ? tDepositAmount : undefined,
        depositStatus: tDepositAmount > 0 ? tDepositStatus : undefined,
        notes: tNotes.trim() || undefined,
      });
      setEditingTenant(false);
    } finally {
      setSavingTenant(false);
    }
  };

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mntTitle.trim()) return;
    setSavingMnt(true);
    try {
      await onAddMaintenanceLog({
        roomId: room.id,
        roomNumber: room.number,
        title: mntTitle.trim(),
        category: mntCat,
        status: mntStatus,
        cost: mntCost,
        reportedDate: mntDate,
        notes: mntNotes.trim() || undefined,
      });
      setMntTitle('');
      setMntCost(0);
      setMntNotes('');
      setAddingMnt(false);
    } finally {
      setSavingMnt(false);
    }
  };

  const handleCycleMaintenanceStatus = async (log: MaintenanceLog) => {
    const nextStatus: MaintenanceStatus =
      log.status === 'Dilaporkan'
        ? 'Diproses'
        : log.status === 'Diproses'
        ? 'Selesai'
        : 'Dilaporkan';
    await onUpdateMaintenanceLog(log.id, {
      title: log.title,
      category: log.category,
      status: nextStatus,
      cost: log.cost,
      reportedDate: log.reportedDate,
      notes: log.notes,
    });
  };

  const handleSaveReceiptProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onSaveRoomReceiptProfile(room.id, {
        useCustom: profileUseCustom,
        preferredMethod: profileMethod,
        bankName: profileBankName.trim() || undefined,
        accountNumber: profileAccountNumber.trim() || undefined,
        accountHolder: profileAccountHolder.trim() || undefined,
        customPaymentUrl: profilePaymentUrl.trim() || undefined,
        autoPdfOnPaid: profileAutoPdf,
        autoOpenWaOnPaid: profileAutoWa,
        customReceiptNote: profileCustomNote.trim() || undefined,
      });
      setEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!currentMonthPayment) return;
    setCreatingLink(true);
    try {
      await onCreateAndCopyPaymentLink(currentMonthPayment, room);
    } finally {
      setCreatingLink(false);
    }
  };

  // Build WA message using saved template
  const dueInfo =
    currentMonthPayment && room.tenant
      ? getDueStatusInfo(currentMonthPayment.month, room.tenant.dueDay)
      : null;

  const activeTemplates = templates.length > 0 ? templates : DEFAULT_MESSAGE_TEMPLATES;
  const preferredTpl =
    dueInfo?.tone === 'overdue'
      ? activeTemplates.find((t) => t.category === 'tunggakan') ?? activeTemplates[0]
      : activeTemplates.find((t) => t.category === 'tagihan') ?? activeTemplates[0];

  const reminderMessage =
    room.tenant && currentMonthPayment
      ? renderMessageTemplate(preferredTpl.body, {
          settings,
          room,
          payment: currentMonthPayment,
          month: currentMonthPayment.month,
          paymentUrl: currentMonthPayment.paymentLinkId
            ? buildShareablePaymentUrl(currentMonthPayment.paymentLinkId)
            : undefined,
        })
      : '';
  const waUrl = room.tenant
    ? buildWhatsAppUrl(room.tenant.phone, reminderMessage)
    : '#';

  const billTotal = currentMonthPayment
    ? currentMonthPayment.amount + (currentMonthPayment.lateFee ?? 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Detail ${displayName}`}
        className="relative z-10 w-full max-w-md h-full bg-white dark:bg-[#0f1a1e] border-l border-slate-200 dark:border-white/[0.08] shadow-xl flex flex-col overflow-hidden animate-drawer-in"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Unit {room.number} · {panelLabel} · {room.areaSqm} m²
            </p>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white truncate">
              {displayName}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('info');
                setEditingUnit((v) => !v);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.12] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors whitespace-nowrap"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Ubah Kamar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              aria-label="Tutup panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Segmented Tabs */}
        <div className="px-6 pt-3 pb-2.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'info'
                ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-200'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            Info &amp; Tagihan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-200'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Wrench className="w-3 h-3" />
            <span>Perawatan ({roomMaintenance.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-200'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            <History className="w-3 h-3" />
            <span>Riwayat ({roomHistory.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'info' && (
            <>
              {/* Inline Unit Name / Tier / Rate / Status / Delete Editor */}
              {editingUnit && (
                <form
                  onSubmit={handleSaveUnit}
                  className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.09] space-y-3"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Ubah Nama, Tipe &amp; Tarif Unit {room.number}
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Nama Kamar
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder={`Kamar ${room.number}`}
                      className="w-full px-2.5 py-2 rounded-lg input-surface border text-xs font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Tipe Kamar
                      </label>
                      <select
                        value={unitTier}
                        onChange={(e) => handleTierSelect(e.target.value as RoomTier)}
                        className="w-full px-2.5 py-2 rounded-lg input-surface border text-xs"
                      >
                        <option value="Tipe A">Tipe A</option>
                        <option value="Tipe B">Tipe B</option>
                        <option value="Tipe C">Tipe C</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Tarif / Bulan (Rp)
                      </label>
                      <CurrencyInput
                        compact
                        value={unitRate}
                        onChange={setUnitRate}
                        aria-label="Tarif per Bulan (Rp)"
                        className="w-full pr-2.5 py-2 rounded-lg input-surface border font-mono-num text-xs"
                      />
                    </div>
                  </div>

                  {!isOccupied && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Status Unit
                      </label>
                      <select
                        value={unitStatus}
                        onChange={(e) => setUnitStatus(e.target.value as RoomStatus)}
                        className="w-full px-2.5 py-2 rounded-lg input-surface border text-xs"
                      >
                        <option value="Tersedia">Tersedia (Siap Huni)</option>
                        <option value="Perawatan">Perawatan (Sedang Diperbaiki)</option>
                      </select>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {!isOccupied ? (
                      !confirmDeleteRoom ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoom(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Unit</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteRoomUnit(room.id);
                              onClose();
                            }}
                            className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-medium"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRoom(false)}
                            className="px-2 py-1 rounded border border-slate-300 dark:border-white/15 text-[11px]"
                          >
                            Batal
                          </button>
                        </div>
                      )
                    ) : (
                      <span />
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingUnit(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs font-medium text-slate-600 dark:text-slate-300"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={savingUnit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-primary text-xs font-medium"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingUnit ? 'Menyimpan...' : 'Simpan Unit'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Gallery Slider + Rate Summary */}
              <div className="space-y-3">
                <RoomPhotoSlider
                  images={galleryImages}
                  title={displayName}
                  className="aspect-[4/3] w-full rounded-xl border border-slate-200 dark:border-white/[0.08]"
                />

                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08]">
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tarif Sewa Bulanan
                    </p>
                    <p className="font-mono-num text-base font-semibold text-slate-900 dark:text-white">
                      {formatIDR(room.monthlyRate)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      room.status === 'Tersedia'
                        ? 'text-teal-700 dark:text-teal-300'
                        : room.status === 'Perawatan'
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {room.status}
                  </span>
                </div>

                {matchedType?.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {matchedType.description}
                  </p>
                )}
              </div>

              {/* Tenant Dossier OR Empty Room CTA */}
              {isOccupied && room.tenant ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Profil Penyewa Aktif
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingTenant((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>{editingTenant ? 'Tutup Edit' : 'Edit Penyewa'}</span>
                    </button>
                  </div>

                  {editingTenant ? (
                    <form
                      onSubmit={handleSaveTenant}
                      className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.09] space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Nama Lengkap *
                          </label>
                          <input
                            type="text"
                            required
                            value={tName}
                            onChange={(e) => setTName(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            No. WhatsApp
                          </label>
                          <input
                            type="tel"
                            value={tPhone}
                            onChange={(e) => setTPhone(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Kampus / Instansi
                          </label>
                          <input
                            type="text"
                            value={tInstitution}
                            onChange={(e) => setTInstitution(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Kota Asal
                          </label>
                          <input
                            type="text"
                            value={tOriginCity}
                            onChange={(e) => setTOriginCity(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Tgl Masuk
                          </label>
                          <input
                            type="date"
                            value={tCheckInDate}
                            onChange={(e) => setTCheckInDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Tgl Jatuh Tempo (1-28)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            value={tDueDay}
                            onChange={(e) => setTDueDay(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Kontak Darurat
                        </label>
                        <input
                          type="text"
                          value={tEmergency}
                          onChange={(e) => setTEmergency(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Deposit (Rp)
                          </label>
                          <CurrencyInput
                            compact
                            value={tDepositAmount}
                            onChange={setTDepositAmount}
                            aria-label="Deposit (Rp)"
                            className="w-full pr-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">
                            Status Deposit
                          </label>
                          <select
                            value={tDepositStatus}
                            disabled={tDepositAmount <= 0}
                            onChange={(e) =>
                              setTDepositStatus(e.target.value as DepositStatus)
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs disabled:opacity-50"
                          >
                            <option value="Disimpan">Disimpan</option>
                            <option value="Belum Bayar">Belum Bayar</option>
                            <option value="Dikembalikan">Dikembalikan</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Catatan Penyewa
                        </label>
                        <input
                          type="text"
                          maxLength={300}
                          value={tNotes}
                          onChange={(e) => setTNotes(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingTenant(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={savingTenant}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg btn-primary text-xs font-medium"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingTenant ? 'Menyimpan...' : 'Simpan Profil'}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <p className="font-display font-semibold text-base text-slate-900 dark:text-white">
                          {room.tenant.name}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                          {room.tenant.institution}
                        </p>
                      </div>

                      <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span className="font-mono-num">{room.tenant.phone}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>Asal: {room.tenant.originCity}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                          <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>
                            Masuk {formatDateID(room.tenant.checkInDate)} · Jatuh tempo tgl{' '}
                            <span className="font-mono-num font-medium text-slate-900 dark:text-white">
                              {room.tenant.dueDay}
                            </span>
                          </span>
                        </div>
                        {typeof room.tenant.depositAmount === 'number' &&
                          room.tenant.depositAmount > 0 && (
                            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                              <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                              <span>
                                Deposit:{' '}
                                <span className="font-mono-num font-medium text-slate-900 dark:text-white">
                                  {formatIDR(room.tenant.depositAmount)}
                                </span>{' '}
                                · {room.tenant.depositStatus ?? 'Disimpan'}
                              </span>
                            </div>
                          )}
                      </div>

                      <div className="p-3.5 rounded-lg bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-xs space-y-1">
                        <p className="text-slate-500 dark:text-slate-400">Kontak Darurat</p>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {room.tenant.emergencyContact}
                        </p>
                        {room.tenant.notes && (
                          <p className="text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/80 dark:border-white/[0.06] mt-1.5">
                            Catatan: {room.tenant.notes}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Current Month Billing Status */}
                  {currentMonthPayment && (
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] pb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Tagihan {formatMonthYear(currentMonthPayment.month)}
                        </h3>
                        <span
                          className={`text-xs font-medium ${
                            currentMonthPayment.status === 'Lunas'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : dueInfo?.tone === 'overdue'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {currentMonthPayment.status === 'Lunas'
                            ? 'Lunas'
                            : dueInfo?.label ?? 'Belum Bayar'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                          Total Tagihan
                          {(currentMonthPayment.lateFee ?? 0) > 0 && (
                            <span className="text-xs text-rose-600 dark:text-rose-400 ml-1">
                              (+Denda {formatIDR(currentMonthPayment.lateFee ?? 0)})
                            </span>
                          )}
                        </span>
                        <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                          {formatIDR(billTotal)}
                        </span>
                      </div>

                      {currentMonthPayment.status === 'Lunas' ? (
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(currentMonthPayment)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-sm font-medium transition-colors"
                        >
                          <ReceiptText className="w-4 h-4" />
                          <span>Lihat &amp; Unduh Kwitansi PDF</span>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => onMarkPaid(currentMonthPayment.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg btn-primary text-sm font-medium transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Tandai Lunas &amp; Terbitkan PDF</span>
                          </button>
                          <button
                            type="button"
                            disabled={creatingLink}
                            onClick={handleCopyPaymentLink}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                            <span>
                              {creatingLink
                                ? 'Menyiapkan Link...'
                                : currentMonthPayment.paymentLinkId
                                ? 'Salin Link Pembayaran (Bank/QRIS)'
                                : 'Buat & Salin Link Pembayaran'}
                            </span>
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onCopyReminder(room, billTotal, currentMonthPayment)
                              }
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Pesan</span>
                            </button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-teal-700 dark:text-teal-300 text-xs font-medium transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Kirim WA</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : room.status === 'Perawatan' ? (
                <div className="p-5 rounded-xl bg-amber-50/50 dark:bg-amber-500/[0.06] border border-amber-200/90 dark:border-amber-500/25 space-y-3">
                  <p className="font-display font-semibold text-base text-slate-900 dark:text-white">
                    Unit Sedang Dalam Perawatan
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Kamar {room.number} ditandai sedang dalam perbaikan. Ubah status ke Tersedia
                    saat unit sudah siap dihuni kembali.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRoomUnit(room.id, {
                        name: room.name,
                        tier: room.tier,
                        monthlyRate: room.monthlyRate,
                        areaSqm: room.areaSqm,
                        facilities: room.facilities,
                        status: 'Tersedia',
                      })
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-sm font-medium transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tandai Siap Huni (Tersedia)</span>
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] space-y-3">
                  <p className="font-display font-semibold text-base text-slate-900 dark:text-white">
                    Unit Siap Huni
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {displayName} dalam kondisi bersih dan siap ditempati penyewa baru. Klik tombol
                    di bawah untuk mencatat data penyewa masuk.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCheckIn(room.number);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-sm font-medium transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Check-In Penyewa Baru</span>
                  </button>
                </div>
              )}

              {/* Profil Pembayaran & Otomasi Kwitansi Per Kamar */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Profil Pembayaran &amp; Kwitansi Kamar
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProfile((v) => !v)}
                    className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline"
                  >
                    {editingProfile ? 'Tutup' : 'Atur Profil'}
                  </button>
                </div>

                {!editingProfile ? (
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p>
                      Mode:{' '}
                      <span className="font-medium text-slate-900 dark:text-white">
                        {resolvedProfile.useCustom
                          ? `Khusus Kamar (${resolvedProfile.preferredMethod})`
                          : 'Ikuti Default Properti'}
                      </span>
                    </p>
                    <p className="truncate">
                      Saluran: <span className="font-medium">{resolvedProfile.accountSummary}</span>
                    </p>
                    <p>
                      Auto-PDF Lunas:{' '}
                      <span className="font-medium text-teal-700 dark:text-teal-300">
                        {resolvedProfile.autoPdfOnPaid ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {resolvedProfile.customReceiptNote && (
                        <> · Catatan: &ldquo;{resolvedProfile.customReceiptNote}&rdquo;</>
                      )}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveReceiptProfile} className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProfileUseCustom(false)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          !profileUseCustom
                            ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-600/40 text-teal-800 dark:text-teal-200'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Default Properti
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileUseCustom(true)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          profileUseCustom
                            ? 'bg-teal-50 dark:bg-teal-500/15 border-teal-600/40 text-teal-800 dark:text-teal-200'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Profil Khusus Kamar
                      </button>
                    </div>

                    {profileUseCustom && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Metode Pembayaran Utama Kamar
                          </label>
                          <select
                            value={profileMethod}
                            onChange={(e) =>
                              setProfileMethod(e.target.value as PaymentMethod)
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                          >
                            <option value="Transfer BCA">Transfer BCA</option>
                            <option value="QRIS">QRIS</option>
                            <option value="Transfer Mandiri">Transfer Mandiri</option>
                            <option value="Tunai">Tunai</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Nama Bank
                            </label>
                            <input
                              type="text"
                              maxLength={50}
                              placeholder="BCA / Mandiri"
                              value={profileBankName}
                              onChange={(e) => setProfileBankName(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              No. Rekening
                            </label>
                            <input
                              type="text"
                              maxLength={60}
                              placeholder="5420-8812-30"
                              value={profileAccountNumber}
                              onChange={(e) => setProfileAccountNumber(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Atas Nama Rekening
                          </label>
                          <input
                            type="text"
                            maxLength={80}
                            value={profileAccountHolder}
                            onChange={(e) => setProfileAccountHolder(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Link Pembayaran Khusus Kamar (opsional)
                          </label>
                          <input
                            type="url"
                            maxLength={300}
                            placeholder="https://..."
                            value={profilePaymentUrl}
                            onChange={(e) => setProfilePaymentUrl(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                          />
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={profileAutoPdf}
                              onChange={(e) => setProfileAutoPdf(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>Auto-generate PDF saat lunas</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={profileAutoWa}
                              onChange={(e) => setProfileAutoWa(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span>Siapkan kirim kwitansi ke WA saat lunas</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Catatan Khusus Tercetak di Kwitansi PDF Kamar Ini
                      </label>
                      <input
                        type="text"
                        maxLength={240}
                        placeholder="Misal: Termasuk parkir motor & listrik token"
                        value={profileCustomNote}
                        onChange={(e) => setProfileCustomNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingProfile(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg btn-primary text-xs font-medium"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingProfile ? 'Menyimpan...' : 'Simpan Profil'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Facilities List */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Fasilitas Termasuk
                </h3>
                <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-300">
                  {room.facilities.map((fac) => (
                    <li
                      key={fac}
                      className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/[0.04] last:border-0"
                    >
                      <span>{fac}</span>
                      <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                        Tersedia
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                    Catatan Perawatan &amp; Komplain
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Riwayat perbaikan AC, listrik, sanitasi, atau kunci unit
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingMnt((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg btn-primary text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat</span>
                </button>
              </div>

              {addingMnt && (
                <form
                  onSubmit={handleAddMaintenance}
                  className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.09] space-y-3"
                >
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Keluhan / Pekerjaan *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      placeholder="Contoh: Cuci AC Split & tambah freon"
                      value={mntTitle}
                      onChange={(e) => setMntTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Kategori
                      </label>
                      <select
                        value={mntCat}
                        onChange={(e) =>
                          setMntCat(e.target.value as MaintenanceCategory)
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                      >
                        {MAINTENANCE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        value={mntStatus}
                        onChange={(e) =>
                          setMntStatus(e.target.value as MaintenanceStatus)
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                      >
                        <option value="Dilaporkan">Dilaporkan</option>
                        <option value="Diproses">Diproses</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Estimasi Biaya (Rp)
                      </label>
                      <CurrencyInput
                        compact
                        value={mntCost}
                        onChange={setMntCost}
                        aria-label="Estimasi Biaya (Rp)"
                        className="w-full pr-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Tanggal
                      </label>
                      <input
                        type="date"
                        value={mntDate}
                        onChange={(e) => setMntDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg input-surface border font-mono-num text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Catatan (Opsional)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={mntNotes}
                      onChange={(e) => setMntNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg input-surface border text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingMnt(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingMnt}
                      className="px-3 py-1.5 rounded-lg btn-primary text-xs font-medium"
                    >
                      {savingMnt ? 'Menyimpan...' : 'Simpan Catatan'}
                    </button>
                  </div>
                </form>
              )}

              {roomMaintenance.length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-white/[0.12] rounded-xl">
                  <Wrench className="w-7 h-7 text-teal-600 dark:text-teal-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Belum ada catatan perawatan di {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Klik tombol Catat jika ada perbaikan AC, keran, atau keluhan penyewa.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {roomMaintenance.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {log.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {log.category} · {formatDateID(log.reportedDate)}
                            {log.cost > 0 ? ` · ${formatIDR(log.cost)}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteMaintenanceLog(log.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                          title="Hapus catatan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {log.notes && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {log.notes}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t border-teal-900/[0.06] dark:border-white/[0.06]">
                        <span
                          className={`text-[11px] font-medium ${
                            log.status === 'Selesai'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : log.status === 'Diproses'
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          Status: {log.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCycleMaintenanceStatus(log)}
                          className="text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
                        >
                          Ubah ke{' '}
                          {log.status === 'Dilaporkan'
                            ? 'Diproses'
                            : log.status === 'Diproses'
                            ? 'Selesai'
                            : 'Dilaporkan'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                  Riwayat Penghuni Sebelumnya
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Arsip otomatis setiap kali penyewa melakukan check-out dari unit ini
                </p>
              </div>

              {roomHistory.length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-white/[0.12] rounded-xl">
                  <History className="w-7 h-7 text-teal-600 dark:text-teal-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Belum ada riwayat penghuni lama
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Penghuni yang check-out akan tercatat otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {roomHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </p>
                        <span className="font-mono-num text-[11px] text-teal-700 dark:text-teal-300">
                          {formatIDR(item.monthlyRate)}/bln
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.institution || '-'} · {item.originCity || '-'}
                      </p>
                      <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateID(item.checkInDate)} → {formatDateID(item.checkOutDate)} ·{' '}
                        {item.phone}
                      </p>
                      {typeof item.depositAmount === 'number' && item.depositAmount > 0 && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Deposit: {formatIDR(item.depositAmount)} ({item.depositStatus ?? 'Dikembalikan'})
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Catatan: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions for Occupied Room */}
        {isOccupied && activeTab === 'info' && (
          <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#0c161a]">
            {!confirmCheckOut ? (
              <button
                type="button"
                onClick={() => setConfirmCheckOut(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Proses Check-Out Penyewa</span>
              </button>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">
                  Yakin mengosongkan {displayName} atas nama {room.tenant?.name}? Data akan
                  diarsipkan ke Riwayat Penghuni.
                </p>
                {typeof room.tenant?.depositAmount === 'number' &&
                  room.tenant.depositAmount > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-300">
                        Deposit ({formatIDR(room.tenant.depositAmount)}):
                      </span>
                      <select
                        value={checkoutDepositStatus}
                        onChange={(e) =>
                          setCheckoutDepositStatus(e.target.value as DepositStatus)
                        }
                        className="px-2 py-1 rounded input-surface border text-xs"
                      >
                        <option value="Dikembalikan">Dikembalikan ke Penyewa</option>
                        <option value="Disimpan">Dipotong / Disimpan</option>
                      </select>
                    </div>
                  )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCheckOut(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/[0.1] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setConfirmCheckOut(false);
                      await onCheckOut(room, checkoutDepositStatus);
                    }}
                    className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                  >
                    Ya, Kosongkan Kamar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
