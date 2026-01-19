// User Settings Context - Kullanıcı bazlı widget ve layout ayarları yönetimi

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { 
  WidgetLayout, 
  PageLayout, 
  WidgetFilter, 
  getDefaultLayoutForPage,
  WidgetCategory 
} from '@/lib/widgetRegistry';
import { toast } from 'sonner';

// ============ TYPES ============

interface UserSettings {
  useMockData: boolean;
  isDemoAccount: boolean;
}

interface UserSettingsContextType {
  // Settings
  settings: UserSettings;
  isLoading: boolean;
  
  // Mock data toggle
  useMockData: boolean;
  setUseMockData: (value: boolean) => Promise<void>;
  
  // Layout management
  getPageLayout: (page: WidgetCategory) => PageLayout;
  savePageLayout: (page: WidgetCategory, layout: PageLayout) => Promise<void>;
  resetPageLayout: (page: WidgetCategory) => Promise<void>;
  
  // Widget visibility
  addWidgetToPage: (widgetId: string, page: WidgetCategory) => Promise<void>;
  removeWidgetFromPage: (widgetId: string, page: WidgetCategory) => Promise<void>;
  moveWidgetToPage: (widgetId: string, fromPage: WidgetCategory, toPage: WidgetCategory) => Promise<void>;
  updateWidgetOrder: (page: WidgetCategory, widgetIds: string[]) => Promise<void>;
  
  // Widget filters
  getWidgetFilters: (widgetId: string) => WidgetFilter;
  saveWidgetFilters: (widgetId: string, filters: WidgetFilter) => Promise<void>;
  resetWidgetFilters: (widgetId: string) => Promise<void>;
  
