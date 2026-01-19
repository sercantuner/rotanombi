// Widget Permissions Hook - Widget yetkilendirme yönetimi

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { WidgetPermission } from '@/lib/pageTypes';
import { Widget } from '@/lib/widgetTypes';

export function useWidgetPermissions() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [permissions, setPermissions] = useState<WidgetPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // İzinleri yükle
  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('widget_permissions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setPermissions((data as unknown as WidgetPermission[]) || []);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Widget'a erişim kontrolü
  const canViewWidget = useCallback((widgetId: string): boolean => {
    // Admin her şeyi görebilir
    if (isAdmin) return true;
    
    // İzin listesinde var mı?
    const permission = permissions.find(p => p.widget_id === widgetId);
    return permission?.can_view ?? false;
  }, [isAdmin, permissions]);

  // Widget ekleme izni kontrolü
  const canAddWidget = useCallback((widgetId: string): boolean => {
    // Admin her şeyi ekleyebilir
    if (isAdmin) return true;
    
    // İzin listesinde var mı?
    const permission = permissions.find(p => p.widget_id === widgetId);
    return permission?.can_add ?? false;
  }, [isAdmin, permissions]);

  // Erişilebilir widget'ları filtrele
  const filterAccessibleWidgets = useCallback((widgets: Widget[]): Widget[] => {
    if (isAdmin) return widgets;
    
    return widgets.filter(widget => canViewWidget(widget.id));
  }, [isAdmin, canViewWidget]);

  return {
    permissions,
    isLoading,
    canViewWidget,
    canAddWidget,
    filterAccessibleWidgets,
    refreshPermissions: loadPermissions,
    isAdmin,
  };
}
