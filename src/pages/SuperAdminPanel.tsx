// Super Admin Panel - Kullanıcı izleme, widget yönetimi ve lisans yönetimi
import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useImpersonation, ImpersonatedProfile } from '@/contexts/ImpersonationContext';
import { useTheme } from '@/hooks/useTheme';
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
  Layers,
  MessageSquare,
  Sun,
  Moon,
  User,
  Link2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, differenceInDays, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { UserLicenseModal } from '@/components/admin/UserLicenseModal';
import { ImpersonatedDashboard } from '@/components/admin/ImpersonatedDashboard';
import { cn } from '@/lib/utils';

// Lazy import widget management components
const SuperAdminWidgetManager = React.lazy(() => import('@/components/admin/SuperAdminWidgetManager'));
const DataSourceManager = React.lazy(() => import('@/components/admin/DataSourceManager').then(m => ({ default: m.DataSourceManager })));
const CategoryManager = React.lazy(() => import('@/components/admin/CategoryManager').then(m => ({ default: m.CategoryManager })));
const FeedbackManager = React.lazy(() => import('@/components/admin/FeedbackManager').then(m => ({ default: m.FeedbackManager })));
const DataModelView = React.lazy(() => import('@/components/admin/DataModelView').then(m => ({ default: m.DataModelView })));
const BulkDataSyncManager = React.lazy(() => import('@/components/admin/BulkDataSyncManager').then(m => ({ default: m.BulkDataSyncManager })));

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
  const { theme, toggleTheme } = useTheme();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [userSearchOpen, setUserSearchOpen] = useState(false);

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
     <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Ana İçerik */}
       <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
        {/* Impersonation Banner */}

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="border-b border-border px-2 md:px-4 flex items-center justify-between gap-2 overflow-x-auto">
            <TabsList className="h-11 w-max gap-1">
              <TabsTrigger value="users" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                <span>Kullanıcı İzleme</span>
              </TabsTrigger>
              <TabsTrigger value="widgets" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <Boxes className="w-3 h-3 md:w-4 md:h-4" />
                <span>Widget Yönetimi</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <Layers className="w-3 h-3 md:w-4 md:h-4" />
                <span>Kategoriler</span>
              </TabsTrigger>
              <TabsTrigger value="datasources" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <Database className="w-3 h-3 md:w-4 md:h-4" />
                <span>Veri Kaynakları</span>
              </TabsTrigger>
              <TabsTrigger value="datamodel" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <Link2 className="w-3 h-3 md:w-4 md:h-4" />
                <span>Veri Modeli</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <MessageSquare className="w-3 h-3 md:w-4 md:h-4" />
                <span>Geri Bildirimler</span>
              </TabsTrigger>
              <TabsTrigger value="bulksync" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
                <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                <span>Toplu Sync</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              {/* Kullanıcı Arama - Sadece Kullanıcı İzleme tab'ında göster */}
              {activeTab === 'users' && (
                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userSearchOpen}
                      className="w-[200px] md:w-[300px] justify-start text-muted-foreground h-9"
                    >
                      <Search className="w-4 h-4 mr-2 shrink-0" />
                      {impersonatedProfile ? (
                        <span className="text-foreground truncate">
                          {impersonatedProfile.display_name || impersonatedProfile.email}
                        </span>
                      ) : (
                        <span>Kullanıcı ara...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] md:w-[400px] p-0" align="end">
                    <Command>
                      <CommandInput 
                        placeholder="İsim, e-posta veya firma ara..." 
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {loading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            </div>
                          ) : (
                            'Kullanıcı bulunamadı'
                          )}
                        </CommandEmpty>
                        <CommandGroup heading={`${filteredUsers.length} kullanıcı`}>
                          {filteredUsers.slice(0, 10).map(user => (
                            <CommandItem
                              key={user.user_id}
                              value={`${user.display_name} ${user.email} ${user.firma_adi}`}
                              onSelect={() => {
                                handleViewUser(user);
                                setUserSearchOpen(false);
                              }}
                              className="flex items-center justify-between gap-2 py-2"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">
                                    {user.display_name || user.email?.split('@')[0] || 'Bilinmeyen'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {user.email}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={impersonatedUserId === user.user_id ? "default" : "ghost"}
                                className="h-7 text-xs shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewUser(user);
                                  setUserSearchOpen(false);
                                }}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Görüntüle
                              </Button>
                            </CommandItem>
                          ))}
                          {filteredUsers.length > 10 && (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              +{filteredUsers.length - 10} kullanıcı daha...
                            </div>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 shrink-0"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
             <TabsContent value="users" className="h-full min-h-0 m-0 bg-background">
              {isImpersonating && impersonatedUserId ? (
                <ImpersonatedDashboard 
                  userId={impersonatedUserId} 
                  onEditLicense={() => {
                    const user = users.find(u => u.user_id === impersonatedUserId);
                    if (user) handleEditLicense(user);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Kullanıcı Seçin</h3>
                  <p className="text-muted-foreground max-w-md">
                    Yukarıdaki arama alanından bir kullanıcı seçerek onun dashboard'unu görüntüleyebilir, 
                    widget düzenlemelerini ve sayfa yapılandırmalarını inceleyebilirsiniz.
                  </p>
                </div>
              )}
            </TabsContent>

             <TabsContent value="widgets" className="h-full m-0 p-6 bg-background">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <SuperAdminWidgetManager />
              </React.Suspense>
            </TabsContent>

             <TabsContent value="categories" className="h-full m-0 p-6 bg-background">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <CategoryManager />
              </React.Suspense>
            </TabsContent>

             <TabsContent value="datasources" className="h-full m-0 p-6 bg-background">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <DataSourceManager />
              </React.Suspense>
            </TabsContent>

             <TabsContent value="datamodel" className="h-full m-0 bg-background">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <DataModelView />
              </React.Suspense>
            </TabsContent>

             <TabsContent value="feedback" className="h-full m-0 p-6 bg-background">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <FeedbackManager />
              </React.Suspense>
            </TabsContent>

             <TabsContent value="bulksync" className="h-full m-0 p-6 bg-background overflow-auto">
              <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <BulkDataSyncManager />
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
