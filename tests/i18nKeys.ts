/**
 * Collects every English source string the game can show, so the German
 * dictionary can be checked for completeness. Three sources:
 *  1. literal arguments of t('…') calls anywhere in src/,
 *  2. display fields of the data tables (items, NPC barks, achievements…),
 *  3. sentence-like literals in src/systems that are shown later (reasons, news, clues).
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONDITION_NAMES } from '../src/core/config';
import { FACILITIES } from '../src/data/facilities';
import { CATEGORY_NAMES, FAMILIES, ITEM_LIST, RARITY_NAMES } from '../src/data/items';
import { AUCTIONEER, NPCS } from '../src/data/npcs';
import { BUYER_TYPES, COLLECTORS, EXPERTS } from '../src/data/people';
import {
  ACHIEVEMENTS, COSMETICS, LEVEL_NAMES, LEVEL_UNLOCKS, QUESTS, TREND_BOOMS, TREND_NAMES, TREND_SLUMPS, UPGRADES, VEHICLES,
} from '../src/data/progression';
import { BLUEPRINTS, EVENT_INFO } from '../src/data/units';
import { WEEKDAYS } from '../src/ui/common';

const ROOT = path.resolve(__dirname, '..');

export type Sources = Map<string, Set<string>>;

function add(map: Sources, key: string | null | undefined, from: string) {
  if (!key || !/[A-Za-z]/.test(key)) return;
  let s = map.get(key);
  if (!s) map.set(key, (s = new Set()));
  s.add(from);
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

// ─── A small TS scanner: strings, comments, regex and template literals ──────

const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '\n']);

function unescape(raw: string): string {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_m, e: string) => {
    if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
    return ({ n: '\n', t: '\t', r: '\r', '0': '\0' } as Record<string, string>)[e] ?? e;
  });
}

/** Reads the string or template literal at src[i]. `value` is null for templates with ${…}. */
function readLiteral(src: string, i: number): { value: string | null; end: number } {
  const q = src[i];
  let j = i + 1;
  let simple = true;
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\') { j += 2; continue; }
    if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
      simple = false;
      j = skipExpression(src, j + 2);
      continue;
    }
    j++;
  }
  return { value: simple ? unescape(src.slice(i + 1, j)) : null, end: j + 1 };
}

/** Skips a ${…} expression body, returning the index after its closing brace. */
function skipExpression(src: string, i: number): number {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\'' || c === '"' || c === '`') { i = readLiteral(src, i).end; continue; }
    if (c === '{') depth++;
    if (c === '}') { if (depth === 0) return i + 1; depth--; }
    i++;
  }
  return i;
}

/**
 * Collects the literals in src[from..]. With `argOnly` it stops at the first
 * top-level ',' or ')' — the end of a call's first argument.
 */
function scan(src: string, from: number, argOnly: boolean): string[] {
  const lits: string[] = [];
  let depth = 0;
  let prev = '\n';
  let i = from;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const { value, end } = readLiteral(src, i);
      if (value !== null) lits.push(value);
      i = end;
      prev = 'a';
      continue;
    }
    if (c === '/' && REGEX_PREV.has(prev)) {
      let j = i + 1;
      let cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
        j++;
      }
      i = j + 1;
      prev = 'a';
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0 && argOnly) return lits;
      depth--;
    } else if (c === ',' && depth === 0 && argOnly) return lits;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return lits;
}

/** Literal strings inside the first argument of every t(…) and N_(…) call. */
export function callKeys(): Sources {
  const out: Sources = new Map();
  for (const f of walkFiles(path.join(ROOT, 'src'))) {
    if (/[\\/]core[\\/]i18n/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const re = /(?<![\w$.])(t|N_)\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      for (const l of scan(src, m.index + m[0].length, true)) add(out, l, path.relative(ROOT, f));
    }
  }
  return out;
}

