import { UiColorPreset } from '../types/kost';

export interface UiColorTemplate {
  id: Exclude<UiColorPreset, 'custom'>;
  name: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
  tintHex: string;
}

export const UI_COLOR_TEMPLATES: UiColorTemplate[] = [
  {
    id: 'emerald',
    name: 'Zamrud Mineral',
    description: 'Hijau zamrud khas properti',
    primaryHex: '#0f766e',
    secondaryHex: '#0d9488',
    tintHex: '#ccfbf1',
  },
  {
    id: 'ocean',
    name: 'Biru Samudra',
    description: 'Biru tegas dan profesional',
    primaryHex: '#1d4ed8',
    secondaryHex: '#2563eb',
    tintHex: '#dbeafe',
  },
  {
    id: 'indigo',
    name: 'Indigo Modern',
    description: 'Kontras tinggi dan tenang',
    primaryHex: '#4338ca',
    secondaryHex: '#4f46e5',
    tintHex: '#e0e7ff',
  },
  {
    id: 'amber',
    name: 'Amber Hangat',
    description: 'Bernuansa hangat dan ramah',
    primaryHex: '#b45309',
    secondaryHex: '#d97706',
    tintHex: '#fef3c7',
  },
  {
    id: 'rose',
    name: 'Merah Delima',
    description: 'Aksen berani dan berkarakter',
    primaryHex: '#be123c',
    secondaryHex: '#e11d48',
    tintHex: '#ffe4e6',
  },
  {
    id: 'slate',
    name: 'Arang Minimalis',
    description: 'Netral monokrom fokus data',
    primaryHex: '#334155',
    secondaryHex: '#475569',
    tintHex: '#e2e8f0',
  },
];

const LOCAL_PREF_KEY = 'kost_admin_ui_palette_v1';

export function normalizeHexColor(raw: string | undefined): string {
  const cleaned = String(raw ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }
  return '#0f766e';
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = normalizeHexColor(hex).slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hn + 1 / 3) * 255),
    Math.round(hue2rgb(hn) * 255),
    Math.round(hue2rgb(hn - 1 / 3) * 255),
  ];
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastWithWhite(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

function shadeForMinWhiteContrast(
  h: number,
  s: number,
  startL: number,
  minRatio: number
): string {
  let l = startL;
  let hex = hslToHex(h, s, l);
  while (contrastWithWhite(hex) < minRatio && l > 10) {
    l -= 2;
    hex = hslToHex(h, s, l);
  }
  return hex;
}

export interface ComputedAccentScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
  rgb600: string;
  rgb700: string;
}

export function buildAccentScale(baseHex: string): ComputedAccentScale {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s] = rgbToHsl(r, g, b);
  const isNeutral = s < 10;
  const sat = (target: number) => (isNeutral ? Math.min(s, 18) : Math.min(Math.max(s, 45), target));

  const s50 = hslToHex(h, sat(65), 97);
  const s100 = hslToHex(h, sat(70), 93);
  const s200 = hslToHex(h, sat(74), 85);
  const s300 = hslToHex(h, sat(76), 76);
  const s400 = hslToHex(h, sat(78), 64);
  const s500 = shadeForMinWhiteContrast(h, sat(82), 45, 3.6);
  const s600 = shadeForMinWhiteContrast(h, sat(84), 38, 4.7);
  const s700 = shadeForMinWhiteContrast(h, sat(86), 31, 6.2);
  const s800 = shadeForMinWhiteContrast(h, sat(82), 25, 7.8);
  const s900 = hslToHex(h, sat(74), 19);
  const s950 = hslToHex(h, sat(70), 13);

  const [r6, g6, b6] = hexToRgb(s600);
  const [r7, g7, b7] = hexToRgb(s700);

  return {
    50: s50,
    100: s100,
    200: s200,
    300: s300,
    400: s400,
    500: s500,
    600: s600,
    700: s700,
    800: s800,
    900: s900,
    950: s950,
    rgb600: `${r6}, ${g6}, ${b6}`,
    rgb700: `${r7}, ${g7}, ${b7}`,
  };
}

export function resolveBaseHexForPreset(
  preset: UiColorPreset | undefined,
  customHex: string | undefined
): string {
  if (preset === 'custom') {
    return normalizeHexColor(customHex);
  }
  const found = UI_COLOR_TEMPLATES.find((t) => t.id === preset);
  return found ? found.primaryHex : '#0f766e';
}

const SCALE_KEYS: Array<keyof Pick<ComputedAccentScale, 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950>> = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
];

export function applyUiColorPalette(
  preset: UiColorPreset | undefined,
  customHex: string | undefined
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const activePreset = preset ?? 'emerald';

  if (activePreset === 'emerald') {
    resetUiColorPalette();
    return;
  }

  const baseHex = resolveBaseHexForPreset(activePreset, customHex);
  const scale = buildAccentScale(baseHex);

  for (const k of SCALE_KEYS) {
    root.style.setProperty(`--color-teal-${k}`, scale[k]);
    root.style.setProperty(`--accent-${k}`, scale[k]);
  }
  root.style.setProperty('--accent-600-rgb', scale.rgb600);
  root.style.setProperty('--accent-700-rgb', scale.rgb700);
}

export function resetUiColorPalette(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const k of SCALE_KEYS) {
    root.style.removeProperty(`--color-teal-${k}`);
    root.style.removeProperty(`--accent-${k}`);
  }
  root.style.removeProperty('--accent-600-rgb');
  root.style.removeProperty('--accent-700-rgb');
}

export function cacheLocalUiPalette(
  preset: UiColorPreset,
  customColor: string
): void {
  try {
    localStorage.setItem(
      LOCAL_PREF_KEY,
      JSON.stringify({ preset, customColor: normalizeHexColor(customColor) })
    );
  } catch {
    // Ignore storage errors in restricted iframes
  }
}

export function readCachedUiPalette(): {
  preset: UiColorPreset;
  customColor: string;
} | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { preset?: string; customColor?: string };
    const validPresets: UiColorPreset[] = [
      'emerald',
      'ocean',
      'indigo',
      'amber',
      'rose',
      'slate',
      'custom',
    ];
    const preset = validPresets.includes(parsed.preset as UiColorPreset)
      ? (parsed.preset as UiColorPreset)
      : 'emerald';
    return {
      preset,
      customColor: normalizeHexColor(parsed.customColor),
    };
  } catch {
    return null;
  }
}
