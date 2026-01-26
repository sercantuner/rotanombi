// Global Filter Context - Sayfa ve widget bazlı filtreleme sistemi
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  GlobalFilters,
  FilterOptions,
  PageFilterConfig,
  FilterPreset,
  DiaAutoFilter,
  DiaApiFilter,
  GlobalFilterContextType,
  defaultGlobalFilters,
  defaultFilterOptions,
  convertToDiaFilters,
} from '@/lib/filterTypes';

const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

interface GlobalFilterProviderProps {
  children: ReactNode;
  pageId?: string;
}

export function GlobalFilterProvider({ children, pageId }: GlobalFilterProviderProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<GlobalFilters>(defaultGlobalFilters);
  const [filterOptions, setFilterOptionsState] = useState<FilterOptions>(defaultFilterOptions);
  const [pageConfig, setPageConfigState] = useState<PageFilterConfig | null>(null);
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  // Sayfa yapılandırması ve DIA auto filters'ı yükle
  useEffect(() => {
    async function loadUserFilters() {
      if (!user) return;

      try {
        // Kullanıcının DIA otomatik filtrelerini yükle
        const { data: profile } = await supabase
          .from('profiles')
          .select('dia_satis_elemani, dia_yetki_kodu, dia_auto_filters')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const autoFilters: DiaAutoFilter[] = [];
          
          // Satış elemanı filtresi
          if (profile.dia_satis_elemani) {
            autoFilters.push({
              field: 'satiselemani',
              operator: '=',
              value: profile.dia_satis_elemani,
              isLocked: true,
              label: profile.dia_satis_elemani,
            });
          }
          
          // Profildeki ek filtreler (JSONB olarak geliyor)
          const diaAutoFilters = profile.dia_auto_filters as unknown as DiaAutoFilter[] | null;
          if (diaAutoFilters && Array.isArray(diaAutoFilters)) {
            autoFilters.push(...diaAutoFilters);
          }

          if (autoFilters.length > 0) {
            setFilters(prev => ({ ...prev, _diaAutoFilters: autoFilters }));
          }
        }

        // Sayfa yapılandırmasını yükle
        if (pageId) {
          const { data: page } = await supabase
            .from('user_pages')
            .select('filter_config')
            .eq('id', pageId)
            .single();

          if (page?.filter_config) {
            const config = page.filter_config as unknown as PageFilterConfig;
            setPageConfigState({ ...config, pageId });
            
            // Varsayılan filtreleri uygula
            if (config.defaultFilters) {
              setFilters(prev => ({ ...prev, ...config.defaultFilters }));
            }
          }
        }

        // Kullanıcının preset'lerini yükle
        const { data: userPresets } = await supabase
          .from('page_filter_presets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (userPresets) {
          setPresets(userPresets.map(p => ({
            id: p.id,
            userId: p.user_id,
            pageId: p.page_id,
            name: p.name,
            filters: p.filters as Partial<GlobalFilters>,
            isDefault: p.is_default || false,
            createdAt: p.created_at,
          })));
        }
      } catch (error) {
        console.error('Error loading user filters:', error);
      }
    }

    loadUserFilters();
  }, [user, pageId]);

  // Tek filtre değiştir
  const setFilter = useCallback(<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Array filtre toggle (sadece string array'ler için)
  const toggleArrayFilter = useCallback((key: keyof GlobalFilters, value: string) => {
    setFilters(prev => {
      const currentArray = prev[key];
      if (!Array.isArray(currentArray)) return prev;
      
      // _diaAutoFilters özel bir array, değiştirilemez
      if (key === '_diaAutoFilters') return prev;
      
      const stringArray = currentArray as string[];
      const newArray = stringArray.includes(value)
        ? stringArray.filter((v: string) => v !== value)
        : [...stringArray, value];
      return { ...prev, [key]: newArray };
    });
  }, []);

  // Tüm filtreleri temizle
  const clearFilters = useCallback(() => {
    setFilters(prev => ({
      ...defaultGlobalFilters,
      _diaAutoFilters: prev._diaAutoFilters, // Zorunlu filtreleri koru
    }));
  }, []);

  // Tek filtre temizle
  const clearFilter = useCallback((key: keyof GlobalFilters) => {
    if (key === '_diaAutoFilters') return; // Zorunlu filtreler temizlenemez
    setFilters(prev => ({ ...prev, [key]: defaultGlobalFilters[key] }));
  }, []);

  // Sayfa yapılandırması değiştir
  const setPageConfig = useCallback((config: PageFilterConfig | null) => {
    setPageConfigState(config);
  }, []);

  // Filtre seçeneklerini güncelle
  const setFilterOptions = useCallback((options: Partial<FilterOptions>) => {
    setFilterOptionsState(prev => ({ ...prev, ...options }));
  }, []);

  // DIA auto filters ayarla
  const setDiaAutoFilters = useCallback((autoFilters: DiaAutoFilter[]) => {
    setFilters(prev => ({ ...prev, _diaAutoFilters: autoFilters }));
  }, []);

  // Preset kaydet
  const savePreset = useCallback(async (name: string) => {
    if (!user) return;

    try {
      // Zorunlu filtreleri preset'e kaydetme
      const filtersToSave = { ...filters, _diaAutoFilters: [] };
      
      const insertData = {
        user_id: user.id,
        page_id: pageId || null,
        name,
        filters: JSON.parse(JSON.stringify(filtersToSave)),
        is_default: false,
      };
      
      const { data, error } = await supabase
        .from('page_filter_presets')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPresets(prev => [{
          id: data.id,
          userId: data.user_id,
          pageId: data.page_id,
          name: data.name,
          filters: data.filters as Partial<GlobalFilters>,
          isDefault: data.is_default || false,
          createdAt: data.created_at,
        }, ...prev]);
      }
    } catch (error) {
      console.error('Error saving filter preset:', error);
      throw error;
    }
  }, [user, pageId, filters]);

  // Preset yükle
  const loadPreset = useCallback((preset: FilterPreset) => {
    setFilters(prev => ({
      ...defaultGlobalFilters,
      ...preset.filters,
      _diaAutoFilters: prev._diaAutoFilters, // Zorunlu filtreleri koru
    }));
  }, []);

  // Preset sil
  const deletePreset = useCallback(async (presetId: string) => {
    try {
      const { error } = await supabase
        .from('page_filter_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;

      setPresets(prev => prev.filter(p => p.id !== presetId));
    } catch (error) {
      console.error('Error deleting filter preset:', error);
      throw error;
    }
  }, []);

  // Aktif filtre sayısı
  const activeFilterCount = 
    filters.cariTipi.length +
    filters.cariKartTipi.length +
    filters.ozelkod1.length +
    filters.ozelkod2.length +
    filters.ozelkod3.length +
    filters.sehir.length +
    filters.satisTemsilcisi.length +
    filters.sube.length +
    filters.depo.length +
    filters.urunGrubu.length +
    filters.marka.length +
    filters.kategori.length +
    (filters.tarihAraligi && filters.tarihAraligi.period !== 'all' ? 1 : 0) +
    (filters.vadeDilimi ? 1 : 0) +
    (filters.durum !== 'hepsi' ? 1 : 0) +
    (filters.gorunumModu !== 'hepsi' ? 1 : 0) +
    (filters.searchTerm ? 1 : 0);

  // Filtreleme aktif mi?
  const isFiltering = activeFilterCount > 0 || filters._diaAutoFilters.length > 0;

  // DIA API formatına dönüştür
  const toDiaFilters = useCallback((): DiaApiFilter[] => {
    return convertToDiaFilters(filters);
  }, [filters]);

  return (
    <GlobalFilterContext.Provider value={{
      filters,
      filterOptions,
      pageConfig,
      setFilter,
      toggleArrayFilter,
      clearFilters,
      clearFilter,
      setPageConfig,
      setFilterOptions,
      setDiaAutoFilters,
      presets,
      savePreset,
      loadPreset,
      deletePreset,
      activeFilterCount,
      isFiltering,
      toDiaFilters,
    }}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilters() {
  const context = useContext(GlobalFilterContext);
  if (context === undefined) {
    throw new Error('useGlobalFilters must be used within a GlobalFilterProvider');
  }
  return context;
}

// Backward compat - eski DashboardFilterContext'i kullanan bileşenler için
export { GlobalFilterContext };
