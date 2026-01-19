// Widget Marketplace - Kullanıcıların widget ekleyebileceği arayüz

import { useState, useMemo } from 'react';
import { useWidgets } from '@/hooks/useWidgets';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { Widget, WidgetCategory, PAGE_CATEGORIES, WIDGET_TYPES, WIDGET_SIZES } from '@/lib/widgetTypes';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Check, LayoutGrid, PieChart, Table2, List, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import * as LucideIcons from 'lucide-react';

interface WidgetMarketplaceProps {
  currentPage: WidgetCategory;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onWidgetAdded?: (widgetKey: string) => void;
  hideTrigger?: boolean;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

// Widget tipi için ikon
const typeIcons: Record<string, React.ElementType> = {
  kpi: Activity,
  chart: PieChart,
  table: Table2,
  list: List,
  summary: LayoutGrid,
};

// Kategori renkleri
const categoryColors: Record<WidgetCategory, string> = {
  dashboard: 'bg-blue-500/10 text-blue-500',
  satis: 'bg-green-500/10 text-green-500',
  finans: 'bg-amber-500/10 text-amber-500',
  cari: 'bg-purple-500/10 text-purple-500',
};

export function WidgetMarketplace({ 
  currentPage, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  onWidgetAdded,
  hideTrigger = false 
}: WidgetMarketplaceProps) {
  const { widgets, isLoading } = useWidgets();
  const { getPageLayout, addWidgetToPage } = useUserSettings();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [addingWidgetId, setAddingWidgetId] = useState<string | null>(null);

  // Kontrollü veya kontrolsüz mod
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  // Mevcut sayfadaki widget'ları al
  const currentLayout = getPageLayout(currentPage);
  const currentWidgetKeys = currentLayout.widgets.map(w => w.id);

  // Kullanılabilir widget'ları filtrele (sayfada olmayanlar)
  const availableWidgets = useMemo(() => {
    return widgets.filter(w => {
      // Aktif olmalı ve sayfada olmamalı
      if (!w.is_active || currentWidgetKeys.includes(w.widget_key)) return false;
      
      // Arama filtresi
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (w.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Kategori filtresi
      const matchesCategory = selectedCategory === 'all' || w.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [widgets, currentWidgetKeys, searchTerm, selectedCategory]);

  // Kategoriye göre grupla
  const groupedWidgets = useMemo(() => {
    const groups: Record<string, Widget[]> = {};
    availableWidgets.forEach(widget => {
      const cat = widget.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(widget);
    });
    return groups;
  }, [availableWidgets]);

  // Widget ekle
  const handleAddWidget = async (widgetKey: string) => {
    setAddingWidgetId(widgetKey);
    await addWidgetToPage(widgetKey, currentPage);
    if (onWidgetAdded) {
      await onWidgetAdded(widgetKey);
    }
    setAddingWidgetId(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Widget Ekle
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Widget Ekle</DialogTitle>
          <DialogDescription>
            {PAGE_CATEGORIES.find(c => c.id === currentPage)?.name} sayfasına eklemek istediğiniz widget'ı seçin
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
            <TabsTrigger value="all">Tümü</TabsTrigger>
            {PAGE_CATEGORIES.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Widget Grid */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : availableWidgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium">Widget bulunamadı</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {currentWidgetKeys.length > 0 
                  ? 'Tüm uygun widget\'lar zaten sayfada mevcut'
                  : 'Arama kriterlerinize uygun widget yok'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {availableWidgets.map((widget) => {
                const TypeIcon = typeIcons[widget.type] || LayoutGrid;
                const isAdding = addingWidgetId === widget.widget_key;
                
                return (
                  <Card
                    key={widget.id}
                    className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                    onClick={() => !isAdding && handleAddWidget(widget.widget_key)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-md bg-muted">
                            <DynamicIcon iconName={widget.icon || 'LayoutGrid'} className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="secondary" className={`text-xs ${categoryColors[widget.category]}`}>
                                {PAGE_CATEGORIES.find(c => c.id === widget.category)?.name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isAdding}
                        >
                          {isAdding ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {widget.description || 'Açıklama yok'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <TypeIcon className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {WIDGET_TYPES.find(t => t.id === widget.type)?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {WIDGET_SIZES.find(s => s.id === widget.size)?.name}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
          <span>{availableWidgets.length} widget eklenebilir</span>
          <span>{currentWidgetKeys.length} widget sayfada mevcut</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
