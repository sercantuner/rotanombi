// useDataSourceLoader - Sayfa seviyesinde veri kaynaklarını merkezi olarak yükler
// Tüm widget'ların kullandığı veri kaynaklarını tespit edip SIRAYLA (kontör tasarrufu) çeker
// Stale-while-revalidate desteği ile eski veriyi gösterirken arka planda günceller

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
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadedSources, setLoadedSources] = useState<string[]>([]);
  const [totalSources, setTotalSources] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceDataMap, setSourceDataMap] = useState<Map<string, any[]>>(new Map());
  const loadingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  
  const { dataSources, getDataSourceById } = useDataSources();
  const { 
    getCachedData,
    getDataSourceDataWithStale,
    setCachedData, 
    setDataSourceData,
    setDataSourceLoading,
    setPageDataReady,
    incrementCacheHit, 
    incrementCacheMiss 
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

  // Tek bir veri kaynağını yükle (SIRAYLA - queue kullanarak)
  const loadDataSource = useCallback(async (
    dataSource: DataSource, 
    accessToken: string,
    forceRefresh: boolean = false
  ): Promise<any[] | null> => {
    const cacheKey = `datasource_${dataSource.id}`;
    
    // Stale-while-revalidate kontrolü
    const { data: cachedData, isStale } = getDataSourceDataWithStale(dataSource.id);
    
    if (cachedData && !forceRefresh) {
      console.log(`[DataSourceLoader] Cache HIT: ${dataSource.name} (${cachedData.length} kayıt)${isStale ? ' [STALE]' : ''}`);
      incrementCacheHit();

      // NOT: Kontör tasarrufu için otomatik arka-plan revalidate KAPALI.
      // Veri "stale" olsa bile burada DIA çağrısı tetiklemiyoruz.
      // Yenileme yalnızca forceRefresh=true (manuel) ile yapılır.

      return cachedData;
    }

    console.log(`[DataSourceLoader] Cache MISS: ${dataSource.name} - Fetching...`);
    incrementCacheMiss();

    return loadDataSourceFromApi(dataSource, accessToken);
  }, [getDataSourceDataWithStale, incrementCacheHit, incrementCacheMiss, setDataSourceData]);

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
      console.log(`[DataSourceLoader] Loaded: ${dataSource.name} (${data.length} kayıt)`);
      
      // Cache'e kaydet - 10 dakika TTL
      setDataSourceData(dataSource.id, data, DEFAULT_TTL);
      
      return data;
    } catch (err) {
      console.error(`[DataSourceLoader] Fetch error for ${dataSource.name}:`, err);
      return null;
    } finally {
      setDataSourceLoading(dataSource.id, false);
    }
  };

  // Tüm veri kaynaklarını SIRAYLA yükle
  const loadAllDataSources = useCallback(async (forceRefresh: boolean = false) => {
    if (!pageId || loadingRef.current) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Oturum bulunamadı');
      }

      // Kullanılan veri kaynaklarını bul
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
        initialLoadDoneRef.current = true;
        return;
      }

      console.log(`[DataSourceLoader] Found ${usedSourceIds.length} data sources to load SEQUENTIALLY`);
      setTotalSources(usedSourceIds.length);

      const newDataMap = new Map<string, any[]>();
      const successfulIds: string[] = [];
      
      // SIRAYLA yükle (kontör tasarrufu - paralel değil)
      for (let i = 0; i < usedSourceIds.length; i++) {
        const sourceId = usedSourceIds[i];
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
        const progress = Math.round(((i + 1) / usedSourceIds.length) * 100);
        setLoadProgress(progress);
        setLoadedSources([...successfulIds]);
      }

      setSourceDataMap(newDataMap);
      
      console.log(`[DataSourceLoader] Successfully loaded ${successfulIds.length}/${usedSourceIds.length} data sources`);
      
      // Sayfa hazır
      setPageDataReady(true);
      initialLoadDoneRef.current = true;
    } catch (err) {
      console.error('[DataSourceLoader] Error:', err);
      setError(err instanceof Error ? err.message : 'Veri kaynakları yüklenemedi');
      if (!initialLoadDoneRef.current) {
        toast.error('Veri kaynakları yüklenirken hata oluştu');
      }
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
      loadingRef.current = false;
    }
  }, [pageId, findUsedDataSources, getDataSourceById, loadDataSource, setPageDataReady]);

  // Veri kaynağı verisini al
  const getSourceData = useCallback((dataSourceId: string): any[] | null => {
    // Önce local map'e bak
    const localData = sourceDataMap.get(dataSourceId);
    if (localData) return localData;
    
    // Cache'e bak
    const cacheKey = `datasource_${dataSourceId}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData && Array.isArray(cachedData)) {
      return cachedData;
    }
    
    return null;
  }, [sourceDataMap, getCachedData]);

  // Sayfa yüklendiğinde veri kaynaklarını yükle
  useEffect(() => {
    if (pageId && dataSources.length > 0 && !initialLoadDoneRef.current) {
      loadAllDataSources();
    }
  }, [pageId, dataSources.length]);

  // Manuel refresh (force)
  const refresh = useCallback(async () => {
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
