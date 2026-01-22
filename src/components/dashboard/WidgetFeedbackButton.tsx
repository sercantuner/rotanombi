import { useState } from 'react';
import { Star, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useWidgetFeedback } from '@/hooks/useWidgetFeedback';

interface WidgetFeedbackButtonProps {
  widgetId: string;
  widgetName: string;
}

export function WidgetFeedbackButton({ widgetId, widgetName }: WidgetFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [suggestion, setSuggestion] = useState('');
  const { submitFeedback, loading } = useWidgetFeedback();

  const handleSubmit = async () => {
    if (rating === 0) return;

    const result = await submitFeedback(widgetId, rating, suggestion);
    if (result.success) {
      setOpen(false);
      setRating(0);
      setSuggestion('');
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-primary"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Değerlendir"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Widget Değerlendirmesi</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{widgetName}</span> için değerlendirmenizi paylaşın
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Star Rating */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Puanınız</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="p-1 transition-transform hover:scale-110"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={cn(
                        'h-8 w-8 transition-colors',
                        star <= displayRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/30'
                      )}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {displayRating > 0 ? `${displayRating}/5` : 'Seçiniz'}
                </span>
              </div>
            </div>

            {/* Suggestion Text */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Şöyle olsa daha iyi olurdu...
              </label>
              <Textarea
                placeholder="Önerilerinizi buraya yazabilirsiniz (isteğe bağlı)"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || loading}
            >
              {loading ? 'Gönderiliyor...' : 'Gönder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
