import type { Bulletin, ExchangeRate } from './types.js';

export class TcmbParseError extends Error {
  override name = 'TcmbParseError';
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' || e[1] === 'X' ? 2 : 1), e[1] === 'x' || e[1] === 'X' ? 16 : 10)) : ENTITIES[e] ?? m,
  );

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

function text(block: string, name: string): string | undefined {
  // Matches <Name>value</Name>; an empty <Name/> yields undefined.
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m?.[1] === undefined ? undefined : decodeEntities(m[1]).trim();
}

function number(block: string, name: string): number | null {
  const raw = text(block, name);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new TcmbParseError(`Invalid number in <${name}>: "${raw}"`);
  return value;
}

/**
 * Decode a bulletin's raw bytes. Current files are UTF-8; files up to about 2016 are ISO-8859-9 (Turkish), declared
 * in the XML prolog.
 */
export function decodeBulletin(bytes: Uint8Array): string {
  const prolog = new TextDecoder('ascii').decode(bytes.subarray(0, 200));
  const encoding = prolog.match(/encoding="([^"]+)"/i)?.[1]?.toLowerCase() ?? 'utf-8';
  return new TextDecoder(encoding === 'iso-8859-9' ? 'windows-1254' : encoding).decode(bytes);
}

/** Parse the XML of a TCMB bulletin (`today.xml` or a dated archive file). Pure: no network, no globals. */
export function parseBulletin(xml: string): Bulletin {
  const root = xml.match(/<Tarih_Date\b[^>]*>/)?.[0];
  if (!root) throw new TcmbParseError('Not a TCMB bulletin: <Tarih_Date> element not found');
  const tarih = attr(root, 'Tarih'); // DD.MM.YYYY
  const [, dd, mm, yyyy] = tarih?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) ?? [];
  if (!dd || !mm || !yyyy) throw new TcmbParseError(`Unexpected bulletin date: "${tarih}"`);

  const rates: ExchangeRate[] = [];
  for (const [, open = '', body = ''] of xml.matchAll(/(<Currency\b[^>]*>)([\s\S]*?)<\/Currency>/g)) {
    const code = attr(open, 'CurrencyCode') ?? attr(open, 'Kod');
    if (!code) throw new TcmbParseError('Currency without a code');
    rates.push({
      code,
      unit: number(body, 'Unit') ?? 1,
      nameTr: text(body, 'Isim') ?? '',
      nameEn: text(body, 'CurrencyName') ?? '',
      forexBuying: number(body, 'ForexBuying'),
      forexSelling: number(body, 'ForexSelling'),
      banknoteBuying: number(body, 'BanknoteBuying'),
      banknoteSelling: number(body, 'BanknoteSelling'),
      crossRateUSD: number(body, 'CrossRateUSD'),
      crossRateOther: number(body, 'CrossRateOther'),
    });
  }
  if (!rates.length) throw new TcmbParseError('Bulletin contains no currencies');
  return { date: `${yyyy}-${mm}-${dd}`, bulletinNo: attr(root, 'Bulten_No') ?? '', rates };
}
