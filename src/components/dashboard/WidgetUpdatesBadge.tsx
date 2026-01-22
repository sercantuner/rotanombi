// Widget güncelleme bildirimleri bileşeni
import { useState } from 'react';
import { Sparkles, Package, ArrowUpCircle, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWidgetUpdates } from '@/hooks/useWidgetUpdates';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function WidgetUpdatesBadge() {
  const { updates, loading, hasNewUpdates, markAsSeen } = useWidgetUpdates();
  const [open, setOpen] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && hasNewUpdates) {
      markAsSeen();
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "relative gap-2",
            hasNewUpdates && "text-primary"
          )}
        >
          <Sparkles className={cn("h-4 w-4", hasNewUpdates && "animate-pulse")} />
          <span className="hidden sm:inline">Yenilikler</span>
          {hasNewUpdates && (
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-ping" />
          )}
          {hasNewUpdates && (
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Widget Güncellemeleri
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Yeni eklenen ve güncellenen widget'lar
          </p>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          {updates.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Henüz güncelleme yok</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "mt-0.5 p-1.5 rounded-full",
                      update.change_type === 'created' 
                        ? "bg-green-500/10 text-green-600" 
                        : "bg-blue-500/10 text-blue-600"
                    )}>
                      {update.change_type === 'created' ? (
                        <Sparkles className="h-3 w-3" />
                      ) : (
                        <ArrowUpCircle className="h-3 w-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {update.widget_name}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          v{update.version}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {update.change_type === 'created' ? 'Yeni eklendi' : 'Güncellendi'}
                        {' • '}
                        {formatDistanceToNow(new Date(update.created_at), {
                          addSuffix: true,
                          locale: tr,
                        })}
                      </p>
                      {update.change_notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {update.change_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
