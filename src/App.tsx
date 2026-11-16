/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './firebase';
import {
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_ROOM_TYPES,
  DEFAULT_SETTINGS,
  getRoomDisplayName,
  HISTORICAL_CASHFLOW,
  INITIAL_ROOMS,
  normalizeRoomTier,
} from './data/initialData';
import {
  AdminInvite,
  AdminUser,
  DepositStatus,
  ExpenseCategory,
  ExpenseRecord,
  MaintenanceCategory,
  MaintenanceLog,
  MaintenanceStatus,
  MessageTemplate,
  MessageTemplateCategory,
  MonthlyHistoricalSummary,
  NavPage,
  PaymentLinkRecord,
  PaymentLinkStatus,
  PaymentMethod,
  PaymentRecord,
  PropertySettings,
  ReceiptAccentTheme,
  ReceiptTemplateConfig,
  Room,
  RoomGalleryImage,
  RoomReceiptProfile,
  RoomStatus,
  RoomTier,
  RoomTypeConfig,
  RoomTypeId,
  Tenant,
  TenantHistoryRecord,
} from './types/kost';
import {
  addAdminInviteInCloud,
  addExpenseInCloud,
  addMaintenanceLogInCloud,
  addRoomUnitInCloud,
  checkInTenantToCloud,
  checkIsAdminUser,
  checkOutTenantInCloud,
  createOrSyncPaymentLinkInCloud,
  deleteExpenseInCloud,
  deleteMaintenanceLogInCloud,
  deleteMessageTemplateInCloud,
  deleteRoomUnitInCloud,
  generateMonthlyBillsInCloud,
  markPaymentPaidInCloud,
  registerAdminInCloud,
  removeAdminInviteInCloud,
  removeRegisteredAdminInCloud,
  resetDatabaseToDemo,
  saveMessageTemplateInCloud,
  saveReceiptTemplateInCloud,
  saveRoomTypeConfigInCloud,
  saveSettingsInCloud,
  seedInitialDatabaseIfEmpty,
  updateAdminRoleInCloud,
  updateMaintenanceLogInCloud,
  updatePaymentDetailsInCloud,
  updateRoomReceiptProfileInCloud,
  updateRoomUnitInCloud,
  updateTenantInCloud,
  upsertPaymentInCloud,
} from './services/kostFirestore';
import {
  formatMonthYear,
  formatShortMonth,
  getCurrentMonthISO,
  getDueStatusInfo,
} from './utils/format';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  renderMessageTemplate,
} from './utils/messageTemplates';
import {
  buildPdfReceiptInputFromAdmin,
  buildShareablePaymentUrl,
  downloadReceiptPdf,
  resolveRoomPaymentProfile,
} from './utils/receiptPdf';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Toast } from './components/Toast';
import { DashboardView } from './components/DashboardView';
import { RoomsView } from './components/RoomsView';
import { PaymentsView } from './components/PaymentsView';
import { FinanceView } from './components/FinanceView';
import { MessagesView } from './components/MessagesView';
import { SettingsView } from './components/SettingsView';
import { RoomDrawer } from './components/RoomDrawer';
import { CheckInModal } from './components/CheckInModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ReceiptFormatModal } from './components/ReceiptFormatModal';
import { PublicPaymentView } from './components/PublicPaymentView';
import { AddPaymentModal } from './components/AddPaymentModal';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AddRoomModal } from './components/AddRoomModal';
import { RoomTypeModal } from './components/RoomTypeModal';
import { LoginView } from './components/LoginView';

interface RoomUnitDoc {
  id: string;
  number: string;
  name?: string;
  floor: number;
  tier: RoomTier;
  monthlyRate: number;
  areaSqm: number;
  facilities: string[];
  status: RoomStatus;
  receiptProfile?: RoomReceiptProfile;
}

