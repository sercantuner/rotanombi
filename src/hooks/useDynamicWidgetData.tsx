// useDynamicWidgetData - Widget Builder ile oluşturulan widget'lar için dinamik veri çekme
// DB-FIRST v4.0: Widget'lar company_data_cache tablosundan veri okur, DIA API yerine
// Widget-bazlı filtreler desteklenir - veriler DB'den okunduktan sonra post-fetch olarak uygulanır
// SCOPE-AWARE: Cache key'ler sunucu:firma:dönem bazlı ayrılarak dönem karışması önlenir

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache, generateCacheKey, SHARED_CACHE_KEYS } from '@/contexts/DiaDataCacheContext';
import { useDataSources } from './useDataSources';
import { useDiaProfile } from './useDiaProfile';
import { WidgetBuilderConfig, AggregationType, CalculatedField, CalculationExpression, QueryMerge, DatePeriod, DiaApiFilter, PostFetchFilter, FilterOperator } from '@/lib/widgetBuilderTypes';
import { queuedDiaFetch, handleRateLimitError } from '@/lib/diaRequestQueue';
import { WidgetLocalFilters } from './useWidgetLocalFilters';
import { DiaAutoFilter } from '@/lib/filterTypes';
import { DataScope, findBestPeriodForSource } from '@/lib/dataScopingUtils';
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, 
  subDays, subWeeks, subMonths, subQuarters, subYears, format 
} from 'date-fns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Veri durumu bilgisi - Stale-While-Revalidate için
export interface DataStatusInfo {
  source: 'cache' | 'api' | 'pending';
  lastSyncedAt: Date | null;
  isStale: boolean;
  isRevalidating: boolean;
  error?: string | null;
}

interface DynamicWidgetDataResult {
  data: any;
  rawData: any[];
  // Multi-query widget'larda her sorgunun ham sonucunu (config.multiQuery.queries sırası ile)
  // custom widget'lara aktarabilmek için kullanılır.
  multiQueryData?: any[][] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // YENİ: Veri durumu bilgisi (Stale-While-Revalidate)
  dataStatus: DataStatusInfo;
}

// Tarih aralığı hesaplama
function getDateRangeFilter(period: DatePeriod, dateField: string, customStart?: string, customEnd?: string): DiaApiFilter[] | null {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  
  switch (period) {
    case 'all':
      return null;
    case 'today':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'this_week':
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'this_month':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case 'this_quarter':
      startDate = startOfQuarter(now);
      endDate = endOfQuarter(now);
      break;
    case 'this_year':
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      break;
    case 'last_week':
      startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      break;
    case 'last_month':
      startDate = startOfMonth(subMonths(now, 1));
      endDate = endOfMonth(subMonths(now, 1));
      break;
    case 'last_quarter':
      startDate = startOfQuarter(subQuarters(now, 1));
      endDate = endOfQuarter(subQuarters(now, 1));
      break;
    case 'last_year':
      startDate = startOfYear(subYears(now, 1));
      endDate = endOfYear(subYears(now, 1));
      break;
    case 'last_7_days':
      startDate = subDays(now, 7);
      endDate = now;
      break;
    case 'last_30_days':
      startDate = subDays(now, 30);
      endDate = now;
      break;
    case 'last_90_days':
      startDate = subDays(now, 90);
      endDate = now;
      break;
    case 'custom':
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      } else {
        return null;
      }
      break;
    default:
      return null;
  }
  
  return [
    { field: dateField, operator: '>=', value: format(startDate, 'yyyy-MM-dd') },
    { field: dateField, operator: '<=', value: format(endDate, 'yyyy-MM-dd') },
  ];
}

// DIA hata mesajlarını kullanıcı dostu hale getir
function getDiaErrorMessage(error: string): string {
  if (error.includes('dönem yetkiniz')) {
    return 'Bu veri kaynağı için dönem erişim yetkiniz bulunmuyor.';
  }
  if (error.includes('CREDITS_ERROR') || error.includes('UNKNOWN_CREDITS')) {
    return 'DIA servis limiti aşıldı. Lütfen biraz bekleyip tekrar deneyin.';
  }
  if (error.includes('bağlantı hatası') || error.includes('500')) {
    return 'DIA sunucusuna bağlanılamadı. Lütfen tekrar deneyin.';
  }
  if (error.includes('INVALID_SESSION')) {
    return 'Oturum süresi doldu. Sayfa yenileniyor...';
  }
  return error;
}

// Agregasyon hesaplamaları
function calculateAggregation(data: any[], field: string, aggregation: AggregationType): number {
  if (!data || data.length === 0) return 0;

  const values = data
    .map(item => {
      const val = item[field];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    })
    .filter(v => !isNaN(v));

  switch (aggregation) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);
    case 'avg':
      return values.length > 0 ? values.reduce((acc, val) => acc + val, 0) / values.length : 0;
    case 'count':
      return data.length;
    case 'count_distinct':
      return new Set(data.map(item => item[field])).size;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'first':
      return values[0] || 0;
    case 'last':
      return values[values.length - 1] || 0;
    default:
      return values.reduce((acc, val) => acc + val, 0);
  }
}

