// useDynamicWidgetData - Widget Builder ile oluşturulan widget'lar için dinamik veri çekme
// Global filtreler desteklenir - veriler cache'den okunduktan sonra post-fetch olarak uygulanır

import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache, generateCacheKey, SHARED_CACHE_KEYS } from '@/contexts/DiaDataCacheContext';
import { useDataSources } from './useDataSources';
import { WidgetBuilderConfig, AggregationType, CalculatedField, CalculationExpression, QueryMerge, DatePeriod, DiaApiFilter, PostFetchFilter, FilterOperator } from '@/lib/widgetBuilderTypes';
import { queuedDiaFetch, handleRateLimitError } from '@/lib/diaRequestQueue';
import { GlobalFilters, convertToDiaFilters } from '@/lib/filterTypes';
import { 
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, 
  subDays, subWeeks, subMonths, subQuarters, subYears, format 
} from 'date-fns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface DynamicWidgetDataResult {
  data: any;
  rawData: any[];
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

function leftJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  return left.map(l => ({ ...l, ...rightMap.get(l[leftKey]) || {} }));
}

function innerJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  return left.filter(l => rightMap.has(l[leftKey])).map(l => ({ ...l, ...rightMap.get(l[leftKey]) }));
}

function rightJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  return leftJoin(right, left, rightKey, leftKey);
}

