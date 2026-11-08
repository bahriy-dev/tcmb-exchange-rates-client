import { decodeBulletin, parseBulletin } from './parse.js';
import type { Bulletin } from './types.js';

const BASE_URL = 'https://www.tcmb.gov.tr/kurlar';

/** No bulletin for that date: a weekend, a public holiday, a future date, or before the archive starts. */
export class TcmbNotFoundError extends Error {
  override name = 'TcmbNotFoundError';
  constructor(readonly date: string) {
    super(`No TCMB bulletin for ${date} (weekend, holiday or future date)`);
  }
}

export class TcmbHttpError extends Error {
  override name = 'TcmbHttpError';
  constructor(readonly status: number, readonly url: string) {
    super(`TCMB responded ${status} for ${url}`);
  }
}

export interface FetchOptions {
  /** Custom fetch, e.g. one with a proxy, cache or retries. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Override the base URL (tests, mirrors). */
  baseUrl?: string;
}

export interface DateOptions extends FetchOptions {
  /**
   * When the date has no bulletin, step back day by day up to this many days to the last business day.
   * 0 (default) throws {@link TcmbNotFoundError} instead. 10 comfortably covers the longest holiday breaks.
   */
  fallbackDays?: number;
}

type DateInput = Date | string;

/** `YYYY-MM-DD` for a Date (using its UTC calendar day) or a validated string. */
export function toIsoDate(input: DateInput): string {
  if (typeof input === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(`${input}T00:00:00Z`))) {
      throw new RangeError(`Expected a YYYY-MM-DD date, got "${input}"`);
    }
    return input;
  }
  if (Number.isNaN(input.getTime())) throw new RangeError('Invalid Date');
  return input.toISOString().slice(0, 10);
}

/** The archive URL for a date: /kurlar/YYYYMM/DDMMYYYY.xml */
export function bulletinUrl(date: DateInput, baseUrl = BASE_URL): string {
  const [y, m, d] = toIsoDate(date).split('-');
  return `${baseUrl}/${y}${m}/${d}${m}${y}.xml`;
}

async function load(url: string, opts: FetchOptions): Promise<Bulletin | null> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const res = await doFetch(url, { signal: opts.signal, headers: { accept: 'application/xml' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new TcmbHttpError(res.status, url);
  return parseBulletin(decodeBulletin(new Uint8Array(await res.arrayBuffer())));
}

/** The latest published bulletin (`today.xml`). On weekends and holidays this is the last business day's. */
export async function getLatestRates(opts: FetchOptions = {}): Promise<Bulletin> {
  const url = `${opts.baseUrl ?? BASE_URL}/today.xml`;
  const bulletin = await load(url, opts);
  if (!bulletin) throw new TcmbHttpError(404, url);
  return bulletin;
}

/** The bulletin announced on a given date, optionally falling back to the previous business day. */
export async function getRatesForDate(date: DateInput, opts: DateOptions = {}): Promise<Bulletin> {
  const fallbackDays = opts.fallbackDays ?? 0;
  if (!Number.isInteger(fallbackDays) || fallbackDays < 0 || fallbackDays > 31) {
    throw new RangeError('fallbackDays must be an integer between 0 and 31');
  }
  const start = new Date(`${toIsoDate(date)}T00:00:00Z`);
  for (let back = 0; back <= fallbackDays; back++) {
    const day = new Date(start.getTime() - back * 86_400_000);
    const bulletin = await load(bulletinUrl(day, opts.baseUrl), opts);
    if (bulletin) return bulletin;
  }
  throw new TcmbNotFoundError(toIsoDate(date));
}
