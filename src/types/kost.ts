export type NavPage =
  | 'dashboard'
  | 'rooms'
  | 'payments'
  | 'finance'
  | 'messages'
  | 'settings';

export type RoomTier = 'Tipe A' | 'Tipe B' | 'Tipe C';

export type RoomTypeId = 'tipe-a' | 'tipe-b' | 'tipe-c';

export interface RoomGalleryImage {
  url: string;
  label: string;
}

export interface RoomTypeConfig {
  id: RoomTypeId;
  tier: RoomTier;
  displayName?: string;
  subtitle: string;
  monthlyRate: number;
  areaSqm: number;
  description: string;
  imageUrl: string;
  images: RoomGalleryImage[];
  facilities: string[];
}

export type RoomStatus = 'Terisi' | 'Tersedia' | 'Perawatan';

export type DepositStatus = 'Belum Bayar' | 'Disimpan' | 'Dikembalikan';

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  institution: string;
  originCity: string;
  checkInDate: string; // YYYY-MM-DD
  dueDay: number;
  emergencyContact: string;
  depositAmount?: number;
  depositStatus?: DepositStatus;
  notes?: string;
}

export type PaymentStatus = 'Lunas' | 'Belum Bayar';

export type PaymentMethod = 'Transfer BCA' | 'QRIS' | 'Transfer Mandiri' | 'Tunai';

export interface RoomReceiptProfile {
  useCustom: boolean;
  preferredMethod: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  customPaymentUrl?: string;
  autoPdfOnPaid: boolean;
  autoOpenWaOnPaid: boolean;
  customReceiptNote?: string;
}

export interface Room {
  id: string;
  number: string; // '101' .. '208' or custom unit code
  name?: string;
  floor: number;
  tier: RoomTier;
  monthlyRate: number;
  areaSqm: number;
  facilities: string[];
  status: RoomStatus;
  tenant: Tenant | null;
  receiptProfile?: RoomReceiptProfile;
}

export interface PaymentRecord {
  id: string;
  invoiceNo: string;
  roomNumber: string;
  tenantName: string;
  month: string; // '2026-11'
  amount: number;
  lateFee?: number;
  paidDate: string | null; // YYYY-MM-DD
  status: PaymentStatus;
  method: PaymentMethod | null;
  notes?: string;
  paymentLinkId?: string;
  receiptGeneratedAt?: string;
}

export type PaymentLinkStatus = 'Belum Bayar' | 'Menunggu Verifikasi' | 'Lunas';

export type ReceiptAccentTheme = 'teal' | 'navy' | 'slate';

export interface ReceiptTemplateConfig {
  title: string;
  subtitle: string;
  accentTheme: ReceiptAccentTheme;
  includedItemsText: string;
  footerNote: string;
  signerLabel: string;
  showLogo: boolean;
  showAddress: boolean;
  showQrVerification: boolean;
  showDepositInfo: boolean;
  autoGeneratePdfOnPaid: boolean;
  autoOpenReceiptModalOnPaid: boolean;
  autoOpenWaOnPaid: boolean;
}

export interface ReceiptSnapshot {
  title?: string;
  subtitle?: string;
  accentTheme?: ReceiptAccentTheme;
  includedItemsText?: string;
  footerNote?: string;
  signerLabel?: string;
  customRoomNote?: string;
  showLogo?: boolean;
  showAddress?: boolean;
  showQrVerification?: boolean;
  showDepositInfo?: boolean;
  depositAmount?: number;
  depositStatus?: DepositStatus;
}

export interface PaymentLinkRecord {
  id: string;
  paymentId: string;
  roomId: string;
  roomNumber: string;
  roomName?: string;
  tenantName: string;
  month: string;
  invoiceNo: string;
  amount: number;
  lateFee?: number;
  dueDay: number;
  status: PaymentLinkStatus;
  preferredMethod: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  qrisImageUrl?: string;
  externalPaymentLink?: string;
  paidDate: string | null;
  method: string | null;
  confirmationMethod?: string;
  confirmationNote?: string;
  confirmedAt?: string;
  propertyName: string;
  propertyAddress?: string;
  adminName: string;
  whatsappAdmin?: string;
  receiptSnapshot?: ReceiptSnapshot;
}

export type ExpenseCategory = 'Listrik' | 'Air' | 'Bahan' | 'Tagihan' | 'Lainnya';

export interface ExpenseRecord {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  month: string; // '2026-11'
  notes?: string;
}

export interface MonthlyHistoricalSummary {
  month: string; // '2026-06'
  label: string; // 'Jun'
  income: number;
  expense: number;
}

export interface PropertySettings {
  name: string;
  tagline: string;
  address: string;
  whatsappAdmin: string;
  paymentAccountInfo: string;
  paymentBankName: string;
  paymentBankAccount: string;
  paymentBankHolder: string;
  qrisImageUrl: string;
  externalPaymentLink: string;
  adminName: string;
  adminInitials: string;
  totalRooms: number;
  defaultDueDay: number;
  theme: 'dark' | 'light';
  rates: {
    standar: number;
    deluxe: number;
    corner: number;
  };
}

export type ApplicationStatus = 'Menunggu' | 'Diterima' | 'Ditolak';

export interface TenantApplication {
  id: string;
  roomId: string;
  roomNumber: string;
  applicantName: string;
  phone: string;
  institution: string;
  originCity: string;
  plannedCheckInDate: string;
  emergencyContact: string;
  notes?: string;
  status: ApplicationStatus;
  createdAtMs?: number;
}

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'owner' | 'staff';
}

export interface AdminInvite {
  email: string;
  name: string;
  role: 'owner' | 'staff';
  addedBy: string;
}

export type MaintenanceCategory =
  | 'AC'
  | 'Listrik'
  | 'Air & Sanitasi'
  | 'Kunci & Pintu'
  | 'Kebersihan'
  | 'Lainnya';

export type MaintenanceStatus = 'Dilaporkan' | 'Diproses' | 'Selesai';

export interface MaintenanceLog {
  id: string;
  roomId: string;
  roomNumber: string;
  title: string;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  cost: number;
  reportedDate: string;
  notes?: string;
}

export interface TenantHistoryRecord {
  id: string;
  roomId: string;
  roomNumber: string;
  roomName?: string;
  name: string;
  phone: string;
  institution?: string;
  originCity?: string;
  checkInDate: string;
  checkOutDate: string;
  monthlyRate: number;
  depositAmount?: number;
  depositStatus?: DepositStatus;
  notes?: string;
}

export type MessageTemplateCategory =
  | 'tagihan'
  | 'tunggakan'
  | 'lunas'
  | 'promo'
  | 'pengumuman'
  | 'kustom';

export interface MessageTemplate {
  id: string;
  name: string;
  category: MessageTemplateCategory;
  body: string;
}
