// Widget Permissions Hook - Widget yetkilendirme yönetimi

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WidgetPermission } from '@/lib/pageTypes';
import { Widget } from '@/lib/widgetTypes';

export function useWidgetPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<WidgetPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTeamAdmin, setIsTeamAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Kullanıcı rollerini ve izinlerini yükle
  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      // Kullanıcının admin rolü var mı kontrol et
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      const userIsAdmin = !!roleData;
      setIsAdmin(userIsAdmin);

      // Kullanıcının team admin olup olmadığını kontrol et
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_team_admin')
        .eq('user_id', user.id)
        .single();
      
      const userIsTeamAdmin = profileData?.is_team_admin ?? true;
      setIsTeamAdmin(userIsTeamAdmin);

      // Eğer admin veya team admin ise tüm widget'ları görebilir
      if (userIsAdmin || userIsTeamAdmin) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      // Takım üyesi ise widget permissions tablosundan izinleri al
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
    // Admin veya şirket yöneticisi her şeyi görebilir
    if (isAdmin || isTeamAdmin) return true;
    
    // Takım üyesi için izin listesinde var mı?
    const permission = permissions.find(p => p.widget_id === widgetId);
    return permission?.can_view ?? false;
  }, [isAdmin, isTeamAdmin, permissions]);

  // Widget ekleme izni kontrolü
  const canAddWidget = useCallback((widgetId: string): boolean => {
    // Admin veya şirket yöneticisi her şeyi ekleyebilir
    if (isAdmin || isTeamAdmin) return true;
    
    // Takım üyesi için izin listesinde var mı?
    const permission = permissions.find(p => p.widget_id === widgetId);
    return permission?.can_add ?? false;
  }, [isAdmin, isTeamAdmin, permissions]);

  // Erişilebilir widget'ları filtrele
  const filterAccessibleWidgets = useCallback((widgets: Widget[]): Widget[] => {
    // Admin veya şirket yöneticisi tümünü görebilir
    if (isAdmin || isTeamAdmin) return widgets;
    
    return widgets.filter(widget => canViewWidget(widget.id));
  }, [isAdmin, isTeamAdmin, canViewWidget]);

  return {
    permissions,
    isLoading,
    canViewWidget,
    canAddWidget,
    filterAccessibleWidgets,
    refreshPermissions: loadPermissions,
    isAdmin,
    isTeamAdmin,
  };
}
