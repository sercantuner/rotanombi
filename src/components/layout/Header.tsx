import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Sun, Moon, Server } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useDiaProfile } from '@/hooks/useDiaProfile';
import { WidgetPicker } from '@/components/dashboard/WidgetPicker';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { NotificationCenter } from '@/components/layout/NotificationCenter';
import { UserFeedbackPanel } from '@/components/dashboard/UserFeedbackPanel';
import type { WidgetCategory } from '@/lib/widgetRegistry';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  currentPage?: WidgetCategory;
  showWidgetPicker?: boolean;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, onRefresh, isRefreshing, currentPage, showWidgetPicker = false, actions }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [commandOpen, setCommandOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { sunucuAdi, firmaAdi, donemYili, isConfigured } = useDiaProfile();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 glass-card border-b border-border flex items-center justify-between px-6">
      {/* Left: Title + DIA Server Info */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        
        {/* DIA Server Badge */}
        {isConfigured && sunucuAdi && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
            <Server className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">{sunucuAdi}</span>
            {firmaAdi && (
              <span className="text-xs text-primary/70">/ {firmaAdi}</span>
            )}
            {donemYili && (
              <span className="text-xs text-primary/60">/ {donemYili}</span>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Custom Actions */}
        {actions}
        {/* Search - Opens Command Palette */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground w-64"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Ara... (Ctrl+K)</span>
          </button>
        </div>

        {/* Command Palette */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

        {/* Widget Picker */}
        {showWidgetPicker && currentPage && (
          <WidgetPicker currentPage={currentPage} />
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
            title="Yenile"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          title={theme === 'dark' ? 'Aydınlık Mod' : 'Karanlık Mod'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-warning" />
          ) : (
            <Moon className="w-5 h-5 text-primary" />
          )}
        </button>

        {/* User Feedback Panel */}
        <UserFeedbackPanel />

        {/* Notifications */}
        <NotificationCenter />

        {/* Time */}
        <div className="text-right hidden lg:block">
          <p className="text-sm font-medium">
            {currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentTime.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>
    </header>
  );
}
