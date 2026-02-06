// useDynamicWidgetData - Widget Builder ile oluşturulan widget'lar için dinamik veri çekme
// DB-FIRST v4.0: Widget'lar company_data_cache tablosundan veri okur, DIA API yerine
// Global filtreler desteklenir - veriler DB'den okunduktan sonra post-fetch olarak uygulanır

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache, generateCacheKey, SHARED_CACHE_KEYS } from '@/contexts/DiaDataCacheContext';
import { useDataSources } from './useDataSources';
import { useDiaProfile } from './useDiaProfile';
import { WidgetBuilderConfig, AggregationType, CalculatedField, CalculationExpression, QueryMerge, DatePeriod, DiaApiFilter, PostFetchFilter, FilterOperator } from '@/lib/widgetBuilderTypes';
import { queuedDiaFetch, handleRateLimitError } from '@/lib/diaRequestQueue';
import { GlobalFilters, convertToDiaFilters, CrossFilter } from '@/lib/filterTypes';
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, 
  subDays, subWeeks, subMonths, subQuarters, subYears, format 
} from 'date-fns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface DynamicWidgetDataResult {
  data: any;
  rawData: any[];
  // Multi-query widget'larda her sorgunun ham sonucunu (config.multiQuery.queries sırası ile)
  // custom widget'lara aktarabilmek için kullanılır.
  multiQueryData?: any[][] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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

// ============= GLOBAL FİLTRELERİ UYGULAMA =============

// Helper: Veri setinde belirli alanlardan en az biri var mı kontrol et
function dataHasField(data: any[], fields: string[]): boolean {
  if (!data || data.length === 0) return false;
  const sample = data[0];
  return fields.some(f => f in sample && sample[f] !== undefined);
}

