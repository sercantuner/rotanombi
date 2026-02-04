// DiaDataCacheContext - DIA API sonuçlarını önbelleğe alma
// GLOBAL cache: Tüm sayfalar arası paylaşılan veri havuzu
// Aynı sorgu bir kez yapılır, tüm sayfalarda kullanılır
// KULLANICI İZOLASYONU: Kullanıcı değiştiğinde cache otomatik temizlenir

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef, useEffect } from 'react';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live (ms)
  isStale?: boolean; // Stale-while-revalidate için
}

interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  realApiCalls: number; // Gerçek DIA API çağrıları (kontör harcayan)
  lastApiCallTime: number | null; // Son API çağrısı timestamp
}

interface DiaDataCacheContextType {
  // Cache işlemleri
  getCachedData: (cacheKey: string) => any | null;
  getCachedDataWithStale: (cacheKey: string) => { data: any | null; isStale: boolean };
  setCachedData: (cacheKey: string, data: any, ttl?: number) => void;
  invalidateCache: (pattern?: string) => void;
  
  // Veri kaynağı bazlı cache
  getDataSourceData: (dataSourceId: string) => any[] | null;
  getDataSourceDataWithStale: (dataSourceId: string) => { data: any[] | null; isStale: boolean };
  setDataSourceData: (dataSourceId: string, data: any[], ttl?: number) => void;
  isDataSourceLoading: (dataSourceId: string) => boolean;
  setDataSourceLoading: (dataSourceId: string, loading: boolean) => void;
  
  // GLOBAL - Hangi veri kaynaklarının ZATEN sorgulandığını takip eder
  // Sayfa geçişlerinde aynı sorgu tekrar yapılmaz
  isDataSourceFetched: (dataSourceId: string) => boolean;
  markDataSourceFetched: (dataSourceId: string) => void;
  getFetchedDataSources: () => string[];
  clearFetchedRegistry: () => void; // Manuel yenileme için
  
  // Sayfa seviyesi yükleme durumu
  isPageDataReady: boolean;
  setPageDataReady: (ready: boolean) => void;
  
  // Hazır veri havuzları (Dashboard'dan gelen) - LEGACY
  sharedData: {
    cariListesi: any[] | null;
    vadeBakiye: any[] | null;
  };
  setSharedData: (key: 'cariListesi' | 'vadeBakiye', data: any[]) => void;
  
  // DIA bağlantı durumu - GLOBAL
  isDiaConnected: boolean;
  setDiaConnected: (connected: boolean) => void;
  
  // İstatistikler
  stats: CacheStats;
  resetStats: () => void;
  incrementCacheHit: () => void;
  incrementCacheMiss: () => void;
  recordApiCall: () => void; // Gerçek API çağrısı yapıldığında çağrılır
  
  // Kullanıcı değişikliğinde cache temizleme
  clearAllCache: () => void;
  currentUserId: string | null;
  
  // Impersonation desteği - Super Admin başka kullanıcı gibi veri çekebilir
  targetUserId: string | null;
}

const DiaDataCacheContext = createContext<DiaDataCacheContextType | null>(null);

// Varsayılan TTL: 10 dakika (agresif caching)
const DEFAULT_TTL = 10 * 60 * 1000;

// Stale süresi: TTL'nin %80'i (8 dakika) - Bu süre sonra veri "stale" kabul edilir
const STALE_RATIO = 0.8;

// Cache key oluşturma
export function generateCacheKey(module: string, method: string, params?: any): string {
  const paramsHash = params ? JSON.stringify({
    filters: params.filters || [],
    selectedColumns: params.selectedcolumns || params.selectedColumns || [],
    limit: params.limit || 0,
  }) : '';
  return `${module}_${method}${paramsHash ? '_' + btoa(paramsHash).slice(0, 16) : ''}`;
}

// Ortak veri kaynaklarının cache key'leri
export const SHARED_CACHE_KEYS = {
  CARI_LISTESI: 'scf_carikart_listele_full',
  VADE_BAKIYE: 'scf_carikart_vade_bakiye_listele_full',
  BANKA_HESAPLARI: 'bcs_bankahesabi_listele_full',
};

