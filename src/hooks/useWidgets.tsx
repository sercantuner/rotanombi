// useWidgets Hook - Veritabanından widget listesini çeker ve yönetir

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Widget, WidgetCategory, WidgetFormData, PageLayout, WidgetLayout } from '@/lib/widgetTypes';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useWidgets() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Widget listesini çek (widget_tags ile birlikte)
  const fetchWidgets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Widget'ları ve etiketlerini çek
      const { data, error: fetchError } = await supabase
        .from('widgets')
        .select(`
          *,
          widget_tags (
            category_id,
            widget_categories!inner (
              slug,
              name,
              icon
            )
          )
        `)
        .order('sort_order', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Map database response to Widget type
      const mappedWidgets: Widget[] = (data || []).map((w: any) => {
        // Etiketleri ayıkla
        const tags = (w.widget_tags || [])
          .map((wt: any) => wt.widget_categories?.slug)
          .filter(Boolean);
        
        return {
          id: w.id,
          widget_key: w.widget_key,
          name: w.name,
          description: w.description,
          category: w.category as WidgetCategory,
          type: w.type,
          data_source: w.data_source,
          size: w.size,
          icon: w.icon,
          default_page: w.default_page as WidgetCategory,
          default_visible: w.default_visible,
          available_filters: Array.isArray(w.available_filters) ? w.available_filters : [],
          default_filters: w.default_filters || {},
          min_height: w.min_height,
          grid_cols: w.grid_cols,
          is_active: w.is_active,
          sort_order: w.sort_order,
          created_at: w.created_at,
          updated_at: w.updated_at,
          created_by: w.created_by,
          builder_config: w.builder_config || null,
          tags: tags.length > 0 ? tags : [w.category], // Etiket yoksa eski category kullan
          // AI Metadata alanları
          short_description: w.short_description || null,
          long_description: w.long_description || null,
          technical_notes: w.technical_notes || null,
          preview_image: w.preview_image || null,
          ai_suggested_tags: w.ai_suggested_tags || null,
        };
      });

      setWidgets(mappedWidgets);
    } catch (err) {
      console.error('Error fetching widgets:', err);
      setError('Widget listesi yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  // Widget'ı key ile bul
  const getWidgetByKey = useCallback((widgetKey: string): Widget | undefined => {
    return widgets.find(w => w.widget_key === widgetKey);
  }, [widgets]);

  // Kategoriye/etikete göre widget'ları getir
  const getWidgetsByCategory = useCallback((category: WidgetCategory): Widget[] => {
    return widgets.filter(w => 
      w.is_active && (w.category === category || w.tags?.includes(category))
    );
  }, [widgets]);

  // Etikete göre widget'ları getir (çoklu etiket desteği)
  const getWidgetsByTag = useCallback((tag: string): Widget[] => {
    return widgets.filter(w => w.is_active && w.tags?.includes(tag));
  }, [widgets]);

  // Varsayılan sayfaya göre widget'ları getir
  const getWidgetsByDefaultPage = useCallback((page: WidgetCategory): Widget[] => {
    return widgets.filter(w => w.default_page === page && w.is_active);
  }, [widgets]);

  // Sayfa için varsayılan layout oluştur
  const getDefaultLayoutForPage = useCallback((page: WidgetCategory): PageLayout => {
    const pageWidgets = widgets
      .filter(w => w.default_page === page && w.default_visible && w.is_active)
      .map((w, index) => ({
        id: w.widget_key,
        visible: true,
        order: index,
        size: w.size,
      }));

    return { widgets: pageWidgets };
  }, [widgets]);

  // Sayfa için kullanılabilir tüm widget'ları getir (etiket bazlı)
  const getAvailableWidgetsForPage = useCallback((page: WidgetCategory): Widget[] => {
    return widgets.filter(w => 
      w.is_active && (
        w.default_page === page || 
        w.category === page || 
        w.tags?.includes(page) ||
        w.category === 'dashboard'
      )
    );
  }, [widgets]);

  return {
    widgets,
    isLoading,
    error,
    refetch: fetchWidgets,
    getWidgetByKey,
    getWidgetsByCategory,
    getWidgetsByTag,
    getWidgetsByDefaultPage,
    getDefaultLayoutForPage,
    getAvailableWidgetsForPage,
  };
}

// Super Admin için widget CRUD işlemleri
export function useWidgetAdmin() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Changelog kaydı oluştur
  const logChange = async (widgetId: string, version: number, changeType: 'created' | 'updated', changeNotes?: string) => {
    try {
      await supabase
        .from('widget_changelog')
        .insert({
          widget_id: widgetId,
          version,
          change_type: changeType,
          change_notes: changeNotes || null,
          changed_by: user?.id,
        });
    } catch (error) {
      console.error('Error logging widget change:', error);
    }
  };

  // Widget oluştur
  const createWidget = async (data: WidgetFormData, changeNotes?: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      const { data: createdWidget, error } = await supabase
        .from('widgets')
        .insert({
          widget_key: data.widget_key,
          name: data.name,
          description: data.description || null,
          category: data.category,
          type: data.type,
          data_source: data.data_source,
          size: data.size,
          icon: data.icon || null,
          default_page: data.default_page,
          default_visible: data.default_visible,
          available_filters: data.available_filters as unknown as any,
          default_filters: data.default_filters as unknown as any,
          min_height: data.min_height || null,
          grid_cols: data.grid_cols,
          is_active: data.is_active,
          sort_order: data.sort_order,
          created_by: user.id,
          builder_config: data.builder_config ? data.builder_config as unknown as any : null,
          version: 1,
          last_change_type: 'created',
          change_notes: changeNotes || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      // Widget etiketlerini kaydet (widget_tags)
      if (createdWidget && data.tags && data.tags.length > 0) {
        await saveWidgetTags(createdWidget.id, data.tags);
      } else if (createdWidget && data.category) {
        // Etiket yoksa varsayılan olarak category'yi kaydet
        await saveWidgetTags(createdWidget.id, [data.category]);
      }
      
      // Changelog kaydı oluştur
      if (createdWidget) {
        await logChange(createdWidget.id, 1, 'created', changeNotes || `${data.name} widget'ı oluşturuldu`);
      }
      
      toast.success('Widget oluşturuldu');
      return true;
    } catch (err) {
      console.error('Error creating widget:', err);
      toast.error('Widget oluşturulamadı');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Eksik etiketleri widget_categories'e otomatik ekle
  const ensureTagsExist = async (tagSlugs: string[]): Promise<void> => {
    if (!tagSlugs || tagSlugs.length === 0) return;
    
    try {
      // Mevcut etiketleri al
      const { data: existingCategories, error: fetchError } = await supabase
        .from('widget_categories')
        .select('slug')
        .in('slug', tagSlugs);
      
      if (fetchError) throw fetchError;
      
      const existingSlugs = (existingCategories || []).map(c => c.slug);
      const missingSlugs = tagSlugs.filter(slug => !existingSlugs.includes(slug));
      
      // Eksik etiketleri oluştur
      if (missingSlugs.length > 0) {
        // Varsayılan ikon ve isim için mapping
        const iconMap: Record<string, string> = {
          'finans': 'Wallet', 'satis': 'ShoppingCart', 'stok': 'Package',
          'cari': 'Users', 'performans': 'TrendingUp', 'ozet': 'FileText',
          'analiz': 'BarChart3', 'rapor': 'ClipboardCheck', 'grafik': 'LineChart',
          'trend': 'Activity', 'banka': 'Landmark', 'kasa': 'Wallet',
          'nakit': 'Banknote', 'doviz': 'DollarSign', 'cek': 'Receipt',
          'borc-alacak': 'Scale', 'odeme': 'CreditCard', 'yaslandirma': 'Clock',
          'harita': 'Map', 'cografi': 'MapPin', 'depo': 'Warehouse',
          'uyari': 'AlertTriangle', 'kontrol': 'Shield', 'gorev': 'CheckSquare',
          'is-takibi': 'ClipboardList', 'pazarlama': 'Megaphone', 'sektor': 'Building',
          'crm': 'UserCircle', 'nakit-akisi': 'Workflow',
        };
        
        const newCategories = missingSlugs.map((slug, index) => ({
          slug: slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
          icon: iconMap[slug] || 'Tag',
          sort_order: 100 + index,
          is_active: true,
        }));
        
        const { error: insertError } = await supabase
          .from('widget_categories')
          .insert(newCategories);
        
        if (insertError) {
          console.error('Error creating missing tags:', insertError);
        } else {
          console.log(`Created ${missingSlugs.length} new tags:`, missingSlugs);
        }
      }
    } catch (err) {
      console.error('Error ensuring tags exist:', err);
    }
  };

  // Widget etiketlerini kaydet
  const saveWidgetTags = async (widgetId: string, tagSlugs: string[]): Promise<void> => {
    try {
      // Önce eksik etiketleri oluştur
      await ensureTagsExist(tagSlugs);
      
      // Sonra widget_categories'den slug'lara göre id'leri al
      const { data: categories, error: catError } = await supabase
        .from('widget_categories')
        .select('id, slug')
        .in('slug', tagSlugs);
      
      if (catError) throw catError;
      
      // Mevcut etiketleri sil
      await supabase
        .from('widget_tags')
        .delete()
        .eq('widget_id', widgetId);
      
      // Yeni etiketleri ekle
      if (categories && categories.length > 0) {
        const tagInserts = categories.map(cat => ({
          widget_id: widgetId,
          category_id: cat.id,
        }));
        
        const { error: insertError } = await supabase
          .from('widget_tags')
          .insert(tagInserts);
        
        if (insertError) {
          console.error('Error inserting widget tags:', insertError);
        }
      }
    } catch (err) {
      console.error('Error saving widget tags:', err);
    }
  };

  // Widget güncelle
  const updateWidget = async (id: string, data: Partial<WidgetFormData>, changeNotes?: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      // Mevcut widget'ın versiyonunu al
      const { data: currentWidget } = await supabase
        .from('widgets')
        .select('version, name')
        .eq('id', id)
        .single();

      const newVersion = (currentWidget?.version || 1) + 1;
      
      // tags alanını data'dan çıkar (ayrı tablo)
      const { tags, ...restData } = data as WidgetFormData;

      const updateData: any = {
        ...restData,
        updated_at: new Date().toISOString(),
        version: newVersion,
        last_change_type: 'updated',
        change_notes: changeNotes || null,
      };
      
      const { error } = await supabase
        .from('widgets')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      // Widget etiketlerini güncelle (widget_tags)
      if (tags && tags.length > 0) {
        await saveWidgetTags(id, tags);
      }
      
      // Changelog kaydı oluştur
      await logChange(id, newVersion, 'updated', changeNotes || `${currentWidget?.name || 'Widget'} güncellendi`);
      
      toast.success('Widget güncellendi');
      return true;
    } catch (err) {
      console.error('Error updating widget:', err);
      toast.error('Widget güncellenemedi');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Widget sil (soft delete - is_active = false)
  const deleteWidget = async (id: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('widgets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Widget devre dışı bırakıldı');
      return true;
    } catch (err) {
      console.error('Error deleting widget:', err);
      toast.error('Widget silinemedi');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Widget kalıcı olarak sil
  const permanentlyDeleteWidget = async (id: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('widgets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Widget kalıcı olarak silindi');
      return true;
    } catch (err) {
      console.error('Error permanently deleting widget:', err);
      toast.error('Widget silinemedi');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Widget'ı aktif et
  const activateWidget = async (id: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('widgets')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Widget aktifleştirildi');
      return true;
    } catch (err) {
      console.error('Error activating widget:', err);
      toast.error('Widget aktifleştirilemedi');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    createWidget,
    updateWidget,
    deleteWidget,
    permanentlyDeleteWidget,
    activateWidget,
  };
}
