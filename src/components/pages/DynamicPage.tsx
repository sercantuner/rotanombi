// Dinamik Sayfa Bileşeni - Kullanıcı tarafından oluşturulan sayfaları render eder
// GLOBAL CACHE: Veri kaynakları tüm sayfalar arası paylaşılır

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { useDataSourceLoader } from '@/hooks/useDataSourceLoader';

// FilterSidePanel kaldırıldı - widget-bazlı filtrelere geçildi
import { UserPage } from '@/lib/pageTypes';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Move, Check, X, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DynamicPage() {
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [page, setPage] = useState<UserPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // FloatingActions state for bottom bar
  const [floatingActionsState, setFloatingActionsState] = useState<{
    isDragMode: boolean;
    isWidgetEditMode: boolean;
    hasChanges: boolean;
    onContainerAdd: () => void;
    onDragModeToggle: () => void;
    onWidgetEditModeToggle: () => void;
    onSave: () => void;
    onCancel: () => void;
  } | null>(null);

  // GLOBAL veri kaynağı loader - sayfa geçişlerinde sadece eksik sorguları tamamlar
  const { 
    isLoading: dataSourcesLoading,
    isInitialLoad: dataSourcesInitialLoad,
    loadedSources,
    currentSourceName,
    totalSources,
    loadProgress,
    refresh: refreshDataSources,
  } = useDataSourceLoader(page?.id || null);

  // Sayfayı yükle
  useEffect(() => {
    const loadPage = async () => {
      if (!pageSlug || !user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_pages')
          .select('*')
          .eq('user_id', user.id)
          .eq('slug', pageSlug)
          .single();

        if (error) throw error;
        setPage(data as unknown as UserPage);
      } catch (error) {
        console.error('Error loading page:', error);
        toast.error('Sayfa bulunamadı');
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadPage();
  }, [pageSlug, user, navigate]);

  // Sayfayı sil
  const handleDeletePage = async () => {
    if (!page) return;

    try {
      await supabase
        .from('user_pages')
        .delete()
        .eq('id', page.id);

      toast.success('Sayfa silindi');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error('Sayfa silinemedi');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-xl font-semibold mb-2">Sayfa bulunamadı</h2>
        <Button onClick={() => navigate('/dashboard')}>Dashboard'a Git</Button>
      </div>
    );
  }

  return (
    <DashboardFilterProvider>
      <TooltipProvider delayDuration={0}>
        <div className="flex-1 flex flex-col pb-16">
          
          <Header 
            title={page.name}
            subtitle="Özel sayfa"
            onRefresh={refreshDataSources}
            isRefreshing={dataSourcesLoading}
            currentPage="dashboard"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Sayfayı Sil
                </Button>
              </div>
            }
          />

          <main className="flex-1 p-2 md:p-4 overflow-auto">
            {/* Filter Side Panel kaldırıldı - widget-bazlı filtrelere geçildi */}

            {/* ContainerBasedDashboard - FloatingActions gizli, alt bar'da gösterilecek */}
            <ContainerBasedDashboard 
              pageId={page.id} 
              widgetData={{}} 
              isLoading={dataSourcesLoading}
              hideFloatingActions={true}
              onFloatingActionsRender={setFloatingActionsState}
            />
          </main>

          {/* Bottom Action Bar */}
          {floatingActionsState && (
            <div 
              className="fixed bottom-0 right-0 z-40 h-14 bg-background/95 backdrop-blur-sm border-t border-border flex items-center justify-end px-4 gap-2"
              style={{ left: 'var(--main-sidebar-width, 16rem)' }}
            >
              {floatingActionsState.isDragMode ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={floatingActionsState.onCancel}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        İptal
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Değişiklikleri iptal et</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        onClick={floatingActionsState.onSave} 
                        disabled={!floatingActionsState.hasChanges}
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Kaydet
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sıralamayı kaydet</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant={floatingActionsState.isWidgetEditMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={floatingActionsState.onWidgetEditModeToggle}
                        className="gap-2"
                      >
                        {floatingActionsState.isWidgetEditMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                        {floatingActionsState.isWidgetEditMode ? 'Bitir' : 'Widget Düzenle'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {floatingActionsState.isWidgetEditMode ? 'Düzenlemeyi bitir' : 'Widget ekle/düzenle'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={floatingActionsState.onContainerAdd}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Container
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Yeni container ekle</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={floatingActionsState.onDragModeToggle}
                        className="gap-2"
                      >
                        <Move className="h-4 w-4" />
                        Sırala
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Container sıralamasını değiştir</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          )}

          {/* Delete Confirmation */}
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sayfayı Sil</AlertDialogTitle>
                <AlertDialogDescription>
                  "{page.name}" sayfasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>İptal</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePage} className="bg-destructive text-destructive-foreground">
                  Sil
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </DashboardFilterProvider>
  );
}
