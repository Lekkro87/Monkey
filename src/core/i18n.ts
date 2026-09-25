import { DE } from './i18n.de';

/**
 * Gettext-style localisation: English source strings are the keys,
 * translations live in one dictionary per language. Missing entries fall back to English.
 */
export type Lang = 'en' | 'de';

let current: Lang = 'en';
const missing = new Set<string>();

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, de: DE };

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function detectLang(): Lang {
  try {
    const langs = (globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? 'en']) as readonly string[];
    return langs.some((l) => l?.toLowerCase().startsWith('de')) ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

/** Translate an English source string and fill {placeholders}. */
export function t(src: string, params?: Record<string, string | number>): string {
  const dict = DICTS[current];
  let out = src;
  if (dict) {
    const hit = dict[src];
    if (hit !== undefined) out = hit;
    else missing.add(src);
  }
  if (params) {
    out = out.replace(/\{(\w+)\}/g, (m, key: string) => (key in params ? String(params[key]) : m));
  }
  return out;
}

/** t() for messages whose string parameters are English source strings as well (item names, titles). */
export function tDeep(src: string, params?: Record<string, string | number>): string {
  if (!params) return t(src);
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) p[k] = typeof v === 'string' ? t(v) : v;
  return t(src, p);
}

/**
 * Marks a string for translation without translating it yet (gettext's N_).
 * Use it for labels that are stored first and passed through t() later.
 */
export function N_(src: string): string {
  return src;
}

export function missingTranslations(): string[] {
  return [...missing];
}

const nf = { en: new Intl.NumberFormat('en-US'), de: new Intl.NumberFormat('de-DE') };

export function num(n: number): string {
  return nf[current].format(Math.round(n));
}

/** Money is always dollars (the genre's home turf), grouped per locale: $8,450 / $8.450. */
export function money(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.round(Math.abs(n));
  const body = `$${nf[current].format(abs)}`;
  if (n < 0) return `-${body}`;
  return opts.sign ? `+${body}` : body;
}

export function pct(n: number, digits = 1): string {
  const f = new Intl.NumberFormat(current === 'de' ? 'de-DE' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${f.format(n * 100)} %`;
}

export function decimal(n: number, digits = 1): string {
  const f = new Intl.NumberFormat(current === 'de' ? 'de-DE' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return f.format(n);
}

/** Cubic metres; tiny items read "<0.01 m³" instead of a misleading zero. */
export function volume(m3: number): string {
  return m3 > 0 && m3 < 0.005 ? `<${decimal(0.01, 2)} m³` : `${decimal(m3, 2)} m³`;
}

export function moneyRange(lo: number, hi: number): string {
  if (Math.round(lo) === Math.round(hi)) return money(lo);
  return `${money(lo)} – ${money(hi)}`;
}
