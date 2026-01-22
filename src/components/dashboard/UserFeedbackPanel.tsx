// Kullanıcının kendi geri bildirimlerini görebildiği panel
import { useState, useEffect, useCallback } from 'react';
import { Star, MessageCircle, Clock, CheckCircle, XCircle, Send, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

interface Feedback {
  id: string;
  widget_id: string;
  rating: number | null;
  suggestion: string | null;
  status: string;
  created_at: string;
  widget_name?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

const statusConfig = {
  pending: { label: 'Bekliyor', icon: Clock, color: 'bg-yellow-500/10 text-yellow-600' },
  reviewed: { label: 'İncelendi', icon: MessageCircle, color: 'bg-blue-500/10 text-blue-600' },
  resolved: { label: 'Çözüldü', icon: CheckCircle, color: 'bg-green-500/10 text-green-600' },
  dismissed: { label: 'Reddedildi', icon: XCircle, color: 'bg-red-500/10 text-red-600' },
};

export function UserFeedbackPanel() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const fetchFeedbacks = useCallback(async () => {
    if (!user) return;

    setLoading(true);
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

      // Okunmamış mesaj sayısını hesapla
      const feedbacksWithUnread = await Promise.all(
        (data || []).map(async (f: any) => {
          const { count } = await supabase
            .from('widget_feedback_messages')
            .select('*', { count: 'exact', head: true })
            .eq('feedback_id', f.id)
            .eq('is_admin', true)
            .eq('is_read', false);

          return {
            ...f,
            widget_name: f.widgets?.name,
            unread_count: count || 0,
          };
        })
      );

      const total = feedbacksWithUnread.reduce((acc, f) => acc + (f.unread_count || 0), 0);
      setTotalUnread(total);
      setFeedbacks(feedbacksWithUnread);
    } catch (error) {
      console.error('Fetch feedbacks error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        sender_name: m.is_admin ? 'Destek' : (m.profiles?.display_name || 'Ben'),
      }));

      setMessages(formattedMessages);

      // Admin mesajlarını okundu işaretle
      await supabase
        .from('widget_feedback_messages')
        .update({ is_read: true })
        .eq('feedback_id', feedbackId)
        .eq('is_admin', true);

      // Unread sayısını güncelle
      fetchFeedbacks();
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, [fetchFeedbacks]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedFeedback || !user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('widget_feedback_messages')
        .insert({
          feedback_id: selectedFeedback.id,
          sender_id: user.id,
          message: newMessage,
          is_admin: false,
        });

      if (error) throw error;

      setNewMessage('');
      await fetchMessages(selectedFeedback.id);
      toast.success('Mesajınız gönderildi');
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  useEffect(() => {
    if (selectedFeedback) {
      fetchMessages(selectedFeedback.id);
    }
  }, [selectedFeedback, fetchMessages]);

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3',
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Geri Bildirimlerim</span>
          {totalUnread > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {totalUnread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Geri Bildirimlerim</SheetTitle>
          <SheetDescription>
            Widget değerlendirmeleriniz ve destek ekibiyle mesajlarınız
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Henüz geri bildirim göndermediniz</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Widget'ların üzerindeki mesaj ikonuna tıklayarak değerlendirme yapabilirsiniz
              </p>
            </div>
          ) : selectedFeedback ? (
            // Mesaj detayı
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFeedback(null)}
                className="gap-1 -ml-2"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Geri
              </Button>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedFeedback.widget_name}</span>
                  {renderStars(selectedFeedback.rating)}
                </div>
                {selectedFeedback.suggestion && (
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {selectedFeedback.suggestion}
                  </p>
                )}
                <Badge
                  variant="outline"
                  className={cn('text-xs', statusConfig[selectedFeedback.status as keyof typeof statusConfig]?.color)}
                >
                  {statusConfig[selectedFeedback.status as keyof typeof statusConfig]?.label || selectedFeedback.status}
                </Badge>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg p-3">
                {messagesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-12 w-2/3 ml-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    Henüz mesaj yok
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'max-w-[80%] p-3 rounded-lg text-sm',
                          msg.is_admin
                            ? 'bg-muted'
                            : 'ml-auto bg-primary text-primary-foreground'
                        )}
                      >
                        <p>{msg.message}</p>
                        <span className="text-xs opacity-70 mt-1 block">
                          {msg.sender_name} • {formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                            locale: tr,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-2">
                <Input
                  placeholder="Mesajınızı yazın..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            // Feedback listesi
            <div className="space-y-2">
              {feedbacks.map((feedback) => {
                const status = statusConfig[feedback.status as keyof typeof statusConfig];

                return (
                  <button
                    key={feedback.id}
                    onClick={() => setSelectedFeedback(feedback)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all hover:bg-muted/50',
                      (feedback.unread_count ?? 0) > 0 && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {feedback.widget_name || 'Widget'}
                          </span>
                          {(feedback.unread_count ?? 0) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {feedback.unread_count} yeni
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {renderStars(feedback.rating)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(feedback.created_at), {
                              addSuffix: true,
                              locale: tr,
                            })}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-xs shrink-0', status?.color)}>
                        {status?.label || feedback.status}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
