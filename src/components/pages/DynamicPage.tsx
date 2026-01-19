// Dinamik Sayfa Bileşeni - Kullanıcı tarafından oluşturulan sayfaları render eder

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { ContainerPicker } from './ContainerPicker';
import { ContainerRenderer } from './ContainerRenderer';
import { usePageContainers } from '@/hooks/useUserPages';
import { UserPage, ContainerType } from '@/lib/pageTypes';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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

// Widget verisi için import
import { diaGetGenelRapor, diaGetFinansRapor } from '@/lib/diaClient';

export function DynamicPage() {
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [page, setPage] = useState<UserPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showContainerPicker, setShowContainerPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [widgetData, setWidgetData] = useState<any>({});
  const [isDataLoading, setIsDataLoading] = useState(false);

  const { containers, addContainer, deleteContainer, reorderContainers, refreshContainers } = 
    usePageContainers(page?.id || null);

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

  // Widget verilerini yükle
  const loadWidgetData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [genelResult, finansResult] = await Promise.all([
        diaGetGenelRapor(),
        diaGetFinansRapor()
      ]);

      const data: any = {};
      
      if (genelResult.success && genelResult.data) {
        data.genelRapor = genelResult.data;
        data.cariler = genelResult.data.cariler || [];
        data.yaslandirma = genelResult.data.yaslandirma;
      }
      
      if (finansResult.success && finansResult.data) {
        data.finansRapor = finansResult.data;
        data.bankaHesaplari = finansResult.data.bankaHesaplari || [];
        data.toplamBankaBakiye = finansResult.data.toplamBankaBakiyesi || 0;
      }

      setWidgetData(data);
    } catch (error) {
      console.error('Error loading widget data:', error);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page) {
      loadWidgetData();
    }
  }, [page, loadWidgetData]);

  // Konteyner ekle
  const handleAddContainer = async (containerType: ContainerType) => {
    await addContainer(containerType);
    refreshContainers();
  };

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
    <div className="flex-1 flex flex-col">
      <Header 
        title={page.name}
        subtitle="Özel sayfa"
        onRefresh={loadWidgetData}
        isRefreshing={isDataLoading}
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

      <main className="flex-1 p-6 overflow-auto">
        {/* Containers */}
        {containers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-xl">
            <Plus className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Bu sayfa henüz boş</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Rapor konteynerleri ekleyerek başlayın
            </p>
            <Button onClick={() => setShowContainerPicker(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Konteyner Ekle
            </Button>
          </div>
        ) : (
          <>
            {containers.map((container) => (
              <ContainerRenderer
                key={container.id}
                container={container}
                onDelete={() => deleteContainer(container.id)}
                widgetData={widgetData}
                isLoading={isDataLoading}
              />
            ))}

            {/* Add Container Button */}
            <button
              onClick={() => setShowContainerPicker(true)}
              className="w-full py-8 border-2 border-dashed rounded-xl text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Konteyner Ekle</span>
            </button>
          </>
        )}
      </main>

      {/* Container Picker Modal */}
      <ContainerPicker
        open={showContainerPicker}
        onOpenChange={setShowContainerPicker}
        onSelectContainer={handleAddContainer}
      />

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
  );
}
