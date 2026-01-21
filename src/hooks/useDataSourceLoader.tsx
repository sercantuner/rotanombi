// useDataSourceLoader - Sayfa seviyesinde veri kaynaklarını merkezi olarak yükler
// GLOBAL CACHE: Bir veri kaynağı bir kez sorgulandıktan sonra tüm sayfalarda kullanılır
// LAZY LOADING: Sayfa geçişlerinde sadece eksik sorgular tamamlanır

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useDataSources, DataSource } from './useDataSources';
import { queuedDiaFetch } from '@/lib/diaRequestQueue';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Varsayılan TTL: 10 dakika
const DEFAULT_TTL = 10 * 60 * 1000;

interface DataSourceLoaderResult {
  isLoading: boolean;
  isInitialLoad: boolean;
  loadedSources: string[];
  totalSources: number;
  loadProgress: number; // 0-100
  error: string | null;
  refresh: () => Promise<void>;
  getSourceData: (dataSourceId: string) => any[] | null;
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
  const [loadedSources, setLoadedSources] = useState<string[]>([]);
  const [totalSources, setTotalSources] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceDataMap, setSourceDataMap] = useState<Map<string, any[]>>(new Map());
  const loadingRef = useRef(false);
  const pageInitializedRef = useRef<string | null>(null);
  
  const { dataSources, getDataSourceById, updateLastFetch } = useDataSources();
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
  } = useDiaDataCache();

  // Sayfadaki widget'ların kullandığı veri kaynaklarını bul
  const findUsedDataSources = useCallback(async (): Promise<string[]> => {
    if (!pageId) return [];

    try {
      // Sayfadaki tüm container'ları ve widget'ları çek
      const { data: containers, error: containerError } = await supabase
        .from('page_containers')
        .select('id')
        .eq('page_id', pageId);

      if (containerError || !containers?.length) return [];

      const containerIds = containers.map(c => c.id);

      // Container'lardaki widget'ları çek
      const { data: containerWidgets, error: widgetsError } = await supabase
        .from('container_widgets')
        .select('widget_id')
        .in('container_id', containerIds);

      if (widgetsError || !containerWidgets?.length) return [];

      const widgetIds = containerWidgets.map(cw => cw.widget_id);

      // Widget'ların builder_config'lerini çek
      const { data: widgets, error: dbError } = await supabase
        .from('widgets')
        .select('id, builder_config')
        .in('id', widgetIds);

      if (dbError || !widgets?.length) return [];

      // Benzersiz dataSourceId'leri topla
      const usedSourceIds = new Set<string>();
      
      for (const widget of widgets) {
        const config = widget.builder_config as WidgetWithDataSource['builder_config'];
        if (config?.dataSourceId) {
          usedSourceIds.add(config.dataSourceId);
        }
      }

      return Array.from(usedSourceIds);
    } catch (err) {
      console.error('Error finding used data sources:', err);
      return [];
    }
  }, [pageId]);

  // Tek bir veri kaynağını yükle - SADECE henüz sorgulanmamış olanları
  const loadDataSource = useCallback(async (
    dataSource: DataSource, 
    accessToken: string,
    forceRefresh: boolean = false
  ): Promise<any[] | null> => {
    // 1. Zaten global registry'de VE cache'de veri varsa - cache'den al
    if (!forceRefresh && isDataSourceFetched(dataSource.id)) {
      const cachedData = getDataSourceData(dataSource.id);
      // FIX: Cache'de gerçekten veri var mı kontrol et
      if (cachedData && cachedData.length > 0) {
        console.log(`[DataSourceLoader] GLOBAL HIT: ${dataSource.name} (${cachedData.length} kayıt) - başka sayfada zaten yüklendi`);
        incrementCacheHit();
        return cachedData;
      }
      // Registry'de var ama cache boş - yeniden fetch gerekli
      console.log(`[DataSourceLoader] STALE REGISTRY: ${dataSource.name} - registry'de var ama cache boş, yeniden yükleniyor`);
    }
    
    // 2. Cache kontrolü (stale-while-revalidate)
    const { data: cachedData, isStale } = getDataSourceDataWithStale(dataSource.id);
    
    if (cachedData && cachedData.length > 0 && !forceRefresh) {
      console.log(`[DataSourceLoader] Cache HIT: ${dataSource.name} (${cachedData.length} kayıt)${isStale ? ' [STALE]' : ''}`);
      incrementCacheHit();
      // Stale olsa bile API çağrısı yapmıyoruz - kontör tasarrufu
      return cachedData;
    }

    // 3. API'den çek ve global registry'e işaretle
    console.log(`[DataSourceLoader] FETCHING: ${dataSource.name} - İlk kez sorgulanıyor`);
    incrementCacheMiss();

    return loadDataSourceFromApi(dataSource, accessToken);
  }, [getDataSourceData, getDataSourceDataWithStale, isDataSourceFetched, incrementCacheHit, incrementCacheMiss]);

  // API'den veri çek (helper)
  const loadDataSourceFromApi = async (
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
          }),
        },
        2 // High priority for data source loading
      );

      const result = await response.json();
      
      if (!result.success) {
        console.error(`[DataSourceLoader] API Error for ${dataSource.name}:`, result.error);
        return null;
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
      return null;
    } finally {
      setDataSourceLoading(dataSource.id, false);
    }
  };

  // Sayfa için veri kaynaklarını yükle - SADECE EKSİK OLANLARI
  const loadAllDataSources = useCallback(async (forceRefresh: boolean = false) => {
    if (!pageId || loadingRef.current) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    // Manuel yenileme ise global registry'i temizle
    if (forceRefresh) {
      console.log('[DataSourceLoader] Force refresh - clearing global registry');
      clearFetchedRegistry();
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
        pageInitializedRef.current = pageId;
        return;
      }

      // FIX: Zaten sorgulanmış VE cache'de gerçekten veri olanları ayır
      const alreadyFetched = usedSourceIds.filter(id => {
        const inRegistry = isDataSourceFetched(id);
        const cachedData = getDataSourceData(id);
        // Registry'de var VE cache'de gerçekten veri var mı?
        return inRegistry && cachedData && cachedData.length > 0;
      });
      
      // FIX: Registry'de olsa bile cache boşsa yeniden fetch et
      const needToFetch = forceRefresh 
        ? usedSourceIds 
        : usedSourceIds.filter(id => {
            const inRegistry = isDataSourceFetched(id);
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
      const successfulIds: string[] = [];
      
      for (const sourceId of alreadyFetched) {
        const data = getDataSourceData(sourceId);
        if (data) {
          newDataMap.set(sourceId, data);
          successfulIds.push(sourceId);
          incrementCacheHit();
        }
      }

      // Eğer sorgulanacak kaynak yoksa hemen bitir
      if (needToFetch.length === 0) {
        console.log('[DataSourceLoader] All sources already cached from previous pages!');
        setSourceDataMap(newDataMap);
        setLoadedSources(successfulIds);
        setLoadProgress(100);
        setIsLoading(false);
        setIsInitialLoad(false);
        setPageDataReady(true);
        loadingRef.current = false;
        pageInitializedRef.current = pageId;
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
        
        const data = await loadDataSource(dataSource, session.access_token, forceRefresh);
        
        if (data) {
          newDataMap.set(sourceId, data);
          successfulIds.push(sourceId);
        }
        
        // Progress güncelle
        const progress = Math.round(((i + 1) / needToFetch.length) * 100);
        setLoadProgress(progress);
        setLoadedSources([...successfulIds]);
      }

      setSourceDataMap(newDataMap);
      
      console.log(`[DataSourceLoader] Page ready: ${successfulIds.length} sources loaded`);
      
      // Sayfa hazır
      setPageDataReady(true);
      pageInitializedRef.current = pageId;
    } catch (err) {
      console.error('[DataSourceLoader] Error:', err);
      setError(err instanceof Error ? err.message : 'Veri kaynakları yüklenemedi');
      if (!pageInitializedRef.current) {
        toast.error('Veri kaynakları yüklenirken hata oluştu');
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
      loadingRef.current = false;
    }
  }, [pageId, findUsedDataSources, getDataSourceById, loadDataSource, setPageDataReady, 
      isDataSourceFetched, getDataSourceData, clearFetchedRegistry, incrementCacheHit]);

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

  // Sayfa değiştiğinde veri kaynaklarını kontrol et ve eksikleri yükle
  useEffect(() => {
    // Sayfa değiştiğinde veya ilk yüklemede
    if (pageId && dataSources.length > 0 && pageInitializedRef.current !== pageId) {
      console.log(`[DataSourceLoader] Page changed to ${pageId} - checking for missing sources`);
      loadAllDataSources();
    }
  }, [pageId, dataSources.length, loadAllDataSources]);

  // Manuel refresh (force) - TÜM verileri yeniden çeker
  const refresh = useCallback(async () => {
    console.log('[DataSourceLoader] Manual refresh triggered');
    await loadAllDataSources(true);
  }, [loadAllDataSources]);

  return {
    isLoading,
    isInitialLoad,
    loadedSources,
    totalSources,
    loadProgress,
    error,
    refresh,
    getSourceData,
  };
}
