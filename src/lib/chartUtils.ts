// chartUtils.ts - Grafik için ortak yardımcı fonksiyonlar

import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, 
  addDays, addWeeks, addMonths, addQuarters, addYears,
  isBefore, isEqual, differenceInDays, format
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { AggregationType } from './widgetBuilderTypes';

// Renk paletleri
export const COLOR_PALETTES: Record<string, string[]> = {
  default: [
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ],
  ocean: ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#eab308'],
  sunset: ['#f97316', '#ef4444', '#ec4899', '#d946ef', '#8b5cf6', '#6366f1'],
  forest: ['#22c55e', '#16a34a', '#15803d', '#14532d', '#84cc16', '#65a30d'],
  berry: ['#ec4899', '#db2777', '#be185d', '#9d174d', '#f472b6', '#f9a8d4'],
  slate: ['#64748b', '#475569', '#334155', '#1e293b', '#94a3b8', '#cbd5e1'],
  professional: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
  vibrant: ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#f97316', '#ec4899'],
  pastel: ['#93c5fd', '#86efac', '#fde047', '#fca5a1', '#c4b5fd', '#a5f3fc'],
  earth: ['#78716c', '#a8a29e', '#d6d3d1', '#292524', '#57534e', '#44403c'],
  neon: ['#22d3ee', '#a855f7', '#f472b6', '#facc15', '#4ade80', '#fb923c'],
  monochrome: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'],
  contrast: ['#000000', '#ffffff', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'],
};

export type PaletteKey = keyof typeof COLOR_PALETTES;
export type DateGroupingType = 'day' | 'week' | 'month' | 'quarter' | 'year';

// HSL renk parse ve interpolasyon fonksiyonları
export function parseHslColor(color: string): { h: number; s: number; l: number } | null {
  // hsl(210, 70%, 50%) formatı
  const hslMatch = color.match(/hsl\((\d+),?\s*(\d+)%?,?\s*(\d+)%?\)/);
  if (hslMatch) {
    return { h: parseInt(hslMatch[1]), s: parseInt(hslMatch[2]), l: parseInt(hslMatch[3]) };
  }
  
  // CSS variable formatı: hsl(var(--primary))
  if (color.includes('var(--')) {
    return { h: 210, s: 70, l: 50 };
  }
  
  // Hex formatı
  const hexMatch = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16) / 255;
    const g = parseInt(hexMatch[2], 16) / 255;
    const b = parseInt(hexMatch[3], 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  
  return null;
}

export function hslToString(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Değer bazlı renk üretimi - büyük değerler koyu, küçük değerler açık
export function getValueBasedColor(
  value: number, 
  minValue: number, 
  maxValue: number, 
  baseColor: string
): string {
  const parsed = parseHslColor(baseColor);
  if (!parsed) return baseColor;
  
  const range = maxValue - minValue;
  const normalized = range > 0 ? (value - minValue) / range : 0.5;
  const lightness = 70 - (normalized * 40);
  const saturation = 40 + (normalized * 50);
  
  return hslToString(parsed.h, saturation, lightness);
}

// Tarih bazlı grafikler için gradyan renk dizisi oluştur
export function generateGradientColors(
  data: { name: string; value: number }[],
  baseColor: string
): string[] {
  if (!data || data.length === 0) return [];
  
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  return data.map(d => getValueBasedColor(d.value, minValue, maxValue, baseColor));
}

// Tarih alanı mı kontrol et
export function isDateField(field: string, sampleData: any[]): boolean {
  if (!field || !sampleData || sampleData.length === 0) return false;
  
  const dateKeywords = ['tarih', 'date', 'time', 'zaman', 'gun', 'gün', 'ay', 'yil', 'yıl', 'vade', 'created', 'updated'];
  const fieldLower = field.toLowerCase();
  if (dateKeywords.some(kw => fieldLower.includes(kw))) return true;
  
  const sampleValue = sampleData[0]?.[field];
  if (typeof sampleValue === 'string') {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{2}\.\d{2}\.\d{4}/, // DD.MM.YYYY
      /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
      /^\d{1,2}\s+\w+\s+\d{4}/, // 15 Ocak 2024
    ];
    return datePatterns.some(p => p.test(sampleValue));
  }
  
  return false;
}

// Tarih parse
export function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  const str = String(value);
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return new Date(str);
  }
  
  // DD.MM.YYYY
  const dotMatch = str.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotMatch) {
    return new Date(parseInt(dotMatch[3]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[1]));
  }
  
  // DD/MM/YYYY
  const slashMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch) {
    return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
  }
  
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Tarih gruplama tipini otomatik tespit et
export function detectDateGroupingType(data: any[], dateField: string): DateGroupingType {
  if (!data || data.length < 2) return 'day';
  
  const dates = data.map(d => parseDate(d[dateField])).filter((d): d is Date => d !== null);
  if (dates.length < 2) return 'day';
  
  dates.sort((a, b) => a.getTime() - b.getTime());
  const daySpan = differenceInDays(dates[dates.length - 1], dates[0]);
  
  if (daySpan > 365 * 2) return 'year';
  if (daySpan > 365) return 'quarter';
  if (daySpan > 90) return 'month';
  if (daySpan > 30) return 'week';
  return 'day';
}

