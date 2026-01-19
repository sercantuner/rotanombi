// Widget Picker - Widget ekleme seçici
// Sayfaya yeni widget eklemek için kullanılan modal

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, LayoutGrid, LineChart, Table, List, FileText } from 'lucide-react';
import { 
  WIDGET_REGISTRY, 
  WidgetCategory, 
  WidgetType,
  getPageCategories 
} from '@/lib/widgetRegistry';
import { useUserSettings } from '@/contexts/UserSettingsContext';

interface WidgetPickerProps {
  currentPage: WidgetCategory;
}

const typeIcons: Record<WidgetType, React.ReactNode> = {
  kpi: <LayoutGrid className="w-4 h-4" />,
  chart: <LineChart className="w-4 h-4" />,
  table: <Table className="w-4 h-4" />,
  list: <List className="w-4 h-4" />,
  summary: <FileText className="w-4 h-4" />,
};

const categoryColors: Record<WidgetCategory, string> = {
  dashboard: 'bg-blue-500/20 text-blue-400',
  satis: 'bg-green-500/20 text-green-400',
  finans: 'bg-amber-500/20 text-amber-400',
  cari: 'bg-purple-500/20 text-purple-400',
};

export function WidgetPicker({ currentPage }: WidgetPickerProps) {
  const [open, setOpen] = useState(false);
  const { getPageLayout, addWidgetToPage } = useUserSettings();
  const pages = getPageCategories();
  
  const currentLayout = getPageLayout(currentPage);
  const currentWidgetIds = currentLayout.widgets.map(w => w.id);
  
  // Get widgets that are not currently on this page
  const availableWidgets = WIDGET_REGISTRY.filter(w => !currentWidgetIds.includes(w.id));
  
  // Group by category
  const widgetsByCategory = pages.map(page => ({
    ...page,
    widgets: availableWidgets.filter(w => w.category === page.id),
  })).filter(group => group.widgets.length > 0);

  const handleAddWidget = async (widgetId: string) => {
    await addWidgetToPage(widgetId, currentPage);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Widget Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Widget Ekle</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          {widgetsByCategory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tüm widget'lar zaten bu sayfada
            </div>
          ) : (
            <div className="space-y-6">
              {widgetsByCategory.map(group => (
                <div key={group.id}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    {group.name}
                  </h4>
                  <div className="space-y-2">
                    {group.widgets.map(widget => (
                      <button
                        key={widget.id}
                        onClick={() => handleAddWidget(widget.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                      >
                        <div className={`p-2 rounded-md ${categoryColors[widget.category]}`}>
                          {typeIcons[widget.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{widget.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {widget.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {widget.size}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
