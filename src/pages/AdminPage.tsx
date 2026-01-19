import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Users, UserPlus, Settings, Trash2, Edit, Search, Crown, Eye, Pencil, LayoutGrid } from 'lucide-react';
import { WidgetPermissionsPanel } from '@/components/admin/WidgetPermissionsPanel';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  created_at: string;
}

interface UserPermission {
  id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

const MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'satis', label: 'Satış', icon: '💰' },
  { id: 'finans', label: 'Finans', icon: '🏦' },
  { id: 'cari', label: 'Cari Hesaplar', icon: '👥' },
  { id: 'ayarlar', label: 'Ayarlar', icon: '⚙️' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('user');

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Get all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, email, display_name, created_at');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        email: p.email || '',
        display_name: p.display_name,
        role: rolesMap.get(p.user_id) || 'user',
        created_at: p.created_at,
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setUserPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('İzinler yüklenirken hata oluştu');
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          role: newRole,
          created_by: user?.id 
        }, { 
          onConflict: 'user_id' 
        });

      if (error) throw error;
      
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
      
      toast.success('Kullanıcı rolü güncellendi');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Rol güncellenirken hata oluştu');
    }
  };

  const updatePermission = async (userId: string, module: string, field: 'can_view' | 'can_edit', value: boolean) => {
    try {
      const existingPermission = userPermissions.find(p => p.module === module);
      
      if (existingPermission) {
        const { error } = await supabase
          .from('user_permissions')
          .update({ [field]: value })
          .eq('id', existingPermission.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: userId,
            module,
            can_view: field === 'can_view' ? value : false,
            can_edit: field === 'can_edit' ? value : false,
          });

        if (error) throw error;
      }

      await fetchUserPermissions(userId);
      toast.success('İzin güncellendi');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('İzin güncellenirken hata oluştu');
    }
  };

  const openPermissionsDialog = async (userItem: UserWithRole) => {
    setSelectedUser(userItem);
    await fetchUserPermissions(userItem.user_id);
    setIsPermissionsOpen(true);
  };

  const getPermissionForModule = (module: string) => {
    return userPermissions.find(p => p.module === module) || {
      can_view: false,
      can_edit: false,
    };
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive/20 text-destructive"><Crown className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'user':
        return <Badge className="bg-primary/20 text-primary"><Users className="w-3 h-3 mr-1" />Kullanıcı</Badge>;
      case 'viewer':
        return <Badge className="bg-muted text-muted-foreground"><Eye className="w-3 h-3 mr-1" />İzleyici</Badge>;
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Erişim Reddedildi</h2>
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Yönetim Paneli
          </h1>
          <p className="text-muted-foreground">Kullanıcı rolleri ve izinlerini yönetin</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Kullanıcı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admin Sayısı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktif Kullanıcı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {users.filter(u => u.role === 'user').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Kullanıcı Yönetimi
          </TabsTrigger>
          <TabsTrigger value="widgets" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Widget Yetkileri
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          {/* Users Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Kullanıcılar</CardTitle>
                  <CardDescription>Sistemdeki tüm kullanıcıları görüntüleyin ve yönetin</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Kullanıcı ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[250px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Kayıt Tarihi</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell className="font-medium">
                        {userItem.display_name || 'İsimsiz Kullanıcı'}
                      </TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                        <Select
                          value={userItem.role}
                          onValueChange={(value: AppRole) => updateUserRole(userItem.user_id, value)}
                          disabled={userItem.user_id === user?.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Crown className="w-3 h-3" /> Admin
                              </div>
                            </SelectItem>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3" /> Kullanıcı
                              </div>
                            </SelectItem>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="w-3 h-3" /> İzleyici
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {new Date(userItem.created_at).toLocaleDateString('tr-TR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPermissionsDialog(userItem)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Modül İzinleri
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="widgets">
          <WidgetPermissionsPanel />
        </TabsContent>
      </Tabs>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Modül İzinleri
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.display_name || selectedUser?.email} için modül izinlerini düzenleyin
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {MODULES.map((module) => {
              const permission = getPermissionForModule(module.id);
              return (
                <div key={module.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{module.icon}</span>
                    <span className="font-medium">{module.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <Switch
                        checked={permission.can_view}
                        onCheckedChange={(checked) => 
                          selectedUser && updatePermission(selectedUser.user_id, module.id, 'can_view', checked)
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                      <Switch
                        checked={permission.can_edit}
                        onCheckedChange={(checked) => 
                          selectedUser && updatePermission(selectedUser.user_id, module.id, 'can_edit', checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionsOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
