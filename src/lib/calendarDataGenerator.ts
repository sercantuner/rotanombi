// Power BI tarzı Date/Calendar Table veri üretici
// Zaman bazlı analizler için boyut tablosu

import { format, getWeek } from 'date-fns';

export interface CalendarDataRow {
  tarih: string;           // YYYY-MM-DD
  yil: number;             // 2020, 2021, 2022...
  ay: number;              // 1-12
  ay_adi: string;          // Ocak, Şubat...
  gun: number;             // 1-31
  gun_adi: string;         // Pazartesi, Salı...
  hafta_no: number;        // 1-53
  ceyrek: number;          // 1-4
  ceyrek_adi: string;      // Q1, Q2, Q3, Q4
  yil_ay: string;          // 2024-01
  yil_ceyrek: string;      // 2024-Q1
  is_gunu: boolean;        // Hafta içi mi?
  hafta_sonu: boolean;     // Cumartesi/Pazar mı?
}

const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const GUNLER = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
];

/**
 * Power BI tarzı takvim/tarih boyut tablosu üretir
 * @param startYear Başlangıç yılı (varsayılan: 2020)
 * @param endYear Bitiş yılı (varsayılan: 2030)
 * @returns Takvim veri dizisi
 */
export function generateCalendarData(startYear = 2020, endYear = 2030): CalendarDataRow[] {
  const data: CalendarDataRow[] = [];

  for (let yil = startYear; yil <= endYear; yil++) {
    for (let ay = 0; ay < 12; ay++) {
      const gunSayisi = new Date(yil, ay + 1, 0).getDate();
      
      for (let gun = 1; gun <= gunSayisi; gun++) {
        const tarih = new Date(yil, ay, gun);
        const haftaGunu = tarih.getDay(); // 0 = Pazar
        const ceyrek = Math.floor(ay / 3) + 1;

        data.push({
          tarih: format(tarih, 'yyyy-MM-dd'),
          yil,
          ay: ay + 1,
          ay_adi: AYLAR[ay],
          gun,
          gun_adi: GUNLER[haftaGunu],
          hafta_no: getWeek(tarih, { weekStartsOn: 1 }),
          ceyrek,
          ceyrek_adi: `Q${ceyrek}`,
          yil_ay: `${yil}-${String(ay + 1).padStart(2, '0')}`,
          yil_ceyrek: `${yil}-Q${ceyrek}`,
          is_gunu: haftaGunu >= 1 && haftaGunu <= 5,
          hafta_sonu: haftaGunu === 0 || haftaGunu === 6,
        });
      }
    }
  }

  return data;
}

// Cache için - aynı parametrelerle tekrar üretilmesini önler
let cachedCalendarData: CalendarDataRow[] | null = null;
let cachedStartYear: number | null = null;
let cachedEndYear: number | null = null;

/**
 * Önbellekli takvim verisi üretici
 * Aynı parametrelerle çağrılırsa cache'den döner
 */
export function getCachedCalendarData(startYear = 2020, endYear = 2030): CalendarDataRow[] {
  if (
    cachedCalendarData &&
    cachedStartYear === startYear &&
    cachedEndYear === endYear
  ) {
    return cachedCalendarData;
  }

  cachedCalendarData = generateCalendarData(startYear, endYear);
  cachedStartYear = startYear;
  cachedEndYear = endYear;
  
  console.log(`[CalendarData] Generated ${cachedCalendarData.length} date rows (${startYear}-${endYear})`);
  
  return cachedCalendarData;
}
