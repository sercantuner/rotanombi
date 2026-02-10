// Türkiye saat dilimi (UTC+3) yardımcı fonksiyonları
// Tüm edge function'larda tarih hesaplamaları için kullanılır

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3

/** Türkiye saatine göre şu anki Date objesi (UTC+3) */
export function getTurkeyNow(): Date {
  return new Date(Date.now() + TURKEY_OFFSET_MS);
}

/** Türkiye saatine göre bugünün tarihi (YYYY-MM-DD) */
export function getTurkeyToday(): string {
  return getTurkeyNow().toISOString().split("T")[0];
}

/** Türkiye saatine göre ayın ilk günü (YYYY-MM-DD) */
export function getTurkeyMonthStart(): string {
  const now = getTurkeyNow();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split("T")[0];
}

/** Herhangi bir Date objesini Türkiye saatine çevirir */
export function toTurkeyDate(date: Date): Date {
  return new Date(date.getTime() + TURKEY_OFFSET_MS);
}
