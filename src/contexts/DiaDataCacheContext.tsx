// DiaDataCacheContext - DIA API sonuçlarını önbelleğe alma
// Aynı verinin birden fazla kez çekilmesini önler, kontör tasarrufu sağlar

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live (ms)
}

interface CacheStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

interface DiaDataCacheContextType {
  // Cache işlemleri
  getCachedData: (cacheKey: string) => any | null;
  setCachedData: (cacheKey: string, data: any, ttl?: number) => void;
  invalidateCache: (pattern?: string) => void;
  
  // Hazır veri havuzları (Dashboard'dan gelen)
  sharedData: {
    cariListesi: any[] | null;
    vadeBakiye: any[] | null;
  };
  setSharedData: (key: 'cariListesi' | 'vadeBakiye', data: any[]) => void;
  
  // İstatistikler
  stats: CacheStats;
  incrementCacheHit: () => void;
  incrementCacheMiss: () => void;
}

const DiaDataCacheContext = createContext<DiaDataCacheContextType | null>(null);

// Varsayılan TTL: 5 dakika
const DEFAULT_TTL = 5 * 60 * 1000;

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
}

export function DiaDataCacheProvider({ children }: DiaDataCacheProviderProps) {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const [sharedData, setSharedDataState] = useState<{
    cariListesi: any[] | null;
    vadeBakiye: any[] | null;
  }>({
    cariListesi: null,
    vadeBakiye: null,
  });
  const [stats, setStats] = useState<CacheStats>({
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
  });

  // Cache'den veri al
  const getCachedData = useCallback((cacheKey: string): any | null => {
    const entry = cache.get(cacheKey);
    if (!entry) return null;
    
    // TTL kontrolü
    if (Date.now() - entry.timestamp > entry.ttl) {
      // Süresi dolmuş, temizle
      setCache(prev => {
        const next = new Map(prev);
        next.delete(cacheKey);
        return next;
      });
      return null;
    }
    
    return entry.data;
  }, [cache]);

  // Cache'e veri ekle
  const setCachedData = useCallback((cacheKey: string, data: any, ttl: number = DEFAULT_TTL) => {
    setCache(prev => {
      const next = new Map(prev);
      next.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl,
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
    }, 10 * 60 * 1000); // 10 dakika TTL
  }, [setCachedData]);

  // İstatistik güncellemeleri
  const incrementCacheHit = useCallback(() => {
    setStats(prev => ({
      ...prev,
      totalQueries: prev.totalQueries + 1,
      cacheHits: prev.cacheHits + 1,
    }));
  }, []);

  const incrementCacheMiss = useCallback(() => {
    setStats(prev => ({
      ...prev,
      totalQueries: prev.totalQueries + 1,
      cacheMisses: prev.cacheMisses + 1,
    }));
  }, []);

  const value = useMemo(() => ({
    getCachedData,
    setCachedData,
    invalidateCache,
    sharedData,
    setSharedData,
    stats,
    incrementCacheHit,
    incrementCacheMiss,
  }), [getCachedData, setCachedData, invalidateCache, sharedData, setSharedData, stats, incrementCacheHit, incrementCacheMiss]);

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
      setCachedData: () => {},
      invalidateCache: () => {},
      sharedData: { cariListesi: null, vadeBakiye: null },
      setSharedData: () => {},
      stats: { totalQueries: 0, cacheHits: 0, cacheMisses: 0 },
      incrementCacheHit: () => {},
      incrementCacheMiss: () => {},
    };
  }
  return context;
}
