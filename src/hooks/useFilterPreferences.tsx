// useFilterPreferences - Kullanıcı filtre tercihlerini yönetir
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Filtre tanımı tipi
export interface FilterDefinition {
  key: string;
  label: string;
  icon: string;
  locked?: boolean;
}

// Tüm kullanılabilir filtreler
export const ALL_AVAILABLE_FILTERS: FilterDefinition[] = [
  { key: 'tarihAraligi', label: 'Tarih Aralığı', icon: 'Calendar', locked: true },
  { key: 'satisTemsilcisi', label: 'Satış Temsilcisi', icon: 'Users', locked: false },
  { key: 'cariKartTipi', label: 'Kart Tipi (AL/AS/ST)', icon: 'Tag', locked: false },
  { key: 'sube', label: 'Şube', icon: 'Building2', locked: false },
  { key: 'depo', label: 'Depo', icon: 'Warehouse', locked: false },
  { key: 'ozelkod1', label: 'Özel Kod 1', icon: 'Hash', locked: false },
  { key: 'ozelkod2', label: 'Özel Kod 2', icon: 'Hash', locked: false },
  { key: 'ozelkod3', label: 'Özel Kod 3', icon: 'Hash', locked: false },
  { key: 'sehir', label: 'Şehir', icon: 'MapPin', locked: false },
  { key: 'durum', label: 'Durum (Aktif/Pasif)', icon: 'ToggleLeft', locked: false },
  { key: 'gorunumModu', label: 'Görünüm Modu', icon: 'Eye', locked: false },
];

// Varsayılan görünür filtreler
export const DEFAULT_VISIBLE_FILTERS = ['satisTemsilcisi', 'cariKartTipi'];
export const DEFAULT_FILTER_ORDER = ['tarihAraligi', 'satisTemsilcisi', 'cariKartTipi'];

export interface FilterPreferences {
  visibleFilters: string[];
  filterOrder: string[];
}

export function useFilterPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<FilterPreferences>({
    visibleFilters: DEFAULT_VISIBLE_FILTERS,
    filterOrder: DEFAULT_FILTER_ORDER,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Tercihleri yükle
  useEffect(() => {
    async function loadPreferences() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_filter_preferences')
          .select('visible_filters, filter_order')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading filter preferences:', error);
        }

        if (data) {
          setPreferences({
            visibleFilters: data.visible_filters || DEFAULT_VISIBLE_FILTERS,
            filterOrder: data.filter_order || DEFAULT_FILTER_ORDER,
          });
        }
      } catch (err) {
        console.error('Error loading filter preferences:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  // Tercihleri kaydet
  const savePreferences = useCallback(async (newPrefs: FilterPreferences) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_filter_preferences')
        .upsert({
          user_id: user.id,
          visible_filters: newPrefs.visibleFilters,
          filter_order: newPrefs.filterOrder,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setPreferences(newPrefs);
    } catch (err) {
      console.error('Error saving filter preferences:', err);
      throw err;
    }
  }, [user]);

  // Tek filtre ekle/kaldır
  const toggleFilter = useCallback(async (filterKey: string) => {
    const newVisibleFilters = preferences.visibleFilters.includes(filterKey)
      ? preferences.visibleFilters.filter(f => f !== filterKey)
      : [...preferences.visibleFilters, filterKey];
    
    const newPrefs = {
      ...preferences,
      visibleFilters: newVisibleFilters,
    };
    
    await savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  // Filtre görünür mü?
  const isFilterVisible = useCallback((filterKey: string) => {
    // tarihAraligi her zaman görünür (locked)
    if (filterKey === 'tarihAraligi') return true;
    return preferences.visibleFilters.includes(filterKey);
  }, [preferences.visibleFilters]);

  return {
    preferences,
    isLoading,
    savePreferences,
    toggleFilter,
    isFilterVisible,
    allFilters: ALL_AVAILABLE_FILTERS,
  };
}
