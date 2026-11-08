import { describe, expect, it } from 'vitest';
import { getLatestRates, getRatesForDate } from '../src/index.js';

// Hits the real TCMB service. Run with `npm run test:live`; CI runs it weekly to catch format changes.
describe.runIf(process.env.LIVE)('live TCMB service', () => {
  it('serves a parsable latest bulletin with USD and EUR', async () => {
    const bulletin = await getLatestRates();
    expect(bulletin.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const code of ['USD', 'EUR']) {
      expect(bulletin.rates.find((r) => r.code === code)?.forexSelling).toBeGreaterThan(0);
    }
  });

  it('serves the archive and falls back over a weekend', async () => {
    const bulletin = await getRatesForDate('2026-11-08', { fallbackDays: 5 });
    expect(bulletin.date).toBe('2026-11-06');
  });
});