interface DiaDataCacheProviderProps {
  children: ReactNode;
  userId?: string | null; // Auth'tan gelen kullanıcı ID'si
}

export function DiaDataCacheProvider({ children, userId }: DiaDataCacheProviderProps) {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const [loadingDataSources, setLoadingDataSources] = useState<Set<string>>(new Set());
  
  // GLOBAL: Hangi veri kaynakları bu oturumda zaten sorgulandı?
  // Bu sayede sayfa geçişlerinde aynı sorgu tekrar yapılmaz
  const fetchedDataSourcesRef = useRef<Set<string>>(new Set());
  
  // Kullanıcı değişikliği takibi için
  const previousUserIdRef = useRef<string | null>(null);
  
  const [isPageDataReady, setPageDataReady] = useState(false);
  const [sharedData, setSharedDataState] = useState<{
    cariListesi: any[] | null;
    vadeBakiye: any[] | null;
  }>({
    cariListesi: null,
    vadeBakiye: null,
  });
  const [isDiaConnected, setDiaConnected] = useState(false);
  const [stats, setStats] = useState<CacheStats>({
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    realApiCalls: 0,
    lastApiCallTime: null,
  });

  // TÜM CACHE'İ TEMİZLE - Kullanıcı değişikliğinde çağrılır
  const clearAllCache = useCallback(() => {
    console.log('[DiaCache] 🧹 Clearing ALL cache - user isolation');
    setCache(new Map());
    fetchedDataSourcesRef.current.clear();
    setSharedDataState({ cariListesi: null, vadeBakiye: null });
    setPageDataReady(false);
    setStats({
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      realApiCalls: 0,
      lastApiCallTime: null,
    });
  }, []);

  // KULLANICI DEĞİŞİKLİĞİNİ İZLE - Farklı kullanıcı = farklı veri
  useEffect(() => {
    const prevId = previousUserIdRef.current;
    const currentId = userId || null;
    
    // İlk mount'ta veya aynı kullanıcı ise temizleme yapma
    if (prevId === null && currentId !== null) {
      // İlk giriş - temizleme gerekli değil
      console.log(`[DiaCache] 👤 User logged in: ${currentId}`);
    } else if (prevId !== null && currentId === null) {
      // Çıkış yapıldı - cache temizle
      console.log(`[DiaCache] 👤 User logged out - clearing cache`);
      clearAllCache();
    } else if (prevId !== null && currentId !== null && prevId !== currentId) {
      // Farklı kullanıcı giriş yaptı - cache temizle (KRİTİK!)
      console.log(`[DiaCache] 👤 User changed: ${prevId} -> ${currentId} - CLEARING CACHE for data isolation`);
      clearAllCache();
    }
    
    previousUserIdRef.current = currentId;
  }, [userId, clearAllCache]);

  // Cache'den veri al (stale check ile)
  const getCachedDataWithStale = useCallback((cacheKey: string): { data: any | null; isStale: boolean } => {
    const entry = cache.get(cacheKey);
    if (!entry) return { data: null, isStale: false };
    
    const age = Date.now() - entry.timestamp;
    const staleTreshold = entry.ttl * STALE_RATIO;
    
    // TTL tamamen dolmuşsa veriyi silme - stale-while-revalidate ile kullan
    if (age > entry.ttl) {
      // Veri tamamen expired ama yine de dönüyoruz (stale)
      return { data: entry.data, isStale: true };
    }
    
    // Stale threshold aşıldıysa stale olarak işaretle
    if (age > staleTreshold) {
      return { data: entry.data, isStale: true };
    }
    
    return { data: entry.data, isStale: false };
  }, [cache]);

  // Cache'den veri al (eski API uyumluluğu)
  const getCachedData = useCallback((cacheKey: string): any | null => {
    const { data, isStale } = getCachedDataWithStale(cacheKey);
    // Tamamen expired değilse döndür (stale-while-revalidate)
    const entry = cache.get(cacheKey);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    // TTL'nin 2 katı geçtiyse artık kullanma
    if (age > entry.ttl * 2) {
      setCache(prev => {
        const next = new Map(prev);
        next.delete(cacheKey);
        return next;
      });
      return null;
    }
    
    return data;
  }, [cache, getCachedDataWithStale]);

  // Cache'e veri ekle
  const setCachedData = useCallback((cacheKey: string, data: any, ttl: number = DEFAULT_TTL) => {
    setCache(prev => {
      const next = new Map(prev);
      next.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl,
        isStale: false,
      });
      return next;
    });
  }, []);

  // Cache'i temizle (pattern ile filtreleme opsiyonel)
  const invalidateCache = useCallback((pattern?: string) => {
    if (!pattern) {
      setCache(new Map());
      return;
    }
    
    setCache(prev => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.includes(pattern)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  // Paylaşılan veriyi ayarla
  const setSharedData = useCallback((key: 'cariListesi' | 'vadeBakiye', data: any[]) => {
    setSharedDataState(prev => ({
      ...prev,
      [key]: data,
    }));
    
    // Aynı zamanda cache'e de ekle
    const cacheKey = key === 'cariListesi' 
      ? SHARED_CACHE_KEYS.CARI_LISTESI 
      : SHARED_CACHE_KEYS.VADE_BAKIYE;
    
    setCachedData(cacheKey, { 
      success: true, 
      sampleData: data,
      recordCount: data.length,
    }, DEFAULT_TTL);
  }, [setCachedData]);

  // Veri kaynağı bazlı cache metodları
  // FIX: TTL kontrolü güçlendirildi - tamamen expired veriyi döndürme
  const getDataSourceData = useCallback((dataSourceId: string): any[] | null => {
    const cacheKey = `datasource_${dataSourceId}`;
    const entry = cache.get(cacheKey);
    
    if (!entry) return null;
    
    // TTL tamamen aşıldıysa null döndür (stale-while-revalidate yerine strict kontrol)
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      console.log(`[Cache] EXPIRED: ${cacheKey} (age: ${Math.round(age/1000)}s, ttl: ${Math.round(entry.ttl/1000)}s)`);
      return null;
    }
    
    const data = entry.data;
    return data && Array.isArray(data) ? data : null;
  }, [cache]);

  const getDataSourceDataWithStale = useCallback((dataSourceId: string): { data: any[] | null; isStale: boolean } => {
    const cacheKey = `datasource_${dataSourceId}`;
    const { data, isStale } = getCachedDataWithStale(cacheKey);
    return { 
      data: data && Array.isArray(data) ? data : null, 
      isStale 
    };
  }, [getCachedDataWithStale]);

  const setDataSourceData = useCallback((dataSourceId: string, data: any[], ttl: number = DEFAULT_TTL) => {
    const cacheKey = `datasource_${dataSourceId}`;
    setCachedData(cacheKey, data, ttl);
  }, [setCachedData]);

  // DataSource loading state
  const isDataSourceLoading = useCallback((dataSourceId: string): boolean => {
    return loadingDataSources.has(dataSourceId);
  }, [loadingDataSources]);

  const setDataSourceLoading = useCallback((dataSourceId: string, loading: boolean) => {
    setLoadingDataSources(prev => {
      const next = new Set(prev);
      if (loading) {
        next.add(dataSourceId);
      } else {
        next.delete(dataSourceId);
      }
      return next;
    });
  }, []);

  // GLOBAL Fetched Registry - Hangi veri kaynakları bu oturumda sorgulandı?
  const isDataSourceFetched = useCallback((dataSourceId: string): boolean => {
    return fetchedDataSourcesRef.current.has(dataSourceId);
  }, []);

  const markDataSourceFetched = useCallback((dataSourceId: string) => {
    fetchedDataSourcesRef.current.add(dataSourceId);
    console.log(`[GlobalRegistry] Marked as fetched: ${dataSourceId} (total: ${fetchedDataSourcesRef.current.size})`);
  }, []);

  const getFetchedDataSources = useCallback((): string[] => {
    return Array.from(fetchedDataSourcesRef.current);
  }, []);

  const clearFetchedRegistry = useCallback(() => {
    fetchedDataSourcesRef.current.clear();
    console.log('[GlobalRegistry] Cleared - next page load will refetch all sources');
  }, []);

  // İstatistik güncellemeleri
  const resetStats = useCallback(() => {
    setStats({
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      realApiCalls: 0,
      lastApiCallTime: null,
    });
  }, []);

  // İstatistik güncellemeleri - STABILIZED: Boş dependency array ile stabil referans
  const incrementCacheHitRef = useRef<() => void>(() => {
    setStats(prev => ({
      ...prev,
      totalQueries: prev.totalQueries + 1,
      cacheHits: prev.cacheHits + 1,
    }));
  });
  
  const incrementCacheMissRef = useRef<() => void>(() => {
    setStats(prev => ({
      ...prev,
      totalQueries: prev.totalQueries + 1,
      cacheMisses: prev.cacheMisses + 1,
    }));
  });
  
  const recordApiCallRef = useRef<() => void>(() => {
    setStats(prev => ({
      ...prev,
      realApiCalls: prev.realApiCalls + 1,
      lastApiCallTime: Date.now(),
    }));
  });

  const incrementCacheHit = useCallback(() => {
    incrementCacheHitRef.current();
  }, []);

  const incrementCacheMiss = useCallback(() => {
    incrementCacheMissRef.current();
  }, []);

  const recordApiCall = useCallback(() => {
    recordApiCallRef.current();
  }, []);

  const value = useMemo(() => ({
    getCachedData,
    getCachedDataWithStale,
    setCachedData,
    invalidateCache,
    getDataSourceData,
    getDataSourceDataWithStale,
    setDataSourceData,
    isDataSourceLoading,
    setDataSourceLoading,
    isDataSourceFetched,
    markDataSourceFetched,
    getFetchedDataSources,
    clearFetchedRegistry,
    isPageDataReady,
    setPageDataReady,
    sharedData,
    setSharedData,
    isDiaConnected,
    setDiaConnected,
    stats,
    resetStats,
    incrementCacheHit,
    incrementCacheMiss,
    recordApiCall,
    clearAllCache,
    currentUserId: userId || null,
    targetUserId: userId || null, // Impersonation için - normal kullanımda currentUserId ile aynı
  }), [
    getCachedData, getCachedDataWithStale, setCachedData, invalidateCache, 
    getDataSourceData, getDataSourceDataWithStale, setDataSourceData, 
    isDataSourceLoading, setDataSourceLoading,
    isDataSourceFetched, markDataSourceFetched, getFetchedDataSources, clearFetchedRegistry,
    isPageDataReady, setPageDataReady,
    sharedData, setSharedData, isDiaConnected, setDiaConnected,
    stats, resetStats, incrementCacheHit, incrementCacheMiss, recordApiCall,
    clearAllCache, userId
  ]);

  return (
    <DiaDataCacheContext.Provider value={value}>
      {children}
    </DiaDataCacheContext.Provider>
  );
}

export function useDiaDataCache(): DiaDataCacheContextType {
  const context = useContext(DiaDataCacheContext);
  if (!context) {
    // Context olmadan çalışabilmesi için fallback
    return {
      getCachedData: () => null,
      getCachedDataWithStale: () => ({ data: null, isStale: false }),
      setCachedData: () => {},
      invalidateCache: () => {},
      getDataSourceData: () => null,
      getDataSourceDataWithStale: () => ({ data: null, isStale: false }),
      setDataSourceData: () => {},
      isDataSourceLoading: () => false,
      setDataSourceLoading: () => {},
      isDataSourceFetched: () => false,
      markDataSourceFetched: () => {},
      getFetchedDataSources: () => [],
      clearFetchedRegistry: () => {},
      isPageDataReady: false,
      setPageDataReady: () => {},
      sharedData: { cariListesi: null, vadeBakiye: null },
      setSharedData: () => {},
      isDiaConnected: false,
      setDiaConnected: () => {},
      stats: { totalQueries: 0, cacheHits: 0, cacheMisses: 0, realApiCalls: 0, lastApiCallTime: null },
      resetStats: () => {},
      incrementCacheHit: () => {},
      incrementCacheMiss: () => {},
      recordApiCall: () => {},
      clearAllCache: () => {},
      currentUserId: null,
      targetUserId: null,
    };
  }
  return context;
}
