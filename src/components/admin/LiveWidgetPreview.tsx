// LiveWidgetPreview - Widget Builder'da gerçek verilerle çalışan canlı önizleme

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WidgetBuilderConfig, CalculatedField, AggregationType, PostFetchFilter, PivotConfig } from '@/lib/widgetBuilderTypes';
import { TableColumn } from './TableColumnBuilder';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Play, RefreshCw, Eye, AlertCircle, CheckCircle2, Hash, 
  BarChart3, TrendingUp, PieChart, Activity, Table, List, Loader2,
  Palette, ChevronDown, Edit2, ArrowUp, ArrowDown, ArrowUpDown,
  Grid3X3, LayoutGrid, Settings2, Minus, Calendar
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LegendPosition } from '@/lib/widgetBuilderTypes';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useChartColorPalette, COLOR_PALETTES as USER_COLOR_PALETTES } from '@/hooks/useChartColorPalette';
import { useGlobalFilters } from '@/contexts/GlobalFilterContext';
import { GlobalFilters } from '@/lib/filterTypes';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Genişletilmiş renk paletleri (12 adet)
const COLOR_PALETTES = {
  default: {
    name: 'Varsayılan',
    colors: [
      'hsl(var(--primary))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
      'hsl(210, 70%, 50%)',
      'hsl(280, 60%, 55%)',
      'hsl(160, 60%, 45%)',
      'hsl(35, 80%, 50%)',
      'hsl(340, 70%, 55%)',
    ]
  },
  pastel: {
    name: 'Pastel',
    colors: [
      '#a8d5ba', '#f5b7b1', '#aed6f1', '#f9e79f', '#d7bde2',
      '#f8c8dc', '#c1e1c1', '#b5e7a0', '#ffd1b3', '#c7ceea'
    ]
  },
  vivid: {
    name: 'Canlı',
    colors: [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
      '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
    ]
  },
  business: {
    name: 'Profesyonel',
    colors: [
      '#1a5276', '#148f77', '#b9770e', '#6c3483', '#943126',
      '#2e4053', '#1e8449', '#7d3c98', '#a04000', '#145a32'
    ]
  },
  mono: {
    name: 'Monokrom',
    colors: [
      '#2c3e50', '#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7',
      '#566573', '#839192', '#aab7b8', '#d5d8dc', '#515a5a'
    ]
  },
  ocean: {
    name: 'Okyanus',
    colors: [
      '#0077b6', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4',
      '#023e8a', '#0096c7', '#caf0f8', '#005f73', '#94d2bd'
    ]
  },
  sunset: {
    name: 'Gün Batımı',
    colors: [
      '#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
      '#ee5a24', '#f8c291', '#6d214f', '#b33939', '#c44569'
    ]
  },
  forest: {
    name: 'Orman',
    colors: [
      '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2',
      '#1b4332', '#b7e4c7', '#d8f3dc', '#081c15', '#344e41'
    ]
  },
  berry: {
    name: 'Meyve',
    colors: [
      '#7b2d8e', '#9c3587', '#c04b7d', '#e06974', '#f4986e',
      '#5c2751', '#d94f70', '#eb6b9d', '#ff8fa3', '#ffb3c1'
    ]
  },
  earth: {
    name: 'Toprak',
    colors: [
      '#8b4513', '#a0522d', '#cd853f', '#daa520', '#d2691e',
      '#5d3a1a', '#bc6c25', '#dda15e', '#606c38', '#283618'
    ]
  },
  neon: {
    name: 'Neon',
    colors: [
      '#ff00ff', '#00ffff', '#ff00aa', '#00ff00', '#ffff00',
      '#ff6600', '#0099ff', '#cc00ff', '#00ff99', '#ff3366'
    ]
  },
  retro: {
    name: 'Retro',
    colors: [
      '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653',
      '#a8dadc', '#457b9d', '#1d3557', '#f1faee', '#ffb4a2'
    ]
  },
};

export type PaletteKey = keyof typeof COLOR_PALETTES;

export { COLOR_PALETTES };

