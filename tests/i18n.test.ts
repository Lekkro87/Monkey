import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DE } from '../src/core/i18n.de';
import { allKeys, callKeys, dataKeys, placeholders } from './i18nKeys';

describe('German translation', () => {
  const keys = allKeys();

  if (process.env.DUMP_I18N) {
    const missing = [...keys.entries()].filter(([k]) => DE[k] === undefined).map(([k, s]) => ({ k, from: [...s].join(', ') }));
    fs.writeFileSync(process.env.DUMP_I18N, JSON.stringify(missing, null, 1));
  }

  it('covers every t() literal and every data display string', () => {
    const required = new Set([...callKeys().keys(), ...dataKeys().keys()]);
    const missing = [...required].filter((k) => DE[k] === undefined);
    expect(missing).toEqual([]);
  });

  it('keeps the same {placeholders} as the English source', () => {
    const bad = Object.entries(DE).filter(([en, de]) => placeholders(en).join() !== placeholders(de).join());
    expect(bad).toEqual([]);
  });

  it('has no empty translations', () => {
    expect(Object.entries(DE).filter(([, de]) => !de.trim())).toEqual([]);
  });
});
