// Impersonated Dashboard - Seçili kullanıcının dashboard görünümü
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContainerBasedDashboard } from '@/components/dashboard/ContainerBasedDashboard';
import { DashboardFilterProvider } from '@/contexts/DashboardFilterContext';
import { Loader2 } from 'lucide-react';

interface ImpersonatedDashboardProps {
  userId: string;
}

export function ImpersonatedDashboard({ userId }: ImpersonatedDashboardProps) {
  const [pageId, setPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserDashboard = async () => {
      setLoading(true);
      
      // Kullanıcının main-dashboard sayfasını bul
      const { data, error } = await supabase
        .from('user_pages')
        .select('id')
        .eq('user_id', userId)
        .eq('slug', 'main-dashboard')
        .single();

      if (!error && data) {
        setPageId(data.id);
      } else {
        setPageId(null);
      }
      
      setLoading(false);
    };

    loadUserDashboard();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pageId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-muted-foreground">
          Bu kullanıcının henüz bir dashboard sayfası bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <DashboardFilterProvider>
      <div className="p-6 h-full overflow-auto">
        <ContainerBasedDashboard 
          pageId={pageId} 
          widgetData={{}} 
        />
      </div>
    </DashboardFilterProvider>
  );
}