// HSL renk parse ve interpolasyon fonksiyonları
function parseHslColor(color: string): { h: number; s: number; l: number } | null {
  // hsl(210, 70%, 50%) formatı
  const hslMatch = color.match(/hsl\((\d+),?\s*(\d+)%?,?\s*(\d+)%?\)/);
  if (hslMatch) {
    return { h: parseInt(hslMatch[1]), s: parseInt(hslMatch[2]), l: parseInt(hslMatch[3]) };
  }
  
  // CSS variable formatı: hsl(var(--primary))
  if (color.includes('var(--')) {
    // Varsayılan primary renk döndür
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

function hslToString(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Değer bazlı renk üretimi - büyük değerler koyu, küçük değerler açık
function getValueBasedColor(
  value: number, 
  minValue: number, 
  maxValue: number, 
  baseColor: string
): string {
  const parsed = parseHslColor(baseColor);
  if (!parsed) return baseColor;
  
  // Normalize edilmiş değer (0-1 arası)
  const range = maxValue - minValue;
  const normalized = range > 0 ? (value - minValue) / range : 0.5;
  
  // Lightness değerini ayarla: düşük değer = açık (70%), yüksek değer = koyu (30%)
  const lightness = 70 - (normalized * 40); // 70'ten 30'a
  
  // Saturation değerini de ayarla: düşük değer = soluk (40%), yüksek değer = canlı (90%)
  const saturation = 40 + (normalized * 50); // 40'tan 90'a
  
  return hslToString(parsed.h, saturation, lightness);
}

// Tarih bazlı grafikler için gradyan renk dizisi oluştur
function generateGradientColors(
  data: { name: string; value: number }[],
  baseColor: string
): string[] {
  if (!data || data.length === 0) return [];
  
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  return data.map(d => getValueBasedColor(d.value, minValue, maxValue, baseColor));
}

// İkon listesi
const ICON_OPTIONS = [
  'Hash', 'BarChart3', 'TrendingUp', 'Activity', 'PieChart', 'DollarSign',
  'Wallet', 'CreditCard', 'Users', 'Package', 'ShoppingCart', 'Clock',
  'Calendar', 'FileText', 'Building', 'Target', 'Award', 'Star',
  'Zap', 'Scale', 'Percent', 'ArrowUpRight', 'ArrowDownRight', 'Gauge'
];

// Field Wells ve Chart Settings tipleri
import { FieldWellsConfig } from './FieldWellBuilder';
import { ChartSettingsData } from './ChartSettingsPanel';
import { DateFilterConfig, DatePeriod, DATE_PERIODS } from '@/lib/widgetBuilderTypes';
import { 
  format, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, 
  subDays, subWeeks, subMonths, subQuarters, subYears, endOfDay, endOfWeek, endOfMonth, 
  endOfQuarter, endOfYear, isWithinInterval, parseISO, isValid,
  addDays, addWeeks, addMonths, addQuarters, isBefore, isAfter, isEqual,
  differenceInDays, differenceInWeeks, differenceInMonths, differenceInQuarters, differenceInYears,
  getWeek, getMonth, getQuarter, getYear
} from 'date-fns';
import { tr } from 'date-fns/locale';

interface LiveWidgetPreviewProps {
  config: WidgetBuilderConfig;
  widgetName: string;
  widgetIcon: string;
  xAxisField: string;
  yAxisField: string;
  legendField: string;
  calculatedFields: CalculatedField[];
  postFetchFilters: PostFetchFilter[];
  tableColumns: TableColumn[];
  pivotConfig: PivotConfig;
  dataSourceId: string | null;
  // Power BI tarzı Field Wells ve Chart Settings (Görsel sekmesinden gelir)
  fieldWells?: FieldWellsConfig;
  chartSettings?: ChartSettingsData;
  // Tarih filtresi ayarları
  dateFilterConfig?: DateFilterConfig;
  onNameChange?: (name: string) => void;
  onIconChange?: (icon: string) => void;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <BarChart3 className={className} />;
  return <Icon className={className} />;
};

// Değer formatlama
function formatValue(value: number, format?: string, prefix?: string, suffix?: string): string {
  let formatted = '';
  
  switch (format) {
    case 'currency':
      if (Math.abs(value) >= 1_000_000_000) {
        formatted = `${(value / 1_000_000_000).toFixed(1)}B`;
      } else if (Math.abs(value) >= 1_000_000) {
        formatted = `${(value / 1_000_000).toFixed(1)}M`;
      } else if (Math.abs(value) >= 1_000) {
        formatted = `${(value / 1_000).toFixed(0)}K`;
      } else {
        formatted = value.toLocaleString('tr-TR');
      }
      return `${prefix || '₺'}${formatted}${suffix || ''}`;
    case 'percentage':
      return `%${value.toFixed(1)}${suffix || ''}`;
    case 'number':
    case 'count':
      return `${prefix || ''}${Math.round(value).toLocaleString('tr-TR')}${suffix || ''}`;
    default:
      return `${prefix || ''}${value.toLocaleString('tr-TR')}${suffix || ''}`;
  }
}

// Kolon başlığı formatlama (snake_case → Title Case)
function formatColumnHeader(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Agregasyon hesaplama
function calculateAggregation(data: any[], field: string, aggregation: AggregationType): number {
  if (!data || data.length === 0) return 0;
  
  const values = data.map(item => {
    const val = item[field];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
    return 0;
  }).filter(v => !isNaN(v));
  
  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'count': return data.length;
    case 'count_distinct': return new Set(data.map(item => item[field])).size;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

// Tarih alanı olup olmadığını tespit et
function isDateField(fieldName: string, sampleValue: any): boolean {
  // Alan adına göre kontrol
  const fieldLower = fieldName.toLowerCase();
  if (fieldLower.includes('tarih') || fieldLower.includes('date') || 
      fieldLower.includes('zaman') || fieldLower.includes('time') ||
      fieldLower.includes('created') || fieldLower.includes('updated')) {
    return true;
  }
  
  // Değer formatına göre kontrol
  if (typeof sampleValue === 'string') {
    // ISO tarih formatı (2024-01-15 veya 2024-01-15T10:30:00)
    if (/^\d{4}-\d{2}-\d{2}/.test(sampleValue)) return true;
    // TR tarih formatı (15.01.2024)
    if (/^\d{2}\.\d{2}\.\d{4}/.test(sampleValue)) return true;
    // US tarih formatı (01/15/2024)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(sampleValue)) return true;
  }
  
  return false;
}

// Tarih değerini Date objesine çevir
function parseDate(value: any): Date | null {
  if (!value) return null;
  
  if (value instanceof Date) return value;
  
  if (typeof value === 'string') {
    // ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parsed = parseISO(value);
      if (isValid(parsed)) return parsed;
    }
    // TR format (DD.MM.YYYY)
    if (/^\d{2}\.\d{2}\.\d{4}/.test(value)) {
      const [day, month, year] = value.split('.').map(Number);
      const parsed = new Date(year, month - 1, day);
      if (isValid(parsed)) return parsed;
    }
    // US format (MM/DD/YYYY)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      const [month, day, year] = value.split('/').map(Number);
      const parsed = new Date(year, month - 1, day);
      if (isValid(parsed)) return parsed;
    }
  }
  
  return null;
}

// Tarih periyoduna göre aralık hesapla
function getDateRangeForPeriod(period: DatePeriod): { start: Date; end: Date } | null {
  const now = new Date();
  
  switch (period) {
    case 'all':
      return null; // Filtre yok
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last_week':
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'last_quarter':
      const lastQuarter = subQuarters(now, 1);
      return { start: startOfQuarter(lastQuarter), end: endOfQuarter(lastQuarter) };
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'last_year':
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    case 'last_7_days':
      return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case 'last_30_days':
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case 'last_90_days':
      return { start: startOfDay(subDays(now, 90)), end: endOfDay(now) };
    case 'custom':
      return null; // Özel aralık için DateFilterConfig'den alınır
    default:
      return null;
  }
}

// Tarih filtresini uygula
function applyDateFilter(data: any[], dateField: string, period: DatePeriod, customStart?: string, customEnd?: string): any[] {
  if (!dateField || period === 'all') return data;
  
  let range = getDateRangeForPeriod(period);
  
  // Özel aralık için
  if (period === 'custom' && customStart && customEnd) {
    const start = parseDate(customStart);
    const end = parseDate(customEnd);
    if (start && end) {
      range = { start: startOfDay(start), end: endOfDay(end) };
    }
  }
  
  if (!range) return data;
  
  return data.filter(row => {
    const dateValue = parseDate(row[dateField]);
    if (!dateValue) return false;
    return isWithinInterval(dateValue, range);
  });
}

// Tarihsel sıraya göre sırala (kronolojik)
function sortByDateField(data: any[], dateField: string, ascending: boolean = true): any[] {
  if (!dateField) return data;
  
  return [...data].sort((a, b) => {
    const dateA = parseDate(a[dateField]);
    const dateB = parseDate(b[dateField]);
    
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    const diff = dateA.getTime() - dateB.getTime();
    return ascending ? diff : -diff;
  });
}

// Tarih gruplama tipini belirle (gün, hafta, ay, çeyrek bazlı)
type DateGroupingType = 'day' | 'week' | 'month' | 'quarter' | 'year';

function detectDateGroupingType(data: any[], dateField: string): DateGroupingType {
  if (!data || data.length < 2) return 'day';
  
  const dates = data
    .map(item => parseDate(item[dateField]))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (dates.length < 2) return 'day';
  
  // İki tarih arasındaki farka bak
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const totalDays = differenceInDays(lastDate, firstDate);
  
  // Veri noktası sayısına göre gruplama tipi belirle
  if (totalDays > 365 * 2) return 'quarter'; // 2 yıldan fazla -> çeyrek
  if (totalDays > 365) return 'month'; // 1 yıldan fazla -> ay
  if (totalDays > 90) return 'month'; // 3 aydan fazla -> ay
  if (totalDays > 30) return 'week'; // 1 aydan fazla -> hafta
  return 'day'; // Varsayılan gün bazlı
}

// Tarih için gruplama anahtarı oluştur
function getDateGroupKey(date: Date, groupingType: DateGroupingType): string {
  switch (groupingType) {
    case 'day':
      return format(date, 'dd.MM.yyyy', { locale: tr });
    case 'week':
      const weekNum = getWeek(date, { weekStartsOn: 1 });
      const year = getYear(date);
      return `${year} - ${weekNum}. Hafta`;
    case 'month':
      return format(date, 'MMMM yyyy', { locale: tr });
    case 'quarter':
      const q = getQuarter(date);
      const y = getYear(date);
      return `${y} Q${q}`;
    case 'year':
      return format(date, 'yyyy');
    default:
      return format(date, 'dd.MM.yyyy', { locale: tr });
  }
}

// Tarih gruplama için başlangıç noktası
function getDateGroupStart(date: Date, groupingType: DateGroupingType): Date {
  switch (groupingType) {
    case 'day': return startOfDay(date);
    case 'week': return startOfWeek(date, { weekStartsOn: 1 });
    case 'month': return startOfMonth(date);
    case 'quarter': return startOfQuarter(date);
    case 'year': return startOfYear(date);
    default: return startOfDay(date);
  }
}

// Tarih grubunu bir sonraki adıma taşı
function addDateGroup(date: Date, groupingType: DateGroupingType): Date {
  switch (groupingType) {
    case 'day': return addDays(date, 1);
    case 'week': return addWeeks(date, 1);
    case 'month': return addMonths(date, 1);
    case 'quarter': return addQuarters(date, 1);
    case 'year': return addMonths(date, 12);
    default: return addDays(date, 1);
  }
}

// Boş tarihleri doldurarak tam tarih akışı oluştur
function fillDateGaps(
  data: { name: string; value: number; sortKey?: number }[],
  rawData: any[],
  dateField: string,
  groupingType: DateGroupingType
): { name: string; value: number; sortKey?: number }[] {
  if (!rawData || rawData.length === 0) return data;
  
  // Tüm tarihleri topla ve sırala
  const allDates = rawData
    .map(item => parseDate(item[dateField]))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (allDates.length === 0) return data;
  
  const minDate = getDateGroupStart(allDates[0], groupingType);
  const maxDate = getDateGroupStart(allDates[allDates.length - 1], groupingType);
  
  // Mevcut veriyi map'e çevir
  const dataMap = new Map<string, number>();
  data.forEach(item => {
    dataMap.set(item.name, item.value);
  });
  
  // Tüm tarih aralığını doldur
  const filledData: { name: string; value: number; sortKey?: number }[] = [];
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
    
    // Sonsuz döngüden korunma (maks 500 iterasyon)
    if (filledData.length > 500) break;
  }
  
  return filledData;
}

// Grafik verileri için gruplama (tarihsel sıralama destekli + boş tarih doldurma)
function groupDataForChart(
  data: any[], 
  groupField: string, 
  valueField: string, 
  aggregation: AggregationType = 'sum',
  displayLimit: number = 100,
  isDateGrouping: boolean = false,
  dateGroupingType?: DateGroupingType
): { name: string; value: number; sortKey?: number }[] {
  if (!data || data.length === 0) return [];

  // Tarih gruplama tipini otomatik belirle
  const effectiveGroupingType = dateGroupingType || (isDateGrouping ? detectDateGroupingType(data, groupField) : 'day');

  const groups: Record<string, any[]> = {};
  const groupDates: Record<string, Date | null> = {};
  
  data.forEach(item => {
    let key: string;
    
    if (isDateGrouping) {
      const date = parseDate(item[groupField]);
      if (date) {
        key = getDateGroupKey(date, effectiveGroupingType);
        groupDates[key] = getDateGroupStart(date, effectiveGroupingType);
      } else {
        key = 'Belirsiz';
      }
    } else {
      key = String(item[groupField] || 'Belirsiz');
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  let result: { name: string; value: number; sortKey?: number }[] = Object.entries(groups)
    .map(([name, items]) => ({
      name,
      value: calculateAggregation(items, valueField, aggregation),
      sortKey: groupDates[name] ? groupDates[name]!.getTime() : 0,
    }));
    
  // Tarihsel gruplama ise kronolojik sırala ve boşlukları doldur
  if (isDateGrouping) {
    result.sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));
    
    // Boş tarihleri doldur
    result = fillDateGaps(result, data, groupField, effectiveGroupingType);
  } else {
    result.sort((a, b) => b.value - a.value);
  }
  
  return result.slice(0, displayLimit);
}

// Post-fetch filtreleme
function applyPostFetchFilters(data: any[], filters: PostFetchFilter[]): any[] {
  if (!filters || filters.length === 0) return data;

  return data.filter(row => {
    let result = true;
    let currentLogical: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const fieldValue = row[filter.field];
      let matches = false;

      const strValue = String(fieldValue ?? '').toLowerCase();
      const filterValue = filter.value.toLowerCase();
      const numValue = parseFloat(String(fieldValue).replace(/[^\d.-]/g, '')) || 0;
      const filterNumValue = parseFloat(filter.value) || 0;
      const filterNumValue2 = parseFloat(filter.value2 || '') || 0;

      switch (filter.operator) {
        case '=': matches = strValue === filterValue; break;
        case '!=': matches = strValue !== filterValue; break;
        case '>': matches = numValue > filterNumValue; break;
        case '<': matches = numValue < filterNumValue; break;
        case '>=': matches = numValue >= filterNumValue; break;
        case '<=': matches = numValue <= filterNumValue; break;
        case 'IN':
          const inValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = inValues.includes(strValue);
          break;
        case 'NOT IN':
          const notInValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = !notInValues.includes(strValue);
          break;
        case 'contains': matches = strValue.includes(filterValue); break;
        case 'not_contains': matches = !strValue.includes(filterValue); break;
        case 'starts_with': matches = strValue.startsWith(filterValue); break;
        case 'ends_with': matches = strValue.endsWith(filterValue); break;
        case 'is_null': matches = fieldValue === null || fieldValue === undefined || fieldValue === ''; break;
        case 'is_not_null': matches = fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; break;
        case 'between': matches = numValue >= filterNumValue && numValue <= filterNumValue2; break;
        default: matches = true;
      }

      if (i === 0) {
        result = matches;
      } else {
        if (currentLogical === 'AND') {
          result = result && matches;
        } else {
          result = result || matches;
        }
      }

      currentLogical = filter.logicalOperator;
    }

    return result;
  });
}

// Hesaplama alanları uygula
function applyCalculatedFields(data: any[], calculatedFields: CalculatedField[]): any[] {
  if (!calculatedFields || calculatedFields.length === 0) return data;
  
  return data.map(row => {
    const newRow = { ...row };
    calculatedFields.forEach(cf => {
      newRow[cf.name] = evaluateExpression(cf.expression, row);
    });
    return newRow;
  });
}

// Global filtreleri veriye uygula (Dashboard ile tutarlılık için)
function applyGlobalFiltersToPreviewData(data: any[], filters: GlobalFilters): any[] {
  if (!data || data.length === 0) return data;
  
  // Helper: Belirli alan veride var mı kontrol et
  const hasField = (fieldName: string) => {
    if (data.length === 0) return false;
    return data.some(item => item[fieldName] !== undefined);
  };
  
  let filtered = [...data];
  
  // 1. Cari Kart Tipi filtresi
  if (filters.cariKartTipi && filters.cariKartTipi.length > 0 && hasField('carikarttipi')) {
    filtered = filtered.filter(item => 
      filters.cariKartTipi.includes(item.carikarttipi)
    );
  }
  
  // 2. Satış Temsilcisi filtresi
  if (filters.satisTemsilcisi && filters.satisTemsilcisi.length > 0) {
    const temsilciField = hasField('satistemsilcisi') ? 'satistemsilcisi' : 
                          hasField('satis_temsilcisi') ? 'satis_temsilcisi' :
                          hasField('temsilci') ? 'temsilci' : null;
    if (temsilciField) {
      filtered = filtered.filter(item => 
        filters.satisTemsilcisi.includes(item[temsilciField])
      );
    }
  }
  
  // 3. Şube filtresi
  if (filters.sube && filters.sube.length > 0) {
    const subeField = hasField('subekodu') ? 'subekodu' : 
                      hasField('sube_kodu') ? 'sube_kodu' :
                      hasField('sube') ? 'sube' : null;
    if (subeField) {
      filtered = filtered.filter(item => 
        filters.sube.includes(item[subeField])
      );
    }
  }
  
  // 4. Depo filtresi
  if (filters.depo && filters.depo.length > 0) {
    const depoField = hasField('depokodu') ? 'depokodu' : 
                      hasField('depo_kodu') ? 'depo_kodu' :
                      hasField('depo') ? 'depo' : null;
    if (depoField) {
      filtered = filtered.filter(item => 
        filters.depo.includes(item[depoField])
      );
    }
  }
  
  // 5. Özel Kod 1-3 filtreleri
  if (filters.ozelkod1 && filters.ozelkod1.length > 0 && hasField('ozelkod1kod')) {
    filtered = filtered.filter(item => filters.ozelkod1.includes(item.ozelkod1kod));
  }
  if (filters.ozelkod2 && filters.ozelkod2.length > 0 && hasField('ozelkod2kod')) {
    filtered = filtered.filter(item => filters.ozelkod2.includes(item.ozelkod2kod));
  }
  if (filters.ozelkod3 && filters.ozelkod3.length > 0 && hasField('ozelkod3kod')) {
    filtered = filtered.filter(item => filters.ozelkod3.includes(item.ozelkod3kod));
  }
  
  // 6. Şehir filtresi
  if (filters.sehir && filters.sehir.length > 0) {
    const sehirField = hasField('il') ? 'il' : 
                       hasField('sehir') ? 'sehir' : null;
    if (sehirField) {
      filtered = filtered.filter(item => 
        filters.sehir.includes(item[sehirField])
      );
    }
  }
  
  // 7. Durum filtresi
  if (filters.durum && filters.durum !== 'hepsi' && hasField('durum')) {
    if (filters.durum === 'aktif') {
      filtered = filtered.filter(item => 
        item.durum !== 'P' && item.durum !== 'Pasif'
      );
    } else if (filters.durum === 'pasif') {
      filtered = filtered.filter(item => 
        item.durum === 'P' || item.durum === 'Pasif'
      );
    }
  }
  
  // 8. Görünüm Modu filtresi
  if (filters.gorunumModu && filters.gorunumModu !== 'hepsi' && hasField('potansiyel')) {
    if (filters.gorunumModu === 'cari') {
      filtered = filtered.filter(item => !item.potansiyel);
    } else if (filters.gorunumModu === 'potansiyel') {
      filtered = filtered.filter(item => item.potansiyel === true);
    }
  }
  
  return filtered;
}

function evaluateExpression(expr: any, row: Record<string, any>): number {
  if (!expr) return 0;
  
  switch (expr.type) {
    case 'field':
      const val = row[expr.field];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    case 'constant':
      return expr.value ?? 0;
    case 'operation':
      const left = evaluateExpression(expr.left, row);
      const right = evaluateExpression(expr.right, row);
      switch (expr.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '%': return left % right;
        default: return 0;
      }
    case 'function':
      const args = expr.arguments?.map((a: any) => evaluateExpression(a, row)) || [];
      switch (expr.functionName) {
        case 'abs': return Math.abs(args[0] || 0);
        case 'round': return Math.round(args[0] || 0);
        case 'floor': return Math.floor(args[0] || 0);
        case 'ceil': return Math.ceil(args[0] || 0);
        case 'sqrt': return Math.sqrt(args[0] || 0);
        case 'pow': return Math.pow(args[0] || 0, args[1] || 0);
        case 'min': return Math.min(...args);
        case 'max': return Math.max(...args);
        default: return 0;
      }
    default:
      return 0;
  }
}

export function LiveWidgetPreview({
  config,
  widgetName,
  widgetIcon,
  xAxisField,
  yAxisField,
  legendField,
  calculatedFields,
  postFetchFilters,
  tableColumns,
  pivotConfig,
  dataSourceId,
  fieldWells,
  chartSettings,
  dateFilterConfig,
  onNameChange,
  onIconChange,
}: LiveWidgetPreviewProps) {
  const { impersonatedUserId, isImpersonating } = useImpersonation();
  const { colors: userColors, currentPaletteName } = useChartColorPalette();
  
  // Global filtreler - dashboard ile aynı filtreleri kullan
  const { filters: globalFilters } = useGlobalFilters();
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  
  // Anlık görsel tip değiştirme
  const [previewVizType, setPreviewVizType] = useState<string>(config.visualization.type);
  
  // Önizleme düzenleme state'leri
  const [editableName, setEditableName] = useState(widgetName);
  const [editableIcon, setEditableIcon] = useState(widgetIcon);
  
  // Tablo sıralama state'i
  const [tableSortColumn, setTableSortColumn] = useState<string | null>(null);
  const [tableSortDirection, setTableSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  
  // Tablo satır limiti
  const [tableRowLimit, setTableRowLimit] = useState(20);
  
  // Kullanıcının tercih ettiği palet kullanılır
  const activeColors = userColors;
  const showGrid = chartSettings?.showGrid !== false;
  const legendPosition = chartSettings?.legendPosition || 'bottom';
  const showTrendLine = chartSettings?.showTrendLine || false;
  const showAverageLine = chartSettings?.showAverageLine || false;
  const displayLimit = chartSettings?.displayLimit || 10;
  
  // Dinamik etiketler - fieldWells'ten veya config'den al
  const yAxisLabel = fieldWells?.yAxis?.[0]?.label 
    || fieldWells?.value?.label 
    || config.visualization.chart?.yAxis?.label
    || config.visualization.kpi?.valueField
    || 'Değer';
    
  const xAxisLabel = fieldWells?.xAxis?.label 
    || fieldWells?.category?.label 
    || config.visualization.chart?.xAxis?.label 
    || 'Kategori';
  
  // Props değişince state'leri güncelle
  useEffect(() => {
    setEditableName(widgetName);
    setEditableIcon(widgetIcon);
  }, [widgetName, widgetIcon]);
  
  // Config değişince preview tipini güncelle
  useEffect(() => {
    setPreviewVizType(config.visualization.type);
  }, [config.visualization.type]);

  // Veri çek
  const fetchPreviewData = useCallback(async () => {
    if (!dataSourceId && !config.diaApi?.method) {
      setError('Veri kaynağı seçilmedi');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-api-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          module: config.diaApi.module,
          method: config.diaApi.method,
          ...(config.diaApi.parameters.limit && config.diaApi.parameters.limit > 0 && { limit: config.diaApi.parameters.limit }),
          filters: config.diaApi.parameters.filters,
          selectedColumns: config.diaApi.parameters.selectedcolumns,
          sorts: config.diaApi.parameters.sorts,
          returnAllData: true,
          ...(isImpersonating && impersonatedUserId ? { targetUserId: impersonatedUserId } : {}),
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API hatası');
      }

      setRawData(result.sampleData || []);
      setRecordCount(result.recordCount || result.sampleData?.length || 0);
      setLastFetched(new Date());
      toast.success(`${result.recordCount || 0} kayıt yüklendi`);
    } catch (err: any) {
      setError(err.message || 'Veri çekilemedi');
      toast.error(err.message || 'Veri çekilemedi');
    } finally {
      setIsLoading(false);
    }
  }, [config, dataSourceId]);

  // Tarih alanını tespit et - X ekseninde veya dateFilterConfig'den
  const detectedDateField = useMemo(() => {
    const xAxisFieldName = fieldWells?.xAxis?.field || xAxisField || '';
    const dateConfigField = dateFilterConfig?.dateField || '';
    
    // Önce açıkça belirtilmiş tarih alanını kontrol et
    if (dateConfigField) return dateConfigField;
    
    // Sonra X ekseni tarih mi bak
    if (xAxisFieldName && rawData.length > 0) {
      const sampleValue = rawData[0][xAxisFieldName];
      if (isDateField(xAxisFieldName, sampleValue)) return xAxisFieldName;
    }
    
    return '';
  }, [fieldWells, xAxisField, dateFilterConfig, rawData]);
  
  // X ekseni tarih mi?
  const isXAxisDate = useMemo(() => {
    const xAxisFieldName = fieldWells?.xAxis?.field || xAxisField || '';
    if (!xAxisFieldName || rawData.length === 0) return false;
    const sampleValue = rawData[0][xAxisFieldName];
    return isDateField(xAxisFieldName, sampleValue);
  }, [fieldWells, xAxisField, rawData]);

  // İşlenmiş veri (filtreler + hesaplamalar + tarih filtresi + GLOBAL FİLTRELER uygulanmış)
  const processedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    
    // 1. Hesaplama alanlarını uygula
    let data = applyCalculatedFields(rawData, calculatedFields);
    
    // 2. Post-fetch filtreleri uygula
    data = applyPostFetchFilters(data, postFetchFilters);
    
    // 3. Tarih filtresi uygula (eğer aktifse)
    if (dateFilterConfig?.enabled && dateFilterConfig.dateField) {
      data = applyDateFilter(
        data, 
        dateFilterConfig.dateField, 
        dateFilterConfig.defaultPeriod,
        dateFilterConfig.customStartDate,
        dateFilterConfig.customEndDate
      );
    }
    
    // 4. GLOBAL FİLTRELER - Dashboard ile aynı görünüm için (KRİTİK!)
    // Bu sayede önizleme ve dashboard aynı sonucu gösterir
    data = applyGlobalFiltersToPreviewData(data, globalFilters);
    
    // 5. Tarih alanına göre sırala (X ekseni tarihse veya dateFilterConfig varsa)
    const sortField = detectedDateField || dateFilterConfig?.dateField;
    if (sortField && data.length > 0) {
      const sampleValue = data[0][sortField];
      if (isDateField(sortField, sampleValue)) {
        data = sortByDateField(data, sortField, true); // Kronolojik sıra
      }
    }
    
    return data;
  }, [rawData, calculatedFields, postFetchFilters, dateFilterConfig, detectedDateField, globalFilters]);

  // Ortalama değer hesapla (trend/average çizgileri için)
  const averageValue = useMemo(() => {
    if (!processedData || processedData.length === 0) return 0;
    // Field Wells öncelikli
    const valueField = fieldWells?.yAxis?.[0]?.field || yAxisField || config.visualization.chart?.yAxis?.field || config.visualization.chart?.valueField || 'toplambakiye';
    const sum = processedData.reduce((acc, row) => {
      const val = row[valueField];
      if (typeof val === 'number') return acc + val;
      if (typeof val === 'string') return acc + (parseFloat(val.replace(/[^\d.-]/g, '')) || 0);
      return acc;
    }, 0);
    return sum / processedData.length;
  }, [processedData, fieldWells, yAxisField, config.visualization.chart]);

  // Görselleştirme verisi - previewVizType kullanarak dinamik
  const visualizationData = useMemo(() => {
    if (!processedData || processedData.length === 0) return null;
    
    // Field Wells'ten değerleri al (öncelikli)
    const fwXAxis = fieldWells?.xAxis?.field;
    const fwYAxis = fieldWells?.yAxis?.[0]?.field;
    const fwValue = fieldWells?.value?.field;
    const fwCategory = fieldWells?.category?.field;
    const fwAggregation = fieldWells?.yAxis?.[0]?.aggregation || fieldWells?.value?.aggregation || 'sum';
    
    // KPI için özel hesaplama
    const kpiData = (() => {
      const valueField = fwValue || fwYAxis || config.visualization.kpi?.valueField || yAxisField || '';
      const aggregation = (fieldWells?.value?.aggregation || config.visualization.kpi?.aggregation || 'count') as AggregationType;
      const format = fieldWells?.value?.format || config.visualization.kpi?.format;
      return {
        value: valueField ? calculateAggregation(processedData, valueField, aggregation) : processedData.length,
        format,
        prefix: fieldWells?.value?.prefix || config.visualization.kpi?.prefix,
        suffix: fieldWells?.value?.suffix || config.visualization.kpi?.suffix,
        recordCount: processedData.length,
      };
    })();
    
    // Chart data için ortak hesaplama - Field Wells öncelikli + tarihsel sıralama
    const chartData = (() => {
      const groupField = fwXAxis || fwCategory || legendField || xAxisField || config.visualization.chart?.xAxis?.field || '';
      const valueField = fwYAxis || fwValue || yAxisField || config.visualization.chart?.yAxis?.field || config.visualization.chart?.valueField || '';
      const aggregation = (fwAggregation || (config.visualization.chart as any)?.aggregation || 'count') as AggregationType;
      
      // X ekseni tarih mi tespit et
      const isGroupDateField = isXAxisDate || (groupField === dateFilterConfig?.dateField);
      
      if (!groupField) {
        // Grup alanı yoksa ilk string alanı bul
        const firstRow = processedData[0];
        if (firstRow) {
          const stringField = Object.keys(firstRow).find(k => typeof firstRow[k] === 'string' && k !== 'id');
          if (stringField) {
            return groupDataForChart(processedData, stringField, valueField || 'toplambakiye', aggregation, 10, false);
          }
        }
        return [];
      }
      
      // Tarihsel gruplama flag'i ile çağır
      return groupDataForChart(processedData, groupField, valueField || 'toplambakiye', aggregation, 15, isGroupDateField);
    })();
    
    // Table data - TÜM kolonları göster
    const allColumns = Object.keys(processedData[0] || {});
    const tableData = {
      rows: processedData.slice(0, tableRowLimit),
      totalRows: processedData.length,
      columns: tableColumns.length > 0 
        ? tableColumns 
        : allColumns.map(f => ({ 
            field: f, 
            header: formatColumnHeader(f)
          })),
    };
    
    return {
      kpiData,
      chartData,
      tableData,
      showLegend: config.visualization.chart?.showLegend !== false,
      showGrid: config.visualization.chart?.showGrid !== false,
      isDateBasedChart: isXAxisDate || !!(dateFilterConfig?.enabled && dateFilterConfig.dateField),
    };
  }, [processedData, config, xAxisField, yAxisField, legendField, tableColumns, tableRowLimit, fieldWells, isXAxisDate, dateFilterConfig]);

  // Kullanılabilir görsel tipler
  const availableVizTypes = [
    { id: 'kpi', label: 'KPI', icon: Hash },
    { id: 'bar', label: 'Çubuk', icon: BarChart3 },
    { id: 'line', label: 'Çizgi', icon: TrendingUp },
    { id: 'area', label: 'Alan', icon: Activity },
    { id: 'pie', label: 'Pasta', icon: PieChart },
    { id: 'donut', label: 'Simit', icon: PieChart },
    { id: 'table', label: 'Tablo', icon: Table },
  ];

  // İsim değişikliği handler
  const handleNameChange = (name: string) => {
    setEditableName(name);
    onNameChange?.(name);
  };

  // İkon değişikliği handler
  const handleIconChange = (icon: string) => {
    setEditableIcon(icon);
    onIconChange?.(icon);
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="p-3 md:pb-3 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <CardTitle className="text-sm md:text-base">Canlı Önizleme</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {lastFetched && (
              <Badge variant="outline" className="text-[10px] md:text-xs">
                {recordCount} kayıt
              </Badge>
            )}
            <Button 
              size="sm" 
              onClick={fetchPreviewData} 
              disabled={isLoading}
              className="gap-1.5 h-7 text-xs md:h-9 md:text-sm"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Play className="h-3 w-3 md:h-4 md:w-4" />
              )}
              <span className="hidden md:inline">{isLoading ? 'Yükleniyor...' : 'Veri Çek'}</span>
              <span className="md:hidden">{isLoading ? 'Yükle...' : 'Çek'}</span>
            </Button>
          </div>
        </div>
        <CardDescription className="text-[10px] md:text-xs hidden md:block">
          Gerçek verilerle widget'ın nasıl görüneceğini test edin
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-2 md:p-6 pt-0">
        {error ? (
          <div className="flex items-center gap-2 text-destructive p-2 md:p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
            <span className="text-xs md:text-sm">{error}</span>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 md:space-y-3">
            <Skeleton className="h-6 md:h-8 w-full" />
            <Skeleton className="h-32 md:h-40 w-full" />
          </div>
        ) : !rawData.length ? (
          <div className="flex flex-col items-center justify-center py-4 md:py-8 text-muted-foreground">
            <RefreshCw className="h-8 w-8 md:h-10 md:w-10 mb-2 md:mb-3 opacity-30" />
            <p className="text-xs md:text-sm font-medium">Veri bekleniyor</p>
            <p className="text-[10px] md:text-xs mt-1">"Veri Çek" butonuna tıklayarak gerçek veriyi yükleyin</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-4">
            {/* Widget İsim ve İkon Düzenleme Alanı - Mobilde kompakt */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 p-2 md:p-3 bg-muted/50 rounded-lg">
              {/* İkon Seçici */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 md:h-9 md:w-9 p-0 flex-shrink-0">
                    <DynamicIcon iconName={editableIcon || 'BarChart3'} className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 md:w-64 p-2" align="start">
                  <Label className="text-[10px] md:text-xs text-muted-foreground mb-2 block">İkon Seç</Label>
                  <div className="grid grid-cols-6 gap-1">
                    {ICON_OPTIONS.map(icon => (
                      <Button
                        key={icon}
                        variant={editableIcon === icon ? 'default' : 'ghost'}
                        size="icon"
                        className="h-6 w-6 md:h-8 md:w-8"
                        onClick={() => handleIconChange(icon)}
                        title={icon}
                      >
                        <DynamicIcon iconName={icon} className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* İsim Input */}
              <div className="flex-1 w-full md:w-auto">
                <Input
                  value={editableName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Widget Adı"
                  className="h-8 md:h-9 text-xs md:text-sm font-medium"
                />
              </div>

              {/* Renk Paleti Göstergesi - Kullanıcının seçtiği palet */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded border bg-muted/20">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-0.5">
                  {activeColors.slice(0, 5).map((color, idx) => (
                    <div
                      key={idx}
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {USER_COLOR_PALETTES.find(p => p.name === currentPaletteName)?.label || 'Kurumsal'}
                </span>
              </div>
            </div>

            {/* İstatistikler ve Tarih Filtresi Bilgisi - Mobilde kompakt */}
            <div className="flex flex-wrap items-center gap-1 md:gap-2">
              <Badge variant="secondary" className="text-[10px] md:text-xs">
                Ham: {rawData.length}
              </Badge>
              {postFetchFilters.length > 0 && (
                <Badge className="text-[10px] md:text-xs bg-green-600">
                  Filtre: {processedData.length}
                </Badge>
              )}
              {calculatedFields.length > 0 && (
                <Badge variant="outline" className="text-[10px] md:text-xs">
                  +{calculatedFields.length} hesap
                </Badge>
              )}
              {/* Tarih Filtresi Durumu */}
              {dateFilterConfig?.enabled && dateFilterConfig.dateField && (
                <Badge className="text-[10px] md:text-xs bg-blue-600 gap-1">
                  <Calendar className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  <span className="hidden md:inline">{DATE_PERIODS.find(p => p.id === dateFilterConfig.defaultPeriod)?.name || dateFilterConfig.defaultPeriod}</span>
                  <span className="md:hidden">{dateFilterConfig.defaultPeriod}</span>
                </Badge>
              )}
              {/* X Ekseni Tarih Tespiti */}
              {isXAxisDate && !dateFilterConfig?.enabled && (
                <Badge variant="outline" className="text-[10px] md:text-xs gap-1 text-blue-600 border-blue-500/30">
                  <Calendar className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  <span className="hidden md:inline">Tarihsel</span>
                </Badge>
              )}
            </div>

            {/* Görsel Tip Değiştirici - Mobilde scroll */}
            <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
              <div className="flex gap-1 p-1.5 md:p-2 bg-muted/50 rounded-lg min-w-max md:min-w-0 md:flex-wrap">
                <span className="text-[10px] md:text-xs text-muted-foreground mr-1 md:mr-2 self-center whitespace-nowrap">Görsel:</span>
                {availableVizTypes.map(vt => {
                  const Icon = vt.icon;
                  return (
                    <Button
                      key={vt.id}
                      variant={previewVizType === vt.id ? 'default' : 'ghost'}
                      size="sm"
                      className="h-6 md:h-7 px-1.5 md:px-2 text-[10px] md:text-xs gap-0.5 md:gap-1"
                      onClick={() => setPreviewVizType(vt.id)}
                    >
                      <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      <span className="hidden xs:inline">{vt.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Grafik Ayarları Özeti - Mobilde gizle */}
            {['bar', 'line', 'area', 'pie', 'donut'].includes(previewVizType) && (
              <div className="hidden md:flex flex-wrap items-center gap-2 p-2 bg-muted/20 rounded-lg text-xs text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                <span>Ayarlar:</span>
                <Badge variant="outline" className="text-xs">
                  <Grid3X3 className="h-3 w-3 mr-1" />
                  Grid: {showGrid ? 'Açık' : 'Kapalı'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <LayoutGrid className="h-3 w-3 mr-1" />
                  Legend: {legendPosition === 'bottom' ? 'Alt' : legendPosition === 'right' ? 'Sağ' : 'Gizli'}
                </Badge>
                {['bar', 'line', 'area'].includes(previewVizType) && (
                  <>
                    {showTrendLine && (
                      <Badge variant="outline" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Trend
                      </Badge>
                    )}
                    {showAverageLine && (
                      <Badge variant="outline" className="text-xs">
                        <Minus className="h-3 w-3 mr-1" />
                        Ortalama
                      </Badge>
                    )}
                  </>
                )}
                {visualizationData?.isDateBasedChart && (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-500/30">
                    <Calendar className="h-3 w-3 mr-1" />
                    Kronolojik
                  </Badge>
                )}
                <span className="text-[10px] italic ml-auto">(Görsel sekmesinden değiştirin)</span>
              </div>
            )}

            <Separator className="hidden md:block" />

            {/* Widget Önizleme - Mobilde daha kompakt */}
            <div className="bg-card rounded-lg border p-2 md:p-4 min-h-[200px] md:min-h-[280px]">
              {/* KPI - Mobilde kompakt */}
              {previewVizType === 'kpi' && visualizationData && (
                <div className="text-center py-2 md:py-4">
                  <DynamicIcon iconName={editableIcon || 'Hash'} className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-2 md:mb-4 text-primary" />
                  <p className="text-3xl md:text-5xl font-bold">
                    {formatValue(
                      visualizationData.kpiData.value || 0,
                      visualizationData.kpiData.format,
                      visualizationData.kpiData.prefix,
                      visualizationData.kpiData.suffix
                    )}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-2 md:mt-3">
                    {editableName || 'KPI Widget'}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                    {processedData.length} kayıt üzerinden hesaplandı
                  </p>
                </div>
              )}

              {/* Bar Chart - Mobilde kısa yükseklik */}
              {previewVizType === 'bar' && visualizationData?.chartData && (
                <div>
                  <p className="text-xs md:text-sm font-medium mb-2 md:mb-3 flex items-center gap-2">
                    <BarChart3 className="h-3 w-3 md:h-4 md:w-4" />
                    {editableName || 'Çubuk Grafik'}
                  </p>
                  <ResponsiveContainer width="100%" height={180} className="md:!h-[240px]">
                    <BarChart data={visualizationData.chartData}>
                      {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          zIndex: 100
                        }}
                        wrapperStyle={{ zIndex: 100 }}
                        formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                      />
                      {legendPosition !== 'hidden' && (
                        <Legend 
                          verticalAlign={legendPosition === 'right' ? 'middle' : 'bottom'}
                          align={legendPosition === 'right' ? 'right' : 'center'}
                          layout={legendPosition === 'right' ? 'vertical' : 'horizontal'}
                        />
                      )}
                      {/* Ortalama Çizgisi */}
                      {showAverageLine && (
                        <ReferenceLine 
                          y={averageValue} 
                          stroke="#f97316" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ value: `Ort: ${averageValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, fill: '#f97316', fontSize: 10, position: 'right' }}
                        />
                      )}
                      <Bar dataKey="value" name={yAxisLabel} radius={[4, 4, 0, 0]}>
                        {visualizationData.chartData.map((item: any, index: number) => {
                          // Tarih bazlı grafiklerde değer bazlı gradyan renk kullan
                          const useGradient = isXAxisDate && visualizationData.chartData.length > 10;
                          if (useGradient) {
                            const gradientColors = generateGradientColors(visualizationData.chartData, activeColors[0]);
                            return <Cell key={`cell-${index}`} fill={gradientColors[index] || activeColors[0]} />;
                          }
                          return <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Line Chart - Mobilde kısa */}
              {previewVizType === 'line' && visualizationData?.chartData && (
                <div>
                  <p className="text-xs md:text-sm font-medium mb-2 md:mb-3 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                    {editableName || 'Çizgi Grafik'}
                  </p>
                  <ResponsiveContainer width="100%" height={180} className="md:!h-[240px]">
                    <LineChart data={visualizationData.chartData}>
                      {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          zIndex: 100
                        }}
                        wrapperStyle={{ zIndex: 100 }}
                        formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                      />
                      {legendPosition !== 'hidden' && <Legend verticalAlign={legendPosition === 'right' ? 'middle' : 'bottom'} />}
                      {showAverageLine && (
                        <ReferenceLine y={averageValue} stroke="#f97316" strokeDasharray="5 5" strokeWidth={2} />
                      )}
                      <Line type="monotone" dataKey="value" name={yAxisLabel} stroke={activeColors[0]} strokeWidth={2} dot={{ r: 4, fill: activeColors[0] }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Area Chart */}
              {previewVizType === 'area' && visualizationData?.chartData && (
                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    {editableName || 'Alan Grafik'}
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={visualizationData.chartData}>
                      {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          zIndex: 100
                        }}
                        wrapperStyle={{ zIndex: 100 }}
                        formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                      />
                      {legendPosition !== 'hidden' && <Legend verticalAlign={legendPosition === 'right' ? 'middle' : 'bottom'} />}
                      {showAverageLine && (
                        <ReferenceLine y={averageValue} stroke="#f97316" strokeDasharray="5 5" strokeWidth={2} />
                      )}
                      <Area type="monotone" dataKey="value" name={yAxisLabel} stroke={activeColors[0]} fill={`${activeColors[0]}40`} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pie Chart */}
              {previewVizType === 'pie' && visualizationData?.chartData && visualizationData.chartData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium mb-4 flex items-center gap-2 self-start">
                    <PieChart className="h-4 w-4" />
                    {editableName || 'Pasta Grafik'}
                  </p>
                  <div className="w-full max-w-[280px] mx-auto">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={visualizationData.chartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={1}
                        >
                          {visualizationData.chartData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px',
                            zIndex: 100
                          }}
                          wrapperStyle={{ zIndex: 100 }}
                          formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full max-w-[380px]">
                    {visualizationData.chartData.slice(0, displayLimit).map((item: any, index: number) => {
                      const total = visualizationData.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                            style={{ backgroundColor: activeColors[index % activeColors.length] }}
                          />
                          <span className="truncate flex-1" title={item.name}>
                            {String(item.name).slice(0, 15)}
                          </span>
                          <span className="text-muted-foreground">{percent}%</span>
                        </div>
                      );
                    })}
                    {visualizationData.chartData.length > displayLimit && (
                      <span className="text-xs text-muted-foreground col-span-2 text-center mt-1">
                        +{visualizationData.chartData.length - displayLimit} daha...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Donut Chart */}
              {previewVizType === 'donut' && visualizationData?.chartData && visualizationData.chartData.length > 0 && (
                <div className="flex flex-col items-center">
                  <p className="text-sm font-medium mb-4 flex items-center gap-2 self-start">
                    <PieChart className="h-4 w-4" />
                    {editableName || 'Simit Grafik'}
                  </p>
                  <div className="w-full max-w-[280px] mx-auto relative">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={visualizationData.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={2}
                        >
                          {visualizationData.chartData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '11px',
                            zIndex: 100
                          }}
                          wrapperStyle={{ zIndex: 100 }}
                          formatter={(value: number) => [value.toLocaleString('tr-TR'), yAxisLabel]}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    {/* Center text - düşük z-index */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
                      <span className="text-2xl font-bold">{visualizationData.chartData.length}</span>
                      <span className="text-xs text-muted-foreground">{xAxisLabel}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full max-w-[380px]">
                    {visualizationData.chartData.slice(0, displayLimit).map((item: any, index: number) => {
                      const total = visualizationData.chartData.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <div 
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                            style={{ backgroundColor: activeColors[index % activeColors.length] }}
                          />
                          <span className="truncate flex-1" title={item.name}>
                            {String(item.name).slice(0, 15)}
                          </span>
                          <span className="text-muted-foreground">{percent}%</span>
                        </div>
                      );
                    })}
                    {visualizationData.chartData.length > displayLimit && (
                      <span className="text-xs text-muted-foreground col-span-2 text-center mt-1">
                        +{visualizationData.chartData.length - displayLimit} daha...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Table - Geliştirilmiş */}
              {previewVizType === 'table' && visualizationData?.tableData && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Table className="h-4 w-4" />
                      {editableName || 'Tablo'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Göster:</span>
                      <div className="flex gap-1">
                        {[10, 20, 50].map(limit => (
                          <Button
                            key={limit}
                            variant={tableRowLimit === limit ? 'default' : 'ghost'}
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setTableRowLimit(limit)}
                          >
                            {limit}
                          </Button>
                        ))}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {visualizationData.tableData.totalRows} toplam
                      </Badge>
                    </div>
                  </div>
                  <ScrollArea className="h-[260px] border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted z-10">
                        <tr>
                          {visualizationData.tableData.columns.map((col: any) => (
                            <th key={col.field} className="text-left py-2 px-3 font-medium border-b whitespace-nowrap">
                              {col.header || formatColumnHeader(col.field)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visualizationData.tableData.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                            {visualizationData.tableData.columns.map((col: any) => {
                              const value = row[col.field];
                              // Sayı formatlaması
                              const displayValue = typeof value === 'number' 
                                ? value.toLocaleString('tr-TR')
                                : String(value ?? '-');
                              return (
                                <td key={col.field} className="py-2 px-3 truncate max-w-[200px]" title={displayValue}>
                                  {displayValue.slice(0, 50)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}

              {/* Fallback - veri var ama chart data yok */}
              {!visualizationData?.chartData?.length && !['kpi', 'table'].includes(previewVizType) && rawData.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <DynamicIcon iconName={editableIcon || 'BarChart3'} className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{editableName || 'Widget'}</p>
                  <p className="text-xs mt-1">Gruplama alanı (X Ekseni) seçerek grafik oluşturun</p>
                </div>
              )}
            </div>

            {/* Son güncelleme */}
            {lastFetched && (
              <p className="text-xs text-muted-foreground text-center">
                Son güncelleme: {lastFetched.toLocaleTimeString('tr-TR')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
