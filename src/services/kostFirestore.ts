import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_ROOM_TYPES,
  DEFAULT_SETTINGS,
  getRoomDisplayName,
  INITIAL_EXPENSES,
  INITIAL_PAYMENTS,
  INITIAL_ROOMS,
} from '../data/initialData';
import { DEFAULT_MESSAGE_TEMPLATES } from '../utils/messageTemplates';
import {
  DepositStatus,
  ExpenseCategory,
  IncomeCategory,
  MaintenanceCategory,
  MaintenanceStatus,
  MessageTemplate,
  PaymentLinkRecord,
  PaymentLinkStatus,
  PaymentMethod,
  PaymentRecord,
  PropertySettings,
  ReceiptSnapshot,
  ReceiptTemplateConfig,
  Room,
  RoomGalleryImage,
  RoomReceiptProfile,
  RoomStatus,
  RoomTier,
  RoomTypeConfig,
  Tenant,
} from '../types/kost';
import { buildInvoiceNumber, getCurrentMonthISO, getTodayISO } from '../utils/format';
import { normalizePublicBaseUrl, resolveRoomPaymentProfile } from '../utils/receiptPdf';

const OWNER_EMAIL = (
  import.meta.env.VITE_PRIMARY_OWNER_EMAIL || 'ekall2h@gmail.com'
)
  .trim()
  .toLowerCase();

function buildReceiptSnapshot(
  room: Room | null | undefined,
  receiptTemplate: ReceiptTemplateConfig = DEFAULT_RECEIPT_TEMPLATE
): ReceiptSnapshot {
  const snap: ReceiptSnapshot = {
    title: receiptTemplate.title.slice(0, 60),
    subtitle: receiptTemplate.subtitle.slice(0, 120),
    accentTheme: receiptTemplate.accentTheme,
    includedItemsText: receiptTemplate.includedItemsText.slice(0, 200),
    footerNote: receiptTemplate.footerNote.slice(0, 300),
    signerLabel: receiptTemplate.signerLabel.slice(0, 60),
    showLogo: receiptTemplate.showLogo,
    showAddress: receiptTemplate.showAddress,
    showQrVerification: receiptTemplate.showQrVerification,
    showDepositInfo: receiptTemplate.showDepositInfo,
  };
  if (room?.receiptProfile?.customReceiptNote?.trim()) {
    snap.customRoomNote = room.receiptProfile.customReceiptNote.trim().slice(0, 240);
  }
  if (
    receiptTemplate.showDepositInfo &&
    typeof room?.tenant?.depositAmount === 'number' &&
    room.tenant.depositAmount > 0
  ) {
    snap.depositAmount = room.tenant.depositAmount;
    snap.depositStatus = room.tenant.depositStatus ?? 'Disimpan';
  }
  return snap;
}

function generatePaymentLinkId(paymentId: string): string {
  const cleanBase = paymentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `pl-${cleanBase}-${rand}`;
}

