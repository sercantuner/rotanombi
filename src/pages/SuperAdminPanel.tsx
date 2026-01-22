// Super Admin Panel - Kullanıcı izleme, widget yönetimi ve lisans yönetimi
import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useImpersonation, ImpersonatedProfile } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Crown, 
  Users, 
  Eye, 
  X, 
  Calendar,
  Shield,
  Boxes,
  Database,
  ChevronRight,
  Search,
  AlertCircle,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, differenceInDays, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UserLicenseModal } from '@/components/admin/UserLicenseModal';
import { ImpersonatedDashboard } from '@/components/admin/ImpersonatedDashboard';
import { cn } from '@/lib/utils';

// Lazy import widget management components
const SuperAdminWidgetManager = React.lazy(() => import('@/components/admin/SuperAdminWidgetManager'));
const DataSourceManager = React.lazy(() => import('@/components/admin/DataSourceManager').then(m => ({ default: m.DataSourceManager })));
const CategoryManager = React.lazy(() => import('@/components/admin/CategoryManager').then(m => ({ default: m.CategoryManager })));

// UserProfile, ImpersonatedProfile'ın bir parçasını kullanır - sadece gösterim için gerekli alanlar
interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  license_type: string | null;
  license_expires_at: string | null;
  is_team_admin: boolean | null;
  dia_sunucu_adi: string | null;
  firma_adi: string | null;
  donem_yili: string | null;
  roles?: { role: string; user_id: string }[];
}