// Grafik verileri için gruplama
function groupDataForChart(
  data: any[], 
  groupField: string, 
  valueField: string, 
  aggregation: AggregationType = 'sum',
  displayLimit: number = 10
): { name: string; value: number }[] {
  if (!data || data.length === 0) return [];

  const groups: Record<string, any[]> = {};
  
  data.forEach(item => {
    const key = String(item[groupField] || 'Belirsiz');
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return Object.entries(groups)
    .map(([name, items]) => ({
      name,
      value: calculateAggregation(items, valueField, aggregation),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, displayLimit);
}

// ============= BİRLEŞTİRME FONKSİYONLARI =============

// Korunacak nested dizi alanları (merge sırasında ezilmemeli)
const PRESERVED_NESTED_FIELDS = [
  '__borchareketler', 
  'hareketler', 
  'm_kalemler', 
  'kalemler',
  '__alacakhareketler',
  '__stokhareketler'
];

// Akıllı merge: Sol taraftaki nested dizileri korur
function smartMerge(left: any, right: any): any {
  if (!right) return left;
  
  const result = { ...left };
  
  for (const key of Object.keys(right)) {
    // Korunan alanları kontrol et
    if (PRESERVED_NESTED_FIELDS.includes(key)) {
      // Sol tarafta dolu bir dizi varsa, sağ tarafı yoksay
      if (Array.isArray(left[key]) && left[key].length > 0) {
        continue; // Sol taraftaki değeri koru
      }
    }
    
    // Diğer alanları normal şekilde merge et
    result[key] = right[key];
  }
  
  return result;
}

function leftJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  return left.map(l => smartMerge(l, rightMap.get(l[leftKey])));
}

function innerJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  return left.filter(l => rightMap.has(l[leftKey])).map(l => smartMerge(l, rightMap.get(l[leftKey])));
}

function rightJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  return leftJoin(right, left, rightKey, leftKey);
}

function fullJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  const leftKeys = new Set(left.map(l => l[leftKey]));
  const joined = left.map(l => smartMerge(l, rightMap.get(l[leftKey])));
  const rightOnly = right.filter(r => !leftKeys.has(r[rightKey]));
  return [...joined, ...rightOnly];
}

function unionData(left: any[], right: any[], columnMapping?: { left: string; right: string }[]): any[] {
  const mappedRight = right.map(r => {
    if (!columnMapping) return r;
    const mapped: any = {};
    columnMapping.forEach(m => { mapped[m.left] = r[m.right]; });
    return mapped;
  });
  const combined = [...left, ...mappedRight];
  return [...new Map(combined.map(item => [JSON.stringify(item), item])).values()];
}

function unionAllData(left: any[], right: any[], columnMapping?: { left: string; right: string }[]): any[] {
  const mappedRight = right.map(r => {
    if (!columnMapping) return r;
    const mapped: any = {};
    columnMapping.forEach(m => { mapped[m.left] = r[m.right]; });
    return mapped;
  });
  return [...left, ...mappedRight];
}

function applyMerge(left: any[], right: any[], merge: QueryMerge): any[] {
  switch (merge.mergeType) {
    case 'left_join': return leftJoin(left, right, merge.leftField, merge.rightField);
    case 'inner_join': return innerJoin(left, right, merge.leftField, merge.rightField);
    case 'right_join': return rightJoin(left, right, merge.leftField, merge.rightField);
    case 'full_join': return fullJoin(left, right, merge.leftField, merge.rightField);
    case 'union': return unionData(left, right, merge.columnMapping);
    case 'union_all': return unionAllData(left, right, merge.columnMapping);
    case 'cross_join': return left.flatMap(l => right.map(r => ({ ...l, ...r })));
    default: return leftJoin(left, right, merge.leftField, merge.rightField);
  }
}

// ============= HESAPLAMA FONKSİYONLARI =============