export default function App() {
  const activeMonth = useMemo(() => getCurrentMonthISO(), []);
  const publicPayLinkId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('bayar')?.trim() || '';
  }, []);

  // Auth & Admin Access State
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginInfo, setLoginInfo] = useState<string | null>(null);
  const [cloudBootstrapped, setCloudBootstrapped] = useState(false);

  // Navigation & Modals
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedPaymentMonth, setSelectedPaymentMonth] = useState(activeMonth);
  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState(activeMonth);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInPreselectedRoom, setCheckInPreselectedRoom] = useState<string | null>(null);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [addRoomModalOpen, setAddRoomModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRecord | null>(null);
  const [receiptFormatModalOpen, setReceiptFormatModalOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomTypeConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cloud-backed Admin State
  const [roomUnits, setRoomUnits] = useState<RoomUnitDoc[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeConfig[]>(DEFAULT_ROOM_TYPES);
  const [tenantsByRoomId, setTenantsByRoomId] = useState<Record<string, Tenant>>({});
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentLinksById, setPaymentLinksById] = useState<
    Record<string, PaymentLinkRecord>
  >({});
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(
    DEFAULT_MESSAGE_TEMPLATES
  );
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateConfig>(
    DEFAULT_RECEIPT_TEMPLATE
  );
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [tenantHistory, setTenantHistory] = useState<TenantHistoryRecord[]>([]);
  const [registeredAdmins, setRegisteredAdmins] = useState<AdminUser[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [settings, setSettings] = useState<PropertySettings>(DEFAULT_SETTINGS);

  // Test Firestore connection on boot
  useEffect(() => {
    if (publicPayLinkId) return;
    testFirestoreConnection();
  }, [publicPayLinkId]);

  // Auth listener
  useEffect(() => {
    if (publicPayLinkId) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (!user.emailVerified) {
          setIsAdmin(false);
          setCloudBootstrapped(false);
          setAuthReady(true);
          return;
        }
        setAuthChecking(true);
        try {
          const allowed = await checkIsAdminUser(user.email, user.uid);
          setIsAdmin(allowed);
          if (allowed) {
            await seedInitialDatabaseIfEmpty();
            setCloudBootstrapped(true);
          }
        } catch (err) {
          console.error('Auth/bootstrap error:', err);
          setLoginError(
            'Terjadi kendala saat menyiapkan database cloud. Silakan muat ulang halaman.'
          );
        } finally {
          setAuthChecking(false);
        }
      } else {
        setIsAdmin(false);
        setCloudBootstrapped(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [publicPayLinkId]);

  // Admin-only Firestore listeners
  useEffect(() => {
    if (publicPayLinkId || !authReady || !currentUser || !isAdmin) {
      setRoomUnits([]);
      setTenantsByRoomId({});
      setPayments([]);
      setPaymentLinksById({});
      setExpenses([]);
      setMaintenanceLogs([]);
      setTenantHistory([]);
      setRegisteredAdmins([]);
      setAdminInvites([]);
      return;
    }

    const unsubRooms = onSnapshot(
      collection(db, 'rooms'),
      (snap) => {
        const list: RoomUnitDoc[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              number: String(data.number ?? ''),
              name: data.name ? String(data.name) : undefined,
              floor: Math.max(1, Number(data.floor ?? 1)),
              tier: normalizeRoomTier(data.tier),
              monthlyRate: Number(data.monthlyRate ?? 1750000),
              areaSqm: Number(data.areaSqm ?? 12),
              facilities: Array.isArray(data.facilities) ? data.facilities.map(String) : [],
              status: (data.status ?? 'Tersedia') as RoomStatus,
              receiptProfile: data.receiptProfile
                ? (data.receiptProfile as RoomReceiptProfile)
                : undefined,
            };
          })
          .sort((a, b) => a.number.localeCompare(b.number));
        setRoomUnits(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'rooms')
    );

    const unsubRoomTypes = onSnapshot(
      collection(db, 'roomTypes'),
      (snap) => {
        if (snap.empty) {
          setRoomTypes(DEFAULT_ROOM_TYPES);
          return;
        }
        const byId = new Map<string, RoomTypeConfig>();
        for (const fallback of DEFAULT_ROOM_TYPES) {
          byId.set(fallback.id, fallback);
        }
        snap.docs.forEach((d) => {
          const data = d.data();
          const typeId = d.id as RoomTypeId;
          const fallback =
            DEFAULT_ROOM_TYPES.find((item) => item.id === typeId) ?? DEFAULT_ROOM_TYPES[0];
          const rawImages = Array.isArray(data.images)
            ? (data.images as Array<{ url?: unknown; label?: unknown }>)
                .filter((item) => item && typeof item.url === 'string' && item.url.trim())
                .map((item, idx) => ({
                  url: String(item.url),
                  label: String(item.label ?? `Foto ${idx + 1}`),
                }))
            : [];
          const coverUrl = String(data.imageUrl ?? fallback.imageUrl);
          const mergedImages: RoomGalleryImage[] =
            rawImages.length > 0
              ? rawImages
              : coverUrl && coverUrl !== fallback.imageUrl
              ? [{ url: coverUrl, label: 'Foto Utama' }, ...fallback.images.slice(1)]
              : fallback.images;

          byId.set(typeId, {
            id: typeId,
            tier: normalizeRoomTier(data.tier ?? fallback.tier),
            displayName: data.displayName
              ? String(data.displayName)
              : fallback.displayName ?? fallback.tier,
            subtitle: String(data.subtitle ?? fallback.subtitle),
            monthlyRate: Number(data.monthlyRate ?? fallback.monthlyRate),
            areaSqm: Number(data.areaSqm ?? fallback.areaSqm),
            description: String(data.description ?? fallback.description),
            imageUrl: mergedImages[0]?.url ?? coverUrl,
            images: mergedImages,
            facilities:
              Array.isArray(data.facilities) && data.facilities.length > 0
                ? data.facilities.map(String)
                : fallback.facilities,
          });
        });
        const ordered: RoomTypeId[] = ['tipe-a', 'tipe-b', 'tipe-c'];
        setRoomTypes(ordered.map((id) => byId.get(id)!).filter(Boolean));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'roomTypes')
    );

    const unsubPropSettings = onSnapshot(
      doc(db, 'settings', 'property'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setSettings((prev) => ({
          ...prev,
          name: String(data.name ?? prev.name),
          tagline: String(data.tagline ?? prev.tagline),
          address: String(data.address ?? prev.address),
          whatsappAdmin: String(data.whatsappAdmin ?? prev.whatsappAdmin),
          paymentAccountInfo: String(
            data.paymentAccountInfo ?? prev.paymentAccountInfo
          ),
          paymentBankName: String(data.paymentBankName ?? prev.paymentBankName),
          paymentBankAccount: String(
            data.paymentBankAccount ?? prev.paymentBankAccount
          ),
          paymentBankHolder: String(
            data.paymentBankHolder ?? prev.paymentBankHolder
          ),
          qrisImageUrl: String(data.qrisImageUrl ?? prev.qrisImageUrl),
          externalPaymentLink: String(
            data.externalPaymentLink ?? prev.externalPaymentLink
          ),
          defaultDueDay: Number(data.defaultDueDay ?? prev.defaultDueDay),
          totalRooms: Number(data.totalRooms ?? prev.totalRooms),
        }));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/property')
    );

    const unsubReceiptSettings = onSnapshot(
      doc(db, 'settings', 'receipt'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setReceiptTemplate({
          title: String(data.title ?? DEFAULT_RECEIPT_TEMPLATE.title),
          subtitle: String(data.subtitle ?? DEFAULT_RECEIPT_TEMPLATE.subtitle),
          accentTheme: (['teal', 'navy', 'slate'].includes(String(data.accentTheme))
            ? String(data.accentTheme)
            : 'teal') as ReceiptAccentTheme,
          includedItemsText: String(
            data.includedItemsText ?? DEFAULT_RECEIPT_TEMPLATE.includedItemsText
          ),
          footerNote: String(data.footerNote ?? DEFAULT_RECEIPT_TEMPLATE.footerNote),
          signerLabel: String(
            data.signerLabel ?? DEFAULT_RECEIPT_TEMPLATE.signerLabel
          ),
          showLogo: Boolean(data.showLogo ?? true),
          showAddress: Boolean(data.showAddress ?? true),
          showQrVerification: Boolean(data.showQrVerification ?? true),
          showDepositInfo: Boolean(data.showDepositInfo ?? true),
          autoGeneratePdfOnPaid: Boolean(data.autoGeneratePdfOnPaid ?? true),
          autoOpenReceiptModalOnPaid: Boolean(data.autoOpenReceiptModalOnPaid ?? true),
          autoOpenWaOnPaid: Boolean(data.autoOpenWaOnPaid ?? true),
        });
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/receipt')
    );

    const unsubTenants = onSnapshot(
      collection(db, 'tenants'),
      (snap) => {
        const map: Record<string, Tenant> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            id: d.id,
            name: String(data.name ?? ''),
            phone: String(data.phone ?? ''),
            institution: String(data.institution ?? ''),
            originCity: String(data.originCity ?? ''),
            checkInDate: String(data.checkInDate ?? ''),
            dueDay: Number(data.dueDay ?? 10),
            emergencyContact: String(data.emergencyContact ?? ''),
            depositAmount:
              typeof data.depositAmount === 'number' ? data.depositAmount : undefined,
            depositStatus: data.depositStatus
              ? (String(data.depositStatus) as DepositStatus)
              : undefined,
            notes: data.notes ? String(data.notes) : undefined,
          };
        });
        setTenantsByRoomId(map);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'tenants')
    );

    const unsubPayments = onSnapshot(
      collection(db, 'payments'),
      (snap) => {
        const list: PaymentRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            invoiceNo: String(data.invoiceNo ?? ''),
            roomNumber: String(data.roomNumber ?? ''),
            tenantName: String(data.tenantName ?? ''),
            month: String(data.month ?? activeMonth),
            amount: Number(data.amount ?? 0),
            lateFee: typeof data.lateFee === 'number' ? data.lateFee : undefined,
            paidDate: data.paidDate ? String(data.paidDate) : null,
            status: (data.status ?? 'Belum Bayar') as 'Lunas' | 'Belum Bayar',
            method: data.method ? (String(data.method) as PaymentMethod) : null,
            notes: data.notes ? String(data.notes) : undefined,
            paymentLinkId: data.paymentLinkId ? String(data.paymentLinkId) : undefined,
            receiptGeneratedAt: data.receiptGeneratedAt
              ? String(data.receiptGeneratedAt)
              : undefined,
          };
        });
        setPayments(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'payments')
    );

    const unsubPaymentLinks = onSnapshot(
      collection(db, 'paymentLinks'),
      (snap) => {
        const map: Record<string, PaymentLinkRecord> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = {
            id: d.id,
            paymentId: String(data.paymentId ?? ''),
            roomId: String(data.roomId ?? ''),
            roomNumber: String(data.roomNumber ?? ''),
            roomName: data.roomName ? String(data.roomName) : undefined,
            tenantName: String(data.tenantName ?? ''),
            month: String(data.month ?? ''),
            invoiceNo: String(data.invoiceNo ?? ''),
            amount: Number(data.amount ?? 0),
            lateFee: typeof data.lateFee === 'number' ? data.lateFee : undefined,
            dueDay: Number(data.dueDay ?? 10),
            status: (data.status ?? 'Belum Bayar') as PaymentLinkStatus,
            preferredMethod: String(data.preferredMethod ?? 'Transfer BCA'),
            bankName: data.bankName ? String(data.bankName) : undefined,
            accountNumber: data.accountNumber ? String(data.accountNumber) : undefined,
            accountHolder: data.accountHolder ? String(data.accountHolder) : undefined,
            qrisImageUrl: data.qrisImageUrl ? String(data.qrisImageUrl) : undefined,
            externalPaymentLink: data.externalPaymentLink
              ? String(data.externalPaymentLink)
              : undefined,
            paidDate: data.paidDate ? String(data.paidDate) : null,
            method: data.method ? String(data.method) : null,
            confirmationMethod: data.confirmationMethod
              ? String(data.confirmationMethod)
              : undefined,
            confirmationNote: data.confirmationNote
              ? String(data.confirmationNote)
              : undefined,
            confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
            propertyName: String(data.propertyName ?? 'Kost Putra Agan'),
            propertyAddress: data.propertyAddress
              ? String(data.propertyAddress)
              : undefined,
            adminName: String(data.adminName ?? 'Pengelola'),
            whatsappAdmin: data.whatsappAdmin
              ? String(data.whatsappAdmin)
              : undefined,
            receiptSnapshot: data.receiptSnapshot as PaymentLinkRecord['receiptSnapshot'],
          };
        });
        setPaymentLinksById(map);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'paymentLinks')
    );

    const unsubExpenses = onSnapshot(
      collection(db, 'expenses'),
      (snap) => {
        const list: ExpenseRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: String(data.title ?? ''),
              category: (data.category ?? 'Lainnya') as ExpenseCategory,
              amount: Number(data.amount ?? 0),
              date: String(data.date ?? ''),
              month: String(data.month ?? activeMonth),
              notes: data.notes ? String(data.notes) : undefined,
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date));
        setExpenses(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'expenses')
    );

    const unsubMessageTemplates = onSnapshot(
      collection(db, 'messageTemplates'),
      (snap) => {
        if (snap.empty) {
          setMessageTemplates(DEFAULT_MESSAGE_TEMPLATES);
          return;
        }
        const list: MessageTemplate[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name ?? 'Template Pesan'),
            category: (data.category ?? 'kustom') as MessageTemplateCategory,
            body: String(data.body ?? ''),
          };
        });
        setMessageTemplates(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'messageTemplates')
    );

    const unsubMaintenance = onSnapshot(
      collection(db, 'maintenanceLogs'),
      (snap) => {
        const list: MaintenanceLog[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              roomId: String(data.roomId ?? ''),
              roomNumber: String(data.roomNumber ?? ''),
              title: String(data.title ?? ''),
              category: (data.category ?? 'Lainnya') as MaintenanceCategory,
              status: (data.status ?? 'Dilaporkan') as MaintenanceStatus,
              cost: Number(data.cost ?? 0),
              reportedDate: String(data.reportedDate ?? ''),
              notes: data.notes ? String(data.notes) : undefined,
            };
          })
          .sort((a, b) => b.reportedDate.localeCompare(a.reportedDate));
        setMaintenanceLogs(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'maintenanceLogs')
    );

    const unsubHistory = onSnapshot(
      collection(db, 'tenantHistory'),
      (snap) => {
        const list: TenantHistoryRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              roomId: String(data.roomId ?? ''),
              roomNumber: String(data.roomNumber ?? ''),
              roomName: data.roomName ? String(data.roomName) : undefined,
              name: String(data.name ?? ''),
              phone: String(data.phone ?? ''),
              institution: data.institution ? String(data.institution) : undefined,
              originCity: data.originCity ? String(data.originCity) : undefined,
              checkInDate: String(data.checkInDate ?? ''),
              checkOutDate: String(data.checkOutDate ?? ''),
              monthlyRate: Number(data.monthlyRate ?? 0),
              depositAmount:
                typeof data.depositAmount === 'number' ? data.depositAmount : undefined,
              depositStatus: data.depositStatus
                ? (String(data.depositStatus) as DepositStatus)
                : undefined,
              notes: data.notes ? String(data.notes) : undefined,
            };
          })
          .sort((a, b) => b.checkOutDate.localeCompare(a.checkOutDate));
        setTenantHistory(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'tenantHistory')
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const list: AdminUser[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: String(data.email ?? ''),
            name: String(data.name ?? ''),
            role: (data.role === 'owner' ? 'owner' : 'staff') as 'owner' | 'staff',
          };
        });
        setRegisteredAdmins(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'admins')
    );

    const unsubInvites = onSnapshot(
      collection(db, 'adminInvites'),
      (snap) => {
        const list: AdminInvite[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            email: String(data.email ?? d.id),
            name: String(data.name ?? ''),
            role: (data.role ?? 'staff') as 'owner' | 'staff',
            addedBy: String(data.addedBy ?? ''),
          };
        });
        setAdminInvites(list);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'adminInvites')
    );

    const unsubAdminSettings = onSnapshot(
      doc(db, 'settings', 'admin'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        setSettings((prev) => ({
          ...prev,
          adminName: String(data.adminName ?? prev.adminName),
          adminInitials: String(data.adminInitials ?? prev.adminInitials),
          theme: (data.theme === 'light' ? 'light' : 'dark') as 'dark' | 'light',
        }));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/admin')
    );

    return () => {
      unsubRooms();
      unsubRoomTypes();
      unsubPropSettings();
      unsubReceiptSettings();
      unsubTenants();
      unsubPayments();
      unsubPaymentLinks();
      unsubExpenses();
      unsubMessageTemplates();
      unsubMaintenance();
      unsubHistory();
      unsubAdmins();
      unsubInvites();
      unsubAdminSettings();
    };
  }, [publicPayLinkId, authReady, currentUser, isAdmin, activeMonth]);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (publicPayLinkId || !isAdmin) {
      root.classList.remove('dark');
      return;
    }
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [publicPayLinkId, settings.theme, isAdmin]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const rooms: Room[] = useMemo(() => {
    if (roomUnits.length === 0) {
      return INITIAL_ROOMS.map((r) => ({ ...r, tenant: null }));
    }
    return roomUnits.map((unit) => ({
      ...unit,
      tenant: tenantsByRoomId[unit.id] ?? null,
    }));
  }, [roomUnits, tenantsByRoomId]);

  const occupiedRooms = useMemo(
    () => rooms.filter((r) => r.status === 'Terisi'),
    [rooms]
  );
  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'Tersedia'),
    [rooms]
  );
  const unpaidActiveCount = useMemo(
    () =>
      payments.filter(
        (p) => p.month === activeMonth && p.status === 'Belum Bayar'
      ).length,
    [payments, activeMonth]
  );

  const activeTotalExpense = useMemo(
    () =>
      expenses
        .filter((e) => e.month === activeMonth)
        .reduce((acc, e) => acc + e.amount, 0),
    [expenses, activeMonth]
  );

  const fullCashflowHistory: MonthlyHistoricalSummary[] = useMemo(() => {
    const historicalMonths = new Set(HISTORICAL_CASHFLOW.map((h) => h.month));
    const liveMonthSet = new Set<string>(['2026-11', activeMonth]);
    payments.forEach((p) => {
      if (!historicalMonths.has(p.month)) liveMonthSet.add(p.month);
    });
    expenses.forEach((e) => {
      if (!historicalMonths.has(e.month)) liveMonthSet.add(e.month);
    });

    const liveEntries: MonthlyHistoricalSummary[] = Array.from(liveMonthSet)
      .sort()
      .map((month) => {
        const income = payments
          .filter((p) => p.month === month && p.status === 'Lunas')
          .reduce((acc, p) => acc + p.amount + (p.lateFee ?? 0), 0);
        const expense = expenses
          .filter((e) => e.month === month)
          .reduce((acc, e) => acc + e.amount, 0);
        return {
          month,
          label: formatShortMonth(month),
          income,
          expense,
        };
      });

    return [...HISTORICAL_CASHFLOW, ...liveEntries];
  }, [payments, expenses, activeMonth]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const selectedRoomCurrentPayment = useMemo(() => {
    if (!selectedRoom) return null;
    return (
      payments.find(
        (p) => p.month === activeMonth && p.roomNumber === selectedRoom.number
      ) ?? null
    );
  }, [payments, selectedRoom, activeMonth]);

  const receiptRoom = useMemo(() => {
    if (!receiptPayment) return null;
    return rooms.find((r) => r.number === receiptPayment.roomNumber) ?? null;
  }, [receiptPayment, rooms]);

  // Auth Helpers & Actions
  const formatFirebaseAuthError = (err: unknown, fallback: string): string => {
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (msg.includes('popup-closed')) {
      return 'Jendela login Google ditutup sebelum selesai.';
    }
    if (msg.includes('unauthorized-domain')) {
      return 'Alamat ini belum terdaftar di Firebase Auth. Gunakan http://localhost:3000 atau tambahkan domain ini di Firebase Console → Authentication → Authorized domains.';
    }
    if (msg.includes('popup-blocked')) {
      return 'Pop-up login diblokir browser. Izinkan pop-up lalu coba kembali.';
    }
    if (msg.includes('operation-not-allowed')) {
      return 'Login Email & Kata Sandi belum diaktifkan di Firebase Console (Authentication → Sign-in method → Email/Password). Gunakan Masuk dengan Google atau aktifkan metode tersebut terlebih dahulu.';
    }
    if (msg.includes('email-already-in-use')) {
      return 'Alamat email ini sudah terdaftar. Silakan masuk melalui tab Masuk atau gunakan fitur Lupa Kata Sandi.';
    }
    if (
      msg.includes('invalid-credential') ||
      msg.includes('wrong-password') ||
      msg.includes('user-not-found')
    ) {
      return 'Email atau kata sandi tidak sesuai. Periksa kembali atau masuk dengan Google.';
    }
    if (msg.includes('weak-password')) {
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    }
    if (msg.includes('invalid-email')) {
      return 'Format alamat email tidak valid.';
    }
    if (msg.includes('too-many-requests')) {
      return 'Terlalu banyak percobaan. Silakan tunggu beberapa saat lalu coba lagi.';
    }
    if (msg.includes('network-request-failed')) {
      return 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba kembali.';
    }
    return fallback;
  };

  const handleClearAuthMessages = () => {
    setLoginError(null);
    setLoginInfo(null);
  };

  const handleGoogleLogin = async () => {
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal masuk dengan Google. Pastikan mengakses lewat localhost/HTTPS dan pop-up diizinkan.'
        )
      );
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleEmailLogin = async (payload: { email: string; password: string }) => {
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        payload.email.trim(),
        payload.password
      );
      if (!cred.user.emailVerified) {
        setLoginInfo(
          `Akun ${cred.user.email} belum terverifikasi. Silakan klik tautan verifikasi di kotak masuk email Anda.`
        );
      }
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal masuk. Periksa kembali email dan kata sandi Anda.'
        )
      );
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleEmailRegister = async (payload: {
    name: string;
    email: string;
    password: string;
  }) => {
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        payload.email.trim(),
        payload.password
      );
      await updateProfile(cred.user, {
        displayName: payload.name.trim(),
      });
      await sendEmailVerification(cred.user);
      setLoginInfo(
        `Akun berhasil dibuat! Tautan verifikasi sudah dikirim ke ${payload.email.trim()}.`
      );
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal mendaftarkan akun baru. Silakan periksa data Anda dan coba lagi.'
        )
      );
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleCheckEmailVerified = async () => {
    if (!auth.currentUser) return;
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const refreshed = auth.currentUser;
      setCurrentUser(refreshed);

      if (!refreshed.emailVerified) {
        setLoginError(
          'Email belum terverifikasi. Silakan buka kotak masuk (atau folder Spam), klik tautan verifikasi, lalu tekan tombol ini lagi.'
        );
        return;
      }

      const allowed = await checkIsAdminUser(refreshed.email, refreshed.uid);
      if (!allowed && refreshed.email) {
        await registerAdminInCloud({
          uid: refreshed.uid,
          email: refreshed.email,
          name: refreshed.displayName?.trim() || refreshed.email.split('@')[0],
        });
      }
      await seedInitialDatabaseIfEmpty();
      setIsAdmin(true);
      setCloudBootstrapped(true);
      setToastMessage(
        `Selamat datang, ${refreshed.displayName || refreshed.email}! Akun pengelola aktif.`
      );
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal memeriksa status verifikasi email. Silakan coba sesaat lagi.'
        )
      );
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleResendVerification = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setLoginInfo(
        `Email verifikasi baru telah dikirim ke ${auth.currentUser.email}. Cek kotak masuk atau folder Spam.`
      );
      return true;
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal mengirim ulang email verifikasi. Tunggu sebentar lalu coba lagi.'
        )
      );
      return false;
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handlePasswordReset = async (email: string): Promise<boolean> => {
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setLoginInfo(
        `Tautan atur ulang kata sandi telah dikirim ke ${email.trim()}. Periksa kotak masuk atau folder Spam.`
      );
      return true;
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal mengirim email reset kata sandi. Pastikan alamat email benar.'
        )
      );
      return false;
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleGoogleRegister = async (payload: { name: string }) => {
    handleClearAuthMessages();
    setAuthActionLoading(true);
    try {
      let user = currentUser;
      if (!user) {
        const cred = await signInWithPopup(auth, googleProvider);
        user = cred.user;
      }
      if (!user || !user.email) {
        setLoginError('Gagal membaca akun Google. Silakan coba kembali.');
        return;
      }
      if (!user.emailVerified) {
        setLoginInfo(
          `Silakan verifikasi email ${user.email} terlebih dahulu sebelum mengaktifkan akses.`
        );
        return;
      }

      await registerAdminInCloud({
        uid: user.uid,
        email: user.email,
        name: payload.name,
      });

      await seedInitialDatabaseIfEmpty();
      setIsAdmin(true);
      setCloudBootstrapped(true);
      setToastMessage(`Selamat datang, ${payload.name}! Akun admin berhasil didaftarkan.`);
    } catch (err) {
      setLoginError(
        formatFirebaseAuthError(
          err,
          'Gagal mendaftarkan akun admin. Pastikan akun Google Anda terverifikasi.'
        )
      );
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleLogout = async () => {
    handleClearAuthMessages();
    await signOut(auth);
    setSelectedRoomId(null);
  };

  const runPaidReceiptAutomation = async (
    paidRecord: PaymentRecord,
    room?: Room | null
  ): Promise<boolean> => {
    const resolved = resolveRoomPaymentProfile(room, settings, receiptTemplate);
    let pdfGenerated = false;
    if (resolved.autoPdfOnPaid) {
      await downloadReceiptPdf(
        buildPdfReceiptInputFromAdmin({
          payment: paidRecord,
          room,
          settings,
          template: receiptTemplate,
        })
      );
      pdfGenerated = true;
    }
    if (receiptTemplate.autoOpenReceiptModalOnPaid || resolved.autoOpenWaOnPaid) {
      setReceiptPayment(paidRecord);
    }
    return pdfGenerated;
  };

  // Cloud Actions
  const handleMarkPaid = async (paymentId: string) => {
    const target = payments.find((p) => p.id === paymentId);
    if (!target) return;
    const targetRoom = rooms.find((r) => r.number === target.roomNumber) ?? null;
    const linkInfo = target.paymentLinkId
      ? paymentLinksById[target.paymentLinkId]
      : undefined;
    const validMethods: PaymentMethod[] = [
      'Transfer BCA',
      'QRIS',
      'Transfer Mandiri',
      'Tunai',
    ];
    const confirmedMethod =
      linkInfo?.confirmationMethod &&
      validMethods.includes(linkInfo.confirmationMethod as PaymentMethod)
        ? (linkInfo.confirmationMethod as PaymentMethod)
        : undefined;

    const updated = await markPaymentPaidInCloud(target, {
      room: targetRoom,
      settings,
      receiptTemplate,
      method: confirmedMethod,
    });
    const autoPdf = await runPaidReceiptAutomation(updated, targetRoom);
    setToastMessage(
      autoPdf
        ? `Kamar ${target.roomNumber} Lunas — Kwitansi PDF otomatis dibuat & diunduh`
        : `Pembayaran Kamar ${target.roomNumber} (${target.tenantName}) ditandai Lunas`
    );
  };

  const handleCopyReminder = async (
    room: Room,
    amount: number,
    payment?: PaymentRecord | null
  ) => {
    if (!room.tenant) return;
    const targetMonth = payment?.month || activeMonth;
    const dueInfo = getDueStatusInfo(targetMonth, room.tenant.dueDay);
    const tplCategory = dueInfo.tone === 'overdue' ? 'tunggakan' : 'tagihan';
    const activeTemplates =
      messageTemplates.length > 0 ? messageTemplates : DEFAULT_MESSAGE_TEMPLATES;
    const chosenTemplate =
      activeTemplates.find((t) => t.category === tplCategory) ??
      DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === tplCategory) ??
      DEFAULT_MESSAGE_TEMPLATES[0];

    const fallbackPayment: PaymentRecord = payment ?? {
      id: `draft-${room.number}`,
      invoiceNo: '-',
      roomNumber: room.number,
      tenantName: room.tenant.name,
      month: targetMonth,
      amount,
      paidDate: null,
      status: 'Belum Bayar',
      method: null,
    };

    let shareUrl = fallbackPayment.paymentLinkId
      ? buildShareablePaymentUrl(fallbackPayment.paymentLinkId)
      : undefined;
    if (!shareUrl && payment) {
      const linkId = await createOrSyncPaymentLinkInCloud({
        payment,
        room,
        settings,
        receiptTemplate,
      });
      shareUrl = buildShareablePaymentUrl(linkId);
    }

    const msg = renderMessageTemplate(chosenTemplate.body, {
      settings,
      room,
      payment: fallbackPayment,
      availableRooms,
      month: targetMonth,
      paymentUrl: shareUrl,
    });

    try {
      await navigator.clipboard.writeText(msg);
      setToastMessage(`Pesan pengingat untuk ${room.tenant.name} disalin`);
    } catch {
      setToastMessage(`Pengingat untuk ${room.tenant.name} siap dikirim`);
    }
  };

  const handleOpenCheckIn = (roomNumber: string | null = null) => {
    setCheckInPreselectedRoom(roomNumber);
    setCheckInModalOpen(true);
  };

  const handleSubmitCheckIn = async (payload: {
    roomNumber: string;
    tenant: Omit<Tenant, 'id'>;
    monthlyRate: number;
    payNow: boolean;
    method: PaymentMethod;
  }) => {
    const targetRoom = rooms.find((r) => r.number === payload.roomNumber);
    if (!targetRoom) return;
    await checkInTenantToCloud({
      room: targetRoom,
      tenant: payload.tenant,
      monthlyRate: payload.monthlyRate,
      payNow: payload.payNow,
      method: payload.method,
      billingMonth: activeMonth,
    });

    if (payload.payNow) {
      const createdPayment = await upsertPaymentInCloud({
        roomNumber: payload.roomNumber,
        tenantName: payload.tenant.name,
        month: activeMonth,
        amount: payload.monthlyRate,
        paidDate: payload.tenant.checkInDate,
        method: payload.method,
        room: { ...targetRoom, tenant: { id: targetRoom.id, ...payload.tenant } },
        settings,
        receiptTemplate,
      });
      await runPaidReceiptAutomation(
        createdPayment,
        { ...targetRoom, tenant: { id: targetRoom.id, ...payload.tenant } }
      );
    }

    setToastMessage(
      `${payload.tenant.name} berhasil check-in di Kamar ${payload.roomNumber}`
    );
  };

  const handleCheckOut = async (
    room: Room,
    depositReturnStatus?: DepositStatus
  ) => {
    await checkOutTenantInCloud(room, depositReturnStatus);
    setSelectedRoomId(null);
    setToastMessage(
      `${getRoomDisplayName(room)} dikosongkan dan riwayat penyewa tersimpan`
    );
  };

  const handleUpdateTenant = async (
    roomId: string,
    roomNumber: string,
    tenant: Omit<Tenant, 'id'>
  ) => {
    await updateTenantInCloud(roomId, roomNumber, tenant);
    setToastMessage(`Data penyewa ${tenant.name} berhasil diperbarui`);
  };

  const handleAddPayment = async (payload: {
    roomNumber: string;
    tenantName: string;
    month: string;
    amount: number;
    lateFee?: number;
    paidDate: string;
    method: PaymentMethod;
    notes?: string;
  }) => {
    const targetRoom = rooms.find((r) => r.number === payload.roomNumber) ?? null;
    const saved = await upsertPaymentInCloud({
      ...payload,
      room: targetRoom,
      settings,
      receiptTemplate,
    });
    const autoPdf = await runPaidReceiptAutomation(saved, targetRoom);
    setToastMessage(
      autoPdf
        ? `Kamar ${payload.roomNumber} dicatat Lunas — Kwitansi PDF otomatis diunduh`
        : `Pembayaran Kamar ${payload.roomNumber} (${payload.tenantName}) dicatat Lunas`
    );
  };

  const handleGenerateMonthlyBills = async (month: string) => {
    const count = await generateMonthlyBillsInCloud(month, rooms, payments);
    if (count === 0) {
      setToastMessage(
        `Semua kamar terisi sudah memiliki tagihan untuk ${formatMonthYear(month)}`
      );
    } else {
      setToastMessage(
        `${count} tagihan sewa ${formatMonthYear(month)} berhasil dibuat otomatis`
      );
    }
  };

  const handleUpdatePaymentDetails = async (
    paymentId: string,
    payload: { amount: number; lateFee?: number; notes?: string }
  ) => {
    const existing = payments.find((p) => p.id === paymentId);
    await updatePaymentDetailsInCloud(paymentId, {
      ...payload,
      paymentLinkId: existing?.paymentLinkId,
    });
    setToastMessage('Rincian tagihan & denda berhasil diperbarui');
  };

  const handleEnsurePaymentLink = async (
    payment: PaymentRecord,
    room?: Room | null
  ): Promise<string> => {
    const targetRoom =
      room ?? rooms.find((r) => r.number === payment.roomNumber) ?? null;
    return createOrSyncPaymentLinkInCloud({
      payment,
      room: targetRoom,
      settings,
      receiptTemplate,
    });
  };

  const handleCreateAndCopyPaymentLink = async (
    payment: PaymentRecord,
    room?: Room | null
  ) => {
    const linkId = await handleEnsurePaymentLink(payment, room);
    const url = buildShareablePaymentUrl(linkId);
    try {
      await navigator.clipboard.writeText(url);
      setToastMessage(
        `Link pembayaran Kamar ${payment.roomNumber} disalin (Bank/QRIS + Auto-Kwitansi PDF)`
      );
    } catch {
      setToastMessage(`Link pembayaran siap dibagikan: ${url}`);
    }
  };

  const handleDownloadPdfReceipt = async (payment: PaymentRecord) => {
    const targetRoom = rooms.find((r) => r.number === payment.roomNumber) ?? null;
    const filename = await downloadReceiptPdf(
      buildPdfReceiptInputFromAdmin({
        payment,
        room: targetRoom,
        settings,
        template: receiptTemplate,
      })
    );
    setToastMessage(`Kwitansi PDF ${filename} berhasil diunduh`);
  };

  const handleSaveReceiptTemplate = async (config: ReceiptTemplateConfig) => {
    setReceiptTemplate(config);
    await saveReceiptTemplateInCloud(config);
    setToastMessage('Format & otomasi kwitansi PDF berhasil disimpan');
  };

  const handleSaveRoomReceiptProfile = async (
    roomId: string,
    profile: RoomReceiptProfile
  ) => {
    await updateRoomReceiptProfileInCloud(roomId, profile);
    setToastMessage('Profil pembayaran & kwitansi kamar diperbarui');
  };

  const handleAddExpense = async (payload: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    notes?: string;
  }) => {
    await addExpenseInCloud(payload);
    setToastMessage(`Pengeluaran "${payload.title}" berhasil dicatat`);
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpenseInCloud(id);
    setToastMessage('Catatan pengeluaran dihapus');
  };

  const handleSaveSettings = async (updated: PropertySettings) => {
    setSettings(updated);
    await saveSettingsInCloud(updated);
  };

  const handleResetDemo = async () => {
    await resetDatabaseToDemo();
    setToastMessage('Database cloud dikembalikan ke data awal');
  };

  const handleRemoveRegisteredAdmin = async (uid: string) => {
    await removeRegisteredAdminInCloud(uid);
    setToastMessage('Akses admin telah dihapus');
  };

  const handleAddAdminInvite = async (
    email: string,
    name: string,
    role: 'owner' | 'staff' = 'staff'
  ) => {
    await addAdminInviteInCloud({
      email,
      name,
      role,
      addedBy: currentUser?.email ?? 'admin',
    });
    setToastMessage(
      `Undangan ${role === 'owner' ? 'Pemilik' : 'Admin'} diberikan kepada ${email}`
    );
  };

  const handleUpdateAdminRole = async (
    uid: string,
    name: string,
    role: 'owner' | 'staff'
  ) => {
    await updateAdminRoleInCloud(uid, name, role);
    setToastMessage(
      `Peran ${name} diperbarui menjadi ${role === 'owner' ? 'Pemilik' : 'Admin'}`
    );
  };

  const handleRemoveAdminInvite = async (email: string) => {
    await removeAdminInviteInCloud(email);
    setToastMessage(`Undangan pengelola untuk ${email} dibatalkan`);
  };

  const handleSaveRoomType = async (
    config: RoomTypeConfig,
    syncAllMatchingRooms: boolean
  ) => {
    const syncIds = syncAllMatchingRooms
      ? rooms.filter((r) => r.tier === config.tier).map((r) => r.id)
      : [];
    await saveRoomTypeConfigInCloud(config, syncIds);
    setToastMessage(
      syncIds.length > 0
        ? `Panel ${config.tier} & ${syncIds.length} unit kamar diperbarui`
        : `Panel ${config.tier} berhasil diperbarui`
    );
  };

  const handleAddRoomUnit = async (payload: {
    number: string;
    name?: string;
    floor: number;
    tier: RoomTier;
    monthlyRate: number;
    areaSqm: number;
    facilities: string[];
  }) => {
    const newId = await addRoomUnitInCloud(payload);
    if (rooms.length + 1 !== settings.totalRooms) {
      await saveSettingsInCloud({ ...settings, totalRooms: rooms.length + 1 });
    }
    setToastMessage(`Kamar ${payload.number} berhasil ditambahkan`);
    setSelectedRoomId(newId);
  };

  const handleUpdateRoomUnit = async (
    roomId: string,
    payload: {
      name?: string;
      tier: RoomTier;
      monthlyRate: number;
      areaSqm: number;
      facilities: string[];
      status?: RoomStatus;
    }
  ) => {
    await updateRoomUnitInCloud(roomId, payload);
    const target = rooms.find((r) => r.id === roomId);
    const label = payload.name?.trim() || (target ? `Kamar ${target.number}` : 'Unit');
    setToastMessage(`${label} diperbarui (${payload.tier})`);
  };

  const handleDeleteRoomUnit = async (roomId: string) => {
    const target = rooms.find((r) => r.id === roomId);
    await deleteRoomUnitInCloud(roomId);
    setSelectedRoomId(null);
    if (rooms.length - 1 >= 1) {
      await saveSettingsInCloud({
        ...settings,
        totalRooms: Math.max(1, rooms.length - 1),
      });
    }
    setToastMessage(
      target ? `${getRoomDisplayName(target)} berhasil dihapus` : 'Unit kamar dihapus'
    );
  };

  const handleAddMaintenanceLog = async (payload: {
    roomId: string;
    roomNumber: string;
    title: string;
    category: MaintenanceCategory;
    status: MaintenanceStatus;
    cost: number;
    reportedDate: string;
    notes?: string;
  }) => {
    await addMaintenanceLogInCloud(payload);
    setToastMessage(`Catatan perawatan Kamar ${payload.roomNumber} disimpan`);
  };

  const handleUpdateMaintenanceLog = async (
    logId: string,
    payload: {
      title: string;
      category: MaintenanceCategory;
      status: MaintenanceStatus;
      cost: number;
      reportedDate: string;
      notes?: string;
    }
  ) => {
    await updateMaintenanceLogInCloud(logId, payload);
    setToastMessage(`Status perawatan diperbarui: ${payload.status}`);
  };

  const handleDeleteMaintenanceLog = async (logId: string) => {
    await deleteMaintenanceLogInCloud(logId);
    setToastMessage('Catatan perawatan dihapus');
  };

  const handleSaveMessageTemplate = async (template: MessageTemplate) => {
    await saveMessageTemplateInCloud(template);
    setToastMessage(`Template "${template.name}" berhasil disimpan`);
  };

  const handleDeleteMessageTemplate = async (templateId: string) => {
    await deleteMessageTemplateInCloud(templateId);
    setToastMessage('Template pesan dihapus');
  };

  const handleTopBarPrimaryAction = () => {
    if (activePage === 'rooms') {
      handleOpenCheckIn(availableRooms[0]?.number ?? null);
    } else if (activePage === 'finance') {
      setAddExpenseOpen(true);
    } else {
      setAddPaymentOpen(true);
    }
  };

  // Public Tenant Payment Link Route (?bayar=...)
  if (publicPayLinkId) {
    return <PublicPaymentView linkId={publicPayLinkId} />;
  }

  // Auth Loading Splash
  if (
    !authReady ||
    authChecking ||
    (currentUser && isAdmin && !cloudBootstrapped && roomUnits.length === 0)
  ) {
    return (
      <div className="min-h-screen text-slate-700 dark:text-slate-200 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-7 h-7 border-2 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Menghubungkan ke Portal Admin Kost Putra Agan...
          </p>
        </div>
      </div>
    );
  }

  // Login, Email Verification OR Complete Admin Registration
  if (!currentUser || !isAdmin) {
    const authMode = !currentUser
      ? 'unauthenticated'
      : !currentUser.emailVerified
      ? 'verify_email'
      : 'register_needed';

    return (
      <>
        <LoginView
          mode={authMode}
          userEmail={currentUser?.email}
          defaultDisplayName={currentUser?.displayName}
          loading={authActionLoading}
          errorMsg={loginError}
          infoMsg={loginInfo}
          onClearMessages={handleClearAuthMessages}
          onGoogleLogin={handleGoogleLogin}
          onGoogleRegister={handleGoogleRegister}
          onEmailLogin={handleEmailLogin}
          onEmailRegister={handleEmailRegister}
          onCheckEmailVerified={handleCheckEmailVerified}
          onResendVerification={handleResendVerification}
          onPasswordReset={handlePasswordReset}
          onLogout={handleLogout}
        />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="min-h-screen flex bg-transparent text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        activePage={activePage}
        onSelectPage={setActivePage}
        propertyName={settings.name}
        occupiedCount={occupiedRooms.length}
        totalRooms={rooms.length}
        unpaidCount={unpaidActiveCount}
        userEmail={currentUser.email}
        onLogout={handleLogout}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activePage={activePage}
          propertyName={settings.name}
          adminName={settings.adminName}
          adminInitials={settings.adminInitials}
          theme={settings.theme}
          onToggleTheme={() =>
            handleSaveSettings({
              ...settings,
              theme: settings.theme === 'dark' ? 'light' : 'dark',
            })
          }
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onPrimaryAction={handleTopBarPrimaryAction}
          onNavigateSettings={() => setActivePage('settings')}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <div key={activePage} className="animate-page-enter">
          {activePage === 'dashboard' && (
            <DashboardView
              rooms={rooms}
              roomTypes={roomTypes}
              payments={payments}
              maintenanceLogs={maintenanceLogs}
              templates={messageTemplates}
              activeMonth={activeMonth}
              totalExpenseActive={activeTotalExpense}
              cashflowHistory={fullCashflowHistory}
              settings={settings}
              onSelectRoom={(r) => setSelectedRoomId(r.id)}
              onNavigate={setActivePage}
              onMarkPaid={handleMarkPaid}
              onCopyReminder={handleCopyReminder}
              onOpenCheckIn={handleOpenCheckIn}
              onEditRoomType={(rt) => setEditingRoomType(rt)}
            />
          )}

          {activePage === 'rooms' && (
            <RoomsView
              rooms={rooms}
              roomTypes={roomTypes}
              payments={payments}
              onSelectRoom={(r) => setSelectedRoomId(r.id)}
              onOpenCheckIn={handleOpenCheckIn}
              onEditRoomType={(rt) => setEditingRoomType(rt)}
              onOpenAddRoom={() => setAddRoomModalOpen(true)}
            />
          )}

          {activePage === 'payments' && (
            <PaymentsView
              payments={payments}
              rooms={rooms}
              settings={settings}
              receiptTemplate={receiptTemplate}
              paymentLinksById={paymentLinksById}
              templates={messageTemplates}
              selectedMonth={selectedPaymentMonth}
              onChangeMonth={setSelectedPaymentMonth}
              onMarkPaid={handleMarkPaid}
              onOpenReceipt={(pay) => setReceiptPayment(pay)}
              onCopyReminder={handleCopyReminder}
              onOpenAddPayment={() => setAddPaymentOpen(true)}
              onOpenReceiptFormat={() => setReceiptFormatModalOpen(true)}
              onCreateAndCopyPaymentLink={handleCreateAndCopyPaymentLink}
              onDownloadPdfReceipt={handleDownloadPdfReceipt}
              onGenerateMonthlyBills={handleGenerateMonthlyBills}
              onUpdatePaymentDetails={handleUpdatePaymentDetails}
            />
          )}

          {activePage === 'finance' && (
            <FinanceView
              payments={payments}
              expenses={expenses}
              rooms={rooms}
              settings={settings}
              cashflowHistory={fullCashflowHistory}
              selectedMonth={selectedFinanceMonth}
              onChangeMonth={setSelectedFinanceMonth}
              onOpenAddExpense={() => setAddExpenseOpen(true)}
              onDeleteExpense={handleDeleteExpense}
              onExportSuccess={(msg) => setToastMessage(msg)}
            />
          )}

          {activePage === 'messages' && (
            <MessagesView
              templates={messageTemplates}
              rooms={rooms}
              payments={payments}
              settings={settings}
              selectedMonth={selectedPaymentMonth}
              onChangeMonth={setSelectedPaymentMonth}
              onSaveTemplate={handleSaveMessageTemplate}
              onDeleteTemplate={handleDeleteMessageTemplate}
              onNotify={(msg) => setToastMessage(msg)}
            />
          )}

          {activePage === 'settings' && (
            <SettingsView
              settings={settings}
              receiptTemplate={receiptTemplate}
              rooms={rooms}
              roomTypes={roomTypes}
              templates={messageTemplates}
              registeredAdmins={registeredAdmins}
              adminInvites={adminInvites}
              currentUserUid={currentUser.uid}
              currentUserEmail={currentUser.email ?? ''}
              onSaveSettings={handleSaveSettings}
              onResetDemo={handleResetDemo}
              onRemoveRegisteredAdmin={handleRemoveRegisteredAdmin}
              onUpdateAdminRole={handleUpdateAdminRole}
              onAddAdminInvite={handleAddAdminInvite}
              onRemoveAdminInvite={handleRemoveAdminInvite}
              onEditRoomType={(rt) => setEditingRoomType(rt)}
              onOpenReceiptFormat={() => setReceiptFormatModalOpen(true)}
              onNavigate={setActivePage}
              onNotify={(msg) => setToastMessage(msg)}
            />
          )}
          </div>
        </main>
      </div>

      {/* Drawers & Modals */}
      <RoomDrawer
        room={selectedRoom}
        roomTypes={roomTypes}
        settings={settings}
        receiptTemplate={receiptTemplate}
        templates={messageTemplates}
        currentMonthPayment={selectedRoomCurrentPayment}
        maintenanceLogs={maintenanceLogs}
        tenantHistory={tenantHistory}
        onClose={() => setSelectedRoomId(null)}
        onOpenCheckIn={handleOpenCheckIn}
        onCheckOut={handleCheckOut}
        onMarkPaid={handleMarkPaid}
        onOpenReceipt={(pay) => setReceiptPayment(pay)}
        onCopyReminder={handleCopyReminder}
        onSaveRoomReceiptProfile={handleSaveRoomReceiptProfile}
        onCreateAndCopyPaymentLink={handleCreateAndCopyPaymentLink}
        onUpdateRoomUnit={handleUpdateRoomUnit}
        onDeleteRoomUnit={handleDeleteRoomUnit}
        onUpdateTenant={handleUpdateTenant}
        onAddMaintenanceLog={handleAddMaintenanceLog}
        onUpdateMaintenanceLog={handleUpdateMaintenanceLog}
        onDeleteMaintenanceLog={handleDeleteMaintenanceLog}
      />

      <RoomTypeModal
        roomType={editingRoomType}
        matchingRoomCount={
          editingRoomType
            ? rooms.filter((r) => r.tier === editingRoomType.tier).length
            : 0
        }
        onClose={() => setEditingRoomType(null)}
        onSave={handleSaveRoomType}
      />

      <AddRoomModal
        open={addRoomModalOpen}
        existingRooms={rooms}
        roomTypes={roomTypes}
        onClose={() => setAddRoomModalOpen(false)}
        onSubmit={handleAddRoomUnit}
      />

      <CheckInModal
        open={checkInModalOpen}
        availableRooms={availableRooms}
        preselectedRoomNumber={checkInPreselectedRoom}
        defaultDueDay={settings.defaultDueDay}
        onClose={() => setCheckInModalOpen(false)}
        onSubmit={handleSubmitCheckIn}
      />

      <AddPaymentModal
        open={addPaymentOpen}
        occupiedRooms={occupiedRooms}
        selectedMonth={selectedPaymentMonth}
        onClose={() => setAddPaymentOpen(false)}
        onSubmit={handleAddPayment}
      />

      <AddExpenseModal
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        onSubmit={handleAddExpense}
      />

      <ReceiptModal
        payment={receiptPayment}
        room={receiptRoom}
        templates={messageTemplates}
        receiptTemplate={receiptTemplate}
        settings={settings}
        onClose={() => setReceiptPayment(null)}
        onCopySuccess={(msg) => setToastMessage(msg)}
        onEnsurePaymentLink={handleEnsurePaymentLink}
      />

      <ReceiptFormatModal
        open={receiptFormatModalOpen}
        template={receiptTemplate}
        settings={settings}
        onClose={() => setReceiptFormatModalOpen(false)}
        onSave={handleSaveReceiptTemplate}
        onNotify={(msg) => setToastMessage(msg)}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </div>
  );
}
