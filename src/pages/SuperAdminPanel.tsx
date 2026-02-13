// Super Admin Panel - Kullanıcı izleme, widget yönetimi ve lisans yönetimi
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  RefreshCw,
  LogOut,
  HardDrive,
  ChevronLeft,
  LayoutDashboard,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, differenceInDays, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
const LicenseManagement = React.lazy(() => import('@/components/admin/LicenseManagement'));
const SuperAdminDashboard = React.lazy(() => import('@/components/admin/SuperAdminDashboard'));
import { ImpersonatedDashboard } from '@/components/admin/ImpersonatedDashboard';
import { cn } from '@/lib/utils';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotanombiLogoDark from '@/assets/rotanombi-logo-dark.svg';

const CronManagement = React.lazy(() => import('@/components/admin/CronManagement'));

// Lazy import widget management components
const SuperAdminWidgetManager = React.lazy(() => import('@/components/admin/SuperAdminWidgetManager'));
const DataSourceManager = React.lazy(() => import('@/components/admin/DataSourceManager').then(m => ({ default: m.DataSourceManager })));
const CategoryManager = React.lazy(() => import('@/components/admin/CategoryManager').then(m => ({ default: m.CategoryManager })));
const FeedbackManager = React.lazy(() => import('@/components/admin/FeedbackManager').then(m => ({ default: m.FeedbackManager })));
const DataModelView = React.lazy(() => import('@/components/admin/DataModelView').then(m => ({ default: m.DataModelView })));
const SuperAdminDataManagement = React.lazy(() => import('@/components/admin/SuperAdminDataManagement'));

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
  firma_kodu: string | null;
  donem_kodu: string | null;
  donem_yili: string | null;
  roles?: { role: string; user_id: string }[];
}

