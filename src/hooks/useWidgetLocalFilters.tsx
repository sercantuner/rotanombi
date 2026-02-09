// useWidgetLocalFilters - Widget bazlı filtre yükleme ve kaydetme hook'u
// user_widget_filters tablosundan widget+kullanıcı bazında filtre saklar

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WidgetLocalFilters {
  // Tarih
  tarihAraligi?: {
    period: string;
    field?: string;
    customStart?: string;
    customEnd?: string;
  };
  // Cari
  cariKartTipi?: string[];
  gorunumModu?: 'hepsi' | 'cari' | 'potansiyel';
  durum?: 'hepsi' | 'aktif' | 'pasif';
  // Organizasyon
  satisTemsilcisi?: string[];
  sube?: string[];
  depo?: string[];
  // Özel kodlar
  ozelkod1?: string[];
  ozelkod2?: string[];
  ozelkod3?: string[];
  // Arama
  searchTerm?: string;
  // Şehir
  sehir?: string[];
  // Ürün
  urunGrubu?: string[];
  marka?: string[];
  kategori?: string[];
}

export const DEFAULT_WIDGET_FILTERS: WidgetLocalFilters = {};

interface UseWidgetLocalFiltersOptions {
  widgetId: string; // container_widget ID veya widget key
  enabled?: boolean;
}

export function useWidgetLocalFilters({ widgetId, enabled = true }: UseWidgetLocalFiltersOptions) {
  const { user } = useAuth();
  const [filters, setFiltersState] = useState<WidgetLocalFilters>(DEFAULT_WIDGET_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isLoadedRef = useRef(false);

  // Filtreleri veritabanından yükle
  useEffect(() => {
    if (!user?.id || !widgetId || !enabled) {
      setIsLoading(false);
      return;
    }

    const loadFilters = async () => {
      try {
        const { data, error } = await supabase
          .from('user_widget_filters')
          .select('filters')
          .eq('user_id', user.id)
          .eq('widget_id', widgetId)
          .maybeSingle();

        if (error) {
          console.error('[WidgetLocalFilters] Error loading:', error);
        } else if (data?.filters) {
          setFiltersState(data.filters as unknown as WidgetLocalFilters);
        }
      } catch (err) {
        console.error('[WidgetLocalFilters] Load error:', err);
      } finally {
        setIsLoading(false);
        isLoadedRef.current = true;
      }
    };

    loadFilters();
  }, [user?.id, widgetId, enabled]);

  // Debounced kaydetme
  const saveFilters = useCallback(async (newFilters: WidgetLocalFilters) => {
    if (!user?.id || !widgetId) return;

    try {
      setIsSaving(true);
      await supabase
        .from('user_widget_filters')
        .upsert({
          user_id: user.id,
          widget_id: widgetId,
          filters: newFilters as any,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,widget_id',
        });
    } catch (err) {
      console.error('[WidgetLocalFilters] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, widgetId]);

  // Filtre değiştir ve otomatik kaydet (debounced)
  const setFilters = useCallback((newFilters: WidgetLocalFilters | ((prev: WidgetLocalFilters) => WidgetLocalFilters)) => {
    setFiltersState(prev => {
      const resolved = typeof newFilters === 'function' ? newFilters(prev) : newFilters;
      
      // Debounced save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveFilters(resolved);
      }, 800);
      
      return resolved;
    });
  }, [saveFilters]);

  // Tek filtre alanını değiştir
  const setFilter = useCallback(<K extends keyof WidgetLocalFilters>(key: K, value: WidgetLocalFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, [setFilters]);

  // Filtreleri sıfırla
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_WIDGET_FILTERS);
  }, [setFilters]);

  // Aktif filtre sayısı
  const activeFilterCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (value === undefined || value === null) return count;
    if (Array.isArray(value) && value.length === 0) return count;
    if (value === 'hepsi') return count;
    if (key === 'tarihAraligi' && (value as any)?.period === 'all') return count;
    if (typeof value === 'string' && !value.trim()) return count;
    return count + 1;
  }, 0);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return {
    filters,
    setFilters,
    setFilter,
    resetFilters,
    isLoading,
    isSaving,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
  };
}
