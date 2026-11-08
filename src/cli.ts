#!/usr/bin/env node
import { getLatestRates, getRatesForDate } from './client.js';

// Usage: tcmb-rates [YYYY-MM-DD] [CODE...]
//   tcmb-rates                 latest bulletin, all currencies
//   tcmb-rates USD EUR         latest bulletin, selected currencies
//   tcmb-rates 2026-11-06 USD  a given day (falls back to the previous business day)
const args = process.argv.slice(2);
const date = args[0]?.match(/^\d{4}-\d{2}-\d{2}$/) ? args.shift() : undefined;
const codes = new Set(args.map((c) => c.toUpperCase()));

const bulletin = date ? await getRatesForDate(date, { fallbackDays: 10 }) : await getLatestRates();
const fmt = (n: number | null) => (n === null ? '-' : n.toFixed(4)).padStart(10);
console.log(`TCMB ${bulletin.date}  bulletin ${bulletin.bulletinNo}`);
console.log(`${'CODE'.padEnd(5)}${'UNIT'.padStart(5)}${'FX BUY'.padStart(10)}${'FX SELL'.padStart(10)}${'CASH BUY'.padStart(10)}${'CASH SELL'.padStart(10)}`);
for (const r of bulletin.rates) {
  if (codes.size && !codes.has(r.code)) continue;
  console.log(`${r.code.padEnd(5)}${String(r.unit).padStart(5)}${fmt(r.forexBuying)}${fmt(r.forexSelling)}${fmt(r.banknoteBuying)}${fmt(r.banknoteSelling)}`);
}
