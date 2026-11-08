import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { TcmbHttpError, TcmbNotFoundError, bulletinUrl, getLatestRates, getRatesForDate, toIsoDate } from '../src/index.js';

const xml = readFileSync(new URL('./fixtures/2026-11-06.xml', import.meta.url));

/** A fake TCMB: serves the fixture for the listed paths and a 404 HTML page for everything else. */
function fakeTcmb(available: string[]) {
  return vi.fn(async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname;
    return available.includes(path)
      ? new Response(xml, { headers: { 'content-type': 'application/xml' } })
      : new Response('<html>Sayfa Goruntulenemedi</html>', { status: 404 });
  });
}

describe('bulletinUrl', () => {
  it('builds the archive path /kurlar/YYYYMM/DDMMYYYY.xml', () => {
    expect(bulletinUrl('2026-11-06')).toBe('https://www.tcmb.gov.tr/kurlar/202611/06112026.xml');
    expect(bulletinUrl(new Date(Date.UTC(2026, 0, 2)))).toBe('https://www.tcmb.gov.tr/kurlar/202601/02012026.xml');
  });

  it('rejects ambiguous or invalid dates', () => {
    expect(() => toIsoDate('06.11.2026')).toThrow(RangeError);
    expect(() => toIsoDate(new Date('nope'))).toThrow(RangeError);
  });
});

describe('getLatestRates', () => {
  it('fetches today.xml', async () => {
    const fetch = fakeTcmb(['/kurlar/today.xml']);
    const bulletin = await getLatestRates({ fetch });
    expect(fetch).toHaveBeenCalledWith('https://www.tcmb.gov.tr/kurlar/today.xml', expect.anything());
    expect(bulletin.date).toBe('2026-11-06');
  });

  it('surfaces server errors', async () => {
    const fetch = vi.fn(async () => new Response('busy', { status: 503 }));
    await expect(getLatestRates({ fetch })).rejects.toBeInstanceOf(TcmbHttpError);
  });
});

describe('getRatesForDate', () => {
  it('throws TcmbNotFoundError on a weekend by default', async () => {
    const fetch = fakeTcmb(['/kurlar/202611/06112026.xml']);
    await expect(getRatesForDate('2026-11-08', { fetch })).rejects.toBeInstanceOf(TcmbNotFoundError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back from Sunday to Friday when asked', async () => {
    const fetch = fakeTcmb(['/kurlar/202611/06112026.xml']);
    const bulletin = await getRatesForDate('2026-11-08', { fetch, fallbackDays: 5 });
    expect(bulletin.date).toBe('2026-11-06');
    expect(fetch.mock.calls.map(([url]) => String(url).slice(-12))).toEqual(['08112026.xml', '07112026.xml', '06112026.xml']);
  });

  it('gives up after fallbackDays', async () => {
    const fetch = fakeTcmb([]);
    await expect(getRatesForDate('2026-11-08', { fetch, fallbackDays: 2 })).rejects.toBeInstanceOf(TcmbNotFoundError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('validates fallbackDays', async () => {
    await expect(getRatesForDate('2026-11-08', { fallbackDays: -1 })).rejects.toThrow(RangeError);
  });
});