export async function checkIsAdminUser(
  email: string | null | undefined,
  uid: string
): Promise<boolean> {
  if (!email) return false;
  const normalized = email.toLowerCase();

  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) return true;

    if (normalized === OWNER_EMAIL) {
      await setDoc(doc(db, 'admins', uid), {
        email: normalized,
        name: 'Pemilik Utama',
        role: 'owner',
        createdAt: serverTimestamp(),
      });
      return true;
    }

    const inviteSnap = await getDoc(doc(db, 'adminInvites', normalized));
    if (inviteSnap.exists()) {
      const invData = inviteSnap.data();
      await setDoc(doc(db, 'admins', uid), {
        email: normalized,
        name: String(invData.name ?? email.split('@')[0]),
        role: invData.role === 'owner' ? 'owner' : 'staff',
        createdAt: serverTimestamp(),
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function registerAdminInCloud(payload: {
  uid: string;
  email: string;
  name: string;
}): Promise<void> {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const role = normalizedEmail === OWNER_EMAIL ? 'owner' : 'staff';

  try {
    await setDoc(doc(db, 'admins', payload.uid), {
      email: normalizedEmail,
      name: payload.name.trim().slice(0, 80),
      role,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admins/${payload.uid}`);
  }
}

export async function removeRegisteredAdminInCloud(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
  }
}

export async function updateAdminRoleInCloud(
  uid: string,
  name: string,
  role: 'owner' | 'staff'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'admins', uid), {
      name: name.trim().slice(0, 80),
      role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admins/${uid}`);
  }
}

export async function seedRoomTypesIfEmpty(): Promise<void> {
  try {
    const typesSnap = await getDocs(collection(db, 'roomTypes'));
    if (!typesSnap.empty) return;

    const batch = writeBatch(db);
    for (const rt of DEFAULT_ROOM_TYPES) {
      batch.set(doc(db, 'roomTypes', rt.id), {
        tier: rt.tier,
        displayName: (rt.displayName ?? rt.tier).slice(0, 60),
        subtitle: rt.subtitle.slice(0, 80),
        monthlyRate: rt.monthlyRate,
        areaSqm: rt.areaSqm,
        description: rt.description.slice(0, 600),
        imageUrl: rt.imageUrl,
        images: rt.images.slice(0, 6),
        facilities: rt.facilities.slice(0, 15),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'roomTypes');
  }
}

export async function seedMessageTemplatesIfEmpty(): Promise<void> {
  try {
    const tplSnap = await getDocs(collection(db, 'messageTemplates'));
    if (!tplSnap.empty) return;

    const batch = writeBatch(db);
    for (const tpl of DEFAULT_MESSAGE_TEMPLATES) {
      batch.set(doc(db, 'messageTemplates', tpl.id), {
        name: tpl.name.slice(0, 80),
        category: tpl.category,
        body: tpl.body.slice(0, 2500),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'messageTemplates');
  }
}

export async function seedInitialDatabaseIfEmpty(): Promise<boolean> {
  await seedRoomTypesIfEmpty();
  await seedMessageTemplatesIfEmpty();

  const roomsSnap = await getDocs(collection(db, 'rooms'));
  if (!roomsSnap.empty) return false;

  // Step 1: Seed physical room units first
  try {
    const roomsBatch = writeBatch(db);
    for (const room of INITIAL_ROOMS) {
      roomsBatch.set(doc(db, 'rooms', room.id), {
        number: room.number,
        floor: room.floor,
        tier: room.tier,
        monthlyRate: room.monthlyRate,
        areaSqm: room.areaSqm,
        facilities: room.facilities.slice(0, 15),
        status: room.status,
        updatedAt: serverTimestamp(),
      });
    }
    await roomsBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'rooms');
  }

  // Step 2: Seed tenant occupancies in small chunks
  try {
    const occupiedRooms = INITIAL_ROOMS.filter((r) => r.status === 'Terisi' && r.tenant);
    for (let i = 0; i < occupiedRooms.length; i += 6) {
      const chunk = occupiedRooms.slice(i, i + 6);
      const tenantsBatch = writeBatch(db);
      for (const room of chunk) {
        if (!room.tenant) continue;
        const tenantDoc: Record<string, unknown> = {
          roomNumber: room.number,
          name: room.tenant.name.slice(0, 100),
          phone: room.tenant.phone.slice(0, 30),
          institution: room.tenant.institution.slice(0, 140),
          originCity: room.tenant.originCity.slice(0, 80),
          checkInDate: room.tenant.checkInDate.slice(0, 20),
          dueDay: room.tenant.dueDay,
          emergencyContact: room.tenant.emergencyContact.slice(0, 120),
          updatedAt: serverTimestamp(),
        };
        if (room.tenant.notes) {
          tenantDoc.notes = room.tenant.notes.slice(0, 300);
        }
        tenantsBatch.set(doc(db, 'tenants', room.id), tenantDoc);
      }
      await tenantsBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tenants');
  }

  // Step 3: Seed payments
  try {
    const paymentsBatch = writeBatch(db);
    for (const pay of INITIAL_PAYMENTS) {
      paymentsBatch.set(doc(db, 'payments', pay.id), {
        invoiceNo: pay.invoiceNo.slice(0, 40),
        roomNumber: pay.roomNumber,
        tenantName: pay.tenantName.slice(0, 100),
        month: pay.month,
        amount: pay.amount,
        paidDate: pay.paidDate ?? null,
        status: pay.status,
        method: pay.method ?? null,
        updatedAt: serverTimestamp(),
      });
    }
    await paymentsBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments');
  }

  // Step 4: Seed expenses & property/admin settings
  try {
    const metaBatch = writeBatch(db);
    for (const exp of INITIAL_EXPENSES) {
      const expDoc: Record<string, unknown> = {
        title: exp.title.slice(0, 160),
        category: exp.category,
        amount: exp.amount,
        date: exp.date,
        month: exp.month,
        createdAt: serverTimestamp(),
      };
      if (exp.notes) expDoc.notes = exp.notes.slice(0, 300);
      metaBatch.set(doc(db, 'expenses', exp.id), expDoc);
    }

    metaBatch.set(doc(db, 'settings', 'property'), {
      name: DEFAULT_SETTINGS.name.slice(0, 80),
      tagline: DEFAULT_SETTINGS.tagline.slice(0, 140),
      address: DEFAULT_SETTINGS.address.slice(0, 200),
      whatsappAdmin: DEFAULT_SETTINGS.whatsappAdmin.slice(0, 30),
      paymentAccountInfo: DEFAULT_SETTINGS.paymentAccountInfo.slice(0, 240),
      paymentBankName: DEFAULT_SETTINGS.paymentBankName.slice(0, 50),
      paymentBankAccount: DEFAULT_SETTINGS.paymentBankAccount.slice(0, 60),
      paymentBankHolder: DEFAULT_SETTINGS.paymentBankHolder.slice(0, 80),
      qrisImageUrl: '',
      externalPaymentLink: '',
      defaultDueDay: DEFAULT_SETTINGS.defaultDueDay,
      totalRooms: DEFAULT_SETTINGS.totalRooms,
      updatedAt: serverTimestamp(),
    });

    metaBatch.set(doc(db, 'settings', 'receipt'), {
      ...DEFAULT_RECEIPT_TEMPLATE,
      updatedAt: serverTimestamp(),
    });

    metaBatch.set(doc(db, 'settings', 'admin'), {
      adminName: DEFAULT_SETTINGS.adminName.slice(0, 80),
      adminInitials: DEFAULT_SETTINGS.adminInitials.slice(0, 4),
      theme: DEFAULT_SETTINGS.theme,
      uiColorPreset: DEFAULT_SETTINGS.uiColorPreset ?? 'emerald',
      uiCustomColor: DEFAULT_SETTINGS.uiCustomColor ?? '#0f766e',
      updatedAt: serverTimestamp(),
    });

    await metaBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings');
  }

  return true;
}

export async function resetDatabaseToDemo(): Promise<void> {
  try {
    const [
      roomsSnap,
      tenantsSnap,
      paymentsSnap,
      expensesSnap,
      incomesSnap,
      appsSnap,
      maintenanceSnap,
      historySnap,
    ] = await Promise.all([
      getDocs(collection(db, 'rooms')),
      getDocs(collection(db, 'tenants')),
      getDocs(collection(db, 'payments')),
      getDocs(collection(db, 'expenses')),
      getDocs(collection(db, 'incomes')),
      getDocs(collection(db, 'applications')),
      getDocs(collection(db, 'maintenanceLogs')),
      getDocs(collection(db, 'tenantHistory')),
    ]);

    const initialRoomIds = new Set(INITIAL_ROOMS.map((r) => r.id));
    const initialTenantIds = new Set(
      INITIAL_ROOMS.filter((r) => r.status === 'Terisi').map((r) => r.id)
    );
    const initialPaymentIds = new Set(INITIAL_PAYMENTS.map((p) => p.id));

    const cleanupBatch = writeBatch(db);
    roomsSnap.forEach((d) => {
      if (!initialRoomIds.has(d.id)) cleanupBatch.delete(d.ref);
    });
    tenantsSnap.forEach((d) => {
      if (!initialTenantIds.has(d.id)) cleanupBatch.delete(d.ref);
    });
    paymentsSnap.forEach((d) => {
      if (!initialPaymentIds.has(d.id)) cleanupBatch.delete(d.ref);
    });
    expensesSnap.forEach((d) => cleanupBatch.delete(d.ref));
    incomesSnap.forEach((d) => cleanupBatch.delete(d.ref));
    appsSnap.forEach((d) => cleanupBatch.delete(d.ref));
    maintenanceSnap.forEach((d) => cleanupBatch.delete(d.ref));
    historySnap.forEach((d) => cleanupBatch.delete(d.ref));
    await cleanupBatch.commit();

    const roomsBatch = writeBatch(db);
    for (const rt of DEFAULT_ROOM_TYPES) {
      roomsBatch.set(doc(db, 'roomTypes', rt.id), {
        tier: rt.tier,
        displayName: (rt.displayName ?? rt.tier).slice(0, 60),
        subtitle: rt.subtitle.slice(0, 80),
        monthlyRate: rt.monthlyRate,
        areaSqm: rt.areaSqm,
        description: rt.description.slice(0, 600),
        imageUrl: rt.imageUrl,
        images: rt.images.slice(0, 6),
        facilities: rt.facilities.slice(0, 15),
        updatedAt: serverTimestamp(),
      });
    }
    for (const tpl of DEFAULT_MESSAGE_TEMPLATES) {
      roomsBatch.set(doc(db, 'messageTemplates', tpl.id), {
        name: tpl.name.slice(0, 80),
        category: tpl.category,
        body: tpl.body.slice(0, 2500),
        updatedAt: serverTimestamp(),
      });
    }
    for (const room of INITIAL_ROOMS) {
      roomsBatch.set(doc(db, 'rooms', room.id), {
        number: room.number,
        floor: room.floor,
        tier: room.tier,
        monthlyRate: room.monthlyRate,
        areaSqm: room.areaSqm,
        facilities: room.facilities.slice(0, 15),
        status: room.status,
        updatedAt: serverTimestamp(),
      });
    }
    await roomsBatch.commit();

    const occupiedRooms = INITIAL_ROOMS.filter((r) => r.status === 'Terisi' && r.tenant);
    for (let i = 0; i < occupiedRooms.length; i += 6) {
      const chunk = occupiedRooms.slice(i, i + 6);
      const tenantsBatch = writeBatch(db);
      for (const room of chunk) {
        if (!room.tenant) continue;
        const tenantDoc: Record<string, unknown> = {
          roomNumber: room.number,
          name: room.tenant.name.slice(0, 100),
          phone: room.tenant.phone.slice(0, 30),
          institution: room.tenant.institution.slice(0, 140),
          originCity: room.tenant.originCity.slice(0, 80),
          checkInDate: room.tenant.checkInDate.slice(0, 20),
          dueDay: room.tenant.dueDay,
          emergencyContact: room.tenant.emergencyContact.slice(0, 120),
          updatedAt: serverTimestamp(),
        };
        if (room.tenant.notes) tenantDoc.notes = room.tenant.notes.slice(0, 300);
        tenantsBatch.set(doc(db, 'tenants', room.id), tenantDoc);
      }
      await tenantsBatch.commit();
    }

    const restBatch = writeBatch(db);
    for (const pay of INITIAL_PAYMENTS) {
      restBatch.set(doc(db, 'payments', pay.id), {
        invoiceNo: pay.invoiceNo.slice(0, 40),
        roomNumber: pay.roomNumber,
        tenantName: pay.tenantName.slice(0, 100),
        month: pay.month,
        amount: pay.amount,
        paidDate: pay.paidDate ?? null,
        status: pay.status,
        method: pay.method ?? null,
        updatedAt: serverTimestamp(),
      });
    }

    for (const exp of INITIAL_EXPENSES) {
      const expDoc: Record<string, unknown> = {
        title: exp.title.slice(0, 160),
        category: exp.category,
        amount: exp.amount,
        date: exp.date,
        month: exp.month,
        createdAt: serverTimestamp(),
      };
      if (exp.notes) expDoc.notes = exp.notes.slice(0, 300);
      restBatch.set(doc(db, 'expenses', exp.id), expDoc);
    }

    restBatch.set(doc(db, 'settings', 'property'), {
      name: DEFAULT_SETTINGS.name,
      tagline: DEFAULT_SETTINGS.tagline,
      address: DEFAULT_SETTINGS.address,
      whatsappAdmin: DEFAULT_SETTINGS.whatsappAdmin,
      paymentAccountInfo: DEFAULT_SETTINGS.paymentAccountInfo,
      paymentBankName: DEFAULT_SETTINGS.paymentBankName,
      paymentBankAccount: DEFAULT_SETTINGS.paymentBankAccount,
      paymentBankHolder: DEFAULT_SETTINGS.paymentBankHolder,
      qrisImageUrl: '',
      externalPaymentLink: '',
      defaultDueDay: DEFAULT_SETTINGS.defaultDueDay,
      totalRooms: DEFAULT_SETTINGS.totalRooms,
      updatedAt: serverTimestamp(),
    });

    restBatch.set(doc(db, 'settings', 'receipt'), {
      ...DEFAULT_RECEIPT_TEMPLATE,
      updatedAt: serverTimestamp(),
    });

    restBatch.set(doc(db, 'settings', 'admin'), {
      adminName: DEFAULT_SETTINGS.adminName,
      adminInitials: DEFAULT_SETTINGS.adminInitials,
      theme: DEFAULT_SETTINGS.theme,
      uiColorPreset: DEFAULT_SETTINGS.uiColorPreset ?? 'emerald',
      uiCustomColor: DEFAULT_SETTINGS.uiCustomColor ?? '#0f766e',
      updatedAt: serverTimestamp(),
    });

    await restBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'rooms');
  }
}

export async function checkInTenantToCloud(payload: {
  room: Room;
  tenant: Omit<Tenant, 'id'>;
  monthlyRate: number;
  payNow: boolean;
  method: PaymentMethod;
  billingMonth?: string;
  applicationId?: string;
}): Promise<void> {
  const { room, tenant, monthlyRate, payNow, method, billingMonth, applicationId } = payload;
  const targetMonth = billingMonth || getCurrentMonthISO() || '2026-11';
  try {
    const batch = writeBatch(db);

    batch.update(doc(db, 'rooms', room.id), {
      status: 'Terisi',
      monthlyRate,
      updatedAt: serverTimestamp(),
    });

    const tenantData: Record<string, unknown> = {
      roomNumber: room.number,
      name: tenant.name.trim().slice(0, 100),
      phone: tenant.phone.trim().slice(0, 30),
      institution: tenant.institution.trim().slice(0, 140),
      originCity: tenant.originCity.trim().slice(0, 80),
      checkInDate: tenant.checkInDate.slice(0, 20),
      dueDay: tenant.dueDay,
      emergencyContact: tenant.emergencyContact.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    };
    if (typeof tenant.depositAmount === 'number' && tenant.depositAmount > 0) {
      tenantData.depositAmount = Math.min(50000000, Math.max(0, tenant.depositAmount));
      tenantData.depositStatus = tenant.depositStatus ?? 'Disimpan';
    }
    if (tenant.notes?.trim()) {
      tenantData.notes = tenant.notes.trim().slice(0, 300);
    }
    batch.set(doc(db, 'tenants', room.id), tenantData);

    const paymentId = `pay-${targetMonth}-${room.number}`;
    batch.set(doc(db, 'payments', paymentId), {
      invoiceNo: buildInvoiceNumber(targetMonth, room.number),
      roomNumber: room.number,
      tenantName: tenant.name.trim().slice(0, 100),
      month: targetMonth,
      amount: monthlyRate,
      paidDate: payNow ? tenant.checkInDate.slice(0, 20) : null,
      status: payNow ? 'Lunas' : 'Belum Bayar',
      method: payNow ? method : null,
      updatedAt: serverTimestamp(),
    });

    if (applicationId) {
      batch.update(doc(db, 'applications', applicationId), {
        status: 'Diterima',
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${room.id}`);
  }
}

export async function updateTenantInCloud(
  roomId: string,
  roomNumber: string,
  tenant: Omit<Tenant, 'id'>
): Promise<void> {
  const tenantData: Record<string, unknown> = {
    roomNumber,
    name: tenant.name.trim().slice(0, 100),
    phone: tenant.phone.trim().slice(0, 30),
    institution: tenant.institution.trim().slice(0, 140) || '-',
    originCity: tenant.originCity.trim().slice(0, 80) || '-',
    checkInDate: tenant.checkInDate.slice(0, 20),
    dueDay: Math.min(28, Math.max(1, Number(tenant.dueDay) || 10)),
    emergencyContact: tenant.emergencyContact.trim().slice(0, 120) || '-',
    updatedAt: serverTimestamp(),
  };

  if (typeof tenant.depositAmount === 'number' && tenant.depositAmount > 0) {
    tenantData.depositAmount = Math.min(50000000, Math.max(0, tenant.depositAmount));
    tenantData.depositStatus = tenant.depositStatus ?? 'Disimpan';
  } else {
    tenantData.depositAmount = deleteField();
    tenantData.depositStatus = deleteField();
  }

  if (tenant.notes?.trim()) {
    tenantData.notes = tenant.notes.trim().slice(0, 300);
  } else {
    tenantData.notes = deleteField();
  }

  try {
    await updateDoc(doc(db, 'tenants', roomId), tenantData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tenants/${roomId}`);
  }
}

export async function checkOutTenantInCloud(
  room: Room,
  depositReturnStatus?: DepositStatus
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'rooms', room.id), {
      status: 'Tersedia',
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'tenants', room.id));

    if (room.tenant) {
      const historyId = `hist-${room.number}-${Date.now()}`;
      const historyDoc: Record<string, unknown> = {
        roomId: room.id,
        roomNumber: room.number,
        roomName: getRoomDisplayName(room).slice(0, 60),
        name: room.tenant.name.trim().slice(0, 100),
        phone: room.tenant.phone.trim().slice(0, 30),
        institution: (room.tenant.institution || '-').slice(0, 140),
        originCity: (room.tenant.originCity || '-').slice(0, 80),
        checkInDate: room.tenant.checkInDate.slice(0, 20),
        checkOutDate: getTodayISO(),
        monthlyRate: room.monthlyRate,
        createdAt: serverTimestamp(),
      };
      if (typeof room.tenant.depositAmount === 'number' && room.tenant.depositAmount > 0) {
        historyDoc.depositAmount = room.tenant.depositAmount;
        historyDoc.depositStatus =
          depositReturnStatus ?? room.tenant.depositStatus ?? 'Dikembalikan';
      }
      if (room.tenant.notes?.trim()) {
        historyDoc.notes = room.tenant.notes.trim().slice(0, 300);
      }
      batch.set(doc(db, 'tenantHistory', historyId), historyDoc);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${room.id}`);
  }
}

function buildPaymentLinkDocumentPayload(params: {
  payment: PaymentRecord;
  room: Room | null | undefined;
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
  statusOverride?: PaymentLinkStatus;
}): Record<string, unknown> {
  const { payment, room, settings, receiptTemplate, statusOverride } = params;
  const resolved = resolveRoomPaymentProfile(room, settings, receiptTemplate);
  const status: PaymentLinkStatus =
    statusOverride ?? (payment.status === 'Lunas' ? 'Lunas' : 'Belum Bayar');

  const docData: Record<string, unknown> = {
    paymentId: payment.id,
    roomId: room?.id || `r-${payment.roomNumber}`,
    roomNumber: payment.roomNumber,
    roomName: room ? getRoomDisplayName(room).slice(0, 60) : `Kamar ${payment.roomNumber}`,
    tenantName: payment.tenantName.trim().slice(0, 100),
    month: payment.month,
    invoiceNo: payment.invoiceNo.slice(0, 40),
    amount: payment.amount,
    dueDay: room?.tenant?.dueDay ?? settings.defaultDueDay,
    status,
    preferredMethod: resolved.preferredMethod,
    paidDate: payment.paidDate ?? null,
    method: payment.method ?? null,
    propertyName: settings.name.trim().slice(0, 80),
    propertyAddress: settings.address.trim().slice(0, 200),
    adminName: settings.adminName.trim().slice(0, 80),
    whatsappAdmin: settings.whatsappAdmin.trim().slice(0, 30),
    receiptSnapshot: buildReceiptSnapshot(room, receiptTemplate),
    updatedAt: serverTimestamp(),
  };

  if (typeof payment.lateFee === 'number' && payment.lateFee > 0) {
    docData.lateFee = payment.lateFee;
  }
  if (resolved.bankName) docData.bankName = resolved.bankName.slice(0, 50);
  if (resolved.accountNumber) docData.accountNumber = resolved.accountNumber.slice(0, 60);
  if (resolved.accountHolder) docData.accountHolder = resolved.accountHolder.slice(0, 80);
  if (resolved.qrisImageUrl) docData.qrisImageUrl = resolved.qrisImageUrl.slice(0, 450000);
  if (resolved.externalPaymentLink) {
    docData.externalPaymentLink = resolved.externalPaymentLink.slice(0, 300);
  }
  return docData;
}

export async function createOrSyncPaymentLinkInCloud(params: {
  payment: PaymentRecord;
  room: Room | null | undefined;
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
}): Promise<string> {
  const { payment, room, settings, receiptTemplate } = params;
  const linkId = payment.paymentLinkId || generatePaymentLinkId(payment.id);
  const linkPayload = buildPaymentLinkDocumentPayload({
    payment,
    room,
    settings,
    receiptTemplate,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'paymentLinks', linkId), linkPayload);
    if (payment.paymentLinkId !== linkId) {
      batch.update(doc(db, 'payments', payment.id), {
        paymentLinkId: linkId,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return linkId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `paymentLinks/${linkId}`);
  }
}

function mapPaymentLinkSnapshotData(
  id: string,
  data: Record<string, unknown>
): PaymentLinkRecord {
  return {
    id,
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
    propertyAddress: data.propertyAddress ? String(data.propertyAddress) : undefined,
    adminName: String(data.adminName ?? 'Pengelola'),
    whatsappAdmin: data.whatsappAdmin ? String(data.whatsappAdmin) : undefined,
    receiptSnapshot: data.receiptSnapshot as PaymentLinkRecord['receiptSnapshot'],
  };
}

export async function createBillAndPaymentLinkInCloud(params: {
  room: Room;
  month: string;
  existingPayment?: PaymentRecord | null;
  amount: number;
  lateFee?: number;
  notes?: string;
  preferredMethod?: PaymentMethod;
  externalPaymentLink?: string;
  settings: PropertySettings;
  receiptTemplate: ReceiptTemplateConfig;
}): Promise<{ payment: PaymentRecord; linkId: string }> {
  const {
    room,
    month,
    existingPayment,
    amount,
    lateFee,
    notes,
    preferredMethod,
    externalPaymentLink,
    settings,
    receiptTemplate,
  } = params;

  const cleanAmount = Math.min(50000000, Math.max(0, Number(amount) || 0));
  const cleanLateFee =
    typeof lateFee === 'number' && lateFee > 0
      ? Math.min(20000000, Math.max(0, lateFee))
      : undefined;
  const cleanNotes = notes?.trim() ? notes.trim().slice(0, 300) : undefined;

  const paymentId = existingPayment?.id || `pay-${month}-${room.number}`;
  const invoiceNo =
    existingPayment?.invoiceNo || buildInvoiceNumber(month, room.number);
  const linkId = existingPayment?.paymentLinkId || generatePaymentLinkId(paymentId);
  const tenantName =
    existingPayment?.tenantName || room.tenant?.name || `Penghuni Kamar ${room.number}`;

  const paymentRecord: PaymentRecord = {
    id: paymentId,
    invoiceNo,
    roomNumber: room.number,
    tenantName,
    month,
    amount: cleanAmount,
    lateFee: cleanLateFee,
    paidDate: existingPayment?.paidDate ?? null,
    status: existingPayment?.status ?? 'Belum Bayar',
    method: existingPayment?.method ?? null,
    notes: cleanNotes,
    paymentLinkId: linkId,
    receiptGeneratedAt: existingPayment?.receiptGeneratedAt,
  };

  const linkPayload = buildPaymentLinkDocumentPayload({
    payment: paymentRecord,
    room,
    settings,
    receiptTemplate,
  });
  if (preferredMethod) {
    linkPayload.preferredMethod = preferredMethod;
  }
  if (externalPaymentLink !== undefined) {
    const trimmedExt = externalPaymentLink.trim().slice(0, 300);
    if (trimmedExt) {
      linkPayload.externalPaymentLink = trimmedExt;
    } else {
      delete linkPayload.externalPaymentLink;
    }
  }

  const paymentPayload: Record<string, unknown> = {
    invoiceNo,
    roomNumber: room.number,
    tenantName: tenantName.trim().slice(0, 100),
    month,
    amount: cleanAmount,
    paidDate: paymentRecord.paidDate,
    status: paymentRecord.status,
    method: paymentRecord.method,
    paymentLinkId: linkId,
    updatedAt: serverTimestamp(),
  };
  if (cleanLateFee) {
    paymentPayload.lateFee = cleanLateFee;
  }
  if (cleanNotes) {
    paymentPayload.notes = cleanNotes;
  }

  try {
    const batch = writeBatch(db);
    if (existingPayment) {
      const updatePayload: Record<string, unknown> = {
        amount: cleanAmount,
        paymentLinkId: linkId,
        updatedAt: serverTimestamp(),
        lateFee: cleanLateFee ? cleanLateFee : deleteField(),
        notes: cleanNotes ? cleanNotes : deleteField(),
      };
      batch.update(doc(db, 'payments', paymentId), updatePayload);
    } else {
      batch.set(doc(db, 'payments', paymentId), paymentPayload);
    }
    batch.set(doc(db, 'paymentLinks', linkId), linkPayload);
    await batch.commit();
    return { payment: paymentRecord, linkId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `paymentLinks/${linkId}`);
  }
}

export async function getPaymentLinkPublicInCloud(
  linkId: string
): Promise<PaymentLinkRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'paymentLinks', linkId));
    if (!snap.exists()) return null;
    return mapPaymentLinkSnapshotData(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `paymentLinks/${linkId}`);
  }
}

export function subscribeToPaymentLinkPublicInCloud(
  linkId: string,
  onData: (record: PaymentLinkRecord | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'paymentLinks', linkId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapPaymentLinkSnapshotData(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function confirmPaymentLinkPublicInCloud(
  linkId: string,
  method: string,
  note?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    status: 'Menunggu Verifikasi',
    confirmationMethod: method.trim().slice(0, 40) || 'Transfer Bank',
    confirmedAt: new Date().toISOString().slice(0, 30),
    updatedAt: serverTimestamp(),
  };
  if (note?.trim()) {
    payload.confirmationNote = note.trim().slice(0, 200);
  }
  try {
    await updateDoc(doc(db, 'paymentLinks', linkId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `paymentLinks/${linkId}`);
  }
}

export async function markPaymentPaidInCloud(
  payment: PaymentRecord,
  options?: {
    paidDate?: string;
    method?: PaymentMethod;
    lateFee?: number;
    room?: Room | null;
    settings?: PropertySettings;
    receiptTemplate?: ReceiptTemplateConfig;
    linkRecord?: PaymentLinkRecord | null;
  }
): Promise<PaymentRecord> {
  const paidDate = options?.paidDate || getTodayISO();
  const resolvedDefaultMethod = options?.room?.receiptProfile?.useCustom
    ? options.room.receiptProfile.preferredMethod
    : undefined;
  const method =
    options?.method ?? payment.method ?? resolvedDefaultMethod ?? 'Transfer BCA';
  const linkId = payment.paymentLinkId || generatePaymentLinkId(payment.id);
  const receiptGeneratedAt = new Date().toISOString().slice(0, 30);

  const payload: Record<string, unknown> = {
    status: 'Lunas',
    paidDate,
    method,
    paymentLinkId: linkId,
    receiptGeneratedAt,
    updatedAt: serverTimestamp(),
  };
  if (typeof options?.lateFee === 'number') {
    if (options.lateFee > 0) {
      payload.lateFee = Math.min(20000000, Math.max(0, options.lateFee));
    } else {
      payload.lateFee = deleteField();
    }
  }

  const updatedRecord: PaymentRecord = {
    ...payment,
    status: 'Lunas',
    paidDate,
    method,
    lateFee:
      typeof options?.lateFee === 'number'
        ? options.lateFee > 0
          ? options.lateFee
          : undefined
        : payment.lateFee,
    paymentLinkId: linkId,
    receiptGeneratedAt,
  };

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payments', payment.id), payload);

    if (options?.settings && options?.receiptTemplate) {
      const linkPayload = buildPaymentLinkDocumentPayload({
        payment: updatedRecord,
        room: options.room,
        settings: options.settings,
        receiptTemplate: options.receiptTemplate,
        statusOverride: 'Lunas',
      });
      if (options.linkRecord?.confirmationMethod) {
        linkPayload.confirmationMethod = options.linkRecord.confirmationMethod.slice(0, 40);
      }
      if (options.linkRecord?.confirmationNote) {
        linkPayload.confirmationNote = options.linkRecord.confirmationNote.slice(0, 200);
      }
      if (options.linkRecord?.confirmedAt) {
        linkPayload.confirmedAt = options.linkRecord.confirmedAt.slice(0, 30);
      }
      batch.set(doc(db, 'paymentLinks', linkId), linkPayload);
    }

    await batch.commit();
    return updatedRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${payment.id}`);
  }
}

export async function updatePaymentDetailsInCloud(
  paymentId: string,
  payload: {
    tenantName?: string;
    month?: string;
    invoiceNo?: string;
    amount: number;
    lateFee?: number;
    status?: 'Lunas' | 'Belum Bayar';
    paidDate?: string | null;
    method?: PaymentMethod | null;
    notes?: string;
    paymentLinkId?: string;
  }
): Promise<void> {
  const cleanAmount = Math.min(50000000, Math.max(0, Number(payload.amount) || 0));
  const cleanLateFee =
    typeof payload.lateFee === 'number' && payload.lateFee > 0
      ? Math.min(20000000, Math.max(0, payload.lateFee))
      : 0;

  const updateData: Record<string, unknown> = {
    amount: cleanAmount,
    updatedAt: serverTimestamp(),
  };

  if (payload.tenantName !== undefined) {
    const cleanName = payload.tenantName.trim().slice(0, 100);
    if (cleanName.length >= 2) {
      updateData.tenantName = cleanName;
    }
  }
  if (payload.month && /^\d{4}-\d{2}$/.test(payload.month)) {
    updateData.month = payload.month;
  }
  if (payload.invoiceNo?.trim() && payload.invoiceNo.trim().length >= 5) {
    updateData.invoiceNo = payload.invoiceNo.trim().slice(0, 40);
  }

  if (cleanLateFee > 0) {
    updateData.lateFee = cleanLateFee;
  } else {
    updateData.lateFee = deleteField();
  }

  if (payload.notes?.trim()) {
    updateData.notes = payload.notes.trim().slice(0, 300);
  } else {
    updateData.notes = deleteField();
  }

  const nextStatus = payload.status;
  let resolvedPaidDate: string | null | undefined = undefined;
  let resolvedMethod: PaymentMethod | null | undefined = undefined;

  if (nextStatus === 'Lunas') {
    resolvedPaidDate =
      payload.paidDate && payload.paidDate.trim().length >= 8
        ? payload.paidDate.trim().slice(0, 20)
        : getTodayISO();
    resolvedMethod = payload.method ?? 'Transfer BCA';
    updateData.status = 'Lunas';
    updateData.paidDate = resolvedPaidDate;
    updateData.method = resolvedMethod;
    updateData.receiptGeneratedAt = new Date().toISOString().slice(0, 30);
  } else if (nextStatus === 'Belum Bayar') {
    resolvedPaidDate = null;
    resolvedMethod = null;
    updateData.status = 'Belum Bayar';
    updateData.paidDate = null;
    updateData.method = null;
    updateData.receiptGeneratedAt = deleteField();
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payments', paymentId), updateData);

    if (payload.paymentLinkId) {
      const linkRef = doc(db, 'paymentLinks', payload.paymentLinkId);
      const linkSnap = await getDoc(linkRef);
      if (linkSnap.exists()) {
        const linkPatch: Record<string, unknown> = {
          amount: cleanAmount,
          updatedAt: serverTimestamp(),
        };
        if (updateData.tenantName) {
          linkPatch.tenantName = updateData.tenantName;
        }
        if (updateData.month) {
          linkPatch.month = updateData.month;
        }
        if (updateData.invoiceNo) {
          linkPatch.invoiceNo = updateData.invoiceNo;
        }
        if (cleanLateFee > 0) {
          linkPatch.lateFee = cleanLateFee;
        } else {
          linkPatch.lateFee = deleteField();
        }
        if (nextStatus === 'Lunas') {
          linkPatch.status = 'Lunas';
          linkPatch.paidDate = resolvedPaidDate ?? null;
          linkPatch.method = resolvedMethod ?? 'Transfer BCA';
        } else if (nextStatus === 'Belum Bayar') {
          linkPatch.status = 'Belum Bayar';
          linkPatch.paidDate = null;
          linkPatch.method = null;
          linkPatch.confirmationMethod = deleteField();
          linkPatch.confirmationNote = deleteField();
          linkPatch.confirmedAt = deleteField();
        }
        batch.update(linkRef, linkPatch);
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
  }
}

export async function deletePaymentInCloud(
  paymentId: string,
  paymentLinkId?: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'payments', paymentId));
    if (paymentLinkId) {
      const linkRef = doc(db, 'paymentLinks', paymentLinkId);
      const linkSnap = await getDoc(linkRef);
      if (linkSnap.exists()) {
        batch.delete(linkRef);
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `payments/${paymentId}`);
  }
}

export async function upsertPaymentInCloud(payload: {
  roomNumber: string;
  tenantName: string;
  month: string;
  amount: number;
  lateFee?: number;
  paidDate: string;
  method: PaymentMethod;
  notes?: string;
  room?: Room | null;
  settings?: PropertySettings;
  receiptTemplate?: ReceiptTemplateConfig;
}): Promise<PaymentRecord> {
  const paymentId = `pay-${payload.month}-${payload.roomNumber}`;
  const invoiceNo = buildInvoiceNumber(payload.month, payload.roomNumber);
  const linkId = generatePaymentLinkId(paymentId);
  const receiptGeneratedAt = new Date().toISOString().slice(0, 30);

  const docData: Record<string, unknown> = {
    invoiceNo,
    roomNumber: payload.roomNumber,
    tenantName: payload.tenantName.trim().slice(0, 100),
    month: payload.month,
    amount: payload.amount,
    paidDate: payload.paidDate,
    status: 'Lunas',
    method: payload.method,
    paymentLinkId: linkId,
    receiptGeneratedAt,
    updatedAt: serverTimestamp(),
  };
  if (typeof payload.lateFee === 'number' && payload.lateFee > 0) {
    docData.lateFee = Math.min(20000000, Math.max(0, payload.lateFee));
  }
  if (payload.notes?.trim()) {
    docData.notes = payload.notes.trim().slice(0, 300);
  }

  const record: PaymentRecord = {
    id: paymentId,
    invoiceNo,
    roomNumber: payload.roomNumber,
    tenantName: payload.tenantName.trim().slice(0, 100),
    month: payload.month,
    amount: payload.amount,
    lateFee: payload.lateFee && payload.lateFee > 0 ? payload.lateFee : undefined,
    paidDate: payload.paidDate,
    status: 'Lunas',
    method: payload.method,
    notes: payload.notes?.trim() || undefined,
    paymentLinkId: linkId,
    receiptGeneratedAt,
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'payments', paymentId), docData);
    if (payload.settings && payload.receiptTemplate) {
      batch.set(
        doc(db, 'paymentLinks', linkId),
        buildPaymentLinkDocumentPayload({
          payment: record,
          room: payload.room,
          settings: payload.settings,
          receiptTemplate: payload.receiptTemplate,
          statusOverride: 'Lunas',
        })
      );
    }
    await batch.commit();
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payments/${paymentId}`);
  }
}

export async function generateMonthlyBillsInCloud(
  month: string,
  rooms: Room[],
  existingPayments: PaymentRecord[]
): Promise<number> {
  const existingKeys = new Set(
    existingPayments.filter((p) => p.month === month).map((p) => p.roomNumber)
  );
  const targets = rooms.filter(
    (r) => r.status === 'Terisi' && r.tenant && !existingKeys.has(r.number)
  );
  if (targets.length === 0) return 0;

  try {
    for (let i = 0; i < targets.length; i += 20) {
      const chunk = targets.slice(i, i + 20);
      const batch = writeBatch(db);
      for (const room of chunk) {
        if (!room.tenant) continue;
        const paymentId = `pay-${month}-${room.number}`;
        batch.set(doc(db, 'payments', paymentId), {
          invoiceNo: buildInvoiceNumber(month, room.number),
          roomNumber: room.number,
          tenantName: room.tenant.name.trim().slice(0, 100),
          month,
          amount: room.monthlyRate,
          paidDate: null,
          status: 'Belum Bayar',
          method: null,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    return targets.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payments');
  }
}

export async function addExpenseInCloud(payload: {
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
}): Promise<void> {
  const id = `exp-${Date.now()}`;
  const cleanTitle = payload.title.trim().slice(0, 160);
  const cleanAmount = Math.min(100000000, Math.max(0, Number(payload.amount) || 0));
  const cleanDate = payload.date.slice(0, 20) || getTodayISO();
  const month = cleanDate.slice(0, 7) || getCurrentMonthISO();
  const docData: Record<string, unknown> = {
    title: cleanTitle.length >= 2 ? cleanTitle : 'Pengeluaran Kost',
    category: payload.category,
    amount: cleanAmount,
    date: cleanDate,
    month,
    createdAt: serverTimestamp(),
  };
  if (payload.notes?.trim()) {
    docData.notes = payload.notes.trim().slice(0, 300);
  }
  try {
    await setDoc(doc(db, 'expenses', id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `expenses/${id}`);
  }
}

export async function updateExpenseInCloud(
  id: string,
  payload: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    notes?: string;
  }
): Promise<void> {
  const cleanTitle = payload.title.trim().slice(0, 160);
  const cleanAmount = Math.min(100000000, Math.max(0, Number(payload.amount) || 0));
  const cleanDate = payload.date.slice(0, 20) || getTodayISO();
  const month = cleanDate.slice(0, 7) || getCurrentMonthISO();
  const updateData: Record<string, unknown> = {
    title: cleanTitle.length >= 2 ? cleanTitle : 'Pengeluaran Kost',
    category: payload.category,
    amount: cleanAmount,
    date: cleanDate,
    month,
    notes: payload.notes?.trim() ? payload.notes.trim().slice(0, 300) : deleteField(),
  };
  try {
    await updateDoc(doc(db, 'expenses', id), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `expenses/${id}`);
  }
}

export async function deleteExpenseInCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'expenses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
  }
}

export async function addIncomeInCloud(payload: {
  title: string;
  category: IncomeCategory;
  amount: number;
  date: string;
  method?: PaymentMethod;
  notes?: string;
}): Promise<void> {
  const id = `inc-${Date.now()}`;
  const cleanTitle = payload.title.trim().slice(0, 160);
  const cleanAmount = Math.min(100000000, Math.max(0, Number(payload.amount) || 0));
  const cleanDate = payload.date.slice(0, 20) || getTodayISO();
  const month = cleanDate.slice(0, 7) || getCurrentMonthISO();
  const docData: Record<string, unknown> = {
    title: cleanTitle.length >= 2 ? cleanTitle : 'Pemasukan Kost',
    category: payload.category,
    amount: cleanAmount,
    date: cleanDate,
    month,
    createdAt: serverTimestamp(),
  };
  if (payload.method) {
    docData.method = payload.method.slice(0, 40);
  }
  if (payload.notes?.trim()) {
    docData.notes = payload.notes.trim().slice(0, 300);
  }
  try {
    await setDoc(doc(db, 'incomes', id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `incomes/${id}`);
  }
}

export async function updateIncomeInCloud(
  id: string,
  payload: {
    title: string;
    category: IncomeCategory;
    amount: number;
    date: string;
    method?: PaymentMethod;
    notes?: string;
  }
): Promise<void> {
  const cleanTitle = payload.title.trim().slice(0, 160);
  const cleanAmount = Math.min(100000000, Math.max(0, Number(payload.amount) || 0));
  const cleanDate = payload.date.slice(0, 20) || getTodayISO();
  const month = cleanDate.slice(0, 7) || getCurrentMonthISO();
  const updateData: Record<string, unknown> = {
    title: cleanTitle.length >= 2 ? cleanTitle : 'Pemasukan Kost',
    category: payload.category,
    amount: cleanAmount,
    date: cleanDate,
    month,
    method: payload.method ? payload.method.slice(0, 40) : deleteField(),
    notes: payload.notes?.trim() ? payload.notes.trim().slice(0, 300) : deleteField(),
  };
  try {
    await updateDoc(doc(db, 'incomes', id), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `incomes/${id}`);
  }
}

export async function deleteIncomeInCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'incomes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `incomes/${id}`);
  }
}

export async function saveSettingsInCloud(updated: PropertySettings): Promise<void> {
  const bankLine = updated.paymentBankAccount.trim()
    ? `${updated.paymentBankName.trim() || 'BCA'} ${updated.paymentBankAccount.trim()}${
        updated.paymentBankHolder.trim() ? ` a.n. ${updated.paymentBankHolder.trim()}` : ''
      }`
    : '';
  const mergedSummary =
    updated.paymentAccountInfo.trim() ||
    [bankLine, updated.qrisImageUrl ? `QRIS ${updated.name}` : '']
      .filter(Boolean)
      .join(' / ');

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'property'), {
      name: updated.name.trim().slice(0, 80),
      tagline: updated.tagline.trim().slice(0, 140),
      address: updated.address.trim().slice(0, 200),
      whatsappAdmin: updated.whatsappAdmin.trim().slice(0, 30),
      paymentAccountInfo: mergedSummary.slice(0, 240),
      paymentBankName: updated.paymentBankName.trim().slice(0, 50),
      paymentBankAccount: updated.paymentBankAccount.trim().slice(0, 60),
      paymentBankHolder: updated.paymentBankHolder.trim().slice(0, 80),
      qrisImageUrl: (updated.qrisImageUrl ?? '').trim().slice(0, 450000),
      externalPaymentLink: (updated.externalPaymentLink ?? '').trim().slice(0, 300),
      publicAppUrl: normalizePublicBaseUrl(updated.publicAppUrl).slice(0, 200),
      defaultDueDay: updated.defaultDueDay,
      totalRooms: updated.totalRooms,
      updatedAt: serverTimestamp(),
    });
    const validPresets = new Set(['emerald', 'ocean', 'indigo', 'amber', 'rose', 'slate', 'custom']);
    const preset = validPresets.has(String(updated.uiColorPreset ?? 'emerald'))
      ? (updated.uiColorPreset ?? 'emerald')
      : 'emerald';
    const rawHex = String(updated.uiCustomColor ?? '#0f766e').trim();
    const safeCustomHex = /^#[0-9a-fA-F]{6}$/.test(rawHex) ? rawHex.toLowerCase() : '#0f766e';

    batch.set(doc(db, 'settings', 'admin'), {
      adminName: updated.adminName.trim().slice(0, 80) || 'Admin',
      adminInitials: updated.adminInitials.trim().slice(0, 4) || 'AD',
      theme: updated.theme,
      uiColorPreset: preset,
      uiCustomColor: safeCustomHex,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings');
  }
}

export async function saveReceiptTemplateInCloud(
  config: ReceiptTemplateConfig
): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'receipt'), {
      title: config.title.trim().slice(0, 60) || 'KWITANSI SEWA RESMI',
      subtitle: config.subtitle.trim().slice(0, 120),
      accentTheme: config.accentTheme,
      includedItemsText: config.includedItemsText.trim().slice(0, 200),
      footerNote: config.footerNote.trim().slice(0, 300),
      signerLabel: config.signerLabel.trim().slice(0, 60) || 'Pengelola Properti',
      showLogo: Boolean(config.showLogo),
      showAddress: Boolean(config.showAddress),
      showQrVerification: Boolean(config.showQrVerification),
      showDepositInfo: Boolean(config.showDepositInfo),
      autoGeneratePdfOnPaid: Boolean(config.autoGeneratePdfOnPaid),
      autoOpenReceiptModalOnPaid: Boolean(config.autoOpenReceiptModalOnPaid),
      autoOpenWaOnPaid: Boolean(config.autoOpenWaOnPaid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/receipt');
  }
}

export async function saveMessageTemplateInCloud(template: MessageTemplate): Promise<void> {
  try {
    await setDoc(doc(db, 'messageTemplates', template.id), {
      name: template.name.trim().slice(0, 80),
      category: template.category,
      body: template.body.trim().slice(0, 2500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `messageTemplates/${template.id}`);
  }
}

export async function deleteMessageTemplateInCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'messageTemplates', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `messageTemplates/${id}`);
  }
}

export async function addAdminInviteInCloud(payload: {
  email: string;
  name: string;
  role?: 'owner' | 'staff';
  addedBy: string;
}): Promise<void> {
  const normalized = payload.email.trim().toLowerCase();
  const role: 'owner' | 'staff' = payload.role === 'owner' ? 'owner' : 'staff';
  try {
    await setDoc(doc(db, 'adminInvites', normalized), {
      email: normalized,
      name: payload.name.trim().slice(0, 80),
      role,
      addedBy: payload.addedBy.slice(0, 120),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `adminInvites/${normalized}`);
  }
}

export async function removeAdminInviteInCloud(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, 'adminInvites', normalized));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `adminInvites/${normalized}`);
  }
}

export async function saveRoomTypeConfigInCloud(
  config: RoomTypeConfig,
  syncRoomIds: string[]
): Promise<void> {
  const cleanFacilities = config.facilities
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 15);
  const safeFacilities = cleanFacilities.length > 0 ? cleanFacilities : ['AC & WiFi 100 Mbps'];

  const fallbackType =
    DEFAULT_ROOM_TYPES.find((item) => item.id === config.id) ?? DEFAULT_ROOM_TYPES[0];
  const rawImages: RoomGalleryImage[] =
    config.images && config.images.length > 0
      ? config.images
      : [{ url: config.imageUrl || fallbackType.imageUrl, label: 'Foto Utama' }];

  const cleanImages: RoomGalleryImage[] = rawImages
    .filter((item) => item.url && item.url.trim().length > 0)
    .slice(0, 6)
    .map((item, idx) => ({
      url: item.url.trim().slice(0, 450000),
      label: (item.label ?? '').trim().slice(0, 60) || `Foto ${idx + 1}`,
    }));

  const safeImages =
    cleanImages.length > 0
      ? cleanImages
      : [{ url: fallbackType.imageUrl, label: 'Foto Utama' }];

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'roomTypes', config.id), {
      tier: config.tier,
      displayName: (config.displayName ?? config.tier).trim().slice(0, 60) || config.tier,
      subtitle: config.subtitle.trim().slice(0, 80) || config.tier,
      monthlyRate: Math.max(0, Math.min(50000000, Number(config.monthlyRate) || 0)),
      areaSqm: Math.max(4, Math.min(100, Number(config.areaSqm) || 12)),
      description: config.description.trim().slice(0, 600),
      imageUrl: safeImages[0].url,
      images: safeImages,
      facilities: safeFacilities,
      updatedAt: serverTimestamp(),
    });

    for (const roomId of syncRoomIds) {
      batch.update(doc(db, 'rooms', roomId), {
        tier: config.tier,
        monthlyRate: Math.max(0, Math.min(50000000, Number(config.monthlyRate) || 0)),
        areaSqm: Math.max(4, Math.min(100, Number(config.areaSqm) || 12)),
        facilities: safeFacilities,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `roomTypes/${config.id}`);
  }
}

export async function addRoomUnitInCloud(payload: {
  number: string;
  name?: string;
  floor: number;
  tier: RoomTier;
  monthlyRate: number;
  areaSqm: number;
  facilities: string[];
}): Promise<string> {
  const cleanNumber = payload.number.trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 10);
  const roomId = `r-${cleanNumber}`;
  const cleanFacilities = payload.facilities
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 15);
  const safeFacilities = cleanFacilities.length > 0 ? cleanFacilities : ['AC & WiFi 100 Mbps'];

  const docData: Record<string, unknown> = {
    number: cleanNumber,
    floor: Math.min(10, Math.max(1, Number(payload.floor) || 1)),
    tier: payload.tier,
    monthlyRate: Math.max(0, Math.min(50000000, Number(payload.monthlyRate) || 0)),
    areaSqm: Math.max(4, Math.min(100, Number(payload.areaSqm) || 12)),
    facilities: safeFacilities,
    status: 'Tersedia',
    updatedAt: serverTimestamp(),
  };

  if (payload.name?.trim()) {
    docData.name = payload.name.trim().slice(0, 60);
  }

  try {
    await setDoc(doc(db, 'rooms', roomId), docData);
    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function updateRoomUnitInCloud(
  roomId: string,
  payload: {
    name?: string;
    tier: RoomTier;
    monthlyRate: number;
    areaSqm: number;
    facilities: string[];
    status?: RoomStatus;
  }
): Promise<void> {
  const cleanFacilities = payload.facilities
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 15);
  const safeFacilities = cleanFacilities.length > 0 ? cleanFacilities : ['AC & WiFi 100 Mbps'];
  const cleanName = payload.name?.trim().slice(0, 60);

  const updateData: Record<string, unknown> = {
    name: cleanName ? cleanName : deleteField(),
    tier: payload.tier,
    monthlyRate: Math.max(0, Math.min(50000000, Number(payload.monthlyRate) || 0)),
    areaSqm: Math.max(4, Math.min(100, Number(payload.areaSqm) || 12)),
    facilities: safeFacilities,
    updatedAt: serverTimestamp(),
  };

  if (payload.status) {
    updateData.status = payload.status;
  }

  try {
    await updateDoc(doc(db, 'rooms', roomId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function updateRoomReceiptProfileInCloud(
  roomId: string,
  profile: RoomReceiptProfile
): Promise<void> {
  const cleanProfile: Record<string, unknown> = {
    useCustom: Boolean(profile.useCustom),
    preferredMethod: profile.preferredMethod,
    autoPdfOnPaid: Boolean(profile.autoPdfOnPaid),
    autoOpenWaOnPaid: Boolean(profile.autoOpenWaOnPaid),
  };
  if (profile.bankName?.trim()) {
    cleanProfile.bankName = profile.bankName.trim().slice(0, 50);
  }
  if (profile.accountNumber?.trim()) {
    cleanProfile.accountNumber = profile.accountNumber.trim().slice(0, 60);
  }
  if (profile.accountHolder?.trim()) {
    cleanProfile.accountHolder = profile.accountHolder.trim().slice(0, 80);
  }
  if (profile.customPaymentUrl?.trim()) {
    cleanProfile.customPaymentUrl = profile.customPaymentUrl.trim().slice(0, 300);
  }
  if (profile.customReceiptNote?.trim()) {
    cleanProfile.customReceiptNote = profile.customReceiptNote.trim().slice(0, 240);
  }

  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      receiptProfile: cleanProfile,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function deleteRoomUnitInCloud(roomId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rooms/${roomId}`);
  }
}

export async function addMaintenanceLogInCloud(payload: {
  roomId: string;
  roomNumber: string;
  title: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  cost: number;
  reportedDate: string;
  notes?: string;
}): Promise<void> {
  const id = `mnt-${payload.roomNumber}-${Date.now()}`;
  const docData: Record<string, unknown> = {
    roomId: payload.roomId,
    roomNumber: payload.roomNumber,
    title: payload.title.trim().slice(0, 140),
    category: payload.category,
    status: payload.status,
    cost: Math.min(100000000, Math.max(0, Number(payload.cost) || 0)),
    reportedDate: payload.reportedDate.slice(0, 20),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (payload.notes?.trim()) {
    docData.notes = payload.notes.trim().slice(0, 300);
  }
  try {
    await setDoc(doc(db, 'maintenanceLogs', id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `maintenanceLogs/${id}`);
  }
}

export async function updateMaintenanceLogInCloud(
  logId: string,
  payload: {
    title: string;
    category: MaintenanceCategory;
    status: MaintenanceStatus;
    cost: number;
    reportedDate: string;
    notes?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    title: payload.title.trim().slice(0, 140),
    category: payload.category,
    status: payload.status,
    cost: Math.min(100000000, Math.max(0, Number(payload.cost) || 0)),
    reportedDate: payload.reportedDate.slice(0, 20),
    updatedAt: serverTimestamp(),
  };
  if (payload.notes?.trim()) {
    updateData.notes = payload.notes.trim().slice(0, 300);
  } else {
    updateData.notes = deleteField();
  }
  try {
    await updateDoc(doc(db, 'maintenanceLogs', logId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `maintenanceLogs/${logId}`);
  }
}

export async function deleteMaintenanceLogInCloud(logId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'maintenanceLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `maintenanceLogs/${logId}`);
  }
}