/** Heuristic for "this literal is text a player reads". */
export function looksLikeText(s: string): boolean {
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return false;
  if (/^[a-z0-9_:.\-/ ]+$/.test(s)) return false; // ids, keys, paths, class lists
  if (/^[A-Z][a-zA-Z]*[A-Z0-9][a-zA-Z0-9]*$/.test(s)) return false; // KeyV, ArrowUp
  if (/^(rgba?|hsla?)\(|^\d/.test(s)) return false;
  return /^[A-Z"'$({[…]/.test(s) || / /.test(s);
}

/** Sentence-like literals in the headless systems (reasons, notes, news, clues, rumors). */
export function systemKeys(): Sources {
  const out: Sources = new Map();
  for (const f of walkFiles(path.join(ROOT, 'src', 'systems'))) {
    for (const l of scan(fs.readFileSync(f, 'utf8'), 0, false)) if (looksLikeText(l)) add(out, l, path.relative(ROOT, f));
  }
  return out;
}

/** Display fields of the data tables. Proper names (people, shops) stay English and are not collected. */
export function dataKeys(): Sources {
  const out: Sources = new Map();
  for (const d of ITEM_LIST) {
    add(out, d.name, 'items.name');
    add(out, d.possibleName, 'items.possibleName');
    add(out, d.fakeName, 'items.fakeName');
    add(out, d.flavor, 'items.flavor');
  }
  for (const f of Object.values(FAMILIES)) {
    for (const [k, v] of Object.entries(f)) if (typeof v === 'string' && k !== 'id') add(out, v, `families.${k}`);
  }
  for (const v of Object.values(CATEGORY_NAMES)) add(out, v, 'categories');
  for (const v of Object.values(RARITY_NAMES)) add(out, v, 'rarities');
  for (const v of CONDITION_NAMES) add(out, v, 'conditions');
  for (const v of WEEKDAYS) add(out, v, 'weekdays');
  for (const b of BLUEPRINTS) add(out, b.name, 'blueprints.name');
  for (const e of Object.values(EVENT_INFO)) { add(out, e.title, 'events.title'); add(out, e.text, 'events.text'); }
  for (const f of FACILITIES) { add(out, f.name, 'facilities.name'); add(out, f.tagline, 'facilities.tagline'); add(out, f.description, 'facilities.description'); }
  for (const n of NPCS) {
    add(out, n.nickname, 'npcs.nickname');
    for (const lines of Object.values(n.barks)) for (const l of (lines as string[] | undefined) ?? []) add(out, l, 'npcs.barks');
  }
  for (const lines of Object.values(AUCTIONEER.lines)) for (const l of lines as readonly string[]) add(out, l, 'auctioneer');
  for (const e of EXPERTS) {
    for (const [k, v] of Object.entries(e)) if (typeof v === 'string' && !['id', 'name'].includes(k) && looksLikeText(v)) add(out, v, `experts.${k}`);
  }
  const deep = (v: unknown, from: string) => {
    if (typeof v === 'string') { if (looksLikeText(v)) add(out, v, from); return; }
    if (Array.isArray(v)) { for (const x of v) deep(x, from); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'id') deep(x, `${from}.${k}`);
  };
  deep(Object.values(BUYER_TYPES), 'buyers');
  for (const c of COLLECTORS) {
    for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && !['id', 'name'].includes(k) && looksLikeText(v)) add(out, v, `collectors.${k}`);
  }
  for (const v of LEVEL_NAMES) add(out, v, 'levels');
  for (const u of LEVEL_UNLOCKS) add(out, u.text, 'unlocks');
  for (const v of Object.values(VEHICLES)) add(out, v.name, 'vehicles');
  for (const u of UPGRADES) { add(out, u.name, 'upgrades.name'); add(out, u.description, 'upgrades.description'); }
  for (const c of COSMETICS) {
    for (const [k, v] of Object.entries(c)) if (typeof v === 'string' && ['name', 'label', 'description'].includes(k)) add(out, v, `cosmetics.${k}`);
  }
  for (const a of ACHIEVEMENTS) { add(out, a.name, 'achievements.name'); add(out, a.description, 'achievements.description'); }
  for (const v of Object.values(TREND_NAMES)) add(out, v, 'trends');
  for (const v of Object.values(TREND_BOOMS)) add(out, v, 'trends.boom');
  for (const v of Object.values(TREND_SLUMPS)) add(out, v, 'trends.slump');
  for (const q of QUESTS) deep(q, 'quests');
  return out;
}

export function allKeys(): Sources {
  const out: Sources = new Map();
  for (const m of [callKeys(), dataKeys(), systemKeys()]) for (const [k, s] of m) for (const f of s) add(out, k, f);
  return out;
}

export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
