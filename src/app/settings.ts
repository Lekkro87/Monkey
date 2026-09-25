import { detectLang, type Lang } from '../core/i18n';
import type { Quality } from '../render/Renderer';

export interface Settings {
  lang: Lang;
  master: number;
  music: number;
  sfx: number;
  voice: boolean;
  quality: Quality;
  sensitivity: number;
  invertY: boolean;
  reducedMotion: boolean;
  hints: boolean;
}

const KEY = 'storageHunter.settings';

function defaultQuality(): Quality {
  try {
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 700;
    return mobile ? 'low' : 'medium';
  } catch {
    return 'medium';
  }
}

export function defaultSettings(): Settings {
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
  return { lang: detectLang(), master: 0.8, music: 0.5, sfx: 0.8, voice: true, quality: defaultQuality(), sensitivity: 1, invertY: false, reducedMotion: reduced, hints: true };
}

export function loadSettings(): Settings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* storage unavailable */ }
  return base;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