function evaluateExpression(expr: CalculationExpression, row: Record<string, any>): number {
  if (!expr) return 0;
  
  switch (expr.type) {
    case 'field':
      const val = row[expr.field!];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    case 'constant':
      return expr.value ?? 0;
    case 'operation':
      const left = evaluateExpression(expr.left!, row);
      const right = evaluateExpression(expr.right!, row);
      switch (expr.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '%': return left % right;
        default: return 0;
      }
    case 'function':
      const args = expr.arguments?.map(a => evaluateExpression(a, row)) || [];
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

// ============= POST-FETCH FİLTRELEME =============

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
        case '=':
          matches = strValue === filterValue;
          break;
        case '!=':
          matches = strValue !== filterValue;
          break;
        case '>':
          matches = numValue > filterNumValue;
          break;
        case '<':
          matches = numValue < filterNumValue;
          break;
        case '>=':
          matches = numValue >= filterNumValue;
          break;
        case '<=':
          matches = numValue <= filterNumValue;
          break;
        case 'IN':
          const inValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = inValues.includes(strValue);
          break;
        case 'NOT IN':
          const notInValues = filter.value.split(',').map(v => v.trim().toLowerCase());
          matches = !notInValues.includes(strValue);
          break;
        case 'contains':
          matches = strValue.includes(filterValue);
          break;
        case 'not_contains':
          matches = !strValue.includes(filterValue);
          break;
        case 'starts_with':
          matches = strValue.startsWith(filterValue);
          break;
        case 'ends_with':
          matches = strValue.endsWith(filterValue);
          break;
        case 'is_null':
          matches = fieldValue === null || fieldValue === undefined || fieldValue === '';
          break;
        case 'is_not_null':
          matches = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
          break;
        case 'between':
          matches = numValue >= filterNumValue && numValue <= filterNumValue2;
          break;
        default:
          matches = true;
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

// ============= WIDGET FİLTRELERİ UYGULAMA =============

// Helper: Veri setinde belirli alanlardan en az biri var mı kontrol et
function dataHasField(data: any[], fields: string[]): boolean {
  if (!data || data.length === 0) return false;
  const sample = data[0];
  return fields.some(f => f in sample && sample[f] !== undefined);
}

function applyWidgetFilters(data: any[], widgetFilters: WidgetLocalFilters, diaAutoFilters?: DiaAutoFilter[]): any[] {
  if (!data || data.length === 0) return data;
  if (!widgetFilters && (!diaAutoFilters || diaAutoFilters.length === 0)) return data;
  
  let filtered = [...data];
  
  const wf = widgetFilters || {};
  
  // Arama terimi
  if (wf.searchTerm && wf.searchTerm.trim()) {
    const term = wf.searchTerm.toLowerCase();
    filtered = filtered.filter(row => 
      Object.values(row).some(val => val && String(val).toLowerCase().includes(term))
    );
  }
  
  // Cari kart tipi (AL, AS, ST)
  const cariKartTipiFields = ['carikarttipi', 'carikarttip', 'karttipi', 'cari_kart_tipi'];
  if (wf.cariKartTipi && wf.cariKartTipi.length > 0 && dataHasField(data, cariKartTipiFields)) {
    filtered = filtered.filter(row => {
      const kartTipi = row.carikarttipi || row.carikarttip || row.karttipi || row.cari_kart_tipi;
      return kartTipi && wf.cariKartTipi!.includes(String(kartTipi).toUpperCase());
    });
  }
  
  // Satış temsilcisi
  const satisTemsilcisiFields = ['satiselemani', 'satis_elemani', 'temsilci'];
  if (wf.satisTemsilcisi && wf.satisTemsilcisi.length > 0 && dataHasField(data, satisTemsilcisiFields)) {
    filtered = filtered.filter(row => {
      const eleman = row.satiselemani || row.satis_elemani || row.temsilci;
      return eleman && wf.satisTemsilcisi!.includes(String(eleman));
    });
  }
  
  // Şube
  const subeFields = ['subekodu', 'sube_kodu', 'sube'];
  if (wf.sube && wf.sube.length > 0 && dataHasField(data, subeFields)) {
    filtered = filtered.filter(row => {
      const sube = row.subekodu || row.sube_kodu || row.sube;
      return sube && wf.sube!.includes(String(sube));
    });
  }
  
  // Depo
  const depoFields = ['depokodu', 'depo_kodu', 'depo'];
  if (wf.depo && wf.depo.length > 0 && dataHasField(data, depoFields)) {
    filtered = filtered.filter(row => {
      const depo = row.depokodu || row.depo_kodu || row.depo;
      return depo && wf.depo!.includes(String(depo));
    });
  }
  
  // Özel kodlar
  const ozelkod1Fields = ['ozelkod1kod', 'ozelkod1', 'ozel_kod_1'];
  if (wf.ozelkod1 && wf.ozelkod1.length > 0 && dataHasField(data, ozelkod1Fields)) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod1kod || row.ozelkod1 || row.ozel_kod_1;
      return kod && wf.ozelkod1!.includes(String(kod));
    });
  }
  
  const ozelkod2Fields = ['ozelkod2kod', 'ozelkod2', 'ozel_kod_2'];
  if (wf.ozelkod2 && wf.ozelkod2.length > 0 && dataHasField(data, ozelkod2Fields)) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod2kod || row.ozelkod2 || row.ozel_kod_2;
      return kod && wf.ozelkod2!.includes(String(kod));
    });
  }
  
  const ozelkod3Fields = ['ozelkod3kod', 'ozelkod3', 'ozel_kod_3'];
  if (wf.ozelkod3 && wf.ozelkod3.length > 0 && dataHasField(data, ozelkod3Fields)) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod3kod || row.ozelkod3 || row.ozel_kod_3;
      return kod && wf.ozelkod3!.includes(String(kod));
    });
  }
  
  // Şehir
  const sehirFields = ['sehir', 'city'];
  if (wf.sehir && wf.sehir.length > 0 && dataHasField(data, sehirFields)) {
    filtered = filtered.filter(row => {
      const sehir = row.sehir || row.city;
      return sehir && wf.sehir!.includes(String(sehir));
    });
  }
  
  // Durum (aktif/pasif)
  const durumFields = ['durum', 'status'];
  if (wf.durum && wf.durum !== 'hepsi' && dataHasField(data, durumFields)) {
    filtered = filtered.filter(row => {
      const durum = row.durum || row.status;
      if (wf.durum === 'aktif') {
        return durum === 'A' || durum === 'aktif' || durum === true;
      } else {
        return durum === 'P' || durum === 'pasif' || durum === false;
      }
    });
  }
  
  // Görünüm modu (potansiyel/cari)
  const potansiyelFields = ['potansiyel'];
  if (wf.gorunumModu && wf.gorunumModu !== 'hepsi' && dataHasField(data, potansiyelFields)) {
    filtered = filtered.filter(row => {
      const potansiyel = row.potansiyel;
      const potansiyelStr = String(potansiyel || '').toUpperCase();
      
      if (wf.gorunumModu === 'potansiyel') {
        return potansiyel === true || potansiyel === 't' || potansiyelStr === 'E' || potansiyelStr === 'EVET' || potansiyelStr === '1' || potansiyelStr === 'TRUE';
      } else {
        return potansiyel === false || potansiyel === 'f' || potansiyelStr === 'H' || potansiyelStr === 'HAYIR' || potansiyelStr === '0' || potansiyelStr === 'FALSE' || !potansiyel;
      }
    });
  }
  
  // DIA zorunlu filtreler (kullanıcıya ait kilitli filtreler)
  const autoFilters = diaAutoFilters || [];
  if (autoFilters.length > 0) {
    for (const autoFilter of autoFilters) {
      if (dataHasField(data, [autoFilter.field])) {
        filtered = filtered.filter(row => {
          const val = row[autoFilter.field];
          if (autoFilter.operator === '=' || autoFilter.operator === '') {
            return String(val).toLowerCase() === String(autoFilter.value).toLowerCase();
          }
          if (autoFilter.operator === 'IN') {
            const values = autoFilter.value.split(',').map(v => v.trim().toLowerCase());
            return values.includes(String(val).toLowerCase());
          }
          return true;
        });
      }
    }
  }
  
  return filtered;
}

// ============= VERİTABANINDAN VERİ OKUMA =============

// company_data_cache tablosundan veri çek - sayfalama ile tüm veriyi çek
// lastSyncedAt da döndürür (Stale-While-Revalidate için)
// KRİTİK: Her zaman donem_kodu ile filtreleme yapılır - dönem karışması önlenir
interface DbFetchResult {
  data: any[];
  lastSyncedAt: Date | null;
  resolvedDonem: number;
}

