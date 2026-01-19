// usePermissions Hook - Kullanıcı yetki yönetimi
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'user' | 'viewer';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_by?: string;
  created_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  admin_id: string;
  member_id: string;
  created_at: string;
  email?: string;
  display_name?: string;
  role?: AppRole;
  permissions: UserPermission[];
}

export function usePermissions() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles.some(r => r.role === 'admin');
  const isViewer = roles.some(r => r.role === 'viewer') && !isAdmin;

  const fetchRolesAndPermissions = useCallback(async () => {
    if (!user) {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      if (rolesError) throw rolesError;
      setRoles((rolesData || []) as unknown as UserRole[]);

      // Fetch user permissions
      const { data: permsData, error: permsError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      if (permsError) throw permsError;
      setPermissions((permsData || []) as unknown as UserPermission[]);
    } catch (error) {
      console.error('Error fetching roles/permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRolesAndPermissions();
  }, [fetchRolesAndPermissions]);

  const hasPermission = useCallback((module: string, permission: 'view' | 'edit' = 'view'): boolean => {
    // Admins have all permissions
    if (isAdmin) return true;

    // Check specific module permission
    const modulePerm = permissions.find(p => p.module === module);
    if (!modulePerm) {
      // Default: users can view, viewers can view, no one can edit without explicit permission
      return permission === 'view';
    }

    return permission === 'view' ? modulePerm.can_view : modulePerm.can_edit;
  }, [isAdmin, permissions]);

  const hasRole = useCallback((role: AppRole): boolean => {
    return roles.some(r => r.role === role);
  }, [roles]);

  // Admin functions
  const addUserRole = useCallback(async (userId: string, role: AppRole) => {
    if (!user || !isAdmin) return false;

    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role,
          created_by: user.id,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding user role:', error);
      return false;
    }
  }, [user, isAdmin]);

  const removeUserRole = useCallback(async (userId: string, role: AppRole) => {
    if (!user || !isAdmin) return false;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing user role:', error);
      return false;
    }
  }, [user, isAdmin]);

  const updateUserPermission = useCallback(async (
    userId: string, 
    module: string, 
    canView: boolean, 
    canEdit: boolean
  ) => {
    if (!user || !isAdmin) return false;

    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: userId,
          module,
          can_view: canView,
          can_edit: canEdit,
        }, {
          onConflict: 'user_id,module',
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user permission:', error);
      return false;
    }
  }, [user, isAdmin]);

  const addTeamMember = useCallback(async (memberEmail: string) => {
    if (!user || !isAdmin) return { success: false, error: 'Yetkiniz yok' };

    try {
      // First, find the user by email in profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', memberEmail)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!profileData) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      // Add to team
      const { error: teamError } = await supabase
        .from('user_teams')
        .insert({
          admin_id: user.id,
          member_id: profileData.user_id,
        });

      if (teamError) {
        if (teamError.code === '23505') {
          return { success: false, error: 'Kullanıcı zaten ekipte' };
        }
        throw teamError;
      }

      // Add default user role
      await supabase
        .from('user_roles')
        .upsert({
          user_id: profileData.user_id,
          role: 'user',
          created_by: user.id,
        }, {
          onConflict: 'user_id,role',
        });

      return { success: true, memberId: profileData.user_id };
    } catch (error) {
      console.error('Error adding team member:', error);
      return { success: false, error: 'Bir hata oluştu' };
    }
  }, [user, isAdmin]);

  const removeTeamMember = useCallback(async (memberId: string) => {
    if (!user || !isAdmin) return false;

    try {
      const { error } = await supabase
        .from('user_teams')
        .delete()
        .eq('admin_id', user.id)
        .eq('member_id', memberId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing team member:', error);
      return false;
    }
  }, [user, isAdmin]);

  const getTeamMembers = useCallback(async (): Promise<TeamMember[]> => {
    if (!user || !isAdmin) return [];

    try {
      // Get team members
      const { data: teamData, error: teamError } = await supabase
        .from('user_teams')
        .select('*')
        .eq('admin_id', user.id);

      if (teamError) throw teamError;
      if (!teamData || teamData.length === 0) return [];

      const memberIds = teamData.map(t => t.member_id);

      // Get profiles for team members
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, display_name')
        .in('user_id', memberIds);

      // Get roles for team members
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('*')
        .in('user_id', memberIds);

      // Get permissions for team members
      const { data: permsData } = await supabase
        .from('user_permissions')
        .select('*')
        .in('user_id', memberIds);

      // Combine data
      return teamData.map(team => {
        const profile = profilesData?.find(p => p.user_id === team.member_id);
        const memberRoles = (rolesData || []).filter(r => r.user_id === team.member_id) as unknown as UserRole[];
        const memberPerms = (permsData || []).filter(p => p.user_id === team.member_id) as unknown as UserPermission[];
        
        return {
          ...team,
          email: profile?.email,
          display_name: profile?.display_name,
          role: memberRoles[0]?.role,
          permissions: memberPerms,
        } as TeamMember;
      });
    } catch (error) {
      console.error('Error getting team members:', error);
      return [];
    }
  }, [user, isAdmin]);

  return {
    roles,
    permissions,
    loading,
    isAdmin,
    isViewer,
    hasPermission,
    hasRole,
    addUserRole,
    removeUserRole,
    updateUserPermission,
    addTeamMember,
    removeTeamMember,
    getTeamMembers,
    refresh: fetchRolesAndPermissions,
  };
}
