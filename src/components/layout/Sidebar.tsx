import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserPages } from '@/hooks/useUserPages';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { CreatePageModal } from '@/components/pages/CreatePageModal';
import { DiaQueryStats } from '@/components/dashboard/DiaQueryStats';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut,
  User,
  Shield,
  Boxes,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plug,
  Users,
  Crown
} from 'lucide-react';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotanombiLogoDark from '@/assets/rotanombi-logo-dark.svg';
import { useTheme } from '@/hooks/useTheme';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useEffect } from 'react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

// Sabit menü öğeleri
const staticNavItems: NavItem[] = [
  { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
  { path: '/takim', label: 'Takım Yönetimi', icon: Users, adminOnly: false },
  { path: '/admin', label: 'Kullanıcı Yönetimi', icon: Shield, adminOnly: true },
];

// Super admin menü öğesi
const superAdminItem: NavItem = { 
  path: '/super-admin-panel', 
  label: 'Sistem Yönetimi', 
  icon: Crown, 
  adminOnly: true 
};

export function Sidebar({ 
  collapsed = false, 
  onToggle
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const { pages, createPage } = useUserPages();
  const { isDiaConnected } = useDiaDataCache();
  const { theme } = useTheme();
  const sidebarLogo = theme === 'dark' ? rotanombiLogoDark : rotanombiLogo;
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreatePage, setShowCreatePage] = useState(false);
  

  // Sidebar genişliğini CSS değişkeni olarak paylaş (fixed positioned elementlar için)
  useEffect(() => {
    document.documentElement.style.setProperty('--main-sidebar-width', collapsed ? '4rem' : '16rem');
  }, [collapsed]);

  // Admin filtresi
  const visibleStaticItems = staticNavItems.filter(item => !item.adminOnly || isAdmin);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreatePage = async (name: string, icon: string) => {
    const newPage = await createPage(name, icon);
    if (newPage) {
      navigate(`/page/${newPage.slug}`);
    }
  };

  // Collapsed modda tooltip ile buton render
  const NavButton = ({ path, label, icon: Icon, isActive }: { path: string; label: string; icon: React.ElementType; isActive: boolean }) => {
    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleNavigation(path)}
              className={cn(
                'nav-item w-full justify-center',
                isActive && 'active'
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <button
        onClick={() => handleNavigation(path)}
        className={cn('nav-item w-full', isActive && 'active')}
      >
        <Icon className="w-5 h-5" />
        <span className="font-medium truncate">{label}</span>
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "h-screen fixed left-0 top-0 z-50 flex flex-col glass-card border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-6 z-50 h-6 w-6 rounded-full bg-background border shadow-md hover:bg-muted"
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        {/* Logo - collapsed iken tamamen gizle */}
        {!collapsed && (
           <div className="p-4 border-b border-border">
             <div className="flex flex-col items-start gap-1">
              <img 
                src={sidebarLogo} 
                alt="RotanomBI" 
                 className="h-7 w-auto"
              />
               <p className="text-[10px] text-muted-foreground uppercase tracking-wider pl-0.5">Rapor Portalı</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
          {/* Dashboard */}
          <NavButton 
            path="/dashboard" 
            label="Dashboard" 
            icon={LayoutDashboard} 
            isActive={location.pathname === '/dashboard'} 
          />

          {/* Kullanıcı Sayfaları (main-dashboard hariç) */}
          {pages.filter(p => p.slug !== 'main-dashboard').length > 0 && (
            <div className="pt-4">
              {!collapsed && (
                <p className="text-xs text-muted-foreground uppercase tracking-wide px-4 mb-2">
                  Sayfalarım
                </p>
              )}
              {pages.filter(p => p.slug !== 'main-dashboard').map((page) => {
                const Icon = (LucideIcons as any)[page.icon] || LayoutDashboard;
                const isActive = location.pathname === `/page/${page.slug}`;
                
                return (
                  <NavButton 
                    key={page.id}
                    path={`/page/${page.slug}`}
                    label={page.name}
                    icon={Icon}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          )}

          {/* Sayfa Ekle Butonu */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-full mt-2"
                  onClick={() => setShowCreatePage(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sayfa Ekle</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowCreatePage(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Sayfa Ekle
            </Button>
          )}

          {/* Ayarlar ve Admin */}
          <div className="pt-4 border-t border-border mt-4">
            {visibleStaticItems.map((item) => (
              <NavButton
                key={item.path}
                path={item.path}
                label={item.label}
                icon={item.icon}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>
        </nav>

        {/* DIA Bağlantı Durumu - Dashboard sayfasındayken göster */}
        {(location.pathname === '/dashboard' || location.pathname.startsWith('/page/')) && (
          <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center justify-center p-2 rounded-lg",
                    isDiaConnected ? "bg-success/10" : "bg-muted"
                  )}>
                    <Plug className={cn("w-4 h-4", isDiaConnected ? "text-success" : "text-muted-foreground")} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isDiaConnected ? 'DIA Bağlı' : 'DIA Bağlı Değil'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <DiaQueryStats customTrigger={
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                  isDiaConnected ? "bg-success/10" : "bg-muted"
                )}>
                  <Plug className={cn("w-4 h-4", isDiaConnected ? "text-success" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-medium", isDiaConnected ? "text-success" : "text-muted-foreground")}>
                    {isDiaConnected ? 'DIA Bağlı' : 'DIA Bağlı Değil'}
                  </span>
                </div>
              } />
            )}
          </div>
        )}

        {/* User Info & Logout */}
        <div className={cn("border-t border-border space-y-3", collapsed ? "p-2" : "p-4")}>
          {user && !collapsed && (
            <div className="flex items-center gap-3 px-4 py-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
          
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="nav-item w-full justify-center text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Çıkış Yap</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="nav-item w-full text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Çıkış Yap</span>
            </button>
          )}
        </div>

        {/* Create Page Modal */}
        <CreatePageModal
          open={showCreatePage}
          onOpenChange={setShowCreatePage}
          onCreatePage={handleCreatePage}
        />
      </aside>
    </TooltipProvider>
  );
}