async function fetchFromDatabase(
  dataSourceSlug: string,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number,
  isPeriodIndependent: boolean = false
): Promise<DbFetchResult> {
  const PAGE_SIZE = 1000; // Supabase max 1000 satır döndürür
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  let lastUpdatedAt: string | null = null;
  
  // Period-independent kaynaklar için en güncel dönemi bul
  let resolvedDonem = donemKodu;
  if (isPeriodIndependent) {
    resolvedDonem = await findBestPeriodForSource(
      dataSourceSlug,
      sunucuAdi,
      firmaKodu,
      donemKodu
    );
  }
  
  while (hasMore) {
    // KRİTİK: Her zaman donem_kodu filtresi uygula - dönem karışmasını önle
    const { data, error } = await supabase
      .from('company_data_cache')
      .select('data, updated_at')
      .eq('data_source_slug', dataSourceSlug)
      .eq('sunucu_adi', sunucuAdi)
      .eq('firma_kodu', firmaKodu)
      .eq('donem_kodu', resolvedDonem) // Her zaman donem filtresi uygula
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('[DB] Error fetching from company_data_cache:', error);
      break;
    }
    
    if (data && data.length > 0) {
      allData = allData.concat(data.map(row => row.data));
      // İlk sayfadan updated_at al (en güncel)
      if (!lastUpdatedAt && data[0]?.updated_at) {
        lastUpdatedAt = data[0].updated_at;
      }
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`[DB] Fetched ${allData.length} records from ${dataSourceSlug} (dönem: ${resolvedDonem}${isPeriodIndependent ? ' [period-independent]' : ''})${lastUpdatedAt ? ` (last sync: ${lastUpdatedAt})` : ''}`);
  
  // JSONB data alanlarını düz obje olarak döndür
  return {
    data: allData,
    lastSyncedAt: lastUpdatedAt ? new Date(lastUpdatedAt) : null,
    resolvedDonem,
  };
}

