// useDataSourceLoader - Sayfa seviyesinde veri kaynaklarını merkezi olarak yükler
// Tüm widget'ların kullandığı veri kaynaklarını tespit edip tek seferde çeker

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useDataSources, DataSource } from './useDataSources';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface DataSourceLoaderResult {
  isLoading: boolean;
  loadedSources: string[]; // Yüklenen dataSourceId'ler
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
  const [loadedSources, setLoadedSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sourceDataMap, setSourceDataMap] = useState<Map<string, any[]>>(new Map());
  
  const { dataSources, getDataSourceById } = useDataSources();
  const { 
    getCachedData, 
    setCachedData, 
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

  // Tek bir veri kaynağını yükle
  const loadDataSource = useCallback(async (
    dataSource: DataSource, 
    accessToken: string
  ): Promise<any[] | null> => {
    const cacheKey = `datasource_${dataSource.id}`;
    
    // Cache kontrolü
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult && Array.isArray(cachedResult)) {
      console.log(`[DataSourceLoader] Cache HIT: ${dataSource.name} (${cachedResult.length} kayıt)`);
      incrementCacheHit();
      return cachedResult;
    }

    console.log(`[DataSourceLoader] Cache MISS: ${dataSource.name} - Fetching...`);
    incrementCacheMiss();

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dia-api-test`, {
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
      });

      const result = await response.json();
      
      if (!result.success) {
        console.error(`[DataSourceLoader] API Error for ${dataSource.name}:`, result.error);
        return null;
      }

      const data = result.sampleData || [];
      console.log(`[DataSourceLoader] Loaded: ${dataSource.name} (${data.length} kayıt)`);
      
      // Cache'e kaydet (TTL: veri kaynağının cache_ttl değeri veya 5 dakika)
      const ttl = (dataSource.cache_ttl || 300) * 1000;
      setCachedData(cacheKey, data, ttl);
      
      return data;
    } catch (err) {
      console.error(`[DataSourceLoader] Fetch error for ${dataSource.name}:`, err);
      return null;
    }
  }, [getCachedData, setCachedData, incrementCacheHit, incrementCacheMiss]);

  // Tüm veri kaynaklarını yükle
  const loadAllDataSources = useCallback(async () => {
    if (!pageId) return;

    setIsLoading(true);
    setError(null);

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
        setIsLoading(false);
        return;
      }

      console.log(`[DataSourceLoader] Found ${usedSourceIds.length} data sources to load`);

      // Her veri kaynağını paralel olarak yükle
      const loadPromises = usedSourceIds.map(async (sourceId) => {
        const dataSource = getDataSourceById(sourceId);
        if (!dataSource) {
          console.warn(`[DataSourceLoader] Data source not found: ${sourceId}`);
          return { sourceId, data: null };
        }
        
        const data = await loadDataSource(dataSource, session.access_token);
        return { sourceId, data };
      });

      const results = await Promise.all(loadPromises);
      
      // Sonuçları map'e ekle
      const newDataMap = new Map<string, any[]>();
      const successfulIds: string[] = [];
      
      for (const { sourceId, data } of results) {
        if (data) {
          newDataMap.set(sourceId, data);
          successfulIds.push(sourceId);
        }
      }

      setSourceDataMap(newDataMap);
      setLoadedSources(successfulIds);
      
      console.log(`[DataSourceLoader] Successfully loaded ${successfulIds.length}/${usedSourceIds.length} data sources`);
    } catch (err) {
      console.error('[DataSourceLoader] Error:', err);
      setError(err instanceof Error ? err.message : 'Veri kaynakları yüklenemedi');
      toast.error('Veri kaynakları yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [pageId, findUsedDataSources, getDataSourceById, loadDataSource]);

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
    if (pageId && dataSources.length > 0) {
      loadAllDataSources();
    }
  }, [pageId, dataSources.length]); // loadAllDataSources'u dependency'den çıkarıyoruz infinite loop önlemek için

  return {
    isLoading,
    loadedSources,
    error,
    refresh: loadAllDataSources,
    getSourceData,
  };
}