  // Refresh
  refreshSettings: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

// ============ PROVIDER ============

interface UserSettingsProviderProps {
  children: ReactNode;
}

export function UserSettingsProvider({ children }: UserSettingsProviderProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    useMockData: false,
    isDemoAccount: false,
  });
  
  // Layouts per page
  const [layouts, setLayouts] = useState<Record<WidgetCategory, PageLayout>>({
    dashboard: { widgets: [] },
    satis: { widgets: [] },
    finans: { widgets: [] },
    cari: { widgets: [] },
  });
  
  // Widget filters
  const [widgetFilters, setWidgetFilters] = useState<Record<string, WidgetFilter>>({});

  // ============ LOAD SETTINGS ============
  
  const loadSettings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Load profile for demo mode
      const { data: profile } = await supabase
        .from('profiles')
        .select('use_mock_data, is_demo_account')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setSettings({
          useMockData: profile.use_mock_data || false,
          isDemoAccount: profile.is_demo_account || false,
        });
      }

      // Load dashboard layouts
      const { data: layoutData } = await (supabase
        .from('user_dashboard_settings') as any)
        .select('page, layout')
        .eq('user_id', user.id);

      if (layoutData && layoutData.length > 0) {
        const newLayouts = { ...layouts };
        layoutData.forEach((item) => {
          const page = item.page as WidgetCategory;
          if (['dashboard', 'satis', 'finans', 'cari'].includes(page)) {
            newLayouts[page] = item.layout as unknown as PageLayout;
          }
        });
        setLayouts(newLayouts);
      } else {
        // Use defaults if no saved layouts
        setLayouts({
          dashboard: getDefaultLayoutForPage('dashboard'),
          satis: getDefaultLayoutForPage('satis'),
          finans: getDefaultLayoutForPage('finans'),
          cari: getDefaultLayoutForPage('cari'),
        });
      }

      // Load widget filters
      const { data: filterData } = await (supabase
        .from('user_widget_filters') as any)
        .select('widget_id, filters')
        .eq('user_id', user.id);

      if (filterData && filterData.length > 0) {
        const newFilters: Record<string, WidgetFilter> = {};
        filterData.forEach((item) => {
          newFilters[item.widget_id] = item.filters as unknown as WidgetFilter;
        });
        setWidgetFilters(newFilters);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ============ MOCK DATA TOGGLE ============
  
  const setUseMockData = async (value: boolean) => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ use_mock_data: value, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      setSettings(prev => ({ ...prev, useMockData: value }));
      toast.success(value ? 'Demo modu aktif' : 'Demo modu devre dışı');
    } catch (error) {
      console.error('Error updating mock data setting:', error);
      toast.error('Ayar kaydedilemedi');
    }
  };

  // ============ LAYOUT MANAGEMENT ============
  
  const getPageLayout = (page: WidgetCategory): PageLayout => {
    const layout = layouts[page];
    if (!layout || !layout.widgets || layout.widgets.length === 0) {
      return getDefaultLayoutForPage(page);
    }
    return layout;
  };

  const savePageLayout = async (page: WidgetCategory, layout: PageLayout) => {
    if (!user) return;
    
    try {
      // Type assertion needed until Supabase types are regenerated
      await (supabase
        .from('user_dashboard_settings') as any)
        .upsert({
          user_id: user.id,
          page,
          layout: layout as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,page' });

      setLayouts(prev => ({ ...prev, [page]: layout }));
    } catch (error) {
      console.error('Error saving layout:', error);
      toast.error('Layout kaydedilemedi');
    }
  };

  const resetPageLayout = async (page: WidgetCategory) => {
    if (!user) return;
    
    const defaultLayout = getDefaultLayoutForPage(page);
    
    try {
      await (supabase
        .from('user_dashboard_settings') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('page', page);

      setLayouts(prev => ({ ...prev, [page]: defaultLayout }));
      toast.success('Varsayılan layout\'a dönüldü');
    } catch (error) {
      console.error('Error resetting layout:', error);
      toast.error('Layout sıfırlanamadı');
    }
  };

  const addWidgetToPage = async (widgetId: string, page: WidgetCategory) => {
    const currentLayout = getPageLayout(page);
    
    // Check if widget already exists
    if (currentLayout.widgets.some(w => w.id === widgetId)) {
      toast.info('Widget zaten bu sayfada');
      return;
    }
    
    const newLayout: PageLayout = {
      widgets: [
        ...currentLayout.widgets,
        {
          id: widgetId,
          visible: true,
          order: currentLayout.widgets.length,
        },
      ],
    };
    
    await savePageLayout(page, newLayout);
    toast.success('Widget eklendi');
  };

  const removeWidgetFromPage = async (widgetId: string, page: WidgetCategory) => {
    const currentLayout = getPageLayout(page);
    
    const newLayout: PageLayout = {
      widgets: currentLayout.widgets
        .filter(w => w.id !== widgetId)
        .map((w, index) => ({ ...w, order: index })),
    };
    
    await savePageLayout(page, newLayout);
    toast.success('Widget kaldırıldı');
  };

  const moveWidgetToPage = async (widgetId: string, fromPage: WidgetCategory, toPage: WidgetCategory) => {
    if (fromPage === toPage) return;
    
    // Remove from source
    await removeWidgetFromPage(widgetId, fromPage);
    
    // Add to target
    await addWidgetToPage(widgetId, toPage);
    
    toast.success(`Widget ${toPage} sayfasına taşındı`);
  };

  const updateWidgetOrder = async (page: WidgetCategory, widgetIds: string[]) => {
    const currentLayout = getPageLayout(page);
    
    const newWidgets: WidgetLayout[] = widgetIds.map((id, index) => {
      const existing = currentLayout.widgets.find(w => w.id === id);
      return {
        id,
        visible: existing?.visible ?? true,
        order: index,
        size: existing?.size,
      };
    });
    
    await savePageLayout(page, { widgets: newWidgets });
  };

  // ============ WIDGET FILTERS ============
  
  const getWidgetFilters = (widgetId: string): WidgetFilter => {
    return widgetFilters[widgetId] || {};
  };

  const saveWidgetFilters = async (widgetId: string, filters: WidgetFilter) => {
    if (!user) return;
    
    try {
      // Type assertion needed until Supabase types are regenerated
      await (supabase
        .from('user_widget_filters') as any)
        .upsert({
          user_id: user.id,
          widget_id: widgetId,
          filters: filters as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,widget_id' });

      setWidgetFilters(prev => ({ ...prev, [widgetId]: filters }));
      toast.success('Filtreler kaydedildi');
    } catch (error) {
      console.error('Error saving widget filters:', error);
      toast.error('Filtreler kaydedilemedi');
    }
  };

  const resetWidgetFilters = async (widgetId: string) => {
    if (!user) return;
    
    try {
      await (supabase
        .from('user_widget_filters') as any)
        .delete()
        .eq('user_id', user.id)
        .eq('widget_id', widgetId);

      setWidgetFilters(prev => {
        const newFilters = { ...prev };
        delete newFilters[widgetId];
        return newFilters;
      });
      toast.success('Filtreler sıfırlandı');
    } catch (error) {
      console.error('Error resetting widget filters:', error);
      toast.error('Filtreler sıfırlanamadı');
    }
  };

  const value: UserSettingsContextType = {
    settings,
    isLoading,
    useMockData: settings.useMockData,
    setUseMockData,
    getPageLayout,
    savePageLayout,
    resetPageLayout,
    addWidgetToPage,
    removeWidgetFromPage,
    moveWidgetToPage,
    updateWidgetOrder,
    getWidgetFilters,
    saveWidgetFilters,
    resetWidgetFilters,
    refreshSettings: loadSettings,
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

// ============ HOOK ============

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
}

// ============ MOCK DATA HOOK ============

export function useMockData() {
  const { useMockData } = useUserSettings();
  return { shouldUseMock: useMockData };
}