// Hook for using widget-local filters
export function useDynamicWidgetData(
  config: WidgetBuilderConfig | null,
  widgetFilters?: WidgetLocalFilters
): DynamicWidgetDataResult {
  const [data, setData] = useState<any>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false); // İç fetch state
  const [error, setError] = useState<string | null>(null);
  
  // YENİ: Veri durumu state (Stale-While-Revalidate)
  const [dataStatus, setDataStatus] = useState<DataStatusInfo>({
    source: 'pending',
    lastSyncedAt: null,
    isStale: false,
    isRevalidating: false,
    error: null,
  });
  
  // DIA profil bilgileri - DB sorgusunda kullanılacak
  const { sunucuAdi, firmaKodu, donemKodu: profileDonem, isConfigured } = useDiaProfile();
  const effectiveDonem = parseInt(profileDonem || '1');
  
  // Raw veriyi tut (filtrelenmemiş) - filtre değişikliğinde yeniden DB sorgusı yapmadan işle
  const rawDataCacheRef = useRef<any[]>([]);
  const hasInitialDataRef = useRef(false);

  // Multi-query ham sonuçları (query sırası ile) - STATE olarak tutulmalı (reaktif render için)
  const [multiQueryData, setMultiQueryData] = useState<any[][] | null>(null);
  
  // OPTIMIZATION: Config'i stabil JSON string'e çevir - dependency kontrolü için
  const configKey = useMemo(() => config ? JSON.stringify(config) : '', [config]);
  
  // OPTIMIZATION: widgetFilters için ref kullan - dependency array'den çıkar
  const widgetFiltersRef = useRef(widgetFilters);
  widgetFiltersRef.current = widgetFilters;
  
  // DIA zorunlu filtreler (profil bazlı) - ayrı ref olarak tutuluyor
  const diaAutoFiltersRef = useRef<DiaAutoFilter[]>([]);
  
  // DIA auto filters'ı profil'den yükle
  useEffect(() => {
    const loadAutoFilters = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('dia_satis_elemani, dia_auto_filters')
        .eq('user_id', session.user.id)
        .single();
      
      if (profile) {
        const autoFilters: DiaAutoFilter[] = [];
        if (profile.dia_satis_elemani) {
          autoFilters.push({
            field: 'satiselemani',
            operator: '=',
            value: profile.dia_satis_elemani,
            isLocked: true,
            label: profile.dia_satis_elemani,
          });
        }
        const diaAutoFilters = profile.dia_auto_filters as unknown as DiaAutoFilter[] | null;
        if (diaAutoFilters && Array.isArray(diaAutoFilters)) {
          autoFilters.push(...diaAutoFilters);
        }
        diaAutoFiltersRef.current = autoFilters;
      }
    };
    loadAutoFilters();
  }, []);
  
  // Cache context - Memory cache hala kullanılıyor (DB sonuçlarını da cache'leyebiliriz)
  const { 
    getCachedData, 
    setCachedData, 
    getDataSourceData,
    getDataSourceDataWithStale,
    setDataSourceData,
    isDataSourceLoading,
    isPageDataReady, // Veri kaynakları hazır mı?
    sharedData, 
    incrementCacheHit, 
    incrementCacheMiss,
    // Background revalidation için
    isSourceRevalidating,
    markSourceRevalidating,
    // API call tracking
    recordApiCall,
    setDataSourceSyncTime,
  } = useDiaDataCache();
  
  // Veri kaynağı bilgilerini çek (slug almak için)
  const { dataSources } = useDataSources();
  
  // OPTIMIZATION: sharedData ref ile tut
  const sharedDataRef = useRef(sharedData);
  sharedDataRef.current = sharedData;
  
  // OPTIMIZATION: Cache fonksiyonları ref ile tut
  const cacheContextRef = useRef({
    getCachedData,
    setCachedData,
    getDataSourceDataWithStale,
    setDataSourceData,
    isDataSourceLoading,
    incrementCacheHit,
    incrementCacheMiss,
    dataSources,
    isSourceRevalidating,
    markSourceRevalidating,
    recordApiCall,
    setDataSourceSyncTime,
  });
  cacheContextRef.current = {
    getCachedData,
    setCachedData,
    getDataSourceDataWithStale,
    setDataSourceData,
    isDataSourceLoading,
    incrementCacheHit,
    incrementCacheMiss,
    dataSources,
    isSourceRevalidating,
    markSourceRevalidating,
    recordApiCall,
    setDataSourceSyncTime,
  };
  
  // Cache-first loading: Cache'de veri varsa isLoading false döner
  // Bu sayede sayfa geçişlerinde skeleton gösterilmez
  // SCOPE-AWARE: Cache lookup'ta scope kullanarak dönem karışmasını önle
  const currentScope: DataScope | undefined = (sunucuAdi && firmaKodu) 
    ? { sunucuAdi, firmaKodu, donemKodu: effectiveDonem } 
    : undefined;
  const cachedData = config?.dataSourceId ? getDataSourceData(config.dataSourceId, currentScope) : null;
  const isLoading = isFetching && !cachedData;

  // Veriyi görselleştirme formatına dönüştür (filtreleme sonrası)
  const processVisualizationData = useCallback((fetchedData: any[], currentConfig: WidgetBuilderConfig) => {
    const recordCount = fetchedData.length;
    const vizType = currentConfig.visualization.type;
    
    if (vizType === 'kpi' && currentConfig.visualization.kpi) {
      const kpiConfig = currentConfig.visualization.kpi;
      let kpiValue = kpiConfig.aggregation === 'count' 
        ? recordCount 
        : calculateAggregation(fetchedData, kpiConfig.valueField, kpiConfig.aggregation);
      
      // isAbsoluteValue desteği (borç gibi negatif değerler için)
      if ((kpiConfig as any).isAbsoluteValue && kpiValue < 0) {
        kpiValue = Math.abs(kpiValue);
      }
      
      setData({
        value: kpiValue,
        format: kpiConfig.format,
        prefix: kpiConfig.prefix,
        suffix: kpiConfig.suffix,
        decimals: kpiConfig.decimals,
        recordCount,
      });
    } else if (['bar', 'line', 'area'].includes(vizType) && currentConfig.visualization.chart) {
      const chartConfig = currentConfig.visualization.chart;
      const barAggType = chartConfig.yAxis?.aggregation || (chartConfig as any).aggregation || 'sum';
      const chartData = groupDataForChart(
        fetchedData, 
        chartConfig.xAxis?.field || '', 
        chartConfig.yAxis?.field || chartConfig.valueField || '', 
        barAggType,
        chartConfig.displayLimit || 10
      );
      setData({ 
        chartData, 
        xField: chartConfig.xAxis?.field, 
        yField: chartConfig.yAxis?.field,
        showGrid: chartConfig.showGrid !== false,
        showLegend: chartConfig.showLegend !== false,
      });
    } else if (['pie', 'donut'].includes(vizType) && currentConfig.visualization.chart) {
      const chartConfig = currentConfig.visualization.chart;
      
      // fieldWells öncelikli - sonra chartConfig
      const groupField = currentConfig.fieldWells?.category?.field || chartConfig.legendField || '';
      const valueField = currentConfig.fieldWells?.value?.field || chartConfig.valueField || '';
      const aggType = currentConfig.fieldWells?.value?.aggregation || (chartConfig as any).aggregation || 'count';
      
      // displayLimit: chartSettings öncelikli, sonra chartConfig, sonra default 10
      const effectiveDisplayLimit = currentConfig.chartSettings?.displayLimit || chartConfig.displayLimit || 10;
      
      const pieData = groupDataForChart(
        fetchedData, 
        groupField, 
        valueField, 
        aggType, 
        effectiveDisplayLimit
      );
      setData({ 
        chartData: pieData,
        showLegend: chartConfig.showLegend !== false,
      });
    } else if (vizType === 'table') {
      const tableConfig = currentConfig.visualization.table;
      const columns = tableConfig?.columns || currentConfig.tableColumns || [];
      const rowLimit = tableConfig?.pageSize || 50;
      setData({ 
        tableData: fetchedData.slice(0, rowLimit), 
        columns,
        recordCount,
      });
    } else if (vizType === 'list') {
      const listConfig = (currentConfig.visualization as any).list;
      let listData = [...fetchedData];
      
      // Sıralama
      if (listConfig?.sortField) {
        listData.sort((a, b) => {
          const aVal = a[listConfig.sortField] || 0;
          const bVal = b[listConfig.sortField] || 0;
          return listConfig.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }
      
      // Limit
      if (listConfig?.limit) {
        listData = listData.slice(0, listConfig.limit);
      }
      
      setData({ 
        listData, 
        listConfig,
        recordCount,
      });
    } else {
      setData({ rawData: fetchedData, recordCount });
    }
    
    setRawData(fetchedData);
  }, []);

  // Global filtreleri raw veri üzerinde uygula (API çağrısı yapmadan)
  const processDataWithFilters = useCallback(() => {
    if (!config || rawDataCacheRef.current.length === 0) return;
    
    const currentFilters = widgetFiltersRef.current;
    let processedData = [...rawDataCacheRef.current];
    
    // Widget filtreleri uygula
    const beforeCount = processedData.length;
    processedData = applyWidgetFilters(processedData, currentFilters || {}, diaAutoFiltersRef.current);
    if (processedData.length !== beforeCount) {
      console.log(`[Filter Change] Applied: ${beforeCount} → ${processedData.length} records`);
    }
    
    // Görselleştirme verisini güncelle
    processVisualizationData(processedData, config);
  }, [config, processVisualizationData]);

  // ============= BACKGROUND REVALIDATE =============
  // Arka planda DIA'dan taze veri çek ve DB'ye yaz
  // UI'ı bloklamaz - önce cache gösterilir, sonra sessizce güncellenir
  
  const backgroundRevalidate = useCallback(async (
    dataSourceId: string, 
    slug: string,
    currentConfig: WidgetBuilderConfig
  ) => {
    const { 
      markSourceRevalidating: markRevalidating, 
      isSourceRevalidating: isRevalidating,
      setDataSourceData: setDsData,
      recordApiCall: recordApi,
      setDataSourceSyncTime: setSyncTime,
    } = cacheContextRef.current;
    
    // Aynı kaynak zaten revalidate ediliyorsa çık (multi-widget koordinasyonu)
    if (isRevalidating(slug)) {
      console.log(`[Background Revalidate] Already running for ${slug}, skipping...`);
      return;
    }
    
    // Revalidation başlıyor
    markRevalidating(slug, true);
    setDataStatus(prev => ({ ...prev, isRevalidating: true }));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }
      
      console.log(`[Background Revalidate] Starting sync for ${slug}...`);
      
      // dia-data-sync edge function'ı çağır
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-data-sync`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          action: 'syncSingleSource',
          dataSourceSlug: slug,
          periodNo: effectiveDonem,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`[Background Revalidate] Sync completed for ${slug}:`, result);
      
      // Sync tamamlandı - DB'den yeni veriyi çek
      const freshDbResult = await fetchFromDatabase(slug, sunucuAdi, firmaKodu, effectiveDonem);
      
      if (freshDbResult.data.length > 0) {
        console.log(`[Background Revalidate] Got ${freshDbResult.data.length} fresh records for ${slug}`);
        
        // Memory cache'i güncelle
        setDsData(dataSourceId, freshDbResult.data);
        
        // Raw cache'i güncelle
        rawDataCacheRef.current = freshDbResult.data;
        hasInitialDataRef.current = true;
        
        // ✅ GERÇEK API ÇAĞRISI SAYACI - DIA kontör takibi
        recordApi();
        
        // ✅ SYNC ZAMANI KAYDET
        const syncTime = new Date();
        setSyncTime(dataSourceId, syncTime);
        
        // dataStatus güncelle - artık güncel!
        setDataStatus({
          source: 'api',
          lastSyncedAt: syncTime,
          isStale: false,
          isRevalidating: false,
          error: null,
        });
        
        // Widget filtreleri uygula ve UI'ı güncelle
        let filteredData = [...freshDbResult.data];
        filteredData = applyWidgetFilters(filteredData, widgetFiltersRef.current || {}, diaAutoFiltersRef.current);
        
        // Görselleştirme verisini güncelle (UI sessizce yenilenir)
        processVisualizationData(filteredData, currentConfig);
        
        console.log(`[Background Revalidate] UI updated with fresh data for ${slug}`);
      } else {
        console.warn(`[Background Revalidate] No data returned from sync for ${slug}`);
        setDataStatus(prev => ({ 
          ...prev, 
          isRevalidating: false,
          error: 'Sync tamamlandı ancak veri bulunamadı',
        }));
      }
    } catch (err) {
      console.error(`[Background Revalidate] Error for ${slug}:`, err);
      // Hata olsa bile eski veriyi göstermeye devam et
      setDataStatus(prev => ({ 
        ...prev, 
        isRevalidating: false, 
        error: err instanceof Error ? getDiaErrorMessage(err.message) : 'Güncelleme hatası',
      }));
    } finally {
      markRevalidating(slug, false);
    }
  }, [sunucuAdi, firmaKodu, effectiveDonem, processVisualizationData]);

  const fetchData = useCallback(async () => {
    if (!config) {
      setData(null);
      setRawData([]);
      rawDataCacheRef.current = [];
      hasInitialDataRef.current = false;
      setMultiQueryData(null);
      return;
    }
    
    // DIA profil bilgilerini kontrol et
    if (!sunucuAdi || !firmaKodu) {
      console.warn('[Widget] DIA profile not configured - widget will show empty');
      setData(null);
      setRawData([]);
      rawDataCacheRef.current = [];
      setIsFetching(false);
      return;
    }
    
    // REF'lerden güncel değerleri oku - dependency array'e eklenmeden
    const currentSharedData = sharedDataRef.current;
    const { 
      getCachedData: getCached, 
      setCachedData: setCached, 
      getDataSourceDataWithStale: getDataWithStale,
      setDataSourceData: setDsData,
      isDataSourceLoading: isLoading,
      incrementCacheHit: incHit,
      incrementCacheMiss: incMiss,
      dataSources: ds,
    } = cacheContextRef.current;

    setIsFetching(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      let fetchedData: any[] = [];
      
      // Helper: DataSource ID'den slug al
      const getDataSourceSlug = (dataSourceId: string): string | null => {
        const dataSource = ds.find(d => d.id === dataSourceId);
        return dataSource?.slug || null;
      };
      
      // Helper: DataSource ID'den period-independent flag al
      const isPeriodIndependent = (dataSourceId: string): boolean => {
        const dataSource = ds.find(d => d.id === dataSourceId);
        return dataSource?.is_period_independent === true;
      };
      
      // Sonuç: lastSyncedAt bilgisini de takip ediyoruz
      let lastSyncedAt: Date | null = null;
      
      // MULTI-QUERY İÇİN: Tüm sorgularda aynı dönem kullanılacak
      // Bu sayede left_join gibi birleştirmelerde dönem uyumsuzluğu önlenir
      const isMultiQuery = config.multiQuery && config.multiQuery.queries.length > 0;
      
      // Helper: DB'den veya memory cache'den veri çek
      // forceEffectiveDonem: multi-query'de tüm sorgular için aynı dönem kullanılır
      const fetchDataForSource = async (dataSourceId: string, forceNoFallback: boolean = false): Promise<any[]> => {
        const slug = getDataSourceSlug(dataSourceId);
        if (!slug) {
          console.warn(`[Widget] DataSource ${dataSourceId} slug not found`);
          return [];
        }
        
        // Multi-query'de period-independent fallback KAPALI - tüm sorgular aynı dönemi kullanmalı
        // Aksi halde left_join gibi merge işlemlerinde dönem uyumsuzluğu oluşur
        const isSourcePeriodIndependent = forceNoFallback ? false : isPeriodIndependent(dataSourceId);
        
        // SCOPE-AWARE: Memory cache lookup için scope oluştur
        const cacheScope: DataScope = {
          sunucuAdi,
          firmaKodu,
          donemKodu: effectiveDonem,
        };
        
        // 1. Önce memory cache kontrol et - SCOPE ile!
        const { data: cachedSourceData, isStale } = getDataWithStale(dataSourceId, cacheScope);
        if (cachedSourceData && !isStale) {
          console.log(`[Widget] Memory Cache HIT - DataSource ${dataSourceId} (scope: ${cacheScope.donemKodu}): ${cachedSourceData.length} kayıt`);
          incHit();
          // Cache'den geliyorsa, dataStatus'u güncelle
          setDataStatus(prev => ({
            ...prev,
            source: 'cache',
            isStale: false,
          }));
          return cachedSourceData;
        }
        
        // 2. Memory cache boş veya stale - DB'den oku
        console.log(`[Widget] Fetching from DB - DataSource: ${slug} (sunucu: ${sunucuAdi}, firma: ${firmaKodu}, dönem: ${effectiveDonem}${isSourcePeriodIndependent ? ' [period-independent]' : ''})`);
        
        // Cache'den gösteriyorsak önce cache'i kullan
        if (cachedSourceData && isStale) {
          setDataStatus(prev => ({
            ...prev,
            source: 'cache',
            isStale: true,
          }));
        }
        
        try {
          // Period-independent flag'i fetchFromDatabase'e geçir
          const dbResult = await fetchFromDatabase(slug, sunucuAdi, firmaKodu, effectiveDonem, isSourcePeriodIndependent);
          
          if (dbResult.data.length > 0) {
            console.log(`[Widget] DB HIT - DataSource ${slug}: ${dbResult.data.length} kayıt (dönem: ${dbResult.resolvedDonem})`);
            
            // Scope ile memory cache'i güncelle (dönem karışmasını önle)
            const scope: DataScope = {
              sunucuAdi,
              firmaKodu,
              donemKodu: dbResult.resolvedDonem,
            };
            setDsData(dataSourceId, dbResult.data, undefined, scope);
            incHit();
            
            // lastSyncedAt güncelle
            if (dbResult.lastSyncedAt) {
              lastSyncedAt = dbResult.lastSyncedAt;
            }
            
            // dataStatus güncelle - DB'den geldi (cache sayılır)
            const hoursSinceSync = dbResult.lastSyncedAt 
              ? (Date.now() - dbResult.lastSyncedAt.getTime()) / (1000 * 60 * 60)
              : 999;
            
            const isDataStale = hoursSinceSync > 1; // 1 saatten eski = stale
            
            setDataStatus(prev => ({
              ...prev,
              source: 'cache',
              lastSyncedAt: dbResult.lastSyncedAt,
              isStale: isDataStale,
              isRevalidating: false,
            }));
            
            // ============= BACKGROUND REVALIDATE TRİGGER =============
            // Veri 1 saatten eskiyse arka planda DIA'dan güncellenecek
            // Bu işlem UI'ı bloklamaz - kullanıcı hemen eski veriyi görür
            if (isDataStale && config) {
              console.log(`[Widget] Data stale (${hoursSinceSync.toFixed(1)}h old) - triggering background revalidate for ${slug}`);
              // setTimeout ile main thread bloklanmaz
              setTimeout(() => {
                backgroundRevalidate(dataSourceId, slug, config);
              }, 100);
            }
            
            return dbResult.data;
          } else {
            // DB'de veri yok - memory cache'de stale veri varsa onu kullan
            if (cachedSourceData) {
              console.log(`[Widget] DB empty, using stale cache for ${dataSourceId}: ${cachedSourceData.length} kayıt`);
              setDataStatus(prev => ({
                ...prev,
                source: 'cache',
                isStale: true,
              }));
              
              // Stale cache kullanıyoruz - background revalidate tetikle
              if (config) {
                console.log(`[Widget] Stale cache used - triggering background revalidate for ${slug}`);
                setTimeout(() => {
                  backgroundRevalidate(dataSourceId, slug, config);
                }, 100);
              }
              
              return cachedSourceData;
            }
            
            // DB boş ve cache yok - ilk kez veri çekilecek
            console.log(`[Widget] DB empty for ${slug} - triggering initial sync`);
            incMiss();
            
            // İlk veri çekimi için de background revalidate tetikle
            if (config) {
              setTimeout(() => {
                backgroundRevalidate(dataSourceId, slug, config);
              }, 100);
            }
            
            return [];
          }
        } catch (dbError) {
          console.error(`[Widget] DB error for ${slug}:`, dbError);
          // DB hatası durumunda stale cache'i kullan
          if (cachedSourceData) {
            console.log(`[Widget] DB error, using stale cache for ${dataSourceId}`);
            setDataStatus(prev => ({
              ...prev,
              source: 'cache',
              isStale: true,
              error: 'DB erişim hatası',
            }));
            return cachedSourceData;
          }
          throw dbError;
        }
      };

      // Çoklu sorgu varsa
      if (config.multiQuery && config.multiQuery.queries.length > 0) {
        const queryResults: Record<string, any[]> = {};
        
        // Her sorguyu paralel çalıştır
        // KRİTİK: Multi-query'de TÜM sorgular için period-independent fallback KAPALI
        // Bu sayede tüm sorgular aynı effectiveDonem'den veri çeker ve merge tutarlı olur
        const queryPromises = config.multiQuery.queries.map(async (query) => {
          if (query.dataSourceId) {
            // forceNoFallback: true - multi-query'de fallback yok, hep aynı dönem
            const result = await fetchDataForSource(query.dataSourceId, true);
            return { id: query.id, data: result };
          }
          console.warn(`[MultiQuery] Query '${query.id}' has no dataSourceId - returning empty`);
          incMiss();
          return { id: query.id, data: [] };
        });
        
        const results = await Promise.all(queryPromises);
        results.forEach(r => { queryResults[r.id] = r.data; });

        // Custom code widget'lar için: sorgu sonuçlarını sıra bazlı diziye çevir (STATE)
        const newMultiData = config.multiQuery.queries.map((q) => queryResults[q.id] || []);
        setMultiQueryData(newMultiData);
        console.log(`[MultiQuery] Set multiQueryData: ${newMultiData.map(d => d.length).join(', ')} records per query`);
        
        // Birleştirmeleri uygula
        const primaryId = config.multiQuery.primaryQueryId || config.multiQuery.queries[0]?.id;
        fetchedData = queryResults[primaryId] || [];
        
        for (const merge of config.multiQuery.merges) {
          const rightData = queryResults[merge.rightQueryId] || [];
          fetchedData = applyMerge(fetchedData, rightData, merge);
        }
      } else {
        setMultiQueryData(null);
        // Tekli sorgu - DB-FIRST STRATEJİ
        
        if (config.dataSourceId) {
          fetchedData = await fetchDataForSource(config.dataSourceId);
        } else {
          // Veri kaynağı ID yok - Eski genel cache mantığı (geriye uyumluluk)
          const cacheKey = generateCacheKey(config.diaApi.module, config.diaApi.method, config.diaApi.parameters);

          const cachedResult = getCached(cacheKey);
          if (cachedResult && cachedResult.sampleData) {
            console.log(`[Widget Cache] HIT - ${cacheKey}: ${cachedResult.sampleData.length} kayıt`);
            fetchedData = cachedResult.sampleData;
            incHit();
          } else {
            console.warn(`[Widget Cache] MISS - ${cacheKey} (no DB call) - widget will show empty`);
            incMiss();
            fetchedData = [];
          }
        }
      }

      // Hesaplama alanlarını uygula
      if (config.calculatedFields && config.calculatedFields.length > 0) {
        fetchedData = applyCalculatedFields(fetchedData, config.calculatedFields);
      }

      // Post-fetch filtreleri uygula
      if (config.postFetchFilters && config.postFetchFilters.length > 0) {
        console.log(`[Post-Fetch] Applying ${config.postFetchFilters.length} filters...`);
        fetchedData = applyPostFetchFilters(fetchedData, config.postFetchFilters);
        console.log(`[Post-Fetch] Filtered to ${fetchedData.length} records`);
      }

      // Raw veriyi cache'le (filtre değişikliklerinde yeniden kullanmak için)
      rawDataCacheRef.current = fetchedData;
      hasInitialDataRef.current = true;
      
      // Widget filtreleri uygula ve görselleştir
      let filteredData = [...fetchedData];
      const beforeCount = filteredData.length;
      filteredData = applyWidgetFilters(filteredData, widgetFiltersRef.current || {}, diaAutoFiltersRef.current);
      if (filteredData.length !== beforeCount) {
        console.log(`[Widget Filters] Applied: ${beforeCount} → ${filteredData.length} records`);
      }
      
      // Görselleştirme verisini oluştur
      processVisualizationData(filteredData, config);
    } catch (err) {
      console.error('Dynamic widget data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
    } finally {
      setIsFetching(false);
    }
  // OPTIMIZED: fetchData'nın dependency'lerini minimize et
  // globalFilters ve sharedData ref'lerde tutulduğu için buraya eklenmiyor
  // config, sunucuAdi, firmaKodu değiştiğinde yeniden oluştur
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, processVisualizationData, sunucuAdi, firmaKodu, effectiveDonem, backgroundRevalidate]);

  // DIA profil değişikliği veya config değiştiğinde veri çek
  const prevConfigRef = useRef(configKey);
  // dataSources yüklenmesini izlemek için ref
  const dataSourcesLoadedRef = useRef(false);
  // dataSourcesReadyKey'in bir önceki değerini tut
  const prevDataSourcesReadyKeyRef = useRef<string>('loading');
  
  // dataSources hazır olduğunda key oluştur (isLoading dependency'sinden kaçınmak için)
  const dataSourcesReadyKey = useMemo(() => {
    // dataSources array'i varsa ve uzunluğu > 0 ise hazır
    return dataSources && dataSources.length > 0 ? 'ready' : 'loading';
  }, [dataSources]);
  
  // Config değiştiğinde ref'leri sıfırla - sayfa değişikliklerinde veri yeniden çekilsin
  useEffect(() => {
    if (prevConfigRef.current !== configKey) {
      dataSourcesLoadedRef.current = false;
      hasInitialDataRef.current = false;
      prevDataSourcesReadyKeyRef.current = 'loading';
      rawDataCacheRef.current = [];
    }
  }, [configKey]);
  
  useEffect(() => {
    // dataSources henüz yüklenmediyse bekle (isLoading yerine array kontrolü)
    // ÖNEMLİ: Hem tekil dataSourceId hem de multiQuery widget'ları için dataSources gerekli
    const needsDataSources = config?.dataSourceId || 
      (config?.multiQuery?.queries && config.multiQuery.queries.some(q => q.dataSourceId));
    
    if (dataSourcesReadyKey === 'loading' && needsDataSources) {
      console.log('[Widget] Waiting for dataSources to load... (multiQuery:', !!config?.multiQuery, ')');
      // dataSources yüklenene kadar bekle - dataSourcesLoadedRef henüz true olmamalı
      prevDataSourcesReadyKeyRef.current = 'loading';
      return;
    }
    
    // Config değiştiyse veya ilk mount'ta fetch yap
    if (config && sunucuAdi && firmaKodu) {
      // isPageDataReady bekleme - doğrudan DB'den okuyoruz
      // FIX: dataSourcesReadyKey 'loading'dan 'ready'ye geçtiyse mutlaka fetch yap
      const wasWaitingForDataSources = prevDataSourcesReadyKeyRef.current === 'loading' && dataSourcesReadyKey === 'ready';
      const shouldFetch = prevConfigRef.current !== configKey || 
                          !hasInitialDataRef.current || 
                          !dataSourcesLoadedRef.current ||
                          wasWaitingForDataSources;
      
      if (shouldFetch) {
        dataSourcesLoadedRef.current = true;
        fetchData();
      }
    }
    prevConfigRef.current = configKey;
    prevDataSourcesReadyKeyRef.current = dataSourcesReadyKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, sunucuAdi, firmaKodu, effectiveDonem, dataSourcesReadyKey]);

  // Filtre değişikliklerini izle - raw veri üzerinde yeniden işle (API çağrısı yapmadan)
  const widgetFiltersKey = useMemo(() => {
    if (!widgetFilters) return '';
    return JSON.stringify(widgetFilters);
  }, [widgetFilters]);

  const prevFiltersKeyRef = useRef<string>('');

  useEffect(() => {
    if (!hasInitialDataRef.current) return;
    
    if (prevFiltersKeyRef.current && prevFiltersKeyRef.current !== widgetFiltersKey) {
      console.log('[Filter Watch] Widget filters changed, reprocessing data...');
      processDataWithFilters();
    }
    prevFiltersKeyRef.current = widgetFiltersKey;
  }, [widgetFiltersKey, processDataWithFilters]);

  return { data, rawData, multiQueryData, isLoading, error, refetch: fetchData, dataStatus };
}
