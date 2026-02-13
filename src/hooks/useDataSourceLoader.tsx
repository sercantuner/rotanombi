// useDataSourceLoader - Sayfa seviyesinde veri kaynaklarını merkezi olarak yükler
// DB-FIRST STRATEGY: Önce veritabanını kontrol et, yoksa API'den çek
// GLOBAL CACHE: Bir veri kaynağı bir kez sorgulandıktan sonra tüm sayfalarda kullanılır
// LAZY LOADING: Sayfa geçişlerinde sadece eksik sorgular tamamlanır
// _system modülü: Takvim gibi lokal üretilen veri kaynakları desteklenir
// SCOPE-AWARE: Cache key'ler sunucu:firma:dönem bazlı ayrılarak dönem karışması önlenir

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useDataSources, DataSource } from './useDataSources';
import { queuedDiaFetch } from '@/lib/diaRequestQueue';
import { toast } from 'sonner';
import { getCachedCalendarData } from '@/lib/calendarDataGenerator';
import { DataScope, findBestPeriodForSource } from '@/lib/dataScopingUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Varsayılan TTL: 10 dakika
const DEFAULT_TTL = 10 * 60 * 1000;

interface LoadedSourceInfo {
  id: string;
  name: string;
}

interface DataSourceLoaderResult {
  isLoading: boolean;
  isInitialLoad: boolean;
  loadedSources: LoadedSourceInfo[];
  currentSourceName: string | null;
  totalSources: number;
  loadProgress: number; // 0-100
  error: string | null;
  refresh: () => Promise<void>;
  getSourceData: (dataSourceId: string) => any[] | null;
  loadSingleDataSource: (dataSourceId: string) => Promise<any[] | null>; // Tek veri kaynağı yükleme
}

interface WidgetWithDataSource {
  widget_id: string;
  builder_config?: {
    dataSourceId?: string;
    diaApi?: {
      module: string;
      method: string;
    };
  };
}

// Field Pool: Aynı veri kaynağını kullanan widget'ların requiredFields'lerini birleştirir
interface DataSourceFieldPool {
  dataSourceId: string;
  // null = projeksiyon yok (en az 1 widget requiredFields tanımlamadıysa tüm veri çekilir)
  pooledFields: string[] | null;
}