function applyGlobalFilters(data: any[], globalFilters: GlobalFilters): any[] {
  if (!globalFilters) return data;
  if (!data || data.length === 0) return data;
  
  let filtered = [...data];
  
  // Arama terimi - tüm verilere uygulanabilir
  if (globalFilters.searchTerm && globalFilters.searchTerm.trim()) {
    const term = globalFilters.searchTerm.toLowerCase();
    filtered = filtered.filter(row => {
      // Tüm string alanlarında ara
      return Object.values(row).some(val => 
        val && String(val).toLowerCase().includes(term)
      );
    });
  }
  
  // Cari kart tipi (AL, AS, ST) - SADECE cari verilere uygulanmalı
  // Banka, Kasa, Stok gibi verilere uygulanmamalı
  const cariKartTipiFields = ['carikarttipi', 'carikarttip', 'karttipi', 'cari_kart_tipi'];
  if (globalFilters.cariKartTipi.length > 0 && dataHasField(data, cariKartTipiFields)) {
    filtered = filtered.filter(row => {
      const kartTipi = row.carikarttipi || row.carikarttip || row.karttipi || row.cari_kart_tipi;
      return kartTipi && globalFilters.cariKartTipi.includes(String(kartTipi).toUpperCase());
    });
  }
  
  // Satış temsilcisi - SADECE ilgili alan varsa uygulanmalı
  const satisTemsilcisiFields = ['satiselemani', 'satis_elemani', 'temsilci'];
  if (globalFilters.satisTemsilcisi.length > 0 && dataHasField(data, satisTemsilcisiFields)) {
    filtered = filtered.filter(row => {
      const eleman = row.satiselemani || row.satis_elemani || row.temsilci;
      return eleman && globalFilters.satisTemsilcisi.includes(String(eleman));
    });
  }
  
  // Şube - SADECE ilgili alan varsa uygulanmalı
  const subeFields = ['subekodu', 'sube_kodu', 'sube'];
  if (globalFilters.sube.length > 0 && dataHasField(data, subeFields)) {
    filtered = filtered.filter(row => {
      const sube = row.subekodu || row.sube_kodu || row.sube;
      return sube && globalFilters.sube.includes(String(sube));
    });
  }
  
  // Depo - SADECE ilgili alan varsa uygulanmalı
  const depoFields = ['depokodu', 'depo_kodu', 'depo'];
  if (globalFilters.depo.length > 0 && dataHasField(data, depoFields)) {
    filtered = filtered.filter(row => {
      const depo = row.depokodu || row.depo_kodu || row.depo;
      return depo && globalFilters.depo.includes(String(depo));
    });
  }
  
  // Özel kodlar - SADECE ilgili alan varsa uygulanmalı
  const ozelkod1Fields = ['ozelkod1kod', 'ozelkod1', 'ozel_kod_1'];
  if (globalFilters.ozelkod1.length > 0 && dataHasField(data, ozelkod1Fields)) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod1kod || row.ozelkod1 || row.ozel_kod_1;
      return kod && globalFilters.ozelkod1.includes(String(kod));
    });
  }
  
  const ozelkod2Fields = ['ozelkod2kod', 'ozelkod2', 'ozel_kod_2'];
  if (globalFilters.ozelkod2.length > 0 && dataHasField(data, ozelkod2Fields)) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod2kod || row.ozelkod2 || row.ozel_kod_2;
      return kod && globalFilters.ozelkod2.includes(String(kod));
    });
  }
  
  const ozelkod3Fields = ['ozelkod3kod', 'ozelkod3', 'ozel_kod_3'];
  if (globalFilters.ozelkod3.length > 0 && dataHasField(data, ozelkod3Fields)) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod3kod || row.ozelkod3 || row.ozel_kod_3;
      return kod && globalFilters.ozelkod3.includes(String(kod));
    });
  }
  
  // Şehir - SADECE ilgili alan varsa uygulanmalı
  const sehirFields = ['sehir', 'city'];
  if (globalFilters.sehir.length > 0 && dataHasField(data, sehirFields)) {
    filtered = filtered.filter(row => {
      const sehir = row.sehir || row.city;
      return sehir && globalFilters.sehir.includes(String(sehir));
    });
  }
  
  // Durum (aktif/pasif) - SADECE ilgili alan varsa uygulanmalı
  const durumFields = ['durum', 'status'];
  if (globalFilters.durum !== 'hepsi' && dataHasField(data, durumFields)) {
    filtered = filtered.filter(row => {
      const durum = row.durum || row.status;
      if (globalFilters.durum === 'aktif') {
        return durum === 'A' || durum === 'aktif' || durum === true;
      } else {
        return durum === 'P' || durum === 'pasif' || durum === false;
      }
    });
  }
  
  // Görünüm modu (potansiyel/cari) - SADECE ilgili alan varsa uygulanmalı
  const potansiyelFields = ['potansiyel'];
  if (globalFilters.gorunumModu !== 'hepsi' && dataHasField(data, potansiyelFields)) {
    filtered = filtered.filter(row => {
      const potansiyel = row.potansiyel;
      const potansiyelStr = String(potansiyel || '').toUpperCase();
      
      if (globalFilters.gorunumModu === 'potansiyel') {
        // Potansiyel müşteriler: E, Evet, true, t, 1
        return potansiyel === true || 
               potansiyel === 't' || 
               potansiyelStr === 'E' || 
               potansiyelStr === 'EVET' ||
               potansiyelStr === '1' ||
               potansiyelStr === 'TRUE';
      } else {
        // Gerçek cariler: H, Hayır, false, f, 0, boş
        return potansiyel === false || 
               potansiyel === 'f' || 
               potansiyelStr === 'H' || 
               potansiyelStr === 'HAYIR' ||
               potansiyelStr === '0' ||
               potansiyelStr === 'FALSE' ||
               !potansiyel;
      }
    });
  }
  
  // DIA zorunlu filtreler (kullanıcıya ait kilitli filtreler)
  // Bu filtreler de SADECE ilgili alan varsa uygulanmalı
  if (globalFilters._diaAutoFilters && globalFilters._diaAutoFilters.length > 0) {
    for (const autoFilter of globalFilters._diaAutoFilters) {
      // İlgili alan verinin içinde var mı kontrol et
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
  
  // Çapraz filtre (Power BI tarzı widget tıklaması)
  // Bu filtre de SADECE ilgili alan varsa uygulanmalı
  if (globalFilters._crossFilter) {
    const crossFilter = globalFilters._crossFilter;
    // crossFilter.field globalFilterKey olarak gelir, ilgili veri alanına eşleştirilmeli
    // Şimdilik basit eşleştirme: globalFilterKey -> data field mapping
    const crossFilterFieldMap: Record<string, string[]> = {
      'cariKartTipi': ['carikarttipi', 'carikarttip', 'karttipi', 'cari_kart_tipi'],
      'satisTemsilcisi': ['satiselemani', 'satis_elemani', 'temsilci'],
      'sube': ['subekodu', 'sube_kodu', 'sube'],
      'depo': ['depokodu', 'depo_kodu', 'depo'],
      'sehir': ['sehir', 'city'],
      'ozelkod1': ['ozelkod1kod', 'ozelkod1', 'ozel_kod_1'],
      'ozelkod2': ['ozelkod2kod', 'ozelkod2', 'ozel_kod_2'],
      'ozelkod3': ['ozelkod3kod', 'ozelkod3', 'ozel_kod_3'],
    };
    
    const possibleFields = crossFilterFieldMap[crossFilter.field] || [crossFilter.field];
    
    if (dataHasField(data, possibleFields)) {
      filtered = filtered.filter(row => {
        // İlk eşleşen alanı bul
        let fieldValue: any = null;
        for (const f of possibleFields) {
          if (row[f] !== undefined) {
            fieldValue = row[f];
            break;
          }
        }
        
        if (fieldValue === null || fieldValue === undefined) return true;
        
        const rowValue = String(fieldValue).toLowerCase();
        
        if (Array.isArray(crossFilter.value)) {
          return crossFilter.value.map(v => String(v).toLowerCase()).includes(rowValue);
        } else {
          return rowValue === String(crossFilter.value).toLowerCase();
        }
      });
    }
  }
  
  return filtered;
}

// ============= VERİTABANINDAN VERİ OKUMA =============

// company_data_cache tablosundan veri çek - sayfalama ile tüm veriyi çek
async function fetchFromDatabase(
  dataSourceSlug: string,
  sunucuAdi: string,
  firmaKodu: string,
  donemKodu: number
): Promise<any[]> {
  const PAGE_SIZE = 1000; // Supabase max 1000 satır döndürür
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('company_data_cache')
      .select('data')
      .eq('data_source_slug', dataSourceSlug)
      .eq('sunucu_adi', sunucuAdi)
      .eq('firma_kodu', firmaKodu)
      .eq('donem_kodu', donemKodu)
      .eq('is_deleted', false)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('[DB] Error fetching from company_data_cache:', error);
      throw error;
    }

    const rows = data || [];
    allData = allData.concat(rows.map(row => row.data));
    
    // Eğer sayfa dolu değilse, daha fazla veri yok demektir
    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }
  
  console.log(`[DB] Fetched ${allData.length} records from ${dataSourceSlug}`);
  
  // JSONB data alanlarını düz obje olarak döndür
  return allData;
}

