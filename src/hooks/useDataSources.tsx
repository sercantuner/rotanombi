// useDataSources - Merkezi Veri Kaynakları Yönetimi

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DiaApiFilter, DiaApiSort, PeriodConfig } from '@/lib/widgetBuilderTypes';

// Veri kaynağı tipi
export interface DataSource {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  
  // DIA API Konfigürasyonu
  module: string;
  method: string;
  filters: DiaApiFilter[];
  sorts: DiaApiSort[];
  selected_columns: string[] | null;
  limit_count: number;
  
  // Dönem yapılandırması
  period_config: PeriodConfig | null;
  
  // Önbellek ayarları
  cache_ttl: number;
  auto_refresh: boolean;
  refresh_schedule: string | null;
  
  // Son çalışma bilgisi
  last_fetched_at: string | null;
  last_record_count: number | null;
  last_fields: string[] | null;
  last_sample_data: any[] | null; // Filtreleme için örnek veriler
  
  is_active: boolean;
  is_shared: boolean;
  
  created_at: string;
  updated_at: string;
}

// Form verisi
export interface DataSourceFormData {
  name: string;
  slug: string;
  description?: string;
  module: string;
  method: string;
  filters?: DiaApiFilter[];
  sorts?: DiaApiSort[];
  selected_columns?: string[];
  limit_count?: number;
  period_config?: PeriodConfig;
  cache_ttl?: number;
  auto_refresh?: boolean;
  refresh_schedule?: string;
  is_active?: boolean;
  is_shared?: boolean;
}

export function useDataSources() {
  const queryClient = useQueryClient();

  // Tüm veri kaynaklarını çek
  const { data: dataSources, isLoading, error, refetch } = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // JSONB alanlarını dönüştür
      return (data || []).map(ds => ({
        ...ds,
        filters: (ds.filters as unknown as DiaApiFilter[]) || [],
        sorts: (ds.sorts as unknown as DiaApiSort[]) || [],
        period_config: ds.period_config as unknown as PeriodConfig | null,
        last_fields: ds.last_fields as unknown as string[] | null,
        last_sample_data: (ds as any).last_sample_data as any[] | null,
      })) as DataSource[];
    },
  });

  // Yeni veri kaynağı oluştur
  const createMutation = useMutation({
    mutationFn: async (formData: DataSourceFormData) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user.id) throw new Error('Oturum bulunamadı');

      const { data, error } = await supabase
        .from('data_sources')
        .insert({
          user_id: session.session.user.id,
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          module: formData.module,
          method: formData.method,
          filters: JSON.parse(JSON.stringify(formData.filters || [])),
          sorts: JSON.parse(JSON.stringify(formData.sorts || [])),
          selected_columns: formData.selected_columns || null,
          limit_count: formData.limit_count || 0,
          period_config: formData.period_config ? JSON.parse(JSON.stringify(formData.period_config)) : null,
          cache_ttl: formData.cache_ttl || 300,
          auto_refresh: formData.auto_refresh || false,
          refresh_schedule: formData.refresh_schedule || null,
          is_active: formData.is_active ?? true,
          is_shared: formData.is_shared ?? false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Veri kaynağı oluşturuldu');
    },
    onError: (error: any) => {
      toast.error(`Hata: ${error.message}`);
    },
  });

  // Veri kaynağı güncelle
  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<DataSourceFormData> }) => {
      // JSONB uyumlu olması için dönüşüm
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      if (formData.name !== undefined) updateData.name = formData.name;
      if (formData.slug !== undefined) updateData.slug = formData.slug;
      if (formData.description !== undefined) updateData.description = formData.description;
      if (formData.module !== undefined) updateData.module = formData.module;
      if (formData.method !== undefined) updateData.method = formData.method;
      if (formData.filters !== undefined) updateData.filters = JSON.parse(JSON.stringify(formData.filters));
      if (formData.sorts !== undefined) updateData.sorts = JSON.parse(JSON.stringify(formData.sorts));
      if (formData.selected_columns !== undefined) updateData.selected_columns = formData.selected_columns;
      if (formData.limit_count !== undefined) updateData.limit_count = formData.limit_count;
      if (formData.period_config !== undefined) updateData.period_config = JSON.parse(JSON.stringify(formData.period_config));
      if (formData.cache_ttl !== undefined) updateData.cache_ttl = formData.cache_ttl;
      if (formData.auto_refresh !== undefined) updateData.auto_refresh = formData.auto_refresh;
      if (formData.refresh_schedule !== undefined) updateData.refresh_schedule = formData.refresh_schedule;
      if (formData.is_active !== undefined) updateData.is_active = formData.is_active;
      if (formData.is_shared !== undefined) updateData.is_shared = formData.is_shared;

      const { data, error } = await supabase
        .from('data_sources')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Veri kaynağı güncellendi');
    },
    onError: (error: any) => {
      toast.error(`Hata: ${error.message}`);
    },
  });

  // Veri kaynağı sil
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('data_sources')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Veri kaynağı silindi');
    },
    onError: (error: any) => {
      toast.error(`Hata: ${error.message}`);
    },
  });

  // Son çalışma bilgisini güncelle (opsiyonel örnek veri dahil)
  const updateLastFetch = useCallback(async (
    id: string, 
    recordCount: number, 
    fields: string[], 
    sampleData?: any[]
  ) => {
    const updatePayload: Record<string, any> = {
      last_fetched_at: new Date().toISOString(),
      last_record_count: recordCount,
      last_fields: fields,
    };
    
    // Örnek veriyi kaydet (filtreleme için benzersiz değer önerileri)
    if (sampleData && sampleData.length > 0) {
      // Max 100 kayıt sakla (performans için)
      updatePayload.last_sample_data = sampleData.slice(0, 100);
    }
    
    await supabase
      .from('data_sources')
      .update(updatePayload)
      .eq('id', id);
      
    // Cache'i güncelle
    queryClient.invalidateQueries({ queryKey: ['data-sources'] });
  }, [queryClient]);

  // Slug'dan ID bul
  const getDataSourceBySlug = useCallback((slug: string) => {
    return dataSources?.find(ds => ds.slug === slug);
  }, [dataSources]);

  // ID'den veri kaynağı bul
  const getDataSourceById = useCallback((id: string) => {
    return dataSources?.find(ds => ds.id === id);
  }, [dataSources]);

  // Aktif veri kaynakları
  const activeDataSources = useMemo(() => {
    return dataSources?.filter(ds => ds.is_active) || [];
  }, [dataSources]);

  return {
    dataSources: dataSources || [],
    activeDataSources,
    isLoading,
    error,
    refetch,
    createDataSource: createMutation.mutateAsync,
    updateDataSource: (id: string, formData: Partial<DataSourceFormData>) => 
      updateMutation.mutateAsync({ id, formData }),
    deleteDataSource: deleteMutation.mutateAsync,
    updateLastFetch,
    getDataSourceBySlug,
    getDataSourceById,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
