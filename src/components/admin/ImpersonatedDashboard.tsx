// Impersonated Dashboard - Seçili kullanıcının dashboard görünümü
// Kullanıcının DIA bağlantısını kullanarak gerçek verileri çeker
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { DiaDataCacheProvider, useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useDataSourceLoader } from '@/hooks/useDataSourceLoader';
import { Loader2, AlertCircle, RefreshCw, WifiOff, CheckCircle, LayoutDashboard, FileText, ChevronLeft, ChevronRight, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import rotanombiLogo from '@/assets/rotanombi-logo.png';

interface UserPage {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface ImpersonatedDashboardProps {
  userId: string;
}

// İç bileşen - cache context içinde çalışır
function ImpersonatedDashboardInner({ userId }: ImpersonatedDashboardProps) {
  const { impersonatedProfile, isDiaConfigured } = useImpersonation();
  const { setDiaConnected, clearAllCache, isDiaConnected } = useDiaDataCache();
  
  const [userPages, setUserPages] = useState<UserPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaStatus, setDiaStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [diaError, setDiaError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // KRİTİK: İzleme modunda widget'lar cache-first çalıştığı için
  // sayfanın veri kaynaklarını mutlaka DataSourceLoader ile yüklemeliyiz.
  const { isLoading: dataSourcesLoading, refresh: refreshDataSources } = useDataSourceLoader(selectedPageId);

  // DIA oturumu başlat - impersonated user'ın bilgileriyle
  const initializeDiaConnection = useCallback(async () => {
    if (!impersonatedProfile || !isDiaConfigured) {
      console.log('[ImpersonatedDashboard] DIA not configured for this user');
      setDiaStatus('idle');
      return false;
    }

    setDiaStatus('connecting');
    setDiaError(null);

    try {
      console.log('[ImpersonatedDashboard] Initializing DIA connection for:', impersonatedProfile.email);
      
      // Önce mevcut session'ı kontrol et
      const sessionExpires = impersonatedProfile.dia_session_expires 
        ? new Date(impersonatedProfile.dia_session_expires) 
        : null;
      const isSessionValid = sessionExpires && sessionExpires > new Date() && impersonatedProfile.dia_session_id;

      if (isSessionValid) {
        console.log('[ImpersonatedDashboard] Using existing valid session');
        setDiaStatus('connected');
        setDiaConnected(true);
        return true;
      }

      // Yeni login gerekiyor - dia-api-test kullan (diaAutoLogin otomatik session alır)
      console.log('[ImpersonatedDashboard] Session expired or missing, triggering auto-login via dia-api-test');
      
      // dia-api-test edge function'ı hedef kullanıcı için otomatik login yapar
      // ensureSessionOnly: DIA'ya herhangi bir method çağrısı yapmadan session üretir
      const { data: testData, error: testError } = await supabase.functions.invoke('dia-api-test', {
        body: {
          targetUserId: userId,
          ensureSessionOnly: true,
        }
      });

      if (testError || !testData?.success) {
        throw new Error(testError?.message || testData?.error || 'DIA bağlantısı kurulamadı');
      }

      console.log('[ImpersonatedDashboard] DIA auto-login successful via dia-api-test');
      setDiaStatus('connected');
      setDiaConnected(true);
      return true;

    } catch (error: any) {
      console.error('[ImpersonatedDashboard] DIA connection error:', error);
      setDiaError(error.message || 'DIA bağlantı hatası');
      setDiaStatus('error');
      setDiaConnected(false);
      return false;
    }
  }, [impersonatedProfile, isDiaConfigured, userId, setDiaConnected]);

  // Kullanıcının tüm sayfalarını yükle
  const loadUserPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_pages')
      .select('id, name, slug, icon')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setUserPages(data);
      // Varsayılan olarak main-dashboard veya ilk sayfayı seç
      const mainPage = data.find(p => p.slug === 'main-dashboard');
      setSelectedPageId(mainPage?.id || data[0]?.id || null);
    } else {
      setUserPages([]);
      setSelectedPageId(null);
    }
  }, [userId]);

  // Sayfa ve DIA bağlantısını yükle
  useEffect(() => {
    const loadUserDashboard = async () => {
      setLoading(true);
      
      // Cache'i temizle - yeni kullanıcı verisi için
      clearAllCache();
      
      // Kullanıcının tüm sayfalarını yükle
      await loadUserPages();
      
      // DIA bağlantısını başlat
      await initializeDiaConnection();
      
      setLoading(false);
    };

    loadUserDashboard();
  }, [userId, clearAllCache, initializeDiaConnection, loadUserPages]);

  // Manuel DIA bağlantı yenileme
  const handleReconnect = async () => {
    clearAllCache();
    await initializeDiaConnection();
    // Veri kaynaklarını da yeniden yükle (cache-first widget'lar için gerekli)
    await refreshDataSources();
    if (diaStatus === 'connected') {
      toast.success('DIA bağlantısı yenilendi');
    }
  };

  // Sayfa değiştir
  const handlePageChange = (pageId: string) => {
    setSelectedPageId(pageId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Kullanıcı verileri yükleniyor...
        </p>
      </div>
    );
  }

  // DIA bağlantısı aktif olsa bile veri kaynakları yüklenirken hafif bir durum göstergesi verelim
  // (Grafikler cache'den besleneceği için bu süreç kritik)
  const isPageLoading = dataSourcesLoading;

  // İzleme modu sidebar - kullanıcının sayfalarını listeler
  const renderSidebar = () => {
    return (
      <TooltipProvider delayDuration={0}>
        <aside className={cn(
          "h-full flex flex-col border-r border-border bg-card/50 transition-all duration-300 relative shrink-0",
          sidebarCollapsed ? "w-14" : "w-56"
        )}>
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full bg-background border shadow-md hover:bg-muted"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </Button>

          {/* Logo / Kullanıcı Bilgisi */}
          {!sidebarCollapsed && (
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2">
                <img src={rotanombiLogo} alt="RotanomBI" className="h-5 w-auto" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">İzleme</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {impersonatedProfile?.display_name || impersonatedProfile?.email}
              </p>
            </div>
          )}

          {/* Sayfa Listesi */}
          <nav className={cn("flex-1 overflow-y-auto", sidebarCollapsed ? "p-1" : "p-2")}>
            {userPages.map(page => {
              const isActive = page.id === selectedPageId;
              
              if (sidebarCollapsed) {
                return (
                  <Tooltip key={page.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handlePageChange(page.id)}
                        className={cn(
                          "w-full flex items-center justify-center p-2 rounded-lg mb-1 transition-colors",
                          isActive 
                            ? "bg-primary/10 text-primary" 
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {page.slug === 'main-dashboard' ? (
                          <LayoutDashboard className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{page.name}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <button
                  key={page.id}
                  onClick={() => handlePageChange(page.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-sm transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {page.slug === 'main-dashboard' ? (
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{page.name}</span>
                </button>
              );
            })}
          </nav>

          {/* DIA Durumu */}
          <div className={cn("border-t border-border", sidebarCollapsed ? "p-2" : "p-3")}>
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center justify-center p-2 rounded-lg",
                    diaStatus === 'connected' ? "bg-green-500/10" : "bg-muted"
                  )}>
                    <Plug className={cn("w-4 h-4", diaStatus === 'connected' ? "text-green-600" : "text-muted-foreground")} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {diaStatus === 'connected' ? 'DIA Bağlı' : 'DIA Bağlı Değil'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                diaStatus === 'connected' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
              )}>
                <Plug className="w-3.5 h-3.5" />
                <span>{diaStatus === 'connected' ? 'DIA Bağlı' : 'DIA Bağlı Değil'}</span>
              </div>
            )}
          </div>
        </aside>
      </TooltipProvider>
    );
  };

  // DIA bağlantı durumu banner
  const renderDiaStatus = () => {
    if (!isDiaConfigured) {
      return (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              DIA Bağlantısı Yapılandırılmamış
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Bu kullanıcının DIA ERP bağlantı ayarları henüz yapılmamış.
            </p>
          </div>
        </div>
      );
    }

    if (diaStatus === 'connecting') {
      return (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            DIA bağlantısı kuruluyor...
          </p>
        </div>
      );
    }

    if (diaStatus === 'error') {
      return (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              DIA Bağlantı Hatası
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">{diaError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReconnect}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Tekrar Dene
          </Button>
        </div>
      );
    }

    if (diaStatus === 'connected') {
      return (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              DIA Bağlantısı Aktif
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {impersonatedProfile?.firma_adi || impersonatedProfile?.firma_kodu} • {impersonatedProfile?.dia_sunucu_adi}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReconnect}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    return null;
  };

  if (userPages.length === 0) {
    return (
      <div className="flex h-full">
        {renderSidebar()}
        <div className="flex-1 p-6">
          {renderDiaStatus()}
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Bu kullanıcının henüz bir dashboard sayfası bulunmuyor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardFilterProvider>
      <div className="flex h-full min-h-0">
        {renderSidebar()}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-6">
            {renderDiaStatus()}

            {isPageLoading && (
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Veri kaynakları yükleniyor...
              </div>
            )}
            
            {selectedPageId && (
              <ContainerBasedDashboard 
                pageId={selectedPageId} 
                widgetData={{}} 
              />
            )}
          </div>
        </div>
      </div>
    </DashboardFilterProvider>
  );
}

// Ana bileşen - kendi cache provider'ı ile
export function ImpersonatedDashboard({ userId }: ImpersonatedDashboardProps) {
  return (
    <DiaDataCacheProvider userId={userId}>
      <ImpersonatedDashboardInner userId={userId} />
    </DiaDataCacheProvider>
  );
}
