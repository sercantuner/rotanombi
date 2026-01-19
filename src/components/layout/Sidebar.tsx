import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserPages } from '@/hooks/useUserPages';
import { CreatePageModal } from '@/components/pages/CreatePageModal';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut,
  BarChart3,
  User,
  Shield,
  Boxes,
  Plus
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

// Sabit menü öğeleri (rapor sayfaları kaldırıldı)
const staticNavItems: NavItem[] = [
  { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
  { path: '/admin', label: 'Kullanıcı Yönetimi', icon: Shield, adminOnly: true },
  { path: '/super-admin', label: 'Widget Yönetimi', icon: Boxes, adminOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const { pages, createPage } = useUserPages();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreatePage, setShowCreatePage] = useState(false);

  // Admin filtresi
  const visibleStaticItems = staticNavItems.filter(item => !item.adminOnly || isAdmin);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreatePage = async (name: string, icon: string) => {
    const newPage = await createPage(name, icon);
    if (newPage) {
      navigate(`/page/${newPage.slug}`);
    }
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 flex flex-col glass-card border-r border-border">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg gradient-text">RotanomBI</h1>
            <p className="text-xs text-muted-foreground">Rapor Portalı</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <button
          onClick={() => handleNavigation('/dashboard')}
          className={`nav-item w-full ${location.pathname === '/dashboard' ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </button>

        {/* Kullanıcı Sayfaları */}
        {pages.length > 0 && (
          <div className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide px-4 mb-2">
              Sayfalarım
            </p>
            {pages.map((page) => {
              const Icon = (LucideIcons as any)[page.icon] || LayoutDashboard;
              const isActive = location.pathname === `/page/${page.slug}`;
              
              return (
                <button
                  key={page.id}
                  onClick={() => handleNavigation(`/page/${page.slug}`)}
                  className={`nav-item w-full ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium truncate">{page.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sayfa Ekle Butonu */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={() => setShowCreatePage(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Sayfa Ekle
        </Button>

        {/* Ayarlar ve Admin */}
        <div className="pt-4 border-t border-border mt-4">
          {visibleStaticItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`nav-item w-full ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-border space-y-3">
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

      {/* Create Page Modal */}
      <CreatePageModal
        open={showCreatePage}
        onOpenChange={setShowCreatePage}
        onCreatePage={handleCreatePage}
      />
    </aside>
  );
}
