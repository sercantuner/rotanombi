import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  Users, 
  Settings, 
  LogOut,
  BarChart3,
  User
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/satis', label: 'Satış Raporu', icon: TrendingUp },
  { path: '/finans', label: 'Finans Raporu', icon: Wallet },
  { path: '/cari', label: 'Cari Hesaplar', icon: Users },
  { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
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
    </aside>
  );
}