function fullJoin(left: any[], right: any[], leftKey: string, rightKey: string): any[] {
  const rightMap = new Map(right.map(r => [r[rightKey], r]));
  const leftKeys = new Set(left.map(l => l[leftKey]));
  const joined = left.map(l => ({ ...l, ...rightMap.get(l[leftKey]) || {} }));
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

function applyGlobalFilters(data: any[], globalFilters: GlobalFilters): any[] {
  if (!globalFilters) return data;
  
  let filtered = [...data];
  
  // Arama terimi
  if (globalFilters.searchTerm && globalFilters.searchTerm.trim()) {
    const term = globalFilters.searchTerm.toLowerCase();
    filtered = filtered.filter(row => {
      // Tüm string alanlarında ara
      return Object.values(row).some(val => 
        val && String(val).toLowerCase().includes(term)
      );
    });
  }
  
  // Cari kart tipi (AL, AS, ST)
  if (globalFilters.cariKartTipi.length > 0) {
    filtered = filtered.filter(row => {
      const kartTipi = row.carikarttipi || row.karttipi || row.cari_kart_tipi;
      return kartTipi && globalFilters.cariKartTipi.includes(String(kartTipi).toUpperCase());
    });
  }
  
  // Satış temsilcisi
  if (globalFilters.satisTemsilcisi.length > 0) {
    filtered = filtered.filter(row => {
      const eleman = row.satiselemani || row.satis_elemani || row.temsilci;
      return eleman && globalFilters.satisTemsilcisi.includes(String(eleman));
    });
  }
  
  // Şube
  if (globalFilters.sube.length > 0) {
    filtered = filtered.filter(row => {
      const sube = row.subekodu || row.sube_kodu || row.sube;
      return sube && globalFilters.sube.includes(String(sube));
    });
  }
  
  // Depo
  if (globalFilters.depo.length > 0) {
    filtered = filtered.filter(row => {
      const depo = row.depokodu || row.depo_kodu || row.depo;
      return depo && globalFilters.depo.includes(String(depo));
    });
  }
  
  // Özel kodlar
  if (globalFilters.ozelkod1.length > 0) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod1kod || row.ozelkod1 || row.ozel_kod_1;
      return kod && globalFilters.ozelkod1.includes(String(kod));
    });
  }
  
  if (globalFilters.ozelkod2.length > 0) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod2kod || row.ozelkod2 || row.ozel_kod_2;
      return kod && globalFilters.ozelkod2.includes(String(kod));
    });
  }
  
  if (globalFilters.ozelkod3.length > 0) {
    filtered = filtered.filter(row => {
      const kod = row.ozelkod3kod || row.ozelkod3 || row.ozel_kod_3;
      return kod && globalFilters.ozelkod3.includes(String(kod));
    });
  }
  
  // Şehir
  if (globalFilters.sehir.length > 0) {
    filtered = filtered.filter(row => {
      const sehir = row.sehir || row.city;
      return sehir && globalFilters.sehir.includes(String(sehir));
    });
  }
  
  // Durum (aktif/pasif)
  if (globalFilters.durum !== 'hepsi') {
    filtered = filtered.filter(row => {
      const durum = row.durum || row.status;
      if (globalFilters.durum === 'aktif') {
        return durum === 'A' || durum === 'aktif' || durum === true;
      } else {
        return durum === 'P' || durum === 'pasif' || durum === false;
      }
    });
  }
  
  // Görünüm modu (potansiyel/cari)
  if (globalFilters.gorunumModu !== 'hepsi') {
    filtered = filtered.filter(row => {
      const potansiyel = row.potansiyel;
      if (globalFilters.gorunumModu === 'potansiyel') {
        return potansiyel === true || potansiyel === 't';
      } else {
        return potansiyel === false || potansiyel === 'f' || !potansiyel;
      }
    });
  }
  
  // DIA zorunlu filtreler (kullanıcıya ait kilitli filtreler)
  if (globalFilters._diaAutoFilters && globalFilters._diaAutoFilters.length > 0) {
    for (const autoFilter of globalFilters._diaAutoFilters) {
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
  
  return filtered;
}

// Hook for using global filters in widgets
export function useDynamicWidgetData(
  config: WidgetBuilderConfig | null,
  globalFilters?: GlobalFilters
): DynamicWidgetDataResult {
  const [data, setData] = useState<any>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache context - Artık veri kaynağı bazlı cache kullanıyoruz (Cache-First strateji)
  const { 
    getCachedData, 
    setCachedData, 
    getDataSourceData,
    getDataSourceDataWithStale,
    setDataSourceData,
    isDataSourceLoading,
    sharedData, 
    incrementCacheHit, 
    incrementCacheMiss 
  } = useDiaDataCache();

  const fetchData = useCallback(async () => {
    if (!config) {
      setData(null);
      setRawData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      let fetchedData: any[] = [];

      // Çoklu sorgu varsa
      if (config.multiQuery && config.multiQuery.queries.length > 0) {
        const queryResults: Record<string, any[]> = {};
        
        // Her sorguyu sırayla çalıştır
        for (const query of config.multiQuery.queries) {
          // 1) DataSourceId varsa: SADECE cache'ten oku (DIA çağrısı yok)
          if (query.dataSourceId) {
            const { data: cachedSourceData, isStale } = getDataSourceDataWithStale(query.dataSourceId);

            if (cachedSourceData) {
              console.log(
                `[MultiQuery] Cache HIT for dataSource: ${query.dataSourceId} (${cachedSourceData.length} kayıt)${isStale ? ' [STALE]' : ''}`
              );
              queryResults[query.id] = cachedSourceData;
              incrementCacheHit();
              continue;
            }

            // DataSourceLoader yüklerken bekle
            if (isDataSourceLoading(query.dataSourceId)) {
              console.log(`[MultiQuery] DataSource ${query.dataSourceId} loading, waiting...`);
              setIsLoading(true);
              return;
            }

            // Cache yok + yüklenmiyor => DIA çağrısı YAPMA
            console.warn(`[MultiQuery] DataSource ${query.dataSourceId} not in cache - returning empty (no DIA call)`);
            queryResults[query.id] = [];
            incrementCacheMiss();
            continue;
          }

          // 2) DataSourceId yok => DIA çağrısı YAPMA
          console.warn(`[MultiQuery] Query '${query.id}' has no dataSourceId - returning empty (no DIA call)`);
          queryResults[query.id] = [];
          incrementCacheMiss();
        }
        
        // Birleştirmeleri uygula
        const primaryId = config.multiQuery.primaryQueryId || config.multiQuery.queries[0]?.id;
        fetchedData = queryResults[primaryId] || [];
        
        for (const merge of config.multiQuery.merges) {
          const rightData = queryResults[merge.rightQueryId] || [];
          fetchedData = applyMerge(fetchedData, rightData, merge);
        }
      } else {
        // Tekli sorgu - CACHE-FIRST STRATEJİ (Merkezi Mimari)
        // Widget'lar asla kendi API çağrısı yapmaz - her zaman cache'den okur
        
        // 1. Veri kaynağı ID'si varsa, onun cache'ine bak
        if (config.dataSourceId) {
          // Stale-while-revalidate destekli cache kontrolü
          const { data: cachedSourceData, isStale } = getDataSourceDataWithStale(config.dataSourceId);
          
          if (cachedSourceData) {
            console.log(`[Widget] Cache HIT - DataSource ${config.dataSourceId}: ${cachedSourceData.length} kayıt${isStale ? ' [STALE]' : ''}`);
            fetchedData = cachedSourceData;
            incrementCacheHit();
            // Stale olsa bile API çağrısı yapmıyoruz - DataSourceLoader arka planda güncelleyecek
          } else if (isDataSourceLoading(config.dataSourceId)) {
            // Veri kaynağı şu anda yükleniyor - bekle
            console.log(`[Widget] DataSource ${config.dataSourceId} loading, waiting...`);
            setIsLoading(true);
            return; // fetchData tekrar çağrılacak
          } else {
            // Cache'de yok ve yüklenmiyor - uyarı ver ama API çağrısı YAPMA
            console.warn(`[Widget] DataSource ${config.dataSourceId} not in cache - widget will show empty`);
            fetchedData = [];
            // Hata mesajı gösterme - DataSourceLoader yükleyecek
          }
        } else {
          // 2. Veri kaynağı ID yok - Eski genel cache mantığı (geriye uyumluluk)
          // ÖNEMLİ: Kontör tasarrufu için burada cache MISS durumunda DIA çağrısı yapmıyoruz.
          const cacheKey = generateCacheKey(config.diaApi.module, config.diaApi.method, config.diaApi.parameters);

          const cachedResult = getCachedData(cacheKey);
          if (cachedResult && cachedResult.sampleData) {
            console.log(`[Widget Cache] HIT - ${cacheKey}: ${cachedResult.sampleData.length} kayıt`);
            fetchedData = cachedResult.sampleData;
            incrementCacheHit();
          } else {
            console.warn(`[Widget Cache] MISS - ${cacheKey} (no DIA call) - widget will show empty`);
            incrementCacheMiss();
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

      // Global filtreleri uygula (UI'dan gelen filtreler)
      if (globalFilters) {
        const beforeCount = fetchedData.length;
        fetchedData = applyGlobalFilters(fetchedData, globalFilters);
        if (fetchedData.length !== beforeCount) {
          console.log(`[Global Filters] Applied: ${beforeCount} → ${fetchedData.length} records`);
        }
      }

      const recordCount = fetchedData.length;
      setRawData(fetchedData);

      // Görselleştirme tipine göre veri işleme
      const vizType = config.visualization.type;
      
      if (vizType === 'kpi' && config.visualization.kpi) {
        const kpiConfig = config.visualization.kpi;
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
      } else if (['bar', 'line', 'area'].includes(vizType) && config.visualization.chart) {
        const chartConfig = config.visualization.chart;
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
      } else if (['pie', 'donut'].includes(vizType) && config.visualization.chart) {
        const chartConfig = config.visualization.chart;
        
        // fieldWells öncelikli - sonra chartConfig
        const groupField = config.fieldWells?.category?.field || chartConfig.legendField || '';
        const valueField = config.fieldWells?.value?.field || chartConfig.valueField || '';
        const aggType = config.fieldWells?.value?.aggregation || (chartConfig as any).aggregation || 'count';
        
        // displayLimit: chartSettings öncelikli, sonra chartConfig, sonra default 10
        const effectiveDisplayLimit = config.chartSettings?.displayLimit || chartConfig.displayLimit || 10;
        
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
        const tableConfig = config.visualization.table;
        const columns = tableConfig?.columns || config.tableColumns || [];
        const rowLimit = tableConfig?.pageSize || 50;
        setData({ 
          tableData: fetchedData.slice(0, rowLimit), 
          columns,
          recordCount,
        });
      } else if (vizType === 'list') {
        const listConfig = (config.visualization as any).list;
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
    } catch (err) {
      console.error('Dynamic widget data fetch error:', err);
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [config, globalFilters, getCachedData, setCachedData, sharedData, incrementCacheHit, incrementCacheMiss]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, rawData, isLoading, error, refetch: fetchData };
}
