import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WidgetUpdate {
  id: string;
  widget_id: string;
  widget_name: string;
  version: number;
  change_type: 'created' | 'updated';
  change_notes: string | null;
  created_at: string;
}

export function useWidgetUpdates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<WidgetUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  const fetchUpdates = useCallback(async () => {
    if (!user) {
      setUpdates([]);
      setLoading(false);
      return;
    }

    try {
      // Kullanıcının son görme zamanını al
      const { data: seenData } = await supabase
        .from('user_widget_seen')
        .select('last_seen_at')
        .eq('user_id', user.id)
        .single();

      const lastSeenAt = seenData?.last_seen_at || new Date(0).toISOString();

      // Son 30 gündeki değişiklikleri al
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: changelog, error } = await supabase
        .from('widget_changelog')
        .select(`
          id,
          widget_id,
          version,
          change_type,
          change_notes,
          created_at,
          widgets:widget_id (name)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedUpdates = (changelog || []).map((item: any) => ({
        id: item.id,
        widget_id: item.widget_id,
        widget_name: item.widgets?.name || 'Widget',
        version: item.version,
        change_type: item.change_type,
        change_notes: item.change_notes,
        created_at: item.created_at,
      }));

      setUpdates(formattedUpdates);

      // Yeni güncelleme var mı kontrol et
      const newUpdatesCount = formattedUpdates.filter(
        u => new Date(u.created_at) > new Date(lastSeenAt)
      ).length;
      setHasNewUpdates(newUpdatesCount > 0);

    } catch (error) {
      console.error('Error fetching widget updates:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsSeen = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_widget_seen')
        .upsert({
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setHasNewUpdates(false);
    } catch (error) {
      console.error('Error marking updates as seen:', error);
    }
  }, [user]);

  // Widget değişikliği kaydet (admin için)
  const logWidgetChange = useCallback(async (
    widgetId: string,
    version: number,
    changeType: 'created' | 'updated',
    changeNotes?: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('widget_changelog')
        .insert({
          widget_id: widgetId,
          version,
          change_type: changeType,
          change_notes: changeNotes || null,
          changed_by: user.id,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging widget change:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  return {
    updates,
    loading,
    hasNewUpdates,
    fetchUpdates,
    markAsSeen,
    logWidgetChange,
  };
}
