/** One currency from a TCMB indicative exchange rate bulletin. All rates are in Turkish lira (TRY) per `unit`. */
export interface ExchangeRate {
  /** ISO 4217 code, e.g. "USD". "XDR" is the IMF Special Drawing Right. */
  code: string;
  /** How many units of the currency the rates are quoted for. 1 for most, 100 for JPY. */
  unit: number;
  /** Turkish name as published, e.g. "ABD DOLARI". */
  nameTr: string;
  /** English name as published, e.g. "US DOLLAR". */
  nameEn: string;
  /** Döviz alış: rate used for transfers and accounts. `null` when not published. */
  forexBuying: number | null;
  /** Döviz satış. */
  forexSelling: number | null;
  /** Efektif alış: rate for physical cash. Many currencies have no cash quote. */
  banknoteBuying: number | null;
  /** Efektif satış. */
  banknoteSelling: number | null;
  /** How many units of this currency one US dollar buys, when published. */
  crossRateUSD: number | null;
  /** Cross rate for currencies quoted against the dollar the other way round (e.g. SDR), when published. */
  crossRateOther: number | null;
}

export interface Bulletin {
  /** Bulletin date as ISO `YYYY-MM-DD`. The rates are announced on this business day. */
  date: string;
  /** Bulletin number, e.g. "2026/209". */
  bulletinNo: string;
  rates: ExchangeRate[];
}

/** Which of the four published rates to use. */
export type RateType = 'forexBuying' | 'forexSelling' | 'banknoteBuying' | 'banknoteSelling';
