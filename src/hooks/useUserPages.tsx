// User Pages Hook - Kullanıcı sayfaları yönetimi

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserPage, PageContainer, ContainerWidget, ContainerType } from '@/lib/pageTypes';
import { toast } from 'sonner';

export function useUserPages() {
  const { user } = useAuth();
  const [pages, setPages] = useState<UserPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Varsayılan widget'ları kullanıcıya ekle
  const initializeDefaultWidgets = useCallback(async (userId: string, mainPageId: string) => {
    try {
      // Varsayılan widget'ları çek
      const { data: defaultWidgets, error: widgetsError } = await supabase
        .from('widgets')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .order('default_sort_order', { ascending: true });

      if (widgetsError || !defaultWidgets?.length) {
        console.log('[DefaultWidgets] No default widgets found');
        return;
      }

      console.log(`[DefaultWidgets] Found ${defaultWidgets.length} default widgets`);

      // KPI row konteyner oluştur
      const { data: container, error: containerError } = await supabase
        .from('page_containers')
        .insert({
          page_id: mainPageId,
          container_type: 'kpi_row_5',
          title: 'Genel Bakış',
          sort_order: 0,
        })
        .select()
        .single();

      if (containerError || !container) {
        console.error('Error creating default container:', containerError);
        return;
      }

      // Widget'ları konteynere ekle
      const widgetInserts = defaultWidgets.slice(0, 5).map((widget, idx) => ({
        container_id: container.id,
        widget_id: widget.id,
        slot_index: idx,
      }));

      const { error: cwError } = await supabase
        .from('container_widgets')
        .insert(widgetInserts);

      if (cwError) {
        console.error('Error inserting default widgets:', cwError);
      } else {
        console.log(`[DefaultWidgets] Added ${widgetInserts.length} widgets to container`);
      }
    } catch (error) {
      console.error('Error initializing default widgets:', error);
    }
  }, []);

  // Sayfaları yükle
  const loadPages = useCallback(async () => {
    if (!user) {
      setPages([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_pages')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      const userPages = (data as unknown as UserPage[]) || [];
      
      // Eğer kullanıcının hiç sayfası yoksa, main-dashboard oluştur ve varsayılan widget'ları ekle
      if (userPages.length === 0 && !isInitialized) {
        console.log('[UserPages] No pages found, creating main-dashboard with defaults...');
        
        const { data: newPage, error: createError } = await supabase
          .from('user_pages')
          .insert({
            user_id: user.id,
            name: 'Ana Dashboard',
            slug: 'main-dashboard',
            icon: 'LayoutDashboard',
            sort_order: 0,
          })
          .select()
          .single();

        if (!createError && newPage) {
          setPages([newPage as unknown as UserPage]);
          setIsInitialized(true);
          
          // Varsayılan widget'ları ekle
          await initializeDefaultWidgets(user.id, newPage.id);
        }
      } else {
        setPages(userPages);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isInitialized, initializeDefaultWidgets]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Sayfa oluştur
  const createPage = async (name: string, icon: string = 'LayoutDashboard') => {
    if (!user) return null;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      const { data, error } = await supabase
        .from('user_pages')
        .insert({
          user_id: user.id,
          name,
          slug: `${slug}-${Date.now()}`,
          icon,
          sort_order: pages.length,
        })
        .select()
        .single();

      if (error) throw error;

      const newPage = data as unknown as UserPage;
      setPages(prev => [...prev, newPage]);
      toast.success('Sayfa oluşturuldu');
      return newPage;
    } catch (error: any) {
      console.error('Error creating page:', error);
      toast.error('Sayfa oluşturulamadı');
      return null;
    }
  };

  // Sayfa güncelle
  const updatePage = async (pageId: string, updates: Partial<UserPage>) => {
    try {
      const { error } = await supabase
        .from('user_pages')
        .update(updates)
        .eq('id', pageId);

      if (error) throw error;

      setPages(prev => prev.map(p => p.id === pageId ? { ...p, ...updates } : p));
      toast.success('Sayfa güncellendi');
    } catch (error) {
      console.error('Error updating page:', error);
      toast.error('Sayfa güncellenemedi');
    }
  };

  // Sayfa sil
  const deletePage = async (pageId: string) => {
    try {
      const { error } = await supabase
        .from('user_pages')
        .delete()
        .eq('id', pageId);

      if (error) throw error;

      setPages(prev => prev.filter(p => p.id !== pageId));
      toast.success('Sayfa silindi');
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error('Sayfa silinemedi');
    }
  };

  return {
    pages,
    isLoading,
    createPage,
    updatePage,
    deletePage,
    refreshPages: loadPages,
  };
}

// Container Hook
export function usePageContainers(pageId: string | null) {
  const [containers, setContainers] = useState<PageContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadContainers = useCallback(async () => {
    if (!pageId) {
      setContainers([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('page_containers')
        .select('*')
        .eq('page_id', pageId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setContainers((data as unknown as PageContainer[]) || []);
    } catch (error) {
      console.error('Error loading containers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  // Konteyner ekle
  const addContainer = async (containerType: ContainerType, title?: string) => {
    if (!pageId) return null;

    try {
      const { data, error } = await supabase
        .from('page_containers')
        .insert({
          page_id: pageId,
          container_type: containerType,
          title,
          sort_order: containers.length,
        })
        .select()
        .single();

      if (error) throw error;

      const newContainer = data as unknown as PageContainer;
      setContainers(prev => [...prev, newContainer]);
      return newContainer;
    } catch (error) {
      console.error('Error adding container:', error);
      toast.error('Konteyner eklenemedi');
      return null;
    }
  };

  // Konteyner sil
  const deleteContainer = async (containerId: string) => {
    try {
      const { error } = await supabase
        .from('page_containers')
        .delete()
        .eq('id', containerId);

      if (error) throw error;

      setContainers(prev => prev.filter(c => c.id !== containerId));
      toast.success('Konteyner silindi');
    } catch (error) {
      console.error('Error deleting container:', error);
      toast.error('Konteyner silinemedi');
    }
  };

  // Konteyner sırasını güncelle
  const reorderContainers = async (containerIds: string[]) => {
    try {
      const updates = containerIds.map((id, index) => 
        supabase
          .from('page_containers')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);

      setContainers(prev => {
        const reordered = containerIds.map(id => prev.find(c => c.id === id)!).filter(Boolean);
        return reordered;
      });
    } catch (error) {
      console.error('Error reordering containers:', error);
    }
  };

  return {
    containers,
    isLoading,
    addContainer,
    deleteContainer,
    reorderContainers,
    refreshContainers: loadContainers,
  };
}

// Container Widgets Hook
export function useContainerWidgets(containerId: string | null) {
  const [widgets, setWidgets] = useState<ContainerWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWidgets = useCallback(async () => {
    if (!containerId) {
      setWidgets([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('container_widgets')
        .select('*')
        .eq('container_id', containerId)
        .order('slot_index', { ascending: true });

      if (error) throw error;
      setWidgets((data as unknown as ContainerWidget[]) || []);
    } catch (error) {
      console.error('Error loading container widgets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    loadWidgets();
  }, [loadWidgets]);

  // Widget ekle
  const addWidget = async (widgetId: string, slotIndex: number) => {
    if (!containerId) return null;

    try {
      const { data, error } = await supabase
        .from('container_widgets')
        .insert({
          container_id: containerId,
          widget_id: widgetId,
          slot_index: slotIndex,
        })
        .select()
        .single();

      if (error) throw error;

      const newWidget = data as unknown as ContainerWidget;
      setWidgets(prev => [...prev, newWidget]);
      return newWidget;
    } catch (error) {
      console.error('Error adding widget:', error);
      toast.error('Widget eklenemedi');
      return null;
    }
  };

  // Widget kaldır
  const removeWidget = async (widgetId: string) => {
    try {
      const { error } = await supabase
        .from('container_widgets')
        .delete()
        .eq('id', widgetId);

      if (error) throw error;

      setWidgets(prev => prev.filter(w => w.id !== widgetId));
    } catch (error) {
      console.error('Error removing widget:', error);
    }
  };

  return {
    widgets,
    isLoading,
    addWidget,
    removeWidget,
    refreshWidgets: loadWidgets,
  };
}
