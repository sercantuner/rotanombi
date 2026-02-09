// Mobile Sidebar - Sheet tabanlı mobil navigasyon

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserPages } from '@/hooks/useUserPages';
import { useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { CreatePageModal } from '@/components/pages/CreatePageModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut,
  User,
  Shield,
  Plus,
  Menu,
  Plug,
  Users,
  Crown,
  X
} from 'lucide-react';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

// Sabit menü öğeleri
const staticNavItems: NavItem[] = [
  { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
  { path: '/takim', label: 'Takım Yönetimi', icon: Users, adminOnly: false },
  { path: '/admin', label: 'Kullanıcı Yönetimi', icon: Shield, adminOnly: true },
];

export function MobileSidebar() {
  const { user, logout } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const { pages, createPage } = useUserPages();
  const { isDiaConnected } = useDiaDataCache();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);

  // Admin filtresi
  const visibleStaticItems = staticNavItems.filter(item => !item.adminOnly || isAdmin);

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreatePage = async (name: string, icon: string) => {
    const newPage = await createPage(name, icon);
    if (newPage) {
      navigate(`/page/${newPage.slug}`);
      setOpen(false);
    }
  };

  const NavButton = ({ path, label, icon: Icon, isActive }: { path: string; label: string; icon: React.ElementType; isActive: boolean }) => (
    <button
      onClick={() => handleNavigation(path)}
      className={cn(
        'nav-item w-full',
        isActive && 'active'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium truncate">{label}</span>
    </button>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="fixed top-0 left-0 right-0 h-14 z-50 glass-card border-b border-border flex items-center justify-between px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <img 
                  src={rotanombiLogo} 
                  alt="RotanomBI" 
                  className="h-8 w-auto"
                />
                <SheetTitle className="text-sm">Rapor Portalı</SheetTitle>
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <nav className="p-4 space-y-1">
                {/* Dashboard */}
                <NavButton 
                  path="/dashboard" 
                  label="Dashboard" 
                  icon={LayoutDashboard} 
                  isActive={location.pathname === '/dashboard'} 
                />

                {/* Kullanıcı Sayfaları */}
                {pages.filter(p => p.slug !== 'main-dashboard').length > 0 && (
                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide px-4 mb-2">
                      Sayfalarım
                    </p>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    setOpen(false);
                    setShowCreatePage(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Sayfa Ekle
                </Button>

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
                  
                  {/* Super Admin */}
                  {isSuperAdmin && (
                    <NavButton
                      path="/super-admin-panel"
                      label="Sistem Yönetimi"
                      icon={Crown}
                      isActive={location.pathname === '/super-admin-panel'}
                    />
                  )}
                </div>

                {/* DIA Bağlantı Durumu */}
                <div className="pt-4 border-t border-border mt-4">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg",
                    isDiaConnected ? "bg-success/10" : "bg-muted"
                  )}>
                    <Plug className={cn("w-4 h-4", isDiaConnected ? "text-success" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-medium", isDiaConnected ? "text-success" : "text-muted-foreground")}>
                      {isDiaConnected ? 'DIA Bağlı' : 'DIA Bağlı Değil'}
                    </span>
                  </div>
                </div>
              </nav>
            </ScrollArea>

            {/* User Info & Logout */}
            <div className="border-t border-border p-4 space-y-3">
              {user && (
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
              
              <button
                onClick={handleLogout}
                className="nav-item w-full text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Çıkış Yap</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <img 
          src={rotanombiLogo} 
          alt="RotanomBI" 
          className="h-7 w-auto"
        />

        {/* DIA Status */}
        <div className={cn(
          "w-2 h-2 rounded-full",
          isDiaConnected ? "bg-success" : "bg-muted-foreground"
        )} />
      </header>

      {/* Create Page Modal */}
      <CreatePageModal
        open={showCreatePage}
        onOpenChange={setShowCreatePage}
        onCreatePage={handleCreatePage}
      />
    </>
  );
}
