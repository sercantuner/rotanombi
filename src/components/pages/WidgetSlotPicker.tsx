// Widget Slot Seçici - Konteyner içindeki slota widget atama

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWidgets } from '@/hooks/useWidgets';
import { useWidgetPermissions } from '@/hooks/useWidgetPermissions';
import { Widget, PAGE_CATEGORIES, WIDGET_TYPES } from '@/lib/widgetTypes';
import { Search, LayoutGrid, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface WidgetSlotPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWidget: (widget: Widget) => void;
  slotIndex: number;
}

// Kategori renkleri
const categoryColors: Record<string, string> = {
  dashboard: 'bg-blue-500/10 text-blue-500',
  satis: 'bg-green-500/10 text-green-500',
  finans: 'bg-amber-500/10 text-amber-500',
  cari: 'bg-purple-500/10 text-purple-500',
};

export function WidgetSlotPicker({ open, onOpenChange, onSelectWidget, slotIndex }: WidgetSlotPickerProps) {
  const { widgets, isLoading } = useWidgets();
  const { filterAccessibleWidgets, isAdmin } = useWidgetPermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Erişilebilir widget'ları filtrele
  const accessibleWidgets = useMemo(() => {
    return filterAccessibleWidgets(widgets.filter(w => w.is_active));
  }, [widgets, filterAccessibleWidgets]);

  // Arama ve kategori filtresi
  const filteredWidgets = useMemo(() => {
    return accessibleWidgets.filter(widget => {
      const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (widget.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [accessibleWidgets, searchTerm, selectedCategory]);

  // Kategoriye göre grupla
  const groupedWidgets = useMemo(() => {
    const groups: Record<string, Widget[]> = {};
    filteredWidgets.forEach(widget => {
      const cat = widget.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(widget);
    });
    return groups;
  }, [filteredWidgets]);

  const handleSelect = (widget: Widget) => {
    onSelectWidget(widget);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Widget Seç - Slot {slotIndex + 1}</DialogTitle>
          <DialogDescription>
            Bu slota eklemek istediğiniz widget'ı seçin
            {isAdmin && <Badge variant="outline" className="ml-2">Admin - Tüm widget'lar görünür</Badge>}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Widget ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">Tümü ({accessibleWidgets.length})</TabsTrigger>
            {PAGE_CATEGORIES.map(cat => {
              const count = accessibleWidgets.filter(w => w.category === cat.id).length;
              return (
                <TabsTrigger key={cat.id} value={cat.id}>
                  {cat.name} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Widget Grid */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredWidgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium">Widget bulunamadı</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {!isAdmin ? 'Yetkiniz olan widget bulunmuyor' : 'Arama kriterlerinize uygun widget yok'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredWidgets.map((widget) => {
                const Icon = (LucideIcons as any)[widget.icon || 'LayoutGrid'] || LucideIcons.LayoutGrid;
                
                return (
                  <Card
                    key={widget.id}
                    className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                    onClick={() => handleSelect(widget)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="secondary" className={`text-xs ${categoryColors[widget.category] || ''}`}>
                                {PAGE_CATEGORIES.find(c => c.id === widget.category)?.name}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {WIDGET_TYPES.find(t => t.id === widget.type)?.name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {widget.description || 'Açıklama yok'}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
          <span>{filteredWidgets.length} widget gösteriliyor</span>
          <span>Toplam {widgets.length} widget mevcut</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
