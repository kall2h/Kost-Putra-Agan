import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Link2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { RoomGalleryImage, RoomTypeConfig } from '../types/kost';
import { DEFAULT_ROOM_TYPES } from '../data/initialData';
import { RoomPhotoSlider } from './RoomPhotoSlider';
import { CurrencyInput } from './CurrencyInput';

interface RoomTypeModalProps {
  roomType: RoomTypeConfig | null;
  matchingRoomCount: number;
  onClose: () => void;
  onSave: (config: RoomTypeConfig, syncAllMatchingRooms: boolean) => Promise<void>;
}

const MAX_GALLERY_ITEMS = 6;
const MAX_TOTAL_GALLERY_BYTES = 680000;

async function compressImageFileToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Format gambar tidak didukung'));
    el.src = dataUrl;
  });

  const maxWidth = 720;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const targetW = Math.max(1, Math.round(img.width * scale));
  const targetH = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan gambar');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let quality = 0.72;
  let result = canvas.toDataURL('image/jpeg', quality);
  while (result.length > 130000 && quality > 0.32) {
    quality -= 0.1;
    result = canvas.toDataURL('image/jpeg', quality);
  }

  if (result.length > 180000) {
    throw new Error(`Ukuran "${file.name}" terlalu besar setelah dikompresi.`);
  }

  return result;
}

const SUGGESTED_LABELS = [
  'Kasur & Area Tidur',
  'Toilet & Kamar Mandi',
  'Meja Belajar & Kursi',
  'Lemari & AC',
  'Balkon & Jendela',
];

