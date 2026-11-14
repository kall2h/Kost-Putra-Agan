import {
  ExpenseRecord,
  MessageTemplate,
  PaymentRecord,
  PropertySettings,
  Room,
} from '../types/kost';
import { DEFAULT_RECEIPT_TEMPLATE, getRoomDisplayName } from '../data/initialData';
import { formatDateID, formatIDR, formatMonthYear } from './format';
import { buildShareablePaymentUrl, resolveRoomPaymentProfile } from './receiptPdf';

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-tagihan',
    name: 'Pengingat Tagihan Bulanan',
    category: 'tagihan',
    body: [
      'Halo *{nama_penyewa}*,',
      '',
      'Mengingatkan tagihan sewa *{nama_kamar}* ({tipe_kamar}) di *{nama_kos}* periode *{bulan}*:',
      '• No. Invoice: {no_invoice}',
      '• Sewa Kamar: {nominal}',
      '• Denda Keterlambatan: {denda}',
      '• *Total Tagihan: {total_tagihan}*',
      '• Jatuh Tempo: Tanggal {jatuh_tempo}',
      '',
      'Pembayaran ({metode_kamar}) dapat dilakukan melalui:',
      '{info_rekening}',
      '{link_pembayaran}',
      '',
      'Setelah transfer, konfirmasi atau unduh kwitansi PDF melalui tautan di atas. Terima kasih.',
    ].join('\n'),
  },
  {
    id: 'tpl-tunggakan',
    name: 'Pengingat Tunggakan (Lewat Tempo)',
    category: 'tunggakan',
    body: [
      'Halo *{nama_penyewa}*,',
      '',
      'Kami menginformasikan bahwa tagihan sewa *{nama_kamar}* ({nama_kos}) periode *{bulan}* sebesar *{total_tagihan}* sudah melewati jatuh tempo tanggal {jatuh_tempo}.',
      '',
      'Mohon segera melakukan pelunasan melalui:',
      '{info_rekening}',
      '{link_pembayaran}',
      '',
      'Jika sudah melakukan transfer, mohon konfirmasi agar kwitansi PDF resmi dapat segera terbit. Terima kasih.',
    ].join('\n'),
  },
  {
    id: 'tpl-lunas',
    name: 'Konfirmasi Lunas & Kwitansi',
    category: 'lunas',
    body: [
      '*KWITANSI RESMI — {nama_kos}*',
      'No. Kwitansi: {no_invoice}',
      'Penyewa: *{nama_penyewa}* ({nama_kamar})',
      'Periode Sewa: {bulan}',
      'Nominal Dibayar: *{total_tagihan}*',
      'Tanggal Bayar: {tanggal_bayar}',
      'Metode: {metode_bayar}',
      'Status: *LUNAS*',
      '',
      'Unduh bukti kwitansi PDF resmi:',
      '{link_pembayaran}',
      '',
      'Terima kasih telah melakukan pembayaran tepat waktu.',
    ].join('\n'),
  },
  {
    id: 'tpl-promo',
    name: 'Info Kamar Kosong (Promosi WA)',
    category: 'promo',
    body: [
      '*{nama_kos}* — {tagline}',
      'Lokasi: {alamat_kos}',
      '',
      'Fasilitas Lengkap: Kamar AC Split, Kamar Mandi Dalam, Kasur Springbed, Meja Belajar, WiFi 100 Mbps, Dapur Bersama & Parkir Luas.',
      '',
      'Unit tersedia saat ini:',
      '{kamar_kosong}',
      '',
      'Info & Survei Lokasi: wa.me/{wa_admin}',
    ].join('\n'),
  },
  {
    id: 'tpl-pengumuman',
    name: 'Pengumuman Penghuni Kos',
    category: 'pengumuman',
    body: [
      '*INFO PENGHUNI — {nama_kos}*',
      '',
      'Halo rekan-rekan penghuni ({nama_penyewa} - {nama_kamar}),',
      'Diinformasikan akan ada perawatan/pembersihan area bersama pada akhir pekan ini. Mohon menjaga kerapian area koridor dan parkir.',
      '',
      'Jika ada kendala fasilitas kamar, silakan hubungi pengelola: wa.me/{wa_admin}. Terima kasih.',
    ].join('\n'),
  },
];

