// useDataSourceLoader - Sayfa seviyesinde veri kaynaklarını merkezi olarak yükler
// DB-FIRST STRATEGY: Önce veritabanını kontrol et, yoksa API'den çek
// GLOBAL CACHE: Bir veri kaynağı bir kez sorgulandıktan sonra tüm sayfalarda kullanılır
// LAZY LOADING: Sayfa geçişlerinde sadece eksik sorgular tamamlanır
// _system modülü: Takvim gibi lokal üretilen veri kaynakları desteklenir

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { useDataSources, DataSource } from './useDataSources';
import { queuedDiaFetch } from '@/lib/diaRequestQueue';
import { toast } from 'sonner';
import { getCachedCalendarData } from '@/lib/calendarDataGenerator';

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

  // DB-FIRST: Veritabanından veri çekme fonksiyonu
  const loadDataSourceFromDatabase = useCallback(async (
    dataSource: DataSource
  ): Promise<any[] | null> => {
    const { sunucuAdi, firmaKodu, donemKodu } = diaProfile;
    
    if (!sunucuAdi || !firmaKodu) {
      console.log(`[DataSourceLoader] DB-FIRST: No profile config, skipping DB check for ${dataSource.name}`);
      return null;
    }

    const effectiveDonem = parseInt(donemKodu || '1');
    const isPeriodIndependent = dataSource.is_period_independent === true;

    try {
      // Sayfalama ile tüm veriyi çek - Supabase varsayılan 1000 limit'i aşmak için
      const PAGE_SIZE = 1000; // Supabase max 1000 satır döndürür
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        // Dönem bağımsız kaynaklar için donem_kodu filtresi uygulanmaz
        let query = supabase
          .from('company_data_cache')
          .select('data')
          .eq('data_source_slug', dataSource.slug)
          .eq('sunucu_adi', sunucuAdi)
          .eq('firma_kodu', firmaKodu)
          .eq('is_deleted', false);
        
        // Sadece dönem bağımlı kaynaklar için dönem filtresi uygula
        if (!isPeriodIndependent) {
          query = query.eq('donem_kodu', effectiveDonem);
        }
        
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error(`[DataSourceLoader] DB-FIRST error for ${dataSource.name}:`, error);
          return null;
        }

        const rows = data || [];
        allData = allData.concat(rows.map(row => row.data));
        
        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      }

      if (allData.length > 0) {
        console.log(`[DataSourceLoader] DB-FIRST HIT: ${dataSource.name} (${allData.length} kayıt from DB${isPeriodIndependent ? ', period-independent' : ''})`);
        return allData;
      }

      console.log(`[DataSourceLoader] DB-FIRST MISS: ${dataSource.name} - no data in DB`);
      return null;
    } catch (err) {
      console.error(`[DataSourceLoader] DB-FIRST exception for ${dataSource.name}:`, err);
      return null;
    }
  }, [diaProfile]);
  const findUsedDataSources = useCallback(async (): Promise<string[]> => {
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

      // Benzersiz dataSourceId'leri topla
      const usedSourceIds = new Set<string>();
      
      for (const widget of widgets) {
        const config = widget.builder_config as any;
        
        // 1. Tek sorgu - üst düzey dataSourceId
        if (config?.dataSourceId) {
          usedSourceIds.add(config.dataSourceId);
        }
        
        // 2. MultiQuery - her sorgunun dataSourceId'sini kontrol et
        if (config?.multiQuery?.queries && Array.isArray(config.multiQuery.queries)) {
          for (const query of config.multiQuery.queries) {
            if (query.dataSourceId) {
              usedSourceIds.add(query.dataSourceId);
            }
          }
        }
        
        // 3. isMultiQuery flag'i varsa ama multiQuery objesi yoksa - eski format
        if (config?.isMultiQuery && config?.queries && Array.isArray(config.queries)) {
          for (const query of config.queries) {
            if (query.dataSourceId) {
              usedSourceIds.add(query.dataSourceId);
            }
          }
        }
      }

      console.log(`[DataSourceLoader] Found ${usedSourceIds.size} unique data sources:`, 
        Array.from(usedSourceIds));

      return Array.from(usedSourceIds);
    } catch (err) {
      console.error('[DataSourceLoader] Error finding used data sources:', err);
      return [];
    }
  }, [pageId]);

  // Tek bir veri kaynağını yükle - DB-FIRST STRATEGY
  const loadDataSource = useCallback(async (
    dataSource: DataSource, 
    accessToken: string,
    forceRefresh: boolean = false
  ): Promise<any[] | null> => {
    // _system modülü - lokal üretilen veri kaynakları (takvim vb.)
    if (dataSource.module === '_system') {
      return loadSystemDataSource(dataSource);
    }
    
    // 1. Zaten global registry'de VE cache'de veri varsa - cache'den al
    if (!forceRefresh && isDataSourceFetched(dataSource.id)) {
      const cachedData = getDataSourceData(dataSource.id);
      if (cachedData && cachedData.length > 0) {
        console.log(`[DataSourceLoader] GLOBAL HIT: ${dataSource.name} (${cachedData.length} kayıt) - başka sayfada zaten yüklendi`);
        incrementCacheHit();
        return cachedData;
      }
    }
    
    // 2. Memory cache kontrolü (stale-while-revalidate)
    const { data: cachedData, isStale } = getDataSourceDataWithStale(dataSource.id);
    
    if (cachedData && cachedData.length > 0 && !forceRefresh) {
      console.log(`[DataSourceLoader] Memory Cache HIT: ${dataSource.name} (${cachedData.length} kayıt)${isStale ? ' [STALE]' : ''}`);
      incrementCacheHit();
      return cachedData;
    }

    // 3. DB-FIRST: Veritabanından veri çek
    if (!forceRefresh) {
      const dbData = await loadDataSourceFromDatabase(dataSource);
      if (dbData && dbData.length > 0) {
        // Veritabanından gelen veriyi memory cache'e de kaydet
        setDataSourceData(dataSource.id, dbData, DEFAULT_TTL);
        markDataSourceFetched(dataSource.id);
        incrementCacheHit();
        return dbData;
      }
    }

    // 4. Son çare: DIA API'den çek
    console.log(`[DataSourceLoader] API FETCH: ${dataSource.name} - DB boş, API'den çekiliyor`);
    incrementCacheMiss();

    return loadDataSourceFromApi(dataSource, accessToken);
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
  const loadDataSourceFromApi = useCallback(async (
    dataSource: DataSource,
    accessToken: string
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
            selectedColumns: dataSource.selected_columns,
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

      // Sayfadaki widget'ların kullandığı veri kaynaklarını bul
      const usedSourceIds = await findUsedDataSources();
      
      if (usedSourceIds.length === 0) {
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

      // FIX: Zaten sorgulanmış VE cache'de gerçekten veri olanları ayır
      const alreadyFetched = usedSourceIds.filter(id => {
        const inRegistry = isDataSourceFetchedRef.current(id);
        const cachedData = getDataSourceData(id);
        // Registry'de var VE cache'de gerçekten veri var mı?
        return inRegistry && cachedData && cachedData.length > 0;
      });
      
      // FIX: Registry'de olsa bile cache boşsa yeniden fetch et
      const needToFetch = forceRefresh 
        ? usedSourceIds 
        : usedSourceIds.filter(id => {
            const inRegistry = isDataSourceFetchedRef.current(id);
            const cachedData = getDataSourceData(id);
            // Registry'de yok VEYA cache boş/geçersiz
            return !inRegistry || !cachedData || cachedData.length === 0;
          });

      console.log(`[DataSourceLoader] Page needs ${usedSourceIds.length} sources:`);
      console.log(`  - Already fetched (with valid cache): ${alreadyFetched.length}`);
      console.log(`  - Need to fetch (missing or empty cache): ${needToFetch.length}`);

      setTotalSources(needToFetch.length || 1); // En az 1 göster progress için

      // Zaten sorgulanmış olanları hemen yükle
      const newDataMap = new Map<string, any[]>();
      const successfulSources: LoadedSourceInfo[] = [];
      
      for (const sourceId of alreadyFetched) {
        const data = getDataSourceData(sourceId);
        const ds = getDataSourceById(sourceId);
        if (data) {
          newDataMap.set(sourceId, data);
          successfulSources.push({ id: sourceId, name: ds?.name || sourceId });
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

      // SIRAYLA yükle (kontör tasarrufu - paralel değil)
      for (let i = 0; i < needToFetch.length; i++) {
        const sourceId = needToFetch[i];
        const dataSource = getDataSourceById(sourceId);
        
        if (!dataSource) {
          console.warn(`[DataSourceLoader] Data source not found: ${sourceId}`);
          continue;
        }
        
        // Aktif kaynak ismini güncelle
        setCurrentSourceName(dataSource.name);
        
        const data = await loadDataSource(dataSource, session.access_token, forceRefresh);
        
        if (data) {
          newDataMap.set(sourceId, data);
          successfulSources.push({ id: sourceId, name: dataSource.name });
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

  // Veri kaynağı verisini al (önce local, sonra global cache)
  const getSourceData = useCallback((dataSourceId: string): any[] | null => {
    // Önce local map'e bak
    const localData = sourceDataMap.get(dataSourceId);
    if (localData) return localData;
    
    // Global cache'e bak
    const globalData = getDataSourceData(dataSourceId);
    if (globalData) return globalData;
    
    return null;
  }, [sourceDataMap, getDataSourceData]);

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
        const usedSourceIds = await findUsedDataSourcesRef.current();
        const allSourcesCached = usedSourceIds.length === 0 || usedSourceIds.every(id => {
          const cachedData = getDataSourceDataRef.current(id);
          return cachedData && cachedData.length > 0;
        });
        
        if (allSourcesCached && usedSourceIds.length > 0) {
          // Tüm kaynaklar cache'de - loading gösterme, hemen hazır
          console.log(`[DataSourceLoader] All ${usedSourceIds.length} sources already in cache - skipping loading state`);
          setIsLoading(false);
          setIsInitialLoad(false);
          setPageDataReady(true);
          setLoadedSources(usedSourceIds.map(id => ({
            id,
            name: getDataSourceByIdRef.current(id)?.name || id
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

  // TEK VERİ KAYNAĞINI YÜKLE - Widget ekleme sonrası kullanım için
  const loadSingleDataSource = useCallback(async (dataSourceId: string): Promise<any[] | null> => {
    // Önce cache'de var mı bak
    const cachedData = getDataSourceData(dataSourceId);
    if (cachedData && cachedData.length > 0) {
      console.log(`[DataSourceLoader] Single source HIT: ${dataSourceId} (${cachedData.length} kayıt)`);
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
  }, [getDataSourceData, getDataSourceById, loadDataSourceFromApi]);

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
