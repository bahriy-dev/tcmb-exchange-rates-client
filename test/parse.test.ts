import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TcmbParseError, decodeBulletin, parseBulletin } from '../src/index.js';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

describe('parseBulletin: current UTF-8 format', () => {
  const bulletin = parseBulletin(decodeBulletin(fixture('2026-11-06.xml')));

  it('reads the bulletin header', () => {
    expect(bulletin.date).toBe('2026-11-06');
    expect(bulletin.bulletinNo).toBe('2026/209');
    expect(bulletin.rates).toHaveLength(22);
  });

  it('reads all four rates and names', () => {
    expect(bulletin.rates[0]).toEqual({
      code: 'USD',
      unit: 1,
      nameTr: 'ABD DOLARI',
      nameEn: 'US DOLLAR',
      forexBuying: 49.9824,
      forexSelling: 50.0724,
      banknoteBuying: 49.9474,
      banknoteSelling: 50.1475,
      crossRateUSD: null,
      crossRateOther: null,
    });
  });

  it('keeps the published unit (JPY is quoted per 100 yen)', () => {
    const jpy = bulletin.rates.find((r) => r.code === 'JPY')!;
    expect(jpy.unit).toBe(100);
    expect(jpy.nameTr).toBe('JAPON YENİ');
  });

  it('returns null for rates that are not published, instead of 0 or NaN', () => {
    const cny = bulletin.rates.find((r) => r.code === 'CNY')!;
    expect(cny.forexSelling).toBeGreaterThan(0);
    expect(cny.banknoteBuying).toBeNull();
    expect(cny.banknoteSelling).toBeNull();
  });

  it('trims the padded SDR names and reads its cross rate', () => {
    const xdr = bulletin.rates.find((r) => r.code === 'XDR')!;
    expect(xdr.nameEn).toBe('SPECIAL DRAWING RIGHT (SDR)');
    expect(xdr.forexSelling).toBeNull();
    expect(xdr.crossRateOther).toBe(1.35406);
  });
});

describe('parseBulletin: legacy ISO-8859-9 format (2012)', () => {
  const bulletin = parseBulletin(decodeBulletin(fixture('2012-10-12-iso-8859-9.xml')));

  it('decodes Turkish characters correctly', () => {
    expect(bulletin.rates.find((r) => r.code === 'DKK')!.nameTr).toBe('DANİMARKA KRONU');
  });

  it('reads the older attribute order and extra elements', () => {
    expect(bulletin.date).toBe('2012-10-12');
    expect(bulletin.bulletinNo).toBe('2012/200');
    const jpy = bulletin.rates.find((r) => r.code === 'JPY')!;
    expect(jpy).toMatchObject({ unit: 100, forexBuying: 2.2891, crossRateUSD: 78.44 });
  });
});

describe('parseBulletin: invalid input', () => {
  it('rejects HTML error pages', () => {
    expect(() => parseBulletin('<html><title>Sayfa Goruntulenemedi</title></html>')).toThrow(TcmbParseError);
  });

  it('rejects malformed numbers instead of returning NaN', () => {
    const xml = '<Tarih_Date Tarih="06.11.2026" Bulten_No="1"><Currency CurrencyCode="USD"><Unit>1</Unit><ForexBuying>4o.1</ForexBuying></Currency></Tarih_Date>';
    expect(() => parseBulletin(xml)).toThrow(/Invalid number in <ForexBuying>/);
  });
});
