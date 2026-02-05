// Impersonated Dashboard - Seçili kullanıcının dashboard görünümü
// Kullanıcının DIA bağlantısını kullanarak gerçek verileri çeker
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { DiaDataCacheProvider, useDiaDataCache } from '@/contexts/DiaDataCacheContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useDataSourceLoader } from '@/hooks/useDataSourceLoader';
 import { Loader2, AlertCircle, RefreshCw, WifiOff, CheckCircle, LayoutDashboard, FileText, ChevronLeft, ChevronRight, Plug, Calendar, User, Plus, Move, Check, X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { differenceInDays, isPast } from 'date-fns';
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
  onEditLicense?: () => void;
}

// İç bileşen - cache context içinde çalışır
function ImpersonatedDashboardInner({ userId, onEditLicense }: ImpersonatedDashboardProps) {
  const { impersonatedProfile, isDiaConfigured } = useImpersonation();
  const { setDiaConnected, clearAllCache, isDiaConnected } = useDiaDataCache();
  
  const [userPages, setUserPages] = useState<UserPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaStatus, setDiaStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [diaError, setDiaError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

   // Floating actions state - ContainerBasedDashboard'dan gelecek
   const [floatingActionsProps, setFloatingActionsProps] = useState<{
     isDragMode: boolean;
     isWidgetEditMode: boolean;
     hasChanges: boolean;
     onContainerAdd: () => void;
     onDragModeToggle: () => void;
     onWidgetEditModeToggle: () => void;
     onSave: () => void;
     onCancel: () => void;
   } | null>(null);
 
  // Lisans durumu hesaplama
  const getLicenseStatus = () => {
    if (!impersonatedProfile?.license_expires_at) {
      return { label: 'Belirsiz', variant: 'secondary' as const, days: null };
    }
    
    const expiresAt = new Date(impersonatedProfile.license_expires_at);
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

  const getUserRole = () => {
    if (impersonatedProfile?.is_team_admin) return 'Şirket Yetkilisi';
    return 'Kullanıcı';
  };

  const licenseStatus = getLicenseStatus();

   // DIA bağlantı bilgisi metni
   const getDiaConnectionInfo = () => {
     if (!isDiaConfigured || diaStatus !== 'connected') return null;
     const parts = [];
     if (impersonatedProfile?.donem_kodu) parts.push(impersonatedProfile.donem_kodu);
     if (impersonatedProfile?.dia_sunucu_adi) parts.push(impersonatedProfile.dia_sunucu_adi);
     return parts.join(' • ');
   };
 
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
            <div className="p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <img src={rotanombiLogo} alt="RotanomBI" className="h-5 w-auto" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">İzleme</span>
              </div>
              
              {/* Kullanıcı Adı */}
              <p className="text-sm font-medium mt-2 truncate">
                {impersonatedProfile?.display_name || impersonatedProfile?.email}
              </p>
              
              {/* Rol ve Lisans Bilgisi */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {getUserRole()}
                </Badge>
                <Badge 
                  variant={licenseStatus.variant === 'success' ? 'default' : licenseStatus.variant === 'warning' ? 'secondary' : licenseStatus.variant}
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    licenseStatus.variant === 'warning' && "bg-warning/20 text-warning-foreground",
                    licenseStatus.variant === 'success' && "bg-success/20 text-success"
                  )}
                >
                  {impersonatedProfile?.license_type === 'demo' ? 'Demo' : 'Standart'} • {licenseStatus.label}
                </Badge>
              </div>
              
              {/* Lisans Düzenle Butonu */}
              {onEditLicense && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 h-7 text-xs"
                  onClick={onEditLicense}
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Lisans Düzenle
                </Button>
              )}
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

        </aside>
      </TooltipProvider>
    );
  };

   // Alt sabit bar - DIA durumu ve kontrol butonları
   const renderBottomBar = () => {
     return (
       <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-4 py-2">
         <div className="flex items-center justify-between gap-4">
           {/* Sol - DIA Durumu */}
           <div className="flex items-center gap-3">
             <div className={cn(
               "flex items-center gap-2 px-3 py-1.5 rounded text-xs",
               diaStatus === 'connected' ? "bg-success/10 text-success" : 
               diaStatus === 'error' ? "bg-destructive/10 text-destructive" :
               diaStatus === 'connecting' ? "bg-primary/10 text-primary" :
               "bg-muted text-muted-foreground"
             )}>
               {diaStatus === 'connecting' ? (
                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
               ) : diaStatus === 'error' ? (
                 <AlertCircle className="w-3.5 h-3.5" />
               ) : (
                 <Plug className="w-3.5 h-3.5" />
               )}
               <span>
                 {diaStatus === 'connecting' ? 'Bağlanıyor...' : 
                  diaStatus === 'error' ? 'Bağlantı Hatası' :
                  diaStatus === 'connected' ? 'DIA Bağlı' : 'Bağlı Değil'}
               </span>
               {diaStatus === 'connected' && getDiaConnectionInfo() && (
                 <span className="text-muted-foreground">• {getDiaConnectionInfo()}</span>
               )}
             </div>
 
             {/* Yenile Butonu */}
             <TooltipProvider>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8"
                     onClick={handleReconnect}
                     disabled={diaStatus === 'connecting'}
                   >
                     <RefreshCw className={cn("w-4 h-4", diaStatus === 'connecting' && "animate-spin")} />
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent>Yenile</TooltipContent>
               </Tooltip>
             </TooltipProvider>
 
             {diaStatus === 'error' && diaError && (
               <span className="text-[10px] text-destructive max-w-[200px] truncate" title={diaError}>
                 {diaError}
               </span>
             )}
           </div>
 
            {/* Orta - Kullanıcı Bilgisi */}
            <div className="text-xs text-muted-foreground flex-1 text-center">
              <span className="font-medium text-foreground">{impersonatedProfile?.display_name || impersonatedProfile?.email}</span> izleniyor
            </div>
 
            {/* Sağ - Widget Düzenleme Butonları */}
            <div className="flex items-center gap-2">
              {floatingActionsProps && (
                <TooltipProvider delayDuration={0}>
                  {floatingActionsProps.isDragMode ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={floatingActionsProps.onCancel}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>İptal</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="icon"
                            onClick={floatingActionsProps.onSave} 
                            disabled={!floatingActionsProps.hasChanges}
                            className="h-8 w-8"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Kaydet</TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant={floatingActionsProps.isWidgetEditMode ? 'default' : 'ghost'}
                            size="icon"
                            onClick={floatingActionsProps.onWidgetEditModeToggle}
                            className="h-8 w-8"
                          >
                            {floatingActionsProps.isWidgetEditMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {floatingActionsProps.isWidgetEditMode ? 'Düzenlemeyi Bitir' : 'Widget Düzenle'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={floatingActionsProps.onContainerAdd}
                            className="h-8 w-8"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Container Ekle</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={floatingActionsProps.onDragModeToggle}
                            className="h-8 w-8"
                          >
                            <Move className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Container Sırala</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </TooltipProvider>
              )}
           </div>
         </div>
       </div>
     );
   };
 
  if (userPages.length === 0) {
    return (
       <div className="flex h-full pb-12">
        {renderSidebar()}
        <div className="flex-1 p-6">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Bu kullanıcının henüz bir dashboard sayfası bulunmuyor.
            </p>
          </div>
        </div>
         {renderBottomBar()}
      </div>
    );
  }

  return (
    <DashboardFilterProvider>
        <div className="flex h-full min-h-0 bg-background pb-12">
        {renderSidebar()}
         <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background">
           {isPageLoading && (
             <div className="p-6 pb-0 flex items-center gap-2 text-xs text-muted-foreground">
               <Loader2 className="w-3.5 h-3.5 animate-spin" />
               Veri kaynakları yükleniyor...
             </div>
           )}
           
           {selectedPageId && (
             <ContainerBasedDashboard 
               pageId={selectedPageId} 
               widgetData={{}} 
                hideFloatingActions={true}
                onFloatingActionsRender={setFloatingActionsProps}
             />
           )}
        </div>
         {renderBottomBar()}
      </div>
    </DashboardFilterProvider>
  );
}

// Ana bileşen - kendi cache provider'ı ile
export function ImpersonatedDashboard({ userId, onEditLicense }: ImpersonatedDashboardProps) {
  return (
    <DiaDataCacheProvider userId={userId}>
      <ImpersonatedDashboardInner userId={userId} onEditLicense={onEditLicense} />
    </DiaDataCacheProvider>
  );
}
