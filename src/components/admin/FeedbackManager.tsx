import { useState, useEffect } from 'react';
import { Star, MessageCircle, CheckCircle, XCircle, Clock, Trash2, Send, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useWidgetFeedbackAdmin, WidgetFeedback } from '@/hooks/useWidgetFeedback';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

const statusConfig = {
  pending: { label: 'Bekliyor', icon: Clock, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  reviewed: { label: 'İncelendi', icon: MessageCircle, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  resolved: { label: 'Çözüldü', icon: CheckCircle, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  dismissed: { label: 'Reddedildi', icon: XCircle, color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export function FeedbackManager() {
  const {
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
  } = useWidgetFeedbackAdmin();

  const [statusFilter, setStatusFilter] = useState('all');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchFeedbacks(statusFilter);
  }, [statusFilter, fetchFeedbacks]);

  useEffect(() => {
    if (selectedFeedback) {
      fetchMessages(selectedFeedback.id);
    }
  }, [selectedFeedback, fetchMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedFeedback) return;

    setSending(true);
    const result = await sendMessage(selectedFeedback.id, newMessage, true);
    if (result.success) {
      setNewMessage('');
    }
    setSending(false);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground text-sm">-</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-4 w-4',
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
            )}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Widget Geri Bildirimleri</h3>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Durum filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="pending">Bekleyenler</SelectItem>
            <SelectItem value="reviewed">İncelenenler</SelectItem>
            <SelectItem value="resolved">Çözülenler</SelectItem>
            <SelectItem value="dismissed">Reddedilenler</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback Listesi */}
      {feedbacks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Henüz geri bildirim yok</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {feedbacks.map((feedback) => {
            const status = statusConfig[feedback.status];
            const StatusIcon = status.icon;

            return (
              <Card
                key={feedback.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  selectedFeedback?.id === feedback.id && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedFeedback(feedback)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">
                          {feedback.widget_name || 'Widget'}
                        </span>
                        <Badge variant="outline" className={cn('text-xs', status.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                        {(feedback.unread_count ?? 0) > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {feedback.unread_count} yeni
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <User className="h-3 w-3" />
                        <span>{feedback.user_display_name || feedback.user_email}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(feedback.created_at), {
                            addSuffix: true,
                            locale: tr,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {renderStars(feedback.rating)}
                        {feedback.suggestion && (
                          <p className="text-sm text-muted-foreground truncate flex-1">
                            "{feedback.suggestion}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detay ve Mesajlaşma Sheet */}
      <Sheet open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedFeedback && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedFeedback.widget_name}</SheetTitle>
                <SheetDescription>
                  {selectedFeedback.user_display_name || selectedFeedback.user_email} tarafından gönderildi
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Rating ve Öneri */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Puan</span>
                    {renderStars(selectedFeedback.rating)}
                  </div>
                  {selectedFeedback.suggestion && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Öneri</span>
                      <p className="text-sm bg-muted p-3 rounded-lg">
                        {selectedFeedback.suggestion}
                      </p>
                    </div>
                  )}
                </div>

                {/* Durum Değiştirme */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Durum:</span>
                  <Select
                    value={selectedFeedback.status}
                    onValueChange={(value) => updateStatus(selectedFeedback.id, value)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Bekliyor</SelectItem>
                      <SelectItem value="reviewed">İncelendi</SelectItem>
                      <SelectItem value="resolved">Çözüldü</SelectItem>
                      <SelectItem value="dismissed">Reddedildi</SelectItem>
                    </SelectContent>
                  </Select>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Geri bildirimi sil?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu işlem geri alınamaz. Tüm mesajlar da silinecektir.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteFeedback(selectedFeedback.id)}>
                          Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Mesajlaşma */}
                <div className="space-y-3">
                  <span className="text-sm font-medium">Mesajlar</span>
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
                                ? 'ml-auto bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            <p>{msg.message}</p>
                            <span className="text-xs opacity-70 mt-1 block">
                              {formatDistanceToNow(new Date(msg.created_at), {
                                addSuffix: true,
                                locale: tr,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Mesaj Gönderme */}
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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
