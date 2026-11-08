import type { Bulletin, ExchangeRate, RateType } from './types.js';

export class RateNotAvailableError extends Error {
  override name = 'RateNotAvailableError';
}

/** Find a currency in a bulletin (case-insensitive). */
export function findRate(bulletin: Bulletin, code: string): ExchangeRate | undefined {
  const wanted = code.toUpperCase();
  return bulletin.rates.find((r) => r.code === wanted);
}

/** TRY for one unit of `code`, normalising the published `unit` (JPY is quoted per 100). */
export function tryPerUnit(bulletin: Bulletin, code: string, type: RateType = 'forexSelling'): number {
  if (code.toUpperCase() === 'TRY') return 1;
  const rate = findRate(bulletin, code);
  if (!rate) throw new RateNotAvailableError(`${code.toUpperCase()} is not in the ${bulletin.date} bulletin`);
  const value = rate[type];
  if (value === null) throw new RateNotAvailableError(`No ${type} rate for ${rate.code} on ${bulletin.date}`);
  return value / rate.unit;
}

export interface ConvertOptions {
  /** Which published rate to use. Defaults to `forexSelling` (döviz satış), the usual choice for pricing. */
  type?: RateType;
  /** Round the result to this many decimals (half away from zero). Omit to keep full precision. */
  decimals?: number;
}

/**
 * Convert `amount` between any two currencies in the bulletin, via TRY. `TRY` itself is supported on either side.
 *
 * @example convert(bulletin, 100, 'USD', 'TRY')            // 100 USD in lira at döviz satış
 * @example convert(bulletin, 2500, 'TRY', 'EUR', { decimals: 2 })
 */
export function convert(bulletin: Bulletin, amount: number, from: string, to: string, opts: ConvertOptions = {}): number {
  if (!Number.isFinite(amount)) throw new RangeError('amount must be a finite number');
  const type = opts.type ?? 'forexSelling';
  const value = (amount * tryPerUnit(bulletin, from, type)) / tryPerUnit(bulletin, to, type);
  if (opts.decimals === undefined) return value;
  const factor = 10 ** opts.decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor + Number.EPSILON)) / factor;
}
