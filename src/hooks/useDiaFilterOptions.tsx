// useDiaFilterOptions - DIA'dan filtre seçeneklerini (şube, depo, satış temsilcisi, özel kodlar) çeker
// Bu hook GlobalFilterContext ile entegre çalışır

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { FilterOptions } from '@/lib/filterTypes';
import { queuedDiaFetch } from '@/lib/diaRequestQueue';
import { useDiaProfile } from './useDiaProfile';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Cache key for filter options
// Not: Key'i sunucu/firma bazlı ve versiyonlu tutuyoruz ki eski cache (yanlış ozelkodlar vb.) kalmasın.
const FILTER_OPTIONS_CACHE_KEY_PREFIX = 'dia_filter_options_v2';
const CACHE_TTL = 30 * 60 * 1000; // 30 dakika

interface DiaFilterOptionsResult {
  filterOptions: Partial<FilterOptions>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface CachedFilterOptions {
  data: Partial<FilterOptions>;
  timestamp: number;
}

export function useDiaFilterOptions(): DiaFilterOptionsResult {
  const { user } = useAuth();
  const { isConfigured, sunucuAdi, firmaKodu } = useDiaProfile();
  const { isDiaConnected } = useDiaDataCache();
  
  const [filterOptions, setFilterOptions] = useState<Partial<FilterOptions>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${FILTER_OPTIONS_CACHE_KEY_PREFIX}:${sunucuAdi || 'na'}:${firmaKodu || 'na'}`;

  // Check cache
  const getCachedOptions = useCallback((): Partial<FilterOptions> | null => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: CachedFilterOptions = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('[DiaFilterOptions] Cache read error:', e);
    }
    return null;
  }, [cacheKey]);

  // Save to cache
  const setCachedOptions = useCallback((data: Partial<FilterOptions>) => {
    try {
      const cacheData: CachedFilterOptions = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('[DiaFilterOptions] Cache write error:', e);
    }
  }, [cacheKey]);

  // Fetch from Supabase tables (firma_branches, firma_warehouses)
  const fetchFromSupabase = useCallback(async (): Promise<Partial<FilterOptions>> => {
    const result: Partial<FilterOptions> = {
      subeler: [],
      depolar: [],
    };

    if (!sunucuAdi || !firmaKodu) return result;

    try {
      // Fetch branches
      const { data: branches } = await supabase
        .from('firma_branches')
        .select('branch_code, branch_name')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .eq('is_active', true)
        .order('branch_code');

      if (branches) {
        result.subeler = branches.map(b => ({
          value: b.branch_code,
          label: b.branch_name || b.branch_code,
        }));
      }

      // Fetch warehouses
      const { data: warehouses } = await supabase
        .from('firma_warehouses')
        .select('warehouse_code, warehouse_name')
        .eq('sunucu_adi', sunucuAdi)
        .eq('firma_kodu', firmaKodu)
        .order('warehouse_code');

      if (warehouses) {
        result.depolar = warehouses.map(w => ({
          value: w.warehouse_code,
          label: w.warehouse_name || w.warehouse_code,
        }));
      }

      console.log(`[DiaFilterOptions] Fetched from Supabase: ${result.subeler?.length} branches, ${result.depolar?.length} warehouses`);
    } catch (e) {
      console.error('[DiaFilterOptions] Supabase fetch error:', e);
    }

    return result;
  }, [sunucuAdi, firmaKodu]);

  // Helper to make DIA API call
  const makeDiaApiCall = useCallback(async (
    session: { access_token: string },
    module: string,
    method: string,
    selectedColumns: string[],
    filters?: { field: string; operator: string; value: string }[],
    limit = 500
  ): Promise<any> => {
    try {
      const response = await queuedDiaFetch(
        `${SUPABASE_URL}/functions/v1/dia-api-test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            module,
            method,
            returnAllSampleData: true,
            selectedColumns,
            filters,
            limit,
          }),
        },
        0
      );
      return await response.json();
    } catch (e) {
      console.error(`[DiaFilterOptions] API call failed: ${module}.${method}`, e);
      return null;
    }
  }, []);

  // Fetch from DIA API (satış temsilcileri, özel kodlar, şehirler)
  const fetchFromDia = useCallback(async (): Promise<Partial<FilterOptions>> => {
    const result: Partial<FilterOptions> = {
      satisTemsilcileri: [],
      ozelkodlar1: [],
      ozelkodlar2: [],
      ozelkodlar3: [],
      sehirler: [],
      markalar: [],
      urunGruplari: [],
    };

    if (!user || !isDiaConnected) return result;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return result;

      // Fetch satış temsilcileri from sis_satiselemani
      // NOT: Bu endpoint bazı DIA sunucularında mevcut olmayabilir (404)
      try {
        const satisElemaniResult = await makeDiaApiCall(
          session,
          'sis',
          'satiselemani_listele',
          ['satiselemani', 'aciklama']
        );

        if (satisElemaniResult?.success && satisElemaniResult?.sampleData) {
          result.satisTemsilcileri = satisElemaniResult.sampleData
            .map((s: any) => s.satiselemani || s.aciklama || '')
            .filter((s: string) => s && s.trim());
          console.log(`[DiaFilterOptions] Fetched ${result.satisTemsilcileri?.length} sales reps`);
        } else if (satisElemaniResult?.error) {
          console.warn(`[DiaFilterOptions] Satış temsilcisi listesi alınamadı: ${satisElemaniResult.error}`);
        }
      } catch (salesRepError) {
        console.warn('[DiaFilterOptions] Satış temsilcisi listesi çekilirken hata (endpoint mevcut olmayabilir):', salesRepError);
        // Hata durumunda boş dizi bırak, dashboard çökmesin
      }

      // Fetch özel kodlar (sis_ozelkod) - bunlar cari kartlara ait özel kodlar
      // Özel kod tipi: 1=ozelkod1, 2=ozelkod2, 3=ozelkod3
      for (const kodTip of [1, 2, 3]) {
        const ozelKodResult = await makeDiaApiCall(
          session,
          'sis',
          'ozelkod_listele',
          ['kod', 'aciklama'],
          [
            { field: 'kaynak', operator: '=', value: 'scf_carikart' },
            { field: 'tip', operator: '=', value: String(kodTip) }
          ],
          200
        );

        if (ozelKodResult?.success && ozelKodResult?.sampleData) {
          const options = ozelKodResult.sampleData
            .map((o: any) => ({
              value: o.kod || '',
              label: o.aciklama ? `${o.kod} - ${o.aciklama}` : o.kod || '',
            }))
            .filter((o: any) => o.value);

          if (kodTip === 1) result.ozelkodlar1 = options;
          if (kodTip === 2) result.ozelkodlar2 = options;
          if (kodTip === 3) result.ozelkodlar3 = options;
          
          console.log(`[DiaFilterOptions] Fetched ${options.length} ozelkod${kodTip} options`);
        }
      }

      // Fetch şehirler from cari kartlar (distinct)
      // NOT: limit: 0 yerine 500 kullanıyoruz - bazı DIA sunucuları limit:0'a 404 döndürebiliyor
      try {
        const cariResult = await makeDiaApiCall(
          session,
          'scf',
          'carikart_listele',
          ['sehir'],
          undefined,
          500 // Güvenli limit - 0 yerine
        );

        if (cariResult?.success && cariResult?.sampleData) {
          const uniqueCities = [...new Set(
            cariResult.sampleData
              .map((c: any) => c.sehir || '')
              .filter((s: string) => s && s.trim())
          )] as string[];
          result.sehirler = uniqueCities.sort();
          console.log(`[DiaFilterOptions] Fetched ${result.sehirler?.length} unique cities`);
        } else if (cariResult?.error) {
          console.warn(`[DiaFilterOptions] Şehir listesi alınamadı: ${cariResult.error}`);
        }
      } catch (cityError) {
        console.warn('[DiaFilterOptions] Şehir listesi çekilirken hata:', cityError);
        // Hata durumunda boş dizi bırak, dashboard çökmesin
      }

      // Fetch markalar from stok kartlar
      const markaResult = await makeDiaApiCall(
        session,
        'sis',
        'ozelkod_listele',
        ['kod', 'aciklama'],
        [
          { field: 'kaynak', operator: '=', value: 'scf_stokkart' },
          { field: 'tip', operator: '=', value: '2' } // Marka genellikle tip 2
        ],
        200
      );

      if (markaResult?.success && markaResult?.sampleData) {
        result.markalar = markaResult.sampleData
          .map((m: any) => m.aciklama || m.kod || '')
          .filter((m: string) => m && m.trim());
        console.log(`[DiaFilterOptions] Fetched ${result.markalar?.length} brands`);
      }

    } catch (e) {
      console.error('[DiaFilterOptions] DIA fetch error:', e);
    }

    return result;
  }, [user, isDiaConnected, makeDiaApiCall]);

  // Main fetch function
  const fetchFilterOptions = useCallback(async () => {
    // Check cache first
    const cached = getCachedOptions();
    if (cached && Object.keys(cached).length > 0) {
      console.log('[DiaFilterOptions] Using cached filter options');
      setFilterOptions(cached);
      return;
    }

    if (!isConfigured) {
      console.log('[DiaFilterOptions] DIA not configured, skipping fetch');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch from Supabase (branches, warehouses) and DIA in parallel
      const [supabaseResult, diaResult] = await Promise.all([
        fetchFromSupabase(),
        fetchFromDia(),
      ]);

      // Merge results
      const merged: Partial<FilterOptions> = {
        ...supabaseResult,
        ...diaResult,
        cariKartTipleri: ['AL', 'AS', 'ST'], // Sabit değerler
      };

      setFilterOptions(merged);
      setCachedOptions(merged);
      console.log('[DiaFilterOptions] Filter options loaded and cached');
    } catch (e) {
      console.error('[DiaFilterOptions] Fetch error:', e);
      setError('Filtre seçenekleri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, getCachedOptions, setCachedOptions, fetchFromSupabase, fetchFromDia]);

  // Refetch function (bypass cache)
  const refetch = useCallback(async () => {
    localStorage.removeItem(cacheKey);
    await fetchFilterOptions();
  }, [cacheKey, fetchFilterOptions]);

  // Initial fetch
  useEffect(() => {
    if (user && isConfigured) {
      fetchFilterOptions();
    }
  }, [user, isConfigured, fetchFilterOptions]);

  return {
    filterOptions,
    isLoading,
    error,
    refetch,
  };
}
