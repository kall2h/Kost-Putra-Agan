import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { RoomGalleryImage } from '../types/kost';

interface RoomPhotoSliderProps {
  images: RoomGalleryImage[];
  title: string;
  className?: string;
  showCaptionBadge?: boolean;
  enableLightbox?: boolean;
  compactControls?: boolean;
  onSlideClick?: () => void;
  children?: React.ReactNode;
}

export const RoomPhotoSlider: React.FC<RoomPhotoSliderProps> = ({
  images,
  title,
  className = 'aspect-[4/3] w-full',
  showCaptionBadge = true,
  enableLightbox = true,
  compactControls = false,
  onSlideClick,
  children,
}) => {
  const safeImages: RoomGalleryImage[] =
    images.length > 0 ? images : [{ url: '', label: title }];

  const trackRef = useRef<HTMLDivElement>(null);
  const lightboxTrackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Reset active slide if gallery shrinks
  useEffect(() => {
    if (activeIndex >= safeImages.length) {
      setActiveIndex(0);
    }
  }, [safeImages.length, activeIndex]);

  const scrollToSlide = (
    index: number,
    ref: React.RefObject<HTMLDivElement | null> = trackRef
  ) => {
    const wrapped = (index + safeImages.length) % safeImages.length;
    setActiveIndex(wrapped);
    const el = ref.current;
    if (el) {
      el.scrollTo({
        left: wrapped * el.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  const handleTrackScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.clientWidth <= 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIndex && idx >= 0 && idx < safeImages.length) {
      setActiveIndex(idx);
    }
  };

  // Keyboard navigation when Google-Review-style lightbox is open
  useEffect(() => {
    if (!lightboxOpen) return;
    const el = lightboxTrackRef.current;
    if (el && el.clientWidth > 0) {
      el.scrollTo({ left: activeIndex * el.clientWidth, behavior: 'instant' as ScrollBehavior });
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowRight') {
        scrollToSlide(activeIndex + 1, lightboxTrackRef);
      } else if (e.key === 'ArrowLeft') {
        scrollToSlide(activeIndex - 1, lightboxTrackRef);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, activeIndex, safeImages.length]);

  const currentSlide = safeImages[activeIndex] ?? safeImages[0];
  const hasMultiple = safeImages.length > 1;

  return (
    <>
      <div
        className={`relative overflow-hidden bg-slate-900 select-none group ${className}`}
      >
        {/* Horizontal Touch-Swipe / Scroll-Snap Track */}
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        >
          {safeImages.map((img, idx) => {
            const broken = imgErrors[idx] || !img.url;
            return (
              <div
                key={`${idx}-${img.label}`}
                onClick={(e) => {
                  if (enableLightbox) {
                    e.stopPropagation();
                    setLightboxOpen(true);
                  } else if (onSlideClick) {
                    onSlideClick();
                  }
                }}
                className={`w-full h-full shrink-0 snap-center relative ${
                  enableLightbox || onSlideClick ? 'cursor-pointer' : ''
                }`}
              >
                {!broken ? (
                  <img
                    src={img.url}
                    alt={`${title} - ${img.label || `Foto ${idx + 1}`}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setImgErrors((prev) => ({ ...prev, [idx]: true }))
                    }
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#06383B] to-[#0D9488] text-white p-4 text-center">
                    <Building2 className="w-7 h-7 mb-1.5 text-teal-100" />
                    <span className="text-xs font-semibold">{title}</span>
                    {img.label && (
                      <span className="text-[11px] text-teal-100 mt-0.5">
                        {img.label}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Scrim for Caption / Custom Overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#04181A]/90 via-[#072B2E]/40 to-transparent" />

        {/* Custom children overlay (optional) */}
        {children}

        {/* Top-Right Photo Counter & Expand Button */}
        {(hasMultiple || enableLightbox) && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
            {hasMultiple && (
              <span className="px-2 py-0.5 rounded-md bg-slate-950/75 text-[11px] font-mono-num font-medium text-white">
                {activeIndex + 1}/{safeImages.length}
              </span>
            )}
            {enableLightbox && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(true);
                }}
                className="p-1.5 rounded-md bg-slate-950/75 hover:bg-slate-950/90 text-white"
                title="Lihat galeri layar penuh"
                aria-label="Perbesar galeri foto"
              >
                <Expand className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Slide Caption (if no children overwrite bottom-left, or shown cleanly) */}
        {showCaptionBadge && currentSlide?.label && !children && (
          <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 z-10 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-white truncate drop-shadow-xs">
              {currentSlide.label}
            </span>
          </div>
        )}

        {/* Left / Right Slider Controls */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                scrollToSlide(activeIndex - 1);
              }}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-slate-950/75 hover:bg-slate-950/90 text-white flex items-center justify-center ${
                compactControls ? 'w-7 h-7' : 'w-8 h-8'
              }`}
              aria-label="Foto sebelumnya"
            >
              <ChevronLeft className={compactControls ? 'w-4 h-4' : 'w-4.5 h-4.5'} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                scrollToSlide(activeIndex + 1);
              }}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-slate-950/75 hover:bg-slate-950/90 text-white flex items-center justify-center ${
                compactControls ? 'w-7 h-7' : 'w-8 h-8'
              }`}
              aria-label="Foto berikutnya"
            >
              <ChevronRight className={compactControls ? 'w-4 h-4' : 'w-4.5 h-4.5'} aria-hidden="true" />
            </button>

            {/* Bottom Dot Indicators */}
            <div
              className={`absolute z-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 ${
                children ? 'top-2.5 left-3 translate-x-0' : 'bottom-2'
              }`}
            >
              {safeImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToSlide(idx);
                  }}
                  aria-label={`Pilih foto ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeIndex
                      ? 'w-4 bg-white'
                      : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Google-Review-Style Fullscreen Photo Slider Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/92 flex flex-col justify-between p-4 sm:p-6 animate-backdrop-in"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Galeri Foto ${title}`}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between gap-4 text-white max-w-5xl w-full mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="font-display font-semibold text-sm sm:text-base truncate">
                {title}
              </p>
              <p className="text-xs text-teal-200 truncate">
                {currentSlide?.label || `Foto ${activeIndex + 1}`} ·{' '}
                <span className="font-mono-num">
                  {activeIndex + 1} dari {safeImages.length} foto
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
              aria-label="Tutup galeri"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Large Swipeable View */}
          <div
            className="relative flex-1 flex items-center justify-center max-w-5xl w-full mx-auto my-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={lightboxTrackRef}
              onScroll={handleTrackScroll}
              className="w-full h-full max-h-[68vh] flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth rounded-xl"
            >
              {safeImages.map((img, idx) => {
                const broken = imgErrors[idx] || !img.url;
                return (
                  <div
                    key={`lb-${idx}-${img.label}`}
                    className="w-full h-full shrink-0 snap-center flex items-center justify-center bg-black/40"
                  >
                    {!broken ? (
                      <img
                        src={img.url}
                        alt={`${title} - ${img.label || `Foto ${idx + 1}`}`}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-[68vh] object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-80 h-60 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-[#06383B] to-[#0D9488] text-white p-6 text-center">
                        <Building2 className="w-10 h-10 mb-2" />
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="text-xs text-teal-100 mt-1">{img.label}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={() => scrollToSlide(activeIndex - 1, lightboxTrackRef)}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center transition-colors"
                  aria-label="Foto sebelumnya"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSlide(activeIndex + 1, lightboxTrackRef)}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/15 flex items-center justify-center transition-colors"
                  aria-label="Foto berikutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Google Review Style Thumbnail Strip */}
          {hasMultiple && (
            <div
              className="flex items-center justify-center gap-2.5 overflow-x-auto no-scrollbar max-w-4xl w-full mx-auto py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {safeImages.map((img, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`thumb-${idx}`}
                    type="button"
                    onClick={() => scrollToSlide(idx, lightboxTrackRef)}
                    className={`relative w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      isActive
                        ? 'border-teal-400 scale-105 opacity-100'
                        : 'border-white/15 opacity-60 hover:opacity-90'
                    }`}
                  >
                    {!imgErrors[idx] && img.url ? (
                      <img
                        src={img.url}
                        alt={img.label || `Foto ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-teal-900 flex items-center justify-center text-white text-[10px]">
                        {idx + 1}
                      </div>
                    )}
                    {img.label && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[9px] text-white px-1 py-0.5 truncate">
                        {img.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
};
