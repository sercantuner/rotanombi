// Konteyner Seçici Bileşeni

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTAINER_TEMPLATES, ContainerType } from '@/lib/pageTypes';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContainerPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContainer: (containerType: ContainerType) => void;
}

export function ContainerPicker({ open, onOpenChange, onSelectContainer }: ContainerPickerProps) {
  const handleSelect = (containerType: ContainerType) => {
    onSelectContainer(containerType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Konteyner Ekle</DialogTitle>
          <DialogDescription>
            Sayfanıza eklemek istediğiniz konteyner tipini seçin
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {CONTAINER_TEMPLATES.map((template) => {
            const Icon = (LucideIcons as any)[template.icon] || LucideIcons.LayoutGrid;
            
            return (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                onClick={() => handleSelect(template.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10">
                      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {template.slots} slot
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  
                  {/* Grid Preview */}
                  <div className={cn('grid gap-1 mt-3', template.gridClass)}>
                    {Array.from({ length: template.slots }).map((_, i) => (
                      <div
                        key={i}
                        className="h-6 rounded bg-muted/50 border border-dashed border-muted-foreground/30"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
