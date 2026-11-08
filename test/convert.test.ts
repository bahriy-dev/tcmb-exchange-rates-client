import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RateNotAvailableError, convert, decodeBulletin, parseBulletin, tryPerUnit } from '../src/index.js';

const bulletin = parseBulletin(decodeBulletin(new Uint8Array(readFileSync(new URL('./fixtures/2026-11-06.xml', import.meta.url)))));

describe('convert', () => {
  it('converts foreign currency to TRY at döviz satış by default', () => {
    expect(convert(bulletin, 100, 'USD', 'TRY')).toBeCloseTo(5007.24, 10);
  });

  it('can use any of the four published rates', () => {
    expect(convert(bulletin, 100, 'USD', 'TRY', { type: 'forexBuying' })).toBeCloseTo(4998.24, 10);
    expect(convert(bulletin, 100, 'USD', 'TRY', { type: 'banknoteSelling' })).toBeCloseTo(5014.75, 10);
  });

  it('converts TRY to foreign currency and rounds when asked', () => {
    expect(convert(bulletin, 1000, 'TRY', 'EUR', { decimals: 2 })).toBe(17.87);
  });

  it('crosses two foreign currencies via TRY', () => {
    expect(convert(bulletin, 1, 'EUR', 'USD', { decimals: 4 })).toBe(1.1176);
  });

  it('normalises the JPY unit of 100', () => {
    expect(tryPerUnit(bulletin, 'JPY')).toBeCloseTo(0.317277, 10);
    expect(convert(bulletin, 10_000, 'JPY', 'TRY', { decimals: 2 })).toBe(3172.77);
  });

  it('is case-insensitive', () => {
    expect(convert(bulletin, 1, 'usd', 'try')).toBe(convert(bulletin, 1, 'USD', 'TRY'));
  });

  it('refuses rates that were not published instead of guessing', () => {
    expect(() => convert(bulletin, 1, 'CNY', 'TRY', { type: 'banknoteSelling' })).toThrow(RateNotAvailableError);
    expect(() => convert(bulletin, 1, 'BTC', 'TRY')).toThrow(/not in the 2026-11-06 bulletin/);
  });

  it('rejects non-finite amounts', () => {
    expect(() => convert(bulletin, Number.NaN, 'USD', 'TRY')).toThrow(RangeError);
  });
});
