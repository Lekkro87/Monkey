import { CONFIG } from '../core/config';
import { hashString } from '../core/rng';
import type { GameState } from '../core/types';

/**
 * Crash-safe persistence. Every save writes a checksummed envelope and keeps
 * rolling backups, so a corrupted or half-written save falls back to the last good one.
 */

export interface StorageBackend {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryBackend implements StorageBackend {
  private data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); }
  remove(key: string) { this.data.delete(key); }
}

/** localStorage can be missing or throw (private windows, sandboxed previews); never let that crash the game. */
export class LocalStorageBackend implements StorageBackend {
  readonly available: boolean;
  private fallback = new MemoryBackend();

  constructor() {
    let ok = false;
    try {
      const k = '__sh_probe__';
      globalThis.localStorage.setItem(k, '1');
      globalThis.localStorage.removeItem(k);
      ok = true;
    } catch {
      ok = false;
    }
    this.available = ok;
  }

  get(key: string) {
    if (!this.available) return this.fallback.get(key);
    try { return globalThis.localStorage.getItem(key); } catch { return this.fallback.get(key); }
  }

  set(key: string, value: string) {
    this.fallback.set(key, value);
    if (!this.available) return;
    try { globalThis.localStorage.setItem(key, value); } catch { /* quota or blocked: memory copy survives the session */ }
  }

  remove(key: string) {
    this.fallback.remove(key);
    if (!this.available) return;
    try { globalThis.localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

interface Envelope {
  v: number;
  savedAt: number;
  sum: number;
  data: string;
}

const KEY = 'storageHunter.save';
const BACKUPS = 3;

type Migration = (s: Record<string, unknown>) => Record<string, unknown>;

/** Save-format migrations, keyed by the version they upgrade *from*. */
const MIGRATIONS: Record<number, Migration> = {};

export class SaveSystem {
  lastSavedAt = 0;
  lastError: string | null = null;

  constructor(readonly backend: StorageBackend, private readonly key = KEY) {}

  hasSave(): boolean {
    return this.readSlot(0) !== null || this.readSlot(1) !== null;
  }

  save(state: GameState): boolean {
    try {
      state.savedAt = Date.now();
      const data = JSON.stringify(state);
      const env: Envelope = { v: CONFIG.saveVersion, savedAt: state.savedAt, sum: hashString(data), data };
      const raw = JSON.stringify(env);
      // Rotate backups: slot n-1 → n.
      for (let i = BACKUPS - 1; i >= 1; i--) {
        const prev = this.backend.get(this.slotKey(i - 1));
        if (prev) this.backend.set(this.slotKey(i), prev);
      }
      this.backend.set(this.slotKey(0), raw);
      this.lastSavedAt = state.savedAt;
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = String(err);
      return false;
    }
  }

  load(): GameState | null {
    for (let i = 0; i < BACKUPS; i++) {
      const state = this.readSlot(i);
      if (state) return state;
    }
    return null;
  }

  clear(): void {
    for (let i = 0; i < BACKUPS; i++) this.backend.remove(this.slotKey(i));
  }

  exportString(state: GameState): string {
    const data = JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(JSON.stringify({ v: CONFIG.saveVersion, sum: hashString(data), data }))));
  }

  importString(text: string): GameState | null {
    try {
      const env = JSON.parse(decodeURIComponent(escape(atob(text.trim())))) as Envelope;
      return this.unwrap(env);
    } catch {
      return null;
    }
  }

  private slotKey(i: number) {
    return i === 0 ? this.key : `${this.key}.bak${i}`;
  }

  private readSlot(i: number): GameState | null {
    const raw = this.backend.get(this.slotKey(i));
    if (!raw) return null;
    try {
      return this.unwrap(JSON.parse(raw) as Envelope);
    } catch {
      return null;
    }
  }

  private unwrap(env: Envelope): GameState | null {
    if (!env || typeof env.data !== 'string') return null;
    if (hashString(env.data) !== env.sum) return null;
    let obj = JSON.parse(env.data) as Record<string, unknown>;
    let v = env.v ?? 1;
    while (v < CONFIG.saveVersion) {
      const m = MIGRATIONS[v];
      if (m) obj = m(obj);
      v++;
    }
    const st = obj as unknown as GameState;
    if (typeof st.money !== 'number' || typeof st.day !== 'number' || !st.items) return null;
    st.version = CONFIG.saveVersion;
    return st;
  }
}