export default function SuperAdminPanel() {
  const { isAuthenticated, isLoading: authLoading, user: authUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin, loading: permLoading } = usePermissions();
  const { impersonatedUserId, impersonatedProfile, startImpersonation, stopImpersonation, isImpersonating } = useImpersonation();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarLogo = theme === 'dark' ? rotanombiLogoDark : rotanombiLogo;

  // URL'den tab parametresiyle açılışta doğru sekmeyi seç
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;

    const allowedTabs = new Set([
      'dashboard',
      'users',
      'widgets',
      'categories',
      'datasources',
      'datamodel',
      'feedback',
      'datamanagement',
      'licenses',
      'cron',
    ]);

    if (allowedTabs.has(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Tüm kullanıcıları yükle
  useEffect(() => {
    if (!isSuperAdmin) return;

    const loadUsers = async () => {
      setLoading(true);
      
      // Tüm profilleri çek
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, firma_kodu, donem_kodu, donem_yili')
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

  // Auth check - since not wrapped in AppLayout
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

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


  const refreshUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, avatar_url, license_type, license_expires_at, is_team_admin, dia_sunucu_adi, firma_adi, firma_kodu, donem_kodu, donem_yili')
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


  const sidebarItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'users', label: 'Kullanıcı İzleme', icon: Users },
    { key: 'licenses', label: 'Lisans Yönetimi', icon: Shield },
    { key: 'widgets', label: 'Widget Yönetimi', icon: Boxes },
    { key: 'categories', label: 'Kategoriler', icon: Layers },
    { key: 'datasources', label: 'Veri Kaynakları', icon: Database },
    { key: 'datamodel', label: 'Veri Modeli', icon: Link2 },
    { key: 'datamanagement', label: 'Veri Yönetimi', icon: HardDrive },
    { key: 'cron', label: 'Cron Yönetimi', icon: Clock },
    { key: 'feedback', label: 'Geri Bildirimler', icon: MessageSquare },
  ];

  const renderContent = () => {
    const suspenseFallback = <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    switch (activeTab) {
      case 'dashboard':
        return <React.Suspense fallback={suspenseFallback}><SuperAdminDashboard /></React.Suspense>;
      case 'users':
        return isImpersonating && impersonatedUserId ? (
          <ImpersonatedDashboard 
            userId={impersonatedUserId} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Kullanıcı Seçin</h3>
            <p className="text-muted-foreground max-w-md">
              Soldaki arama alanından bir kullanıcı seçerek onun dashboard'unu görüntüleyebilir, 
              widget düzenlemelerini ve sayfa yapılandırmalarını inceleyebilirsiniz.
            </p>
          </div>
        );
      case 'widgets':
        return <React.Suspense fallback={suspenseFallback}><div className="p-6 overflow-auto h-full"><SuperAdminWidgetManager /></div></React.Suspense>;
      case 'categories':
        return <React.Suspense fallback={suspenseFallback}><div className="p-6 overflow-auto h-full"><CategoryManager /></div></React.Suspense>;
      case 'datasources':
        return <React.Suspense fallback={suspenseFallback}><div className="p-6 overflow-auto h-full"><DataSourceManager /></div></React.Suspense>;
      case 'datamodel':
        return <React.Suspense fallback={suspenseFallback}><div className="h-full"><DataModelView /></div></React.Suspense>;
      case 'datamanagement':
        return <React.Suspense fallback={suspenseFallback}><div className="p-6 overflow-auto h-full"><SuperAdminDataManagement users={users} /></div></React.Suspense>;
      case 'licenses':
        return <React.Suspense fallback={suspenseFallback}><div className="p-6 overflow-auto h-full"><LicenseManagement users={users} onRefresh={refreshUsers} /></div></React.Suspense>;
      case 'cron':
        return <React.Suspense fallback={suspenseFallback}><div className="h-full"><CronManagement /></div></React.Suspense>;
      case 'feedback':
        return <React.Suspense fallback={suspenseFallback}><div className="p-6 overflow-auto h-full"><FeedbackManager /></div></React.Suspense>;
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen flex bg-background">
        {/* Left Sidebar */}
        <aside className={cn(
          "h-screen fixed left-0 top-0 z-50 flex flex-col glass-card border-r border-border transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-6 z-50 h-6 w-6 rounded-full bg-background border shadow-md hover:bg-muted"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </Button>

          {/* Logo */}
          {!sidebarCollapsed && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <img src={sidebarLogo} alt="RotanomBI" className="h-7 w-auto" />
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <Crown className="w-2.5 h-2.5 mr-0.5" />
                  Admin
                </Badge>
              </div>
            </div>
          )}

          {/* Nav Items */}
          <nav className={cn("flex-1 space-y-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-4")}>
            {sidebarItems.map(item => {
              const isActive = activeTab === item.key;
              const Icon = item.icon;

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveTab(item.key)}
                        className={cn(
                          'nav-item w-full justify-center',
                          isActive && 'active'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={cn('nav-item w-full', isActive && 'active')}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Search (for users tab) */}
          {activeTab === 'users' && !sidebarCollapsed && (
            <div className="border-t border-border p-3">
              <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start h-9 text-xs">
                    <Search className="w-3.5 h-3.5 mr-2 shrink-0" />
                    {impersonatedProfile ? (
                      <span className="text-foreground truncate">
                        {impersonatedProfile.display_name || impersonatedProfile.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Kullanıcı ara...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start" side="right">
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
                        ) : 'Kullanıcı bulunamadı'}
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
                            className="flex items-center gap-2 py-2"
                          >
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {user.display_name || user.email?.split('@')[0] || 'Bilinmeyen'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Bottom Actions */}
          <div className={cn("border-t border-border space-y-1", sidebarCollapsed ? "p-2" : "p-3")}>
            {sidebarCollapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-full" onClick={toggleTheme}>
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Tema Değiştir</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => logout()} className="nav-item w-full justify-center text-destructive hover:bg-destructive/10">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Çıkış Yap</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <div className="flex items-center justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <button onClick={() => logout()} className="nav-item w-full text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium text-sm">Çıkış Yap</span>
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300 h-screen overflow-hidden",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}>
          {renderContent()}
        </div>

      </div>
    </TooltipProvider>
  );
}