// Hook for using global filters in widgets
export function useDynamicWidgetData(
  config: WidgetBuilderConfig | null,
  globalFilters?: GlobalFilters
): DynamicWidgetDataResult {
  const [data, setData] = useState<any>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false); // İç fetch state
  const [error, setError] = useState<string | null>(null);
  
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
  
  // OPTIMIZATION: globalFilters ve sharedData için ref kullan - dependency array'den çıkar
  const globalFiltersRef = useRef(globalFilters);
  globalFiltersRef.current = globalFilters;
  
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
    incrementCacheMiss 
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
  };
  
  // Cache-first loading: Cache'de veri varsa isLoading false döner
  // Bu sayede sayfa geçişlerinde skeleton gösterilmez
  const cachedData = config?.dataSourceId ? getDataSourceData(config.dataSourceId) : null;
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
    
    const currentFilters = globalFiltersRef.current;
    let processedData = [...rawDataCacheRef.current];
    
    // Global filtreleri uygula
    if (currentFilters) {
      const beforeCount = processedData.length;
      processedData = applyGlobalFilters(processedData, currentFilters);
      if (processedData.length !== beforeCount) {
        console.log(`[Filter Change] Applied: ${beforeCount} → ${processedData.length} records`);
      }
    }
    
    // Görselleştirme verisini güncelle
    processVisualizationData(processedData, config);
  }, [config, processVisualizationData]);

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
    const currentGlobalFilters = globalFiltersRef.current;
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
      
      // Helper: DB'den veya memory cache'den veri çek
      const fetchDataForSource = async (dataSourceId: string): Promise<any[]> => {
        const slug = getDataSourceSlug(dataSourceId);
        if (!slug) {
          console.warn(`[Widget] DataSource ${dataSourceId} slug not found`);
          return [];
        }
        
        // 1. Önce memory cache kontrol et
        const { data: cachedSourceData, isStale } = getDataWithStale(dataSourceId);
        if (cachedSourceData && !isStale) {
          console.log(`[Widget] Memory Cache HIT - DataSource ${dataSourceId}: ${cachedSourceData.length} kayıt`);
          incHit();
          return cachedSourceData;
        }
        
        // 2. Memory cache boş veya stale - DB'den oku
        console.log(`[Widget] Fetching from DB - DataSource: ${slug} (sunucu: ${sunucuAdi}, firma: ${firmaKodu}, dönem: ${effectiveDonem})`);
        
        try {
          const dbData = await fetchFromDatabase(slug, sunucuAdi, firmaKodu, effectiveDonem);
          
          if (dbData.length > 0) {
            console.log(`[Widget] DB HIT - DataSource ${slug}: ${dbData.length} kayıt`);
            // Memory cache'i güncelle
            setDsData(dataSourceId, dbData);
            incHit();
            return dbData;
          } else {
            // DB'de veri yok - memory cache'de stale veri varsa onu kullan
            if (cachedSourceData) {
              console.log(`[Widget] DB empty, using stale cache for ${dataSourceId}: ${cachedSourceData.length} kayıt`);
              return cachedSourceData;
            }
            console.log(`[Widget] DB empty for ${slug} - no data`);
            incMiss();
            return [];
          }
        } catch (dbError) {
          console.error(`[Widget] DB error for ${slug}:`, dbError);
          // DB hatası durumunda stale cache'i kullan
          if (cachedSourceData) {
            console.log(`[Widget] DB error, using stale cache for ${dataSourceId}`);
            return cachedSourceData;
          }
          throw dbError;
        }
      };

      // Çoklu sorgu varsa
      if (config.multiQuery && config.multiQuery.queries.length > 0) {
        const queryResults: Record<string, any[]> = {};
        
        // Her sorguyu paralel çalıştır
        const queryPromises = config.multiQuery.queries.map(async (query) => {
          if (query.dataSourceId) {
            const result = await fetchDataForSource(query.dataSourceId);
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
      
      // Global filtreleri uygula ve görselleştir
      let filteredData = [...fetchedData];
      const currentGlobalFilters = globalFiltersRef.current;
      if (currentGlobalFilters) {
        const beforeCount = filteredData.length;
        filteredData = applyGlobalFilters(filteredData, currentGlobalFilters);
        if (filteredData.length !== beforeCount) {
          console.log(`[Global Filters] Applied: ${beforeCount} → ${filteredData.length} records`);
        }
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
  }, [configKey, processVisualizationData, sunucuAdi, firmaKodu, effectiveDonem]);

  // DIA profil değişikliği veya config değiştiğinde veri çek
  const prevConfigRef = useRef(configKey);
  // dataSources yüklenmesini izlemek için ref
  const dataSourcesLoadedRef = useRef(false);
  
  // dataSources hazır olduğunda key oluştur (isLoading dependency'sinden kaçınmak için)
  const dataSourcesReadyKey = useMemo(() => {
    // dataSources array'i varsa ve uzunluğu > 0 ise hazır
    return dataSources && dataSources.length > 0 ? 'ready' : 'loading';
  }, [dataSources]);
  
  useEffect(() => {
    // dataSources henüz yüklenmediyse bekle (isLoading yerine array kontrolü)
    if (dataSourcesReadyKey === 'loading' && config?.dataSourceId) {
      console.log('[Widget] Waiting for dataSources to load...');
      return;
    }
    
    // Config değiştiyse veya ilk mount'ta fetch yap
    if (config && sunucuAdi && firmaKodu) {
      // isPageDataReady bekleme - doğrudan DB'den okuyoruz
      if (prevConfigRef.current !== configKey || !hasInitialDataRef.current || !dataSourcesLoadedRef.current) {
        dataSourcesLoadedRef.current = true;
        fetchData();
      }
    }
    prevConfigRef.current = configKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, sunucuAdi, firmaKodu, effectiveDonem, dataSourcesReadyKey]);

  // Filtre değişikliklerini izle - raw veri üzerinde yeniden işle (API çağrısı yapmadan)
  const globalFiltersKey = useMemo(() => {
    if (!globalFilters) return '';
    // Sadece değişen filtre değerlerini izle
    return JSON.stringify({
      searchTerm: globalFilters.searchTerm,
      cariKartTipi: globalFilters.cariKartTipi,
      satisTemsilcisi: globalFilters.satisTemsilcisi,
      sube: globalFilters.sube,
      depo: globalFilters.depo,
      ozelkod1: globalFilters.ozelkod1,
      ozelkod2: globalFilters.ozelkod2,
      ozelkod3: globalFilters.ozelkod3,
      sehir: globalFilters.sehir,
      durum: globalFilters.durum,
      gorunumModu: globalFilters.gorunumModu,
      _diaAutoFilters: globalFilters._diaAutoFilters,
      _crossFilter: globalFilters._crossFilter,
    });
  }, [globalFilters]);

  const prevFiltersKeyRef = useRef<string>('');

  useEffect(() => {
    // İlk veri yüklendikten sonra filtre değişikliklerini izle
    if (!hasInitialDataRef.current) return;
    
    // İlk render değilse VE filtre değiştiyse yeniden işle
    if (prevFiltersKeyRef.current && prevFiltersKeyRef.current !== globalFiltersKey) {
      console.log('[Filter Watch] Filters changed, reprocessing data...');
      processDataWithFilters();
    }
    prevFiltersKeyRef.current = globalFiltersKey;
  }, [globalFiltersKey, processDataWithFilters]);

  return { data, rawData, multiQueryData, isLoading, error, refetch: fetchData };
}