export function useDataSourceLoader(pageId: string | null): DataSourceLoaderResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadedSources, setLoadedSources] = useState<LoadedSourceInfo[]>([]);
  const [currentSourceName, setCurrentSourceName] = useState<string | null>(null);
  const [totalSources, setTotalSources] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceDataMap, setSourceDataMap] = useState<Map<string, any[]>>(new Map());
  const [hasInitialized, setHasInitialized] = useState(false); // Sayfa yenileme tespiti için
  const loadingRef = useRef(false);
  
  // DIA profile for DB queries
  const diaProfile = useDiaProfile();
  const isDiaProfileLoading = diaProfile.isLoading;
  
  // SCOPE-AWARE: Cache lookup için gerekli scope
  const effectiveDonem = parseInt(diaProfile.donemKodu || '1');
  const currentScope: DataScope | undefined = (diaProfile.sunucuAdi && diaProfile.firmaKodu)
    ? { sunucuAdi: diaProfile.sunucuAdi, firmaKodu: diaProfile.firmaKodu, donemKodu: effectiveDonem }
    : undefined;
  
  const { dataSources, getDataSourceById, updateLastFetch, isLoading: isDataSourcesLoading } = useDataSources();
  const { 
    getCachedData,
    getDataSourceData,
    getDataSourceDataWithStale,
    setCachedData, 
    setDataSourceData,
    setDataSourceLoading,
    setPageDataReady,
    // GLOBAL registry - tüm sayfalar arası paylaşılan
    isDataSourceFetched,
    markDataSourceFetched,
    clearFetchedRegistry,
    incrementCacheHit, 
    incrementCacheMiss,
    recordApiCall,
    // Impersonation için hedef kullanıcı ID'si
    targetUserId,
  } = useDiaDataCache();

  // _system modülü için lokal veri üretimi (Takvim vb.)
  const loadSystemDataSource = useCallback((dataSource: DataSource): any[] | null => {
    if (dataSource.method === 'calendar') {
      console.log(`[DataSourceLoader] SYSTEM: ${dataSource.name} - Takvim verisi üretiliyor`);
      const calendarData = getCachedCalendarData();
      
      // Cache'e kaydet - 24 saat TTL (86400000 ms)
      setDataSourceData(dataSource.id, calendarData, 86400000);
      markDataSourceFetched(dataSource.id);
      
      return calendarData;
    }
    
    console.warn(`[DataSourceLoader] Unknown system method: ${dataSource.method}`);
    return [];
  }, [setDataSourceData, markDataSourceFetched]);

  // Helper: Belirli bir dönem için sayfalayarak veri çeker
  const fetchPeriodData = useCallback(async (
    dataSource: DataSource,
    sunucuAdi: string,
    firmaKodu: string,
    donemKodu: number,
    requiredFields?: string[]
  ): Promise<any[]> => {
    // scf_fatura_listele fallback'inde timeout önlemek için küçük PAGE_SIZE
    const PAGE_SIZE = dataSource.slug === 'scf_fatura_listele' ? 200 : 1000;
    const useProjection = requiredFields && requiredFields.length > 0;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    // Invoice MV optimizasyonu: scf_fatura_listele için get_invoice_summary kullan
    if (dataSource.slug === 'scf_fatura_listele') {
      while (hasMore) {
        const { data, error } = await supabase.rpc('get_invoice_summary', {
          p_sunucu_adi: sunucuAdi,
          p_firma_kodu: firmaKodu,
          p_donem_kodu: donemKodu,
          p_limit: PAGE_SIZE,
          p_offset: from,
        });
        if (error) {
          console.error(`[DataSourceLoader] Invoice MV error for period ${donemKodu}:`, error);
          // Fallback: MV yoksa normal yoldan devam et
          break;
        }
        const rows = (data as any[]) || [];
        allData = allData.concat(rows);
        hasMore = rows.length >= PAGE_SIZE;
        from += PAGE_SIZE;
      }
      if (allData.length > 0) {
        console.log(`[DataSourceLoader] Invoice MV HIT: period ${donemKodu}, ${allData.length} rows`);
        return allData;
      }
      // MV boşsa normal yoldan dene
      from = 0;
      hasMore = true;
    }

    while (hasMore) {
      let rows: any[] = [];
      let fetchError: any = null;

      if (useProjection) {
        const { data, error } = await supabase.rpc('get_projected_cache_data', {
          p_data_source_slug: dataSource.slug,
          p_sunucu_adi: sunucuAdi,
          p_firma_kodu: firmaKodu,
          p_donem_kodu: donemKodu,
          p_fields: requiredFields!,
          p_limit: PAGE_SIZE,
          p_offset: from,
        });
        fetchError = error;
        rows = (data as any[]) || [];
      } else {
        const { data, error } = await supabase
          .from('company_data_cache')
          .select('data')
          .eq('data_source_slug', dataSource.slug)
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .eq('donem_kodu', donemKodu)
          .eq('is_deleted', false)
          .range(from, from + PAGE_SIZE - 1);
        fetchError = error;
        rows = data || [];
      }

      if (fetchError) {
        console.error(`[DataSourceLoader] DB error for ${dataSource.name} period ${donemKodu}:`, fetchError);
        return allData; // return what we have so far
      }

      allData = allData.concat(rows.map(row => row.data));
      hasMore = rows.length >= PAGE_SIZE;
      from += PAGE_SIZE;
    }
    return allData;
  }, []);

  // DB-FIRST: Veritabanından veri çekme fonksiyonu
  // Period-independent kaynaklar için PERIOD-BATCHED fetching: her dönem ayrı sorgulanır
  const loadDataSourceFromDatabase = useCallback(async (
    dataSource: DataSource,
    requiredFields?: string[]
  ): Promise<{ data: any[] | null; resolvedDonem: number }> => {

    const { sunucuAdi, firmaKodu, donemKodu } = diaProfile;
    
    if (!sunucuAdi || !firmaKodu) {
      console.log(`[DataSourceLoader] DB-FIRST: No profile config, skipping DB check for ${dataSource.name}`);
      return { data: null, resolvedDonem: 1 };
    }

    const effectiveDonem = parseInt(donemKodu || '1');
    const isPeriodIndependent = dataSource.is_period_independent === true;

    try {
      // period_read_mode kontrolü
      const readMode = dataSource.period_read_mode || 'all_periods';
      
      if (isPeriodIndependent && readMode === 'current_only') {
        // MASTERDATA: Sadece aktif dönemden oku, period-batch yapma
        console.log(`[DataSourceLoader] CURRENT_ONLY: ${dataSource.name} - only period ${effectiveDonem}`);
        const data = await fetchPeriodData(dataSource, sunucuAdi, firmaKodu, effectiveDonem, requiredFields);
        if (data.length > 0) {
          console.log(`[DataSourceLoader] CURRENT_ONLY HIT: ${dataSource.name} (${data.length} kayıt, dönem: ${effectiveDonem})`);
          return { data, resolvedDonem: effectiveDonem };
        }
        return { data: null, resolvedDonem: effectiveDonem };
      }

      if (isPeriodIndependent) {
        // PERIOD-BATCHED: Önce mevcut dönemleri tespit et, sonra her biri için ayrı sorgu at (transaction kaynakları)
        const { data: periodsData, error: periodsError } = await supabase
          .from('company_data_cache')
          .select('donem_kodu')
          .eq('data_source_slug', dataSource.slug)
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .eq('is_deleted', false);

        if (periodsError) {
          console.error(`[DataSourceLoader] Period discovery error for ${dataSource.name}:`, periodsError);
          return { data: null, resolvedDonem: effectiveDonem };
        }

        // Distinct dönemleri çıkar
        const distinctPeriods = [...new Set((periodsData || []).map(r => r.donem_kodu))].sort((a, b) => a - b);

        if (distinctPeriods.length === 0) {
          console.log(`[DataSourceLoader] DB-FIRST MISS: ${dataSource.name} - no periods found`);
          return { data: null, resolvedDonem: effectiveDonem };
        }

        console.log(`[DataSourceLoader] PERIOD-BATCH: ${dataSource.name} - ${distinctPeriods.length} periods found: [${distinctPeriods.join(', ')}]`);

        // Her dönem için seri olarak veri çek (DB yükünü dağıt)
        let allData: any[] = [];
        for (const period of distinctPeriods) {
          const periodData = await fetchPeriodData(dataSource, sunucuAdi, firmaKodu, period, requiredFields);
          allData = allData.concat(periodData);
          if (periodData.length > 0) {
            console.log(`[DataSourceLoader] PERIOD-BATCH: ${dataSource.name} period ${period} -> ${periodData.length} rows`);
          }
        }

        if (allData.length > 0) {
          console.log(`[DataSourceLoader] PERIOD-BATCH COMPLETE: ${dataSource.name} total ${allData.length} rows from ${distinctPeriods.length} periods`);
          return { data: allData, resolvedDonem: effectiveDonem };
        }

        return { data: null, resolvedDonem: effectiveDonem };
      } else {
        // Normal tek-dönem sorgusu
        const data = await fetchPeriodData(dataSource, sunucuAdi, firmaKodu, effectiveDonem, requiredFields);
        
        if (data.length > 0) {
          console.log(`[DataSourceLoader] DB-FIRST HIT: ${dataSource.name} (${data.length} kayıt, dönem: ${effectiveDonem})`);
          return { data, resolvedDonem: effectiveDonem };
        }

        console.log(`[DataSourceLoader] DB-FIRST MISS: ${dataSource.name} - no data in DB for dönem ${effectiveDonem}`);
        return { data: null, resolvedDonem: effectiveDonem };
      }
    } catch (err) {
      console.error(`[DataSourceLoader] DB-FIRST exception for ${dataSource.name}:`, err);
      return { data: null, resolvedDonem: effectiveDonem };
    }
  }, [diaProfile, fetchPeriodData]);
  const findUsedDataSources = useCallback(async (): Promise<DataSourceFieldPool[]> => {
    if (!pageId) {
      console.log('[DataSourceLoader] No pageId, returning empty sources');
      return [];
    }

    try {
      console.log(`[DataSourceLoader] Finding data sources for page: ${pageId}`);
      
      // Sayfadaki tüm container'ları ve widget'ları çek
      const { data: containers, error: containerError } = await supabase
        .from('page_containers')
        .select('id')
        .eq('page_id', pageId);

      if (containerError) {
        console.error('[DataSourceLoader] Container fetch error:', containerError);
        return [];
      }
      
      if (!containers?.length) {
        console.log('[DataSourceLoader] No containers found for page');
        return [];
      }

      const containerIds = containers.map(c => c.id);

      // Container'lardaki widget'ları çek
      const { data: containerWidgets, error: widgetsError } = await supabase
        .from('container_widgets')
        .select('widget_id')
        .in('container_id', containerIds);

      if (widgetsError) {
        console.error('[DataSourceLoader] Widgets fetch error:', widgetsError);
        return [];
      }
      
      if (!containerWidgets?.length) {
        console.log('[DataSourceLoader] No widgets found in containers');
        return [];
      }

      const widgetIds = containerWidgets.map(cw => cw.widget_id);

      // Widget'ların builder_config'lerini çek
      const { data: widgets, error: dbError } = await supabase
        .from('widgets')
        .select('id, builder_config')
        .in('id', widgetIds);

      if (dbError) {
        console.error('[DataSourceLoader] Widget config fetch error:', dbError);
        return [];
      }
      
      if (!widgets?.length) {
        console.log('[DataSourceLoader] No widget configs found');
        return [];
      }

      // FIELD POOL: dataSourceId -> { fields: Set, hasWidgetWithoutFields: boolean }
      const poolMap = new Map<string, { fields: Set<string>; hasWidgetWithoutFields: boolean }>();
      
      const addToPool = (dataSourceId: string, requiredFields: string[] | null | undefined) => {
        if (!poolMap.has(dataSourceId)) {
          poolMap.set(dataSourceId, { fields: new Set(), hasWidgetWithoutFields: false });
        }
        const pool = poolMap.get(dataSourceId)!;
        
        if (!requiredFields || requiredFields.length === 0) {
          // Bu widget requiredFields tanımlamadı - projeksiyon yapılamaz
          pool.hasWidgetWithoutFields = true;
        } else {
          for (const field of requiredFields) {
            pool.fields.add(field);
          }
        }
      };
      
      for (const widget of widgets) {
        const config = widget.builder_config as any;
        
        // 1. Tek sorgu - üst düzey dataSourceId
        if (config?.dataSourceId) {
          addToPool(config.dataSourceId, config.requiredFields);
        }
        
        // 2. MultiQuery - her sorgunun dataSourceId'sini kontrol et
        if (config?.multiQuery?.queries && Array.isArray(config.multiQuery.queries)) {
          for (const query of config.multiQuery.queries) {
            if (query.dataSourceId) {
              // Multi-query widget'lar için üst seviye requiredFields kullan
              addToPool(query.dataSourceId, config.requiredFields);
            }
          }
        }
        
        // 3. isMultiQuery flag'i varsa ama multiQuery objesi yoksa - eski format
        if (config?.isMultiQuery && config?.queries && Array.isArray(config.queries)) {
          for (const query of config.queries) {
            if (query.dataSourceId) {
              addToPool(query.dataSourceId, config.requiredFields);
            }
          }
        }
      }

      // Pool'u DataSourceFieldPool[] formatına çevir
      const fieldPools: DataSourceFieldPool[] = Array.from(poolMap.entries()).map(([dataSourceId, pool]) => ({
        dataSourceId,
        // Herhangi bir widget requiredFields tanımlamadıysa projeksiyon yapma
        pooledFields: pool.hasWidgetWithoutFields ? null : Array.from(pool.fields),
      }));

      console.log(`[DataSourceLoader] Found ${fieldPools.length} unique data sources with field pools:`,
        fieldPools.map(p => `${p.dataSourceId}: ${p.pooledFields ? p.pooledFields.length + ' fields' : 'FULL'}`));

      return fieldPools;
    } catch (err) {
      console.error('[DataSourceLoader] Error finding used data sources:', err);
      return [];
    }
  }, [pageId]);

  // Tek bir veri kaynağını yükle - DB-FIRST STRATEGY
  // pooledFields: Widget havuzundan hesaplanan alan listesi (opsiyonel)
  const loadDataSource = useCallback(async (
    dataSource: DataSource, 
    accessToken: string,
    forceRefresh: boolean = false,
    pooledFields?: string[] | null
  ): Promise<any[] | null> => {
    // _system modülü - lokal üretilen veri kaynakları (takvim vb.)
    if (dataSource.module === '_system') {
      return loadSystemDataSource(dataSource);
    }
    
    // 1. Zaten global registry'de VE cache'de veri varsa - cache'den al (SCOPE-AWARE)
    const lookupScope = currentScope || { sunucuAdi: diaProfile.sunucuAdi || '', firmaKodu: diaProfile.firmaKodu || '', donemKodu: effectiveDonem };
    
    if (!forceRefresh && isDataSourceFetched(dataSource.id, lookupScope)) {
      const cachedData = getDataSourceData(dataSource.id, lookupScope);
      if (cachedData && cachedData.length > 0) {
        console.log(`[DataSourceLoader] GLOBAL HIT: ${dataSource.name} (${cachedData.length} kayıt) - scope: dönem ${lookupScope.donemKodu}`);
        incrementCacheHit();
        return cachedData;
      }
    }
    
    // 2. Memory cache kontrolü (stale-while-revalidate) - SCOPE-AWARE
    const { data: cachedData, isStale } = getDataSourceDataWithStale(dataSource.id, lookupScope);
    
    if (cachedData && cachedData.length > 0 && !forceRefresh) {
      console.log(`[DataSourceLoader] Memory Cache HIT: ${dataSource.name} (${cachedData.length} kayıt) - scope: dönem ${lookupScope.donemKodu}${isStale ? ' [STALE]' : ''}`);
      incrementCacheHit();
      return cachedData;
    }

    // 3. DB-FIRST: Veritabanından veri çek
    if (!forceRefresh) {
      const dbResult = await loadDataSourceFromDatabase(dataSource);
      if (dbResult.data && dbResult.data.length > 0) {
        // Scope ile cache'e kaydet (dönem karışmasını önle)
        const scope: DataScope = {
          sunucuAdi: diaProfile.sunucuAdi || '',
          firmaKodu: diaProfile.firmaKodu || '',
          donemKodu: dbResult.resolvedDonem,
        };
        // Veritabanından gelen veriyi memory cache'e de kaydet
        setDataSourceData(dataSource.id, dbResult.data, DEFAULT_TTL, scope);
        markDataSourceFetched(dataSource.id, scope);
        incrementCacheHit();
        return dbResult.data;
      }
    }

    // 4. Son çare: DIA API'den çek (pooledFields ile)
    console.log(`[DataSourceLoader] API FETCH: ${dataSource.name} - DB boş, API'den çekiliyor`);
    incrementCacheMiss();

    return loadDataSourceFromApi(dataSource, accessToken, pooledFields);
  }, [getDataSourceData, getDataSourceDataWithStale, isDataSourceFetched, incrementCacheHit, incrementCacheMiss, loadSystemDataSource, loadDataSourceFromDatabase, setDataSourceData, markDataSourceFetched]);

  // DIA hata mesajlarını kullanıcı dostu hale getir
  const getDiaErrorMessage = useCallback((error: string): string => {
    if (error.includes('dönem yetkiniz')) {
      return 'Bu veri kaynağı için dönem erişim yetkiniz bulunmuyor. Ayarlardan farklı bir dönem seçin.';
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
    if (error.includes('Erişim engellendi')) {
      return 'DIA erişim yetkisi hatası. Ayarlardan bağlantınızı kontrol edin.';
    }
    return error;
  }, []);

  // API'den veri çek (helper) - useCallback ile sarmalandı
  // pooledFields: Widget havuzundan hesaplanan alan listesi (data_sources.selected_columns yerine)
  const loadDataSourceFromApi = useCallback(async (
    dataSource: DataSource,
    accessToken: string,
    pooledFields?: string[] | null
  ): Promise<any[] | null> => {
    setDataSourceLoading(dataSource.id, true);
    
    try {
      const response = await queuedDiaFetch(
        `${SUPABASE_URL}/functions/v1/dia-api-test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            module: dataSource.module,
            method: dataSource.method,
            ...(dataSource.limit_count > 0 && { limit: dataSource.limit_count }),
            filters: dataSource.filters,
            // Widget pool'dan gelen alanları kullan, yoksa sunucu tarafı kendi hesaplar
            ...(pooledFields && pooledFields.length > 0 && { selectedColumns: pooledFields }),
            sorts: dataSource.sorts,
            returnAllData: true,
            periodConfig: dataSource.period_config,
            // Impersonation için - super admin başka kullanıcının verisini çekebilir
            ...(targetUserId && { targetUserId }),
          }),
        },
        2 // High priority for data source loading
      );

      const result = await response.json();
      
      if (!result.success) {
        const errorMessage = getDiaErrorMessage(result.error || 'Bilinmeyen hata');
        console.error(`[DataSourceLoader] API Error for ${dataSource.name}:`, result.error);
        
        // Dönem yetki hatası veya erişim hatası için toast göster
        if (result.error?.includes('dönem yetkiniz') || result.error?.includes('Erişim engellendi')) {
          toast.error(errorMessage, {
            duration: 5000,
            action: {
              label: 'Ayarlar',
              onClick: () => window.location.href = '/ayarlar',
            },
          });
        }
        
        // Boş array döndür ama hata setleme - dashboard çökmesin
        return [];
      }

      const data = result.sampleData || [];
      console.log(`[DataSourceLoader] LOADED: ${dataSource.name} (${data.length} kayıt)`);
      
      // Gerçek API çağrısını kaydet (kontör harcandı!)
      recordApiCall();
      
      // Cache'e kaydet - 10 dakika TTL
      setDataSourceData(dataSource.id, data, DEFAULT_TTL);
      
      // GLOBAL registry'e ekle - bu oturumda bir daha sorgulanmasın
      markDataSourceFetched(dataSource.id);
      
      // FIX: Veritabanında last_fetched_at'ı güncelle
      try {
        const fields = data.length > 0 ? Object.keys(data[0]) : [];
        await updateLastFetch(dataSource.id, data.length, fields, data.slice(0, 100));
        console.log(`[DataSourceLoader] DB Updated: ${dataSource.name} last_fetched_at`);
      } catch (dbError) {
        console.warn(`[DataSourceLoader] DB update failed for ${dataSource.name}:`, dbError);
        // DB güncellemesi başarısız olsa bile veri yüklemeyi etkilemesin
      }
      
      return data;
    } catch (err) {
      console.error(`[DataSourceLoader] Fetch error for ${dataSource.name}:`, err);
      
      // Network hatası için toast
      const errorMsg = err instanceof Error ? err.message : 'Bağlantı hatası';
      toast.error(`${dataSource.name}: ${errorMsg}`);
      
      return [];
    } finally {
      setDataSourceLoading(dataSource.id, false);
    }
  }, [setDataSourceLoading, recordApiCall, setDataSourceData, markDataSourceFetched, updateLastFetch, targetUserId, getDiaErrorMessage]);


  // Referansları ref'lerde tut - loadAllDataSources için
  const isDataSourceFetchedRef = useRef(isDataSourceFetched);
  isDataSourceFetchedRef.current = isDataSourceFetched;
  
  const clearFetchedRegistryRef = useRef(clearFetchedRegistry);
  clearFetchedRegistryRef.current = clearFetchedRegistry;
  
  const incrementCacheHitRef = useRef(incrementCacheHit);
  incrementCacheHitRef.current = incrementCacheHit;

  // Sayfa için veri kaynaklarını yükle - SADECE EKSİK OLANLARI
  const loadAllDataSources = useCallback(async (forceRefresh: boolean = false) => {
     // DIA profili henüz yüklenmediyse bekle
     if (isDiaProfileLoading) {
       console.log('[DataSourceLoader] Waiting for DIA profile to load...');
       return;
     }
     
     if (!pageId || loadingRef.current || isDataSourcesLoading) {
       if (isDataSourcesLoading) {
         console.log('[DataSourceLoader] Waiting for dataSources to load from React Query...');
       }
       return;
     }
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    // Manuel yenileme ise global registry'i temizle
    if (forceRefresh) {
      console.log('[DataSourceLoader] Force refresh - clearing global registry');
      clearFetchedRegistryRef.current();
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      // Sayfadaki widget'ların kullandığı veri kaynaklarını ve alan havuzlarını bul
      const fieldPools = await findUsedDataSources();
      
      if (fieldPools.length === 0) {
        console.log('[DataSourceLoader] No data sources used on this page');
        setLoadedSources([]);
        setTotalSources(0);
        setLoadProgress(100);
        setIsLoading(false);
        setIsInitialLoad(false);
        setPageDataReady(true);
        loadingRef.current = false;
        return;
      }

      // FIX: Zaten sorgulanmış VE cache'de gerçekten veri olanları ayır (SCOPE-AWARE)
      const lookupScope = currentScope || { sunucuAdi: diaProfile.sunucuAdi || '', firmaKodu: diaProfile.firmaKodu || '', donemKodu: effectiveDonem };
      
      const alreadyFetched = fieldPools.filter(pool => {
        const inRegistry = isDataSourceFetchedRef.current(pool.dataSourceId, lookupScope);
        const cachedData = getDataSourceData(pool.dataSourceId, lookupScope);
        return inRegistry && cachedData && cachedData.length > 0;
      });
      
      // FIX: Registry'de olsa bile cache boşsa yeniden fetch et
      const needToFetch = forceRefresh 
        ? fieldPools 
        : fieldPools.filter(pool => {
            const inRegistry = isDataSourceFetchedRef.current(pool.dataSourceId, lookupScope);
            const cachedData = getDataSourceData(pool.dataSourceId, lookupScope);
            return !inRegistry || !cachedData || cachedData.length === 0;
          });

      console.log(`[DataSourceLoader] Page needs ${fieldPools.length} sources (scope: dönem ${lookupScope.donemKodu}):`);
      console.log(`  - Already fetched (with valid cache): ${alreadyFetched.length}`);
      console.log(`  - Need to fetch (missing or empty cache): ${needToFetch.length}`);

      setTotalSources(needToFetch.length || 1);

      // Zaten sorgulanmış olanları hemen yükle
      const newDataMap = new Map<string, any[]>();
      const successfulSources: LoadedSourceInfo[] = [];
      
      for (const pool of alreadyFetched) {
        const data = getDataSourceData(pool.dataSourceId, lookupScope);
        const ds = getDataSourceById(pool.dataSourceId);
        if (data) {
          newDataMap.set(pool.dataSourceId, data);
          successfulSources.push({ id: pool.dataSourceId, name: ds?.name || pool.dataSourceId });
          incrementCacheHitRef.current();
        }
      }

      // Eğer sorgulanacak kaynak yoksa hemen bitir
      if (needToFetch.length === 0) {
        console.log('[DataSourceLoader] All sources already cached from previous pages!');
        setSourceDataMap(newDataMap);
        setLoadedSources(successfulSources);
        setCurrentSourceName(null);
        setLoadProgress(100);
        setIsLoading(false);
        setIsInitialLoad(false);
        setPageDataReady(true);
        loadingRef.current = false;
        return;
      }

      // FIELD POOL: Sırayla yükle - her kaynak için havuzlanmış alanlarla tek sorgu
      for (let i = 0; i < needToFetch.length; i++) {
        const pool = needToFetch[i];
        const dataSource = getDataSourceById(pool.dataSourceId);
        
        if (!dataSource) {
          console.warn(`[DataSourceLoader] Data source not found: ${pool.dataSourceId}`);
          continue;
        }
        
        // Aktif kaynak ismini güncelle
        setCurrentSourceName(dataSource.name);
        
        // FIELD POOL: Havuzlanmış alanlarla DB'den çek (loadDataSource yerine doğrudan DB-first with pooled fields)
        let data: any[] | null = null;
        
        if (!forceRefresh) {
          // DB-FIRST with pooled fields
          const dbResult = await loadDataSourceFromDatabase(dataSource, pool.pooledFields ?? undefined);
          if (dbResult.data && dbResult.data.length > 0) {
            const scope: DataScope = {
              sunucuAdi: diaProfile.sunucuAdi || '',
              firmaKodu: diaProfile.firmaKodu || '',
              donemKodu: dbResult.resolvedDonem,
            };
            setDataSourceData(dataSource.id, dbResult.data, DEFAULT_TTL, scope);
            markDataSourceFetched(dataSource.id, scope);
            incrementCacheHitRef.current();
            data = dbResult.data;
            
            if (pool.pooledFields) {
              console.log(`[DataSourceLoader] FIELD POOL: ${dataSource.name} - ${pool.pooledFields.length} pooled fields, ${dbResult.data.length} records`);
            }
          }
        }
        
        // DB'de yoksa normal loadDataSource akışına düş (API fetch - pooledFields ile)
        if (!data) {
          data = await loadDataSource(dataSource, session.access_token, forceRefresh, pool.pooledFields);
        }
        
        if (data) {
          newDataMap.set(pool.dataSourceId, data);
          successfulSources.push({ id: pool.dataSourceId, name: dataSource.name });
        }
        
        // Progress güncelle
        const progress = Math.round(((i + 1) / needToFetch.length) * 100);
        setLoadProgress(progress);
        setLoadedSources([...successfulSources]);
      }

      setSourceDataMap(newDataMap);
      setCurrentSourceName(null);
      
      console.log(`[DataSourceLoader] Page ready: ${successfulSources.length} sources loaded`);
      
      // Sayfa hazır
      setPageDataReady(true);
    } catch (err) {
      console.error('[DataSourceLoader] Error:', err);
      setError(err instanceof Error ? err.message : 'Veri kaynakları yüklenemedi');
      toast.error('Veri kaynakları yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
      loadingRef.current = false;
    }
  }, [pageId, findUsedDataSources, getDataSourceById, loadDataSource, setPageDataReady, getDataSourceData]);

  // Veri kaynağı verisini al (önce local, sonra global cache) - SCOPE-AWARE
  const getSourceData = useCallback((dataSourceId: string): any[] | null => {
    // Önce local map'e bak
    const localData = sourceDataMap.get(dataSourceId);
    if (localData) return localData;
    
    // Global cache'e bak - scope ile
    const lookupScope = currentScope || { sunucuAdi: diaProfile.sunucuAdi || '', firmaKodu: diaProfile.firmaKodu || '', donemKodu: effectiveDonem };
    const globalData = getDataSourceData(dataSourceId, lookupScope);
    if (globalData) return globalData;
    
    return null;
  }, [sourceDataMap, getDataSourceData, currentScope, diaProfile.sunucuAdi, diaProfile.firmaKodu, effectiveDonem]);

  // Referansları ref'lerde tut - dependency döngüsü kırılsın
  const findUsedDataSourcesRef = useRef(findUsedDataSources);
  findUsedDataSourcesRef.current = findUsedDataSources;
  
  const getDataSourceDataRef = useRef(getDataSourceData);
  getDataSourceDataRef.current = getDataSourceData;
  
  const getDataSourceByIdRef = useRef(getDataSourceById);
  getDataSourceByIdRef.current = getDataSourceById;
  
  const loadAllDataSourcesRef = useRef(loadAllDataSources);
  loadAllDataSourcesRef.current = loadAllDataSources;
  
  // dataSources ref'i - dependency'den çıkarmak için
  const dataSourcesRef = useRef(dataSources);
  dataSourcesRef.current = dataSources;
  
  // Önceki pageId'yi takip et - sadece gerçek değişimlerde tetikle
  const prevPageIdRef = useRef<string | null>(null);
  
  // Başlatma durumunu takip et - sadece bir kez çalışsın
  const initCalledRef = useRef(false);
  
  // Önceki değerleri takip et - gereksiz tetiklemeleri önle
  const prevInitStateRef = useRef({ pageId: null as string | null, dataSourcesReady: false });

  // pageId değiştiğinde hasInitialized'ı sıfırla - SADECE gerçek değişimlerde
  useEffect(() => {
    if (pageId && pageId !== prevPageIdRef.current) {
      console.log(`[DataSourceLoader] Page ID changed to ${pageId}, resetting initialization`);
      setHasInitialized(false);
      initCalledRef.current = false;
      prevPageIdRef.current = pageId;
    }
  }, [pageId]);

  // Sayfa değiştiğinde veya ilk yüklemede veri kaynaklarını kontrol et ve eksikleri yükle
  useEffect(() => {
    // DIA profili yüklenene kadar başlatma
    if (isDiaProfileLoading) {
      console.log('[DataSourceLoader] Effect waiting for DIA profile...');
      return;
    }
    
    // Değişiklik var mı kontrol et
    const dataSourcesReady = dataSources.length > 0 && !isDataSourcesLoading;
    const stateChanged = prevInitStateRef.current.pageId !== pageId || 
                          prevInitStateRef.current.dataSourcesReady !== dataSourcesReady;
    
    // State değişmediyse hiçbir şey yapma
    if (!stateChanged && initCalledRef.current) return;
    
    // State'i güncelle
    prevInitStateRef.current = { pageId, dataSourcesReady };
    
    // Zaten çağrıldıysa tekrar çağırma
    if (initCalledRef.current) return;
    
    // pageId hazır VE dataSources yüklendi VE henüz başlatılmadı VE yükleme devam etmiyor
    if (pageId && dataSources.length > 0 && !isDataSourcesLoading && !hasInitialized && !loadingRef.current) {
      // Önce flag'i set et - race condition önleme
      initCalledRef.current = true;
      
      console.log(`[DataSourceLoader] Initial load for page ${pageId} (${dataSources.length} sources available)`);
      setHasInitialized(true);
      
      // Sayfa geçişlerinde cache kontrol et - tüm kaynaklar zaten cache'de mi?
      (async () => {
        const fieldPools = await findUsedDataSourcesRef.current();
        const allSourcesCached = fieldPools.length === 0 || fieldPools.every(pool => {
          const cachedData = getDataSourceDataRef.current(pool.dataSourceId);
          return cachedData && cachedData.length > 0;
        });
        
        if (allSourcesCached && fieldPools.length > 0) {
          // Tüm kaynaklar cache'de - loading gösterme, hemen hazır
          console.log(`[DataSourceLoader] All ${fieldPools.length} sources already in cache - skipping loading state`);
          setIsLoading(false);
          setIsInitialLoad(false);
          setPageDataReady(true);
          setLoadedSources(fieldPools.map(pool => ({
            id: pool.dataSourceId,
            name: getDataSourceByIdRef.current(pool.dataSourceId)?.name || pool.dataSourceId
          })));
          setLoadProgress(100);
        } else {
          // Cache miss var - normal yükleme yap
          loadAllDataSourcesRef.current();
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, dataSources.length, hasInitialized, isDataSourcesLoading, isDiaProfileLoading]);

  // Manuel refresh (force) - TÜM verileri yeniden çeker
  const refresh = useCallback(async () => {
    console.log('[DataSourceLoader] Manual refresh triggered');
    await loadAllDataSources(true);
  }, [loadAllDataSources]);

  // TEK VERİ KAYNAĞINI YÜKLE - Widget ekleme sonrası kullanım için (SCOPE-AWARE)
  const loadSingleDataSource = useCallback(async (dataSourceId: string): Promise<any[] | null> => {
    // Önce cache'de var mı bak - scope ile
    const lookupScope = currentScope || { sunucuAdi: diaProfile.sunucuAdi || '', firmaKodu: diaProfile.firmaKodu || '', donemKodu: effectiveDonem };
    const cachedData = getDataSourceData(dataSourceId, lookupScope);
    if (cachedData && cachedData.length > 0) {
      console.log(`[DataSourceLoader] Single source HIT: ${dataSourceId} (${cachedData.length} kayıt) - scope: dönem ${lookupScope.donemKodu}`);
      return cachedData;
    }
    
    // Cache'de yok, API'den çek
    const dataSource = getDataSourceById(dataSourceId);
    if (!dataSource) {
      console.warn(`[DataSourceLoader] Data source not found: ${dataSourceId}`);
      return null;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[DataSourceLoader] No session for single source load');
        return null;
      }
      
      console.log(`[DataSourceLoader] Loading single source: ${dataSource.name}`);
      const data = await loadDataSourceFromApi(dataSource, session.access_token);
      
      // Local map'e de ekle
      if (data) {
        setSourceDataMap(prev => {
          const next = new Map(prev);
          next.set(dataSourceId, data);
          return next;
        });
      }
      
      return data;
    } catch (err) {
      console.error(`[DataSourceLoader] Single source load error:`, err);
      return null;
    }
  }, [getDataSourceData, getDataSourceById, loadDataSourceFromApi, currentScope, diaProfile.sunucuAdi, diaProfile.firmaKodu, effectiveDonem]);

  return {
    isLoading,
    isInitialLoad,
    loadedSources,
    currentSourceName,
    totalSources,
    loadProgress,
    error,
    refresh,
    getSourceData,
    loadSingleDataSource,
  };
}