// Tarih grup anahtarı oluştur
export function getDateGroupKey(date: Date, groupingType: DateGroupingType): string {
  switch (groupingType) {
    case 'day':
      return format(date, 'dd MMM', { locale: tr });
    case 'week':
      return `${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd MMM', { locale: tr })}`;
    case 'month':
      return format(date, 'MMM yyyy', { locale: tr });
    case 'quarter':
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `Ç${q} ${date.getFullYear()}`;
    case 'year':
      return format(date, 'yyyy');
    default:
      return format(date, 'dd MMM', { locale: tr });
  }
}

// Tarih grubunun başlangıç tarihini döndür
export function getDateGroupStart(date: Date, groupingType: DateGroupingType): Date {
  switch (groupingType) {
    case 'day': return startOfDay(date);
    case 'week': return startOfWeek(date, { weekStartsOn: 1 });
    case 'month': return startOfMonth(date);
    case 'quarter': return startOfQuarter(date);
    case 'year': return startOfYear(date);
    default: return startOfDay(date);
  }
}

// Tarih grubuna bir birim ekle
export function addDateGroup(date: Date, groupingType: DateGroupingType): Date {
  switch (groupingType) {
    case 'day': return addDays(date, 1);
    case 'week': return addWeeks(date, 1);
    case 'month': return addMonths(date, 1);
    case 'quarter': return addQuarters(date, 1);
    case 'year': return addYears(date, 1);
    default: return addDays(date, 1);
  }
}

// Tarih aralığındaki boşlukları doldur
export function fillDateGaps(
  groupedData: { name: string; value: number; sortKey?: number }[],
  rawData: any[],
  dateField: string,
  groupingType: DateGroupingType
): { name: string; value: number; sortKey?: number }[] {
  if (!rawData || rawData.length === 0) return groupedData;
  
  // Tüm tarihleri parse et
  const allDates = rawData
    .map(d => parseDate(d[dateField]))
    .filter((d): d is Date => d !== null);
  
  if (allDates.length < 2) return groupedData;
  
  allDates.sort((a, b) => a.getTime() - b.getTime());
  
  const minDate = getDateGroupStart(allDates[0], groupingType);
  const maxDate = getDateGroupStart(allDates[allDates.length - 1], groupingType);
  
  // Mevcut verileri map'e al
  const dataMap = new Map<string, number>();
  groupedData.forEach(d => dataMap.set(d.name, d.value));
  
  // Tüm tarih aralığını doldur
  const filledData: { name: string; value: number; sortKey: number }[] = [];
  let currentDate = minDate;
  
  while (isBefore(currentDate, maxDate) || isEqual(currentDate, maxDate)) {
    const key = getDateGroupKey(currentDate, groupingType);
    const value = dataMap.get(key) || 0;
    
    filledData.push({
      name: key,
      value,
      sortKey: currentDate.getTime()
    });
    
    currentDate = addDateGroup(currentDate, groupingType);
  }
  
  return filledData.sort((a, b) => a.sortKey - b.sortKey);
}

// Grafik verileri için gruplama (tarih desteği ile)
export function groupDataForChartWithDates(
  data: any[], 
  groupField: string, 
  valueField: string, 
  aggregation: AggregationType = 'sum',
  displayLimit: number = 10,
  isDateGrouping: boolean = false,
  dateGroupingType?: DateGroupingType,
  fillGaps: boolean = false
): { name: string; value: number; sortKey?: number }[] {
  if (!data || data.length === 0) return [];

  const effectiveGroupingType = dateGroupingType || (isDateGrouping ? detectDateGroupingType(data, groupField) : 'day');

  // Tarihe göre gruplama
  const groups: Record<string, { items: any[]; sortKey: number }> = {};
  
  data.forEach(item => {
    let key: string;
    let sortKey = 0;
    
    if (isDateGrouping) {
      const date = parseDate(item[groupField]);
      if (date) {
        key = getDateGroupKey(date, effectiveGroupingType);
        sortKey = getDateGroupStart(date, effectiveGroupingType).getTime();
      } else {
        key = String(item[groupField] || 'Belirsiz');
      }
    } else {
      key = String(item[groupField] || 'Belirsiz');
    }
    
    if (!groups[key]) groups[key] = { items: [], sortKey };
    groups[key].items.push(item);
  });

  // Agregasyon hesapla
  const calculateAggregation = (items: any[], field: string, agg: AggregationType): number => {
    const values = items.map(item => {
      const val = item[field];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    }).filter(v => !isNaN(v));

    switch (agg) {
      case 'sum': return values.reduce((acc, val) => acc + val, 0);
      case 'avg': return values.length > 0 ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;
      case 'count': return items.length;
      case 'count_distinct': return new Set(items.map(item => item[field])).size;
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      default: return values.reduce((acc, val) => acc + val, 0);
    }
  };

  let result: { name: string; value: number; sortKey?: number }[] = Object.entries(groups)
    .map(([name, { items, sortKey }]) => ({
      name,
      value: calculateAggregation(items, valueField, aggregation),
      sortKey
    }));

  if (isDateGrouping) {
    // Tarih sırasına göre sırala
    result.sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));
    
    // Boşlukları doldur
    if (fillGaps) {
      const filled = fillDateGaps(result, data, groupField, effectiveGroupingType);
      result = filled;
    }
  } else {
    // Değere göre sırala ve limit uygula
    result.sort((a, b) => b.value - a.value);
    result = result.slice(0, displayLimit);
  }

  return result;
}
