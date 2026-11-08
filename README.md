# TCMB Exchange Rates: TypeScript client for TCMB döviz kurları

[![CI](https://github.com/bahriy-dev/tcmb-exchange-rates/actions/workflows/ci.yml/badge.svg)](https://github.com/bahriy-dev/tcmb-exchange-rates/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

A typed, zero-dependency client for the **Central Bank of the Republic of Türkiye (TCMB / CBRT)** exchange rate XML
service. It covers the latest bulletin, the archive by date, the previous business day on weekends and holidays, and
currency conversion with the quirks of the real data handled for you.

**[Türkçe açıklama aşağıda ↓](#türkçe)**

```ts
import { getRatesForDate, convert } from '@bahriy-dev/tcmb-exchange-rates';

const bulletin = await getRatesForDate('2026-11-08', { fallbackDays: 10 }); // Sunday → Friday's bulletin
convert(bulletin, 100, 'USD', 'TRY');                    // 5007.24 (döviz satış)
convert(bulletin, 2500, 'TRY', 'EUR', { decimals: 2 });  // 44.67
```

## Why another TCMB client?

The XML looks simple. These are the things that break naive parsers in production:

| Real-world quirk | What this library does |
| --- | --- |
| **No file on weekends and public holidays.** The archive returns an HTML 404 page. | `fallbackDays` steps back to the last business day. Without it you get a typed `TcmbNotFoundError`, not a parse crash. |
| **JPY is quoted per 100 yen** (`<Unit>100</Unit>`). | `unit` is kept, and `convert()` / `tryPerUnit()` normalise it. |
| **Many currencies have no cash rate.** `BanknoteBuying` / `BanknoteSelling` are empty for CNY, AED, KZT… | Missing rates are `null`, never `0` or `NaN`. `convert()` throws instead of guessing. |
| **Files before ~2016 are ISO-8859-9**, not UTF-8. | Bytes are decoded using the encoding in the XML prolog, so `DANİMARKA KRONU` stays intact. |
| **Padded names** (SDR) and an **XDR** row with only a cross rate. | Names are trimmed and all six numeric fields are exposed. |

All of this is covered by tests against **real bulletins** (a 2026 UTF-8 file and a 2012 ISO-8859-9 file), and a
weekly CI job runs the suite against the live service.

## Install

```bash
npm install github:bahriy-dev/tcmb-exchange-rates
```

Requires Node.js 20+ (uses the global `fetch`). It also works in Bun, Deno and edge runtimes.

## API

### `getLatestRates(options?)`

Fetches `https://www.tcmb.gov.tr/kurlar/today.xml`, the most recent bulletin. On weekends this is Friday's.

### `getRatesForDate(date, options?)`

Fetches the archived bulletin for `date` (`'YYYY-MM-DD'` or a `Date`, read as its UTC day).

| Option | Default | |
| --- | --- | --- |
| `fallbackDays` | `0` | Step back up to N days when there is no bulletin. `10` covers the longest holiday breaks. |
| `fetch` | global `fetch` | Inject your own for caching, retries or a proxy. |
| `signal` | | `AbortSignal` for timeouts. |

### `convert(bulletin, amount, from, to, options?)`

Converts between any two currencies in the bulletin, via TRY. `TRY` works on either side.

| Option | Default | |
| --- | --- | --- |
| `type` | `'forexSelling'` | `'forexBuying'` · `'forexSelling'` · `'banknoteBuying'` · `'banknoteSelling'` |
| `decimals` | none | Round half away from zero. |

### Lower-level

`parseBulletin(xml)`, `decodeBulletin(bytes)`, `bulletinUrl(date)`, `findRate(bulletin, code)` and
`tryPerUnit(bulletin, code, type)`. These are pure functions with no network access.

### Types

```ts
interface Bulletin { date: string; bulletinNo: string; rates: ExchangeRate[] }

interface ExchangeRate {
  code: string;            // 'USD'
  unit: number;            // 1, or 100 for JPY
  nameTr: string;          // 'ABD DOLARI'
  nameEn: string;          // 'US DOLLAR'
  forexBuying: number | null;      // döviz alış
  forexSelling: number | null;     // döviz satış
  banknoteBuying: number | null;   // efektif alış
  banknoteSelling: number | null;  // efektif satış
  crossRateUSD: number | null;
  crossRateOther: number | null;
}
```

## CLI

```bash
npx tcmb-rates                  # latest bulletin, all currencies
npx tcmb-rates USD EUR          # selected currencies
npx tcmb-rates 2026-11-08 USD   # a given day (falls back to the previous business day)
```

```
TCMB 2026-11-06  bulletin 2026/209
CODE  UNIT    FX BUY   FX SELL  CASH BUY CASH SELL
USD      1   49.9824   50.0724   49.9474   50.1475
EUR      1   55.8603   55.9609   55.8212   56.0449
JPY    100   31.5190   31.7277   31.4024   31.8483
```

## E-commerce recipes

**Price a USD catalogue in TRY once a day.** Cache the bulletin per date instead of calling TCMB on every request:

```ts
const cache = new Map<string, Promise<Bulletin>>();
const ratesFor = (day: string) => {
  if (!cache.has(day)) cache.set(day, getRatesForDate(day, { fallbackDays: 10 }));
  return cache.get(day)!;
};

const bulletin = await ratesFor(new Date().toISOString().slice(0, 10));
const priceTry = convert(bulletin, product.priceUsd, 'USD', 'TRY', { decimals: 2 });
```

**Time out instead of hanging checkout:**

```ts
await getLatestRates({ signal: AbortSignal.timeout(3000) });
```

> TCMB rates are **indicative**. Whether you may use the buying or the selling rate, or the previous day's bulletin,
> for invoices and accounting is a legal and tax question for your accountant. This library doesn't decide it for
> you, which is why `type` and the date are always explicit.

## Development

```bash
npm install
npm test            # unit tests on real fixtures, no network
npm run test:live   # against the live TCMB service
npm run build
```

---

## Türkçe

**TCMB döviz kurları için TypeScript / Node.js kütüphanesi.** Merkez Bankası'nın XML servisinden (`today.xml` ve
tarihli arşiv) gösterge niteliğindeki kurları tipli olarak okur. Hiçbir bağımlılığı yoktur.

- **Bugünün kurları:** `getLatestRates()`
- **Geçmiş tarihli kurlar:** `getRatesForDate('2026-11-06')`. Hafta sonu ve resmî tatillerde yayın yoktur;
  `fallbackDays` ile son iş gününün bülteni alınır.
- **Döviz alış/satış ve efektif alış/satış:** dört kur türü ayrı ayrı gelir. Yayınlanmayan kur `null` olur.
- **JPY 100 birim üzerinden yayınlanır;** `convert()` bunu otomatik düzeltir.
- **Eski (ISO-8859-9) dosyalar** Türkçe karakterleri bozmadan okunur.
- **Kur çevirme:** `convert(bulletin, 100, 'USD', 'TRY')`. Varsayılan olarak döviz satış kuru kullanılır.
- **Komut satırı:** `npx tcmb-rates USD EUR`

E-ticarette ürün fiyatlarını döviz bazlı güncellemek, faturada kur göstermek ya da raporlamada geçmiş kurları
kullanmak için uygundur. Hangi kurun (alış/satış, aynı gün/önceki gün) faturada kullanılacağı vergi mevzuatı
konusudur; mali müşavirinize danışın.

## License

[MIT](LICENSE). Exchange rate data © Türkiye Cumhuriyet Merkez Bankası. This project is not affiliated with TCMB.
