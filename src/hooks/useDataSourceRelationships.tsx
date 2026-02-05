// useDataSourceRelationships - Veri kaynakları arası ilişki yönetimi

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// İlişki tipi
export type RelationshipType = 'one_to_many' | 'many_to_one' | 'one_to_one';

// Çapraz filtre yönü
export type CrossFilterDirection = 'single' | 'both' | 'none';

// Veri kaynağı ilişkisi
export interface DataSourceRelationship {
  id: string;
  source_data_source_id: string;
  target_data_source_id: string;
  source_field: string;
  target_field: string;
  relationship_type: RelationshipType;
  cross_filter_direction: CrossFilterDirection;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Form verisi
export interface RelationshipFormData {
  source_data_source_id: string;
  target_data_source_id: string;
  source_field: string;
  target_field: string;
  relationship_type?: RelationshipType;
  cross_filter_direction?: CrossFilterDirection;
  is_active?: boolean;
}

export function useDataSourceRelationships() {
  const queryClient = useQueryClient();

  // Tüm ilişkileri çek
  const { data: relationships, isLoading, error, refetch } = useQuery({
    queryKey: ['data-source-relationships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_source_relationships')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as DataSourceRelationship[];
    },
  });

  // Yeni ilişki oluştur
  const createMutation = useMutation({
    mutationFn: async (formData: RelationshipFormData) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user.id) throw new Error('Oturum bulunamadı');

      const { data, error } = await supabase
        .from('data_source_relationships')
        .insert({
          source_data_source_id: formData.source_data_source_id,
          target_data_source_id: formData.target_data_source_id,
          source_field: formData.source_field,
          target_field: formData.target_field,
          relationship_type: formData.relationship_type || 'one_to_many',
          cross_filter_direction: formData.cross_filter_direction || 'single',
          is_active: formData.is_active ?? true,
          user_id: session.session.user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-source-relationships'] });
      toast.success('İlişki oluşturuldu');
    },
    onError: (error: any) => {
      if (error.message?.includes('unique_relationship')) {
        toast.error('Bu ilişki zaten mevcut');
      } else {
        toast.error(`Hata: ${error.message}`);
      }
    },
  });

  // İlişki güncelle
  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<RelationshipFormData> }) => {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      if (formData.source_field !== undefined) updateData.source_field = formData.source_field;
      if (formData.target_field !== undefined) updateData.target_field = formData.target_field;
      if (formData.relationship_type !== undefined) updateData.relationship_type = formData.relationship_type;
      if (formData.cross_filter_direction !== undefined) updateData.cross_filter_direction = formData.cross_filter_direction;
      if (formData.is_active !== undefined) updateData.is_active = formData.is_active;

      const { data, error } = await supabase
        .from('data_source_relationships')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-source-relationships'] });
      toast.success('İlişki güncellendi');
    },
    onError: (error: any) => {
      toast.error(`Hata: ${error.message}`);
    },
  });

  // İlişki sil
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('data_source_relationships')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-source-relationships'] });
      toast.success('İlişki silindi');
    },
    onError: (error: any) => {
      toast.error(`Hata: ${error.message}`);
    },
  });

  // Belirli bir veri kaynağının ilişkilerini bul
  const getRelationshipsForDataSource = useCallback((dataSourceId: string) => {
    return relationships?.filter(
      r => r.source_data_source_id === dataSourceId || r.target_data_source_id === dataSourceId
    ) || [];
  }, [relationships]);

  // İki veri kaynağı arasındaki ilişkileri bul
  const getRelationshipsBetween = useCallback((sourceId: string, targetId: string) => {
    return relationships?.filter(
      r => (r.source_data_source_id === sourceId && r.target_data_source_id === targetId) ||
           (r.source_data_source_id === targetId && r.target_data_source_id === sourceId)
    ) || [];
  }, [relationships]);

  // Aktif ilişkiler
  const activeRelationships = useMemo(() => {
    return relationships?.filter(r => r.is_active) || [];
  }, [relationships]);

  return {
    relationships: relationships || [],
    activeRelationships,
    isLoading,
    error,
    refetch,
    createRelationship: createMutation.mutateAsync,
    updateRelationship: (id: string, formData: Partial<RelationshipFormData>) => 
      updateMutation.mutateAsync({ id, formData }),
    deleteRelationship: deleteMutation.mutateAsync,
    getRelationshipsForDataSource,
    getRelationshipsBetween,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
