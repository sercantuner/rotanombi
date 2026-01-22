import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WidgetFeedback {
  id: string;
  widget_id: string;
  user_id: string;
  rating: number | null;
  suggestion: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
  // Joined data
  widget_name?: string;
  user_email?: string;
  user_display_name?: string;
  unread_count?: number;
}

export interface FeedbackMessage {
  id: string;
  feedback_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

export function useWidgetFeedback() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Kullanıcının bir widget için feedback göndermesi
  const submitFeedback = async (
    widgetId: string,
    rating: number,
    suggestion?: string
  ) => {
    if (!user) return { success: false, error: 'Giriş yapmalısınız' };

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('widget_feedback')
        .insert({
          widget_id: widgetId,
          user_id: user.id,
          rating,
          suggestion: suggestion || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Değerlendirmeniz gönderildi!');
      return { success: true, data };
    } catch (error: any) {
      console.error('Feedback submit error:', error);
      toast.error('Değerlendirme gönderilemedi');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcının kendi feedback'lerini getir
  const getUserFeedbacks = async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('widget_feedback')
        .select(`
          *,
          widgets:widget_id (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((f: any) => ({
        ...f,
        widget_name: f.widgets?.name,
      }));
    } catch (error) {
      console.error('Get user feedbacks error:', error);
      return [];
    }
  };

  // Widget için ortalama rating
  const getWidgetAverageRating = async (widgetId: string) => {
    try {
      const { data, error } = await supabase
        .from('widget_feedback')
        .select('rating')
        .eq('widget_id', widgetId)
        .not('rating', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) return null;

      const sum = data.reduce((acc: number, f: any) => acc + (f.rating || 0), 0);
      return sum / data.length;
    } catch (error) {
      console.error('Get average rating error:', error);
      return null;
    }
  };

  return {
    loading,
    submitFeedback,
    getUserFeedbacks,
    getWidgetAverageRating,
  };
}

// Super Admin için feedback yönetimi
export function useWidgetFeedbackAdmin() {
  const [feedbacks, setFeedbacks] = useState<WidgetFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<WidgetFeedback | null>(null);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Tüm feedback'leri getir
  const fetchFeedbacks = useCallback(async (statusFilter?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('widget_feedback')
        .select(`
          *,
          widgets:widget_id (name),
          profiles:user_id (email, display_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Okunmamış mesaj sayısını hesapla
      const feedbacksWithUnread = await Promise.all(
        (data || []).map(async (f: any) => {
          const { count } = await supabase
            .from('widget_feedback_messages')
            .select('*', { count: 'exact', head: true })
            .eq('feedback_id', f.id)
            .eq('is_admin', false)
            .eq('is_read', false);

          return {
            ...f,
            widget_name: f.widgets?.name,
            user_email: f.profiles?.email,
            user_display_name: f.profiles?.display_name,
            unread_count: count || 0,
          };
        })
      );

      setFeedbacks(feedbacksWithUnread);
    } catch (error) {
      console.error('Fetch feedbacks error:', error);
      toast.error('Feedback listesi yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  // Feedback mesajlarını getir
  const fetchMessages = useCallback(async (feedbackId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('widget_feedback_messages')
        .select(`
          *,
          profiles:sender_id (display_name, email)
        `)
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = (data || []).map((m: any) => ({
        ...m,
        sender_name: m.profiles?.display_name || m.profiles?.email || 'Kullanıcı',
      }));

      setMessages(formattedMessages);

      // Okunmamış mesajları okundu işaretle (admin tarafı)
      await supabase
        .from('widget_feedback_messages')
        .update({ is_read: true })
        .eq('feedback_id', feedbackId)
        .eq('is_admin', false);

    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Mesaj gönder
  const sendMessage = async (feedbackId: string, message: string, isAdmin: boolean) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { success: false };

    try {
      const { error } = await supabase
        .from('widget_feedback_messages')
        .insert({
          feedback_id: feedbackId,
          sender_id: userData.user.id,
          message,
          is_admin: isAdmin,
        });

      if (error) throw error;

      await fetchMessages(feedbackId);
      return { success: true };
    } catch (error: any) {
      console.error('Send message error:', error);
      toast.error('Mesaj gönderilemedi');
      return { success: false, error: error.message };
    }
  };

  // Feedback durumunu güncelle
  const updateStatus = async (feedbackId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('widget_feedback')
        .update({ status })
        .eq('id', feedbackId);

      if (error) throw error;

      toast.success('Durum güncellendi');
      await fetchFeedbacks();
    } catch (error) {
      console.error('Update status error:', error);
      toast.error('Durum güncellenemedi');
    }
  };

  // Feedback sil
  const deleteFeedback = async (feedbackId: string) => {
    try {
      const { error } = await supabase
        .from('widget_feedback')
        .delete()
        .eq('id', feedbackId);

      if (error) throw error;

      toast.success('Feedback silindi');
      setSelectedFeedback(null);
      await fetchFeedbacks();
    } catch (error) {
      console.error('Delete feedback error:', error);
      toast.error('Feedback silinemedi');
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  return {
    feedbacks,
    loading,
    selectedFeedback,
    setSelectedFeedback,
    messages,
    messagesLoading,
    fetchFeedbacks,
    fetchMessages,
    sendMessage,
    updateStatus,
    deleteFeedback,
  };
}