export const TEMPLATE_VARIABLES: { key: string; label: string; example: string }[] = [
  { key: '{nama_penyewa}', label: 'Nama Penyewa', example: 'Yoga Aditya' },
  { key: '{nama_kamar}', label: 'Nama Kamar', example: 'Kamar 105' },
  { key: '{unit}', label: 'Nomor Unit', example: '105' },
  { key: '{tipe_kamar}', label: 'Tipe Kamar', example: 'Tipe A' },
  { key: '{nominal}', label: 'Nominal Sewa', example: 'Rp 1.750.000' },
  { key: '{denda}', label: 'Denda', example: 'Rp 0' },
  { key: '{total_tagihan}', label: 'Total Bayar', example: 'Rp 1.750.000' },
  { key: '{bulan}', label: 'Periode Bulan', example: 'November 2026' },
  { key: '{jatuh_tempo}', label: 'Tgl Jatuh Tempo', example: '10' },
  { key: '{tanggal_bayar}', label: 'Tgl Bayar', example: '14 Nov 2026' },
  { key: '{metode_bayar}', label: 'Metode Bayar', example: 'Transfer BCA' },
  { key: '{metode_kamar}', label: 'Metode Profil Kamar', example: 'QRIS / BCA' },
  { key: '{no_invoice}', label: 'No. Invoice', example: 'INV/KPA/2026/11/105' },
  { key: '{info_rekening}', label: 'Info Rekening', example: 'BCA 5420-8812-30' },
  { key: '{link_pembayaran}', label: 'Link Bayar & PDF', example: 'https://.../?bayar=...' },
  { key: '{nama_kos}', label: 'Nama Properti', example: 'Kost Putra Agan' },
  { key: '{tagline}', label: 'Tagline Kos', example: 'Nyaman & Strategis' },
  { key: '{alamat_kos}', label: 'Alamat Kos', example: 'Jl. Srengseng Sawah No. 18' },
  { key: '{wa_admin}', label: 'WA Pengelola', example: '6281288904412' },
  { key: '{kamar_kosong}', label: 'Daftar Kamar Kosong', example: 'Kamar 103 (Tipe A)' },
];

export interface RenderMessageContext {
  settings: PropertySettings;
  room?: Room | null;
  payment?: PaymentRecord | null;
  availableRooms?: Room[];
  month?: string;
  paymentUrl?: string;
}

