// useWidgetCategories / useWidgetTags - Dinamik widget etiketleri yönetimi
// Terminoloji: Kategori yerine Etiket (Tag) sistemi

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Etiket tipi (eski WidgetCategory adı korunuyor geriye uyumluluk için)
export interface WidgetCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Alias: Etiket sistemi için
export type WidgetTag = WidgetCategory;

export interface WidgetCategoryFormData {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
  is_active?: boolean;
}

// Alias: Etiket sistemi için
export type WidgetTagFormData = WidgetCategoryFormData;

export function useWidgetCategories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Kategorileri çek
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['widget-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('widget_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as WidgetCategory[];
    },
  });

  // Yeni kategori oluştur
  const createMutation = useMutation({
    mutationFn: async (formData: WidgetCategoryFormData) => {
      const { data, error } = await supabase
        .from('widget_categories')
        .insert({
          slug: formData.slug,
          name: formData.name,
          description: formData.description || null,
          icon: formData.icon || 'Folder',
          color: formData.color || null,
          sort_order: formData.sort_order || 0,
          is_active: formData.is_active ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-categories'] });
      toast.success('Kategori oluşturuldu');
    },
    onError: (error) => {
      console.error('Kategori oluşturma hatası:', error);
      toast.error('Kategori oluşturulamadı');
    },
  });

  // Kategori güncelle
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WidgetCategoryFormData> }) => {
      const { error } = await supabase
        .from('widget_categories')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-categories'] });
      toast.success('Kategori güncellendi');
    },
    onError: (error) => {
      console.error('Kategori güncelleme hatası:', error);
      toast.error('Kategori güncellenemedi');
    },
  });

  // Kategori sil
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('widget_categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget-categories'] });
      toast.success('Kategori silindi');
    },
    onError: (error) => {
      console.error('Kategori silme hatası:', error);
      toast.error('Kategori silinemedi');
    },
  });

  // Aktif kategoriler
  const activeCategories = (data || []).filter(c => c.is_active);

  // Slug ile kategori bul
  const getCategoryBySlug = (slug: string) => {
    return data?.find(c => c.slug === slug);
  };

  // Kategori listesi (Select için)
  const categoryOptions = activeCategories.map(c => ({
    id: c.slug,
    name: c.name,
    icon: c.icon,
  }));

  return {
    // Geriye uyumluluk için eski isimler
    categories: data || [],
    activeCategories,
    categoryOptions,
    getCategoryBySlug,
    createCategory: createMutation.mutateAsync,
    updateCategory: (id: string, data: Partial<WidgetCategoryFormData>) => 
      updateMutation.mutateAsync({ id, data }),
    deleteCategory: deleteMutation.mutateAsync,
    
    // Yeni etiket sistemi için alias'lar
    tags: data || [],
    activeTags: activeCategories,
    tagOptions: categoryOptions,
    getTagBySlug: getCategoryBySlug,
    createTag: createMutation.mutateAsync,
    updateTag: (id: string, data: Partial<WidgetCategoryFormData>) => 
      updateMutation.mutateAsync({ id, data }),
    deleteTag: deleteMutation.mutateAsync,
    
    // Ortak
    isLoading,
    error,
    refetch,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// Alias: Etiket hook'u
export const useWidgetTags = useWidgetCategories;
