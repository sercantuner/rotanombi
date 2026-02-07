// FilterManagerModal - Kullanıcının görünür filtreleri seçmesi için modal
import React from 'react';
import { Settings2, Lock, GripVertical } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ALL_AVAILABLE_FILTERS } from '@/hooks/useFilterPreferences';
import { cn } from '@/lib/utils';

interface FilterManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleFilters: string[];
  onSave: (filters: string[]) => void;
}

// Dinamik ikon
const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = (LucideIcons as any)[name] || LucideIcons.Filter;
  return <Icon className={className} />;
};

export function FilterManagerModal({
  open,
  onOpenChange,
  visibleFilters,
  onSave,
}: FilterManagerModalProps) {
  const [selected, setSelected] = React.useState<string[]>(visibleFilters);

  // Modal açıldığında mevcut filtreleri yükle
  React.useEffect(() => {
    if (open) {
      setSelected(visibleFilters);
    }
  }, [open, visibleFilters]);

  const handleToggle = (filterKey: string) => {
    // tarihAraligi kilitli - değiştirilemez
    if (filterKey === 'tarihAraligi') return;
    
    setSelected(prev =>
      prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey]
    );
  };

  const handleSave = () => {
    onSave(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Filtre Yönetimi
          </DialogTitle>
          <DialogDescription>
            Filtre barında görmek istediğiniz filtreleri seçin.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {ALL_AVAILABLE_FILTERS.map((filter) => {
              const isLocked = filter.locked;
              const isSelected = isLocked || selected.includes(filter.key);
              
              return (
                <div
                  key={filter.key}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    isLocked 
                      ? 'bg-muted/30 border-muted cursor-not-allowed' 
                      : isSelected 
                        ? 'bg-primary/5 border-primary/30 hover:bg-primary/10' 
                        : 'bg-card hover:bg-muted/50 cursor-pointer'
                  )}
                  onClick={() => handleToggle(filter.key)}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={isSelected}
                    disabled={isLocked}
                    onCheckedChange={() => handleToggle(filter.key)}
                    className={isLocked ? 'opacity-50' : ''}
                  />
                  
                  {/* Icon */}
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <DynamicIcon name={filter.icon} className="h-4 w-4" />
                  </div>
                  
                  {/* Label */}
                  <span className={cn(
                    'flex-1 text-sm font-medium',
                    isLocked ? 'text-muted-foreground' : 'text-foreground'
                  )}>
                    {filter.label}
                  </span>
                  
                  {/* Lock badge */}
                  {isLocked && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Lock className="h-3 w-3" />
                      Zorunlu
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {selected.length} filtre seçili
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button onClick={handleSave}>
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