export default function SuperAdminPanel() {
  const { isSuperAdmin, loading: permLoading } = usePermissions();
  const { impersonatedUserId, impersonatedProfile, startImpersonation, stopImpersonation, isImpersonating } = useImpersonation();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  // Tüm kullanıcıları yükle
  useEffect(() => {
    if (!isSuperAdmin) return;

    const loadUsers = async () => {
      setLoading(true);
      
      // Tüm profilleri çek
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, donem_yili')
        .order('created_at', { ascending: false });

      if (profileError) {
        console.error('Error loading profiles:', profileError);
        setLoading(false);
        return;
      }

      // Tüm rolleri çek
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Profilleri rollerle birleştir
      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        roles: (rolesData || []).filter(r => r.user_id === profile.user_id)
      })) as UserProfile[];

      setUsers(usersWithRoles);
      setLoading(false);
    };

    loadUsers();
  }, [isSuperAdmin]);

  // Yetki kontrolü
  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Erişim Engellendi</h3>
        <p className="text-muted-foreground max-w-md">
          Bu sayfa sadece Süper Yöneticiler için erişilebilir.
        </p>
      </div>
    );
  }

  // Filtrelenmiş kullanıcılar
  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firma_adi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewUser = (user: UserProfile) => {
    startImpersonation(user.user_id);
  };

  const handleEditLicense = (user: UserProfile) => {
    setSelectedUser(user);
    setShowLicenseModal(true);
  };

  const refreshUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, donem_yili')
      .order('created_at', { ascending: false });

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const usersWithRoles = (profiles || []).map(profile => ({
      ...profile,
      roles: (rolesData || []).filter(r => r.user_id === profile.user_id)
    })) as UserProfile[];

    setUsers(usersWithRoles);
  };

  const getLicenseStatus = (user: UserProfile) => {
    if (!user.license_expires_at) {
      return { label: 'Belirsiz', variant: 'secondary' as const, days: null };
    }
    
    const expiresAt = new Date(user.license_expires_at);
    const daysLeft = differenceInDays(expiresAt, new Date());
    
    if (isPast(expiresAt)) {
      return { label: 'Süresi Doldu', variant: 'destructive' as const, days: daysLeft };
    }
    
    if (daysLeft <= 7) {
      return { label: `${daysLeft} gün`, variant: 'destructive' as const, days: daysLeft };
    }
    
    if (daysLeft <= 30) {
      return { label: `${daysLeft} gün`, variant: 'warning' as const, days: daysLeft };
    }
    
    return { label: `${daysLeft} gün`, variant: 'success' as const, days: daysLeft };
  };

  const getUserRole = (user: UserProfile) => {
    if (user.roles?.some(r => r.role === 'super_admin')) return 'Süper Admin';
    if (user.roles?.some(r => r.role === 'admin')) return 'Admin';
    if (user.is_team_admin) return 'Şirket Yetkilisi';
    return 'Kullanıcı';
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sol Panel - Kullanıcı Listesi (sadece users tabında) */}
      {activeTab === 'users' && (
        <div className={cn(
          "border-r border-border bg-card transition-all duration-300",
          isImpersonating ? "w-80" : "w-96"
        )}>
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-warning" />
              <h2 className="font-semibold">Süper Admin Paneli</h2>
            </div>
            
            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Kullanıcı ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Kullanıcı Listesi */}
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Kullanıcı bulunamadı
                </div>
              ) : (
                filteredUsers.map(user => {
                  const licenseStatus = getLicenseStatus(user);
                  const isViewing = impersonatedUserId === user.user_id;
                  
                  return (
                    <div
                      key={user.user_id}
                      className={cn(
                        "p-3 rounded-lg border transition-all cursor-pointer",
                        isViewing 
                          ? "bg-primary/10 border-primary" 
                          : "bg-card hover:bg-muted border-transparent"
                      )}
                      onClick={() => handleViewUser(user)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {user.display_name || user.email?.split('@')[0] || 'Bilinmeyen'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                          {user.firma_adi && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                              {user.firma_adi}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-xs">
                            {getUserRole(user)}
                          </Badge>
                          <Badge 
                            variant={licenseStatus.variant === 'success' ? 'default' : licenseStatus.variant === 'warning' ? 'secondary' : licenseStatus.variant}
                            className={cn(
                              "text-xs",
                              licenseStatus.variant === 'warning' && "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
                              licenseStatus.variant === 'success' && "bg-green-500/20 text-green-600 border-green-500/30"
                            )}
                          >
                            {user.license_type === 'demo' ? 'Demo' : 'Standart'} • {licenseStatus.label}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant={isViewing ? "default" : "outline"}
                          className="flex-1 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewUser(user);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          {isViewing ? 'Görüntüleniyor' : 'Görüntüle'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditLicense(user);
                          }}
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          Lisans
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Sağ Panel - İçerik */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Impersonation Banner */}
        {isImpersonating && impersonatedProfile && (
          <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium">
                <span className="text-warning">{impersonatedProfile.display_name || impersonatedProfile.email}</span> 
                <span className="text-muted-foreground"> kullanıcısı olarak görüntülüyorsunuz</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={stopImpersonation}
              className="h-7"
            >
              <X className="w-4 h-4 mr-1" />
              Kapat
            </Button>
          </div>
        )}

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b border-border px-4">
            <TabsList className="h-12">
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Kullanıcı İzleme
              </TabsTrigger>
              <TabsTrigger value="widgets" className="gap-2">
                <Boxes className="w-4 h-4" />
                Widget Yönetimi
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-2">
                <Layers className="w-4 h-4" />
                Kategoriler
              </TabsTrigger>
              <TabsTrigger value="datasources" className="gap-2">
                <Database className="w-4 h-4" />
                Veri Kaynakları
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="users" className="h-full m-0">
              {isImpersonating && impersonatedUserId ? (
                <ImpersonatedDashboard userId={impersonatedUserId} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Kullanıcı Seçin</h3>
                  <p className="text-muted-foreground max-w-md">
                    Sol panelden bir kullanıcı seçerek onun dashboard'unu görüntüleyebilir, 
                    widget düzenlemelerini ve sayfa yapılandırmalarını inceleyebilirsiniz.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="widgets" className="h-full m-0 p-6">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <SuperAdminWidgetManager />
              </React.Suspense>
            </TabsContent>

            <TabsContent value="categories" className="h-full m-0 p-6">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <CategoryManager />
              </React.Suspense>
            </TabsContent>

            <TabsContent value="datasources" className="h-full m-0 p-6">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <DataSourceManager />
              </React.Suspense>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Lisans Modal */}
      {selectedUser && (
        <UserLicenseModal
          open={showLicenseModal}
          onOpenChange={setShowLicenseModal}
          user={selectedUser}
          onSave={refreshUsers}
        />
      )}
    </div>
  );
}