export function renderMessageTemplate(body: string, ctx: RenderMessageContext): string {
  const { settings, room, payment, availableRooms = [], month, paymentUrl } = ctx;
  const targetMonth = payment?.month || month || '2026-11';
  const baseAmount = payment?.amount ?? room?.monthlyRate ?? 0;
  const lateFee = payment?.lateFee ?? 0;
  const total = baseAmount + lateFee;
  const dueDay = room?.tenant?.dueDay ?? settings.defaultDueDay;

  const resolvedProfile = resolveRoomPaymentProfile(
    room,
    settings,
    DEFAULT_RECEIPT_TEMPLATE
  );

  const effectiveLink =
    paymentUrl?.trim() ||
    (payment?.paymentLinkId ? buildShareablePaymentUrl(payment.paymentLinkId) : '') ||
    resolvedProfile.externalPaymentLink ||
    '';

  const linkLine = effectiveLink
    ? `Link Pembayaran & Kwitansi PDF: ${effectiveLink}`
    : '(Hubungi pengelola untuk tautan pembayaran QRIS/Transfer)';

  const vacantText =
    availableRooms.length > 0
      ? availableRooms
          .map(
            (r) =>
              `• ${getRoomDisplayName(r)} (${r.tier} — ${formatIDR(r.monthlyRate)}/bln)`
          )
          .join('\n')
      : 'Saat ini seluruh unit kamar sedang terisi penuh.';

  const replacements: Record<string, string> = {
    '{nama_penyewa}': payment?.tenantName || room?.tenant?.name || 'Penghuni',
    '{nama_kamar}': room ? getRoomDisplayName(room) : payment ? `Kamar ${payment.roomNumber}` : 'Kamar',
    '{unit}': room?.number || payment?.roomNumber || '-',
    '{tipe_kamar}': room?.tier || '-',
    '{nominal}': formatIDR(baseAmount),
    '{denda}': formatIDR(lateFee),
    '{total_tagihan}': formatIDR(total),
    '{bulan}': formatMonthYear(targetMonth),
    '{jatuh_tempo}': String(dueDay),
    '{tanggal_bayar}': payment?.paidDate ? formatDateID(payment.paidDate) : 'Belum dibayar',
    '{metode_bayar}': payment?.method || resolvedProfile.preferredMethod,
    '{metode_kamar}': resolvedProfile.preferredMethod,
    '{no_invoice}': payment?.invoiceNo || '-',
    '{info_rekening}': resolvedProfile.accountSummary,
    '{link_pembayaran}': linkLine,
    '{nama_kos}': settings.name,
    '{tagline}': settings.tagline,
    '{alamat_kos}': settings.address,
    '{wa_admin}': settings.whatsappAdmin,
    '{kamar_kosong}': vacantText,
  };

  let output = body;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.split(token).join(value);
  }
  return output;
}

export function buildMonthlyFinanceWhatsAppSummary(params: {
  settings: PropertySettings;
  month: string;
  rooms: Room[];
  payments: PaymentRecord[];
  expenses: ExpenseRecord[];
}): string {
  const { settings, month, rooms, payments, expenses } = params;
  const monthPayments = payments.filter((p) => p.month === month);
  const paid = monthPayments.filter((p) => p.status === 'Lunas');
  const unpaid = monthPayments.filter((p) => p.status === 'Belum Bayar');
  const monthExpenses = expenses.filter((e) => e.month === month);

  const totalIncome = paid.reduce((acc, p) => acc + p.amount + (p.lateFee ?? 0), 0);
  const totalExpense = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const occupiedCount = rooms.filter((r) => r.status === 'Terisi').length;
  const vacantRooms = rooms.filter((r) => r.status === 'Tersedia');

  const lines = [
    `*LAPORAN BULANAN — ${settings.name.toUpperCase()}*`,
    `Periode: *${formatMonthYear(month)}*`,
    ``,
    `*1. Ringkasan Keuangan*`,
    `• Pemasukan Sewa Lunas (${paid.length} unit): ${formatIDR(totalIncome)}`,
    `• Pengeluaran Operasional (${monthExpenses.length} item): ${formatIDR(totalExpense)}`,
    `• *Laba Bersih: ${formatIDR(netProfit)}*`,
    ``,
    `*2. Okupansi Kamar*`,
    `• Terisi: ${occupiedCount} dari ${rooms.length} unit (${
      rooms.length > 0 ? Math.round((occupiedCount / rooms.length) * 100) : 0
    }%)`,
    `• Kamar Kosong (${vacantRooms.length}): ${
      vacantRooms.length > 0 ? vacantRooms.map((r) => getRoomDisplayName(r)).join(', ') : 'Tidak ada (Penuh)'
    }`,
  ];

  if (unpaid.length > 0) {
    lines.push(``);
    lines.push(`*3. Tagihan Menunggu Pelunasan (${unpaid.length})*`);
    unpaid.forEach((p) => {
      lines.push(
        `• Kamar ${p.roomNumber} (${p.tenantName}): ${formatIDR(p.amount + (p.lateFee ?? 0))}`
      );
    });
  } else {
    lines.push(``);
    lines.push(`*3. Tagihan:* Semua tagihan periode ini sudah *Lunas*.`);
  }

  lines.push(``);
  lines.push(`Dilaporkan oleh: ${settings.adminName}`);
  return lines.join('\n');
}