export const RoomTypeModal: React.FC<RoomTypeModalProps> = ({
  roomType,
  matchingRoomCount,
  onClose,
  onSave,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [monthlyRate, setMonthlyRate] = useState(1750000);
  const [areaSqm, setAreaSqm] = useState(12);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<RoomGalleryImage[]>([]);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlLabelDraft, setUrlLabelDraft] = useState('');
  const [facilitiesText, setFacilitiesText] = useState('');
  const [syncToRooms, setSyncToRooms] = useState(true);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomType) return;
    const defaultPreset =
      DEFAULT_ROOM_TYPES.find((d) => d.id === roomType.id) ?? DEFAULT_ROOM_TYPES[0];
    setDisplayName(roomType.displayName || roomType.tier);
    setSubtitle(roomType.subtitle);
    setMonthlyRate(roomType.monthlyRate);
    setAreaSqm(roomType.areaSqm);
    setDescription(roomType.description);
    setImages(
      roomType.images && roomType.images.length > 0
        ? roomType.images
        : defaultPreset.images
    );
    setUrlDraft('');
    setUrlLabelDraft('');
    setFacilitiesText(roomType.facilities.join('\n'));
    setSyncToRooms(true);
    setErrorMsg(null);
  }, [roomType]);

  if (!roomType) return null;

  const defaultPreset =
    DEFAULT_ROOM_TYPES.find((d) => d.id === roomType.id) ?? DEFAULT_ROOM_TYPES[0];

  const totalGalleryBytes = (list: RoomGalleryImage[]) =>
    list.reduce((sum, item) => sum + item.url.length + item.label.length, 0);

  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    if (files.length === 0) return;

    setErrorMsg(null);
    const remainingSlots = MAX_GALLERY_ITEMS - images.length;
    if (remainingSlots <= 0) {
      setErrorMsg(`Maksimal ${MAX_GALLERY_ITEMS} foto per panel tipe kamar.`);
      e.target.value = '';
      return;
    }

    const selected = files.slice(0, remainingSlots);
    setUploadingImg(true);
    try {
      const nextList = [...images];
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const compressed = await compressImageFileToDataUrl(file);
        const rawBase = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        const defaultLabel =
          SUGGESTED_LABELS[nextList.length % SUGGESTED_LABELS.length] ||
          rawBase.slice(0, 40) ||
          `Foto ${nextList.length + 1}`;
        const candidate = { url: compressed, label: defaultLabel };
        if (totalGalleryBytes([...nextList, candidate]) > MAX_TOTAL_GALLERY_BYTES) {
          throw new Error(
            'Total kapasitas galeri penuh. Hapus beberapa foto lama atau gunakan link URL gambar.'
          );
        }
        nextList.push(candidate);
      }
      setImages(nextList);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    setErrorMsg(null);
    const cleanUrl = urlDraft.trim();
    if (!cleanUrl) return;
    if (images.length >= MAX_GALLERY_ITEMS) {
      setErrorMsg(`Maksimal ${MAX_GALLERY_ITEMS} foto per panel tipe kamar.`);
      return;
    }
    const label =
      urlLabelDraft.trim().slice(0, 60) ||
      SUGGESTED_LABELS[images.length % SUGGESTED_LABELS.length] ||
      `Foto ${images.length + 1}`;
    const nextList = [...images, { url: cleanUrl, label }];
    if (totalGalleryBytes(nextList) > MAX_TOTAL_GALLERY_BYTES) {
      setErrorMsg('Total kapasitas galeri melebihi batas penyimpanan.');
      return;
    }
    setImages(nextList);
    setUrlDraft('');
    setUrlLabelDraft('');
  };

  const handleMoveImage = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const copy = [...images];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    setImages(copy);
  };

  const handleRemoveImage = (idx: number) => {
    if (images.length <= 1) {
      setErrorMsg('Minimal harus ada 1 foto pada galeri panel kamar.');
      return;
    }
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleUpdateLabel = (idx: number, label: string) => {
    setImages(
      images.map((item, i) => (i === idx ? { ...item, label: label.slice(0, 60) } : item))
    );
  };

  const handleResetDefaultGallery = () => {
    setImages(defaultPreset.images);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const parsedFacilities = facilitiesText
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 15);

    if (parsedFacilities.length === 0) {
      setErrorMsg('Isi minimal 1 fasilitas kamar.');
      return;
    }

    const cleanImages = images
      .filter((item) => item.url.trim().length > 0)
      .slice(0, MAX_GALLERY_ITEMS)
      .map((item, idx) => ({
        url: item.url.trim(),
        label: item.label.trim().slice(0, 60) || `Foto ${idx + 1}`,
      }));

    if (cleanImages.length === 0) {
      setErrorMsg('Tambahkan minimal 1 foto kamar.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          id: roomType.id,
          tier: roomType.tier,
          displayName: displayName.trim().slice(0, 60) || roomType.tier,
          subtitle: subtitle.trim() || roomType.tier,
          monthlyRate: Math.max(0, Number(monthlyRate) || 0),
          areaSqm: Math.max(4, Math.min(100, Number(areaSqm) || 12)),
          description: description.trim().slice(0, 600),
          imageUrl: cleanImages[0].url,
          images: cleanImages,
          facilities: parsedFacilities,
        },
        syncToRooms
      );
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi tipe kamar.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/50 animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-type-modal-title"
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0e191d] border border-slate-200/90 dark:border-white/[0.1] shadow-xl overflow-hidden animate-modal-in"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h2
                id="room-type-modal-title"
                className="font-display font-semibold text-base text-slate-900 dark:text-white"
              >
                Modifikasi Panel {displayName || roomType.tier}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kelola nama panel, galeri multi-foto slider (kasur, toilet, meja), deskripsi, dan tarif
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[84vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Live Google-Review Style Slider Preview + Multi-Photo Controls */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Galeri Slider Panel ({images.length}/{MAX_GALLERY_ITEMS} Foto)
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultiFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingImg || images.length >= MAX_GALLERY_ITEMS}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-xl btn-primary text-xs font-medium disabled:opacity-50"
                >
                  <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{uploadingImg ? 'Memproses...' : 'Unggah Foto'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaultGallery}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset Default</span>
                </button>
              </div>
            </div>

            {/* Live Slider Preview */}
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
              <RoomPhotoSlider
                images={images}
                title={displayName || roomType.tier}
                className="h-48 sm:h-52 w-full"
                enableLightbox={false}
              />
            </div>

            {/* Slide Items Editor List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {images.map((item, idx) => (
                <div
                  key={`${idx}-${item.url.slice(0, 24)}`}
                  className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-2.5"
                >
                  <img
                    src={item.url}
                    alt={item.label || `Foto ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-14 h-11 rounded-lg object-cover shrink-0 bg-slate-900"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      maxLength={60}
                      value={item.label}
                      onChange={(e) => handleUpdateLabel(idx, e.target.value)}
                      placeholder="Label (mis. Kasur, Toilet, Meja)"
                      className="w-full px-2 py-1 rounded-md input-surface border text-xs"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono-num">
                        Slide {idx + 1} {idx === 0 ? '· Cover' : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveImage(idx, -1)}
                          className="p-1 rounded hover:bg-teal-500/10 text-slate-500 dark:text-slate-300 disabled:opacity-30"
                          title="Geser ke kiri"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={() => handleMoveImage(idx, 1)}
                          className="p-1 rounded hover:bg-teal-500/10 text-slate-500 dark:text-slate-300 disabled:opacity-30"
                          title="Geser ke kanan"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-600"
                          title="Hapus foto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Optional Add Image by URL */}
            {images.length < MAX_GALLERY_ITEMS && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                <input
                  type="text"
                  value={urlLabelDraft}
                  onChange={(e) => setUrlLabelDraft(e.target.value)}
                  placeholder="Label (mis. Toilet / Meja)"
                  className="sm:col-span-4 px-3 py-1.5 rounded-lg input-surface border text-xs"
                />
                <input
                  type="text"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="Tempel URL gambar tambahan (https://...)"
                  className="sm:col-span-6 px-3 py-1.5 rounded-lg input-surface border text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="sm:col-span-2 inline-flex items-center justify-center gap-1 min-h-[36px] px-3 py-1.5 rounded-xl btn-secondary text-xs font-medium"
                >
                  <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tambah</span>
                </button>
              </div>
            )}
          </div>

          {/* Panel Display Name, Subtitle, Monthly Rate & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nama Tipe / Panel *
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={roomType.tier}
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm font-medium"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Subjudul Singkat *
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Contoh: Standar Nyaman AC"
                className="w-full px-3 py-2 rounded-lg input-surface border text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Tarif / Bln *
              </label>
              <CurrencyInput
                required
                value={monthlyRate}
                onChange={setMonthlyRate}
                aria-label="Tarif per Bulan"
                className="w-full pr-2.5 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Luas (m²) *
              </label>
              <input
                type="number"
                required
                min={4}
                max={100}
                value={areaSqm}
                onChange={(e) => setAreaSqm(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg input-surface border font-mono-num text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Deskripsi {displayName || roomType.tier}
              </label>
              <span className="font-mono-num text-[11px] text-slate-400">
                {description.length}/600
              </span>
            </div>
            <textarea
              rows={2}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tuliskan keunggulan kasur, toilet, meja belajar, dan detail kamar tipe ini..."
              className="w-full px-3 py-2 rounded-lg input-surface border text-sm resize-none"
            />
          </div>

          {/* Facilities */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Daftar Fasilitas (pisahkan dengan baris baru atau koma)
            </label>
            <textarea
              rows={2}
              value={facilitiesText}
              onChange={(e) => setFacilitiesText(e.target.value)}
              placeholder="AC Split Inverter&#10;Kamar Mandi Dalam&#10;WiFi 100 Mbps"
              className="w-full px-3 py-2 rounded-lg input-surface border text-xs leading-relaxed"
            />
          </div>

          {/* Sync toggle */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] cursor-pointer">
            <input
              type="checkbox"
              checked={syncToRooms}
              onChange={(e) => setSyncToRooms(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-teal-600 rounded shrink-0"
            />
            <div className="text-xs">
              <p className="font-medium text-slate-900 dark:text-white">
                Terapkan harga, luas &amp; fasilitas ke semua kamar {roomType.tier} ({matchingRoomCount} unit)
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Seluruh unit {roomType.tier} otomatis mengikuti tarif dan fasilitas terbaru.
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl btn-secondary text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImg}
              className="inline-flex items-center gap-2 min-h-[40px] px-5 py-2 rounded-xl btn-primary text-sm font-medium disabled:opacity-60"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Panel Tipe'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
