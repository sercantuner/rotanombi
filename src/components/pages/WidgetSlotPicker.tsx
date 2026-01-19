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
import { Search, LayoutGrid, Plus, BarChart3, PieChart, TrendingUp, List, Table, Wallet } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface WidgetSlotPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWidget: (widget: Widget) => void;
  slotIndex: number;
}

// Kategori renkleri
const categoryColors: Record<string, string> = {
  dashboard: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  satis: 'bg-green-500/10 text-green-500 border-green-500/20',
  finans: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  cari: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

// Widget tip ikonları
const typeIcons: Record<string, React.ComponentType<any>> = {
  kpi: TrendingUp,
  chart: BarChart3,
  donut: PieChart,
  list: List,
  table: Table,
  info: Wallet,
};

// Widget önizleme bileşeni
function WidgetPreview({ widget }: { widget: Widget }) {
  const Icon = (LucideIcons as any)[widget.icon || 'LayoutGrid'] || LucideIcons.LayoutGrid;
  
  // Tip bazlı placeholder önizleme
  const renderPreview = () => {
    const widgetType = widget.type as string;
    if (widgetType === 'kpi') {
      return (
        <div className="flex flex-col items-center p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg">
          <Icon className="h-8 w-8 text-primary mb-2" />
          <div className="text-2xl font-bold text-primary">₺125K</div>
          <div className="text-xs text-muted-foreground">Örnek Değer</div>
        </div>
      );
    }
    if (widgetType === 'donut') {
      return (
        <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
          <div className="relative">
            <PieChart className="h-16 w-16 text-primary/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-medium">65%</span>
            </div>
          </div>
        </div>
      );
    }
    if (widgetType === 'chart') {
      return (
        <div className="flex items-end justify-center gap-1 p-4 bg-muted/50 rounded-lg h-20">
          <div className="w-4 bg-primary/60 rounded-t" style={{ height: '40%' }} />
          <div className="w-4 bg-primary/60 rounded-t" style={{ height: '70%' }} />
          <div className="w-4 bg-primary/60 rounded-t" style={{ height: '55%' }} />
          <div className="w-4 bg-primary/60 rounded-t" style={{ height: '85%' }} />
          <div className="w-4 bg-primary/60 rounded-t" style={{ height: '45%' }} />
        </div>
      );
    }
    if (widgetType === 'list') {
      return (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20" />
              <div className="flex-1">
                <div className="h-2 bg-foreground/10 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center p-6 bg-muted/50 rounded-lg">
        <Icon className="h-12 w-12 text-muted-foreground/50" />
      </div>
    );
  };

  return (
    <div className="mt-2">
      {renderPreview()}
    </div>
  );
}

export function WidgetSlotPicker({ open, onOpenChange, onSelectWidget, slotIndex }: WidgetSlotPickerProps) {
  const { widgets, isLoading } = useWidgets();
  const { filterAccessibleWidgets, isAdmin } = useWidgetPermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [hoveredWidget, setHoveredWidget] = useState<Widget | null>(null);

  // Erişilebilir widget'ları filtrele
  const accessibleWidgets = useMemo(() => {
    return filterAccessibleWidgets(widgets.filter(w => w.is_active));
  }, [widgets, filterAccessibleWidgets]);

  // Arama ve kategori/tip filtresi
  const filteredWidgets = useMemo(() => {
    return accessibleWidgets.filter(widget => {
      const matchesSearch = widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (widget.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
      const matchesType = selectedType === 'all' || widget.type === selectedType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [accessibleWidgets, searchTerm, selectedCategory, selectedType]);

  // Tip sayıları
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accessibleWidgets.length };
    accessibleWidgets.forEach(w => {
      counts[w.type] = (counts[w.type] || 0) + 1;
    });
    return counts;
  }, [accessibleWidgets]);

  const handleSelect = (widget: Widget) => {
    onSelectWidget(widget);
    onOpenChange(false);
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedType('all');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Widget Seç - Slot {slotIndex + 1}
          </DialogTitle>
          <DialogDescription>
            Bu slota eklemek istediğiniz widget'ı seçin
            {isAdmin && <Badge variant="outline" className="ml-2">Admin - Tüm widget'lar görünür</Badge>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4">
          {/* Sol taraf - Filtreler ve Liste */}
          <div className="col-span-2 space-y-4">
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
              <TabsList className="grid w-full grid-cols-5 h-auto">
                <TabsTrigger value="all" className="text-xs py-1.5">
                  Tümü ({accessibleWidgets.length})
                </TabsTrigger>
                {PAGE_CATEGORIES.map(cat => {
                  const count = accessibleWidgets.filter(w => w.category === cat.id).length;
                  return (
                    <TabsTrigger key={cat.id} value={cat.id} className="text-xs py-1.5">
                      {cat.name} ({count})
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedType === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedType('all')}
                className="h-7 text-xs"
              >
                Tüm Tipler
              </Button>
              {WIDGET_TYPES.map(type => {
                const TypeIcon = typeIcons[type.id] || LayoutGrid;
                const count = typeCounts[type.id] || 0;
                if (count === 0) return null;
                return (
                  <Button
                    key={type.id}
                    variant={selectedType === type.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedType(type.id)}
                    className="h-7 text-xs"
                  >
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {type.name} ({count})
                  </Button>
                );
              })}
            </div>

            {/* Widget Grid */}
            <ScrollArea className="h-[350px] pr-4">
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
                <div className="grid grid-cols-2 gap-3">
                  {filteredWidgets.map((widget) => {
                    const Icon = (LucideIcons as any)[widget.icon || 'LayoutGrid'] || LucideIcons.LayoutGrid;
                    const TypeIcon = typeIcons[widget.type] || LayoutGrid;
                    
                    return (
                      <Card
                        key={widget.id}
                        className={`cursor-pointer transition-all hover:border-primary hover:shadow-md group ${
                          hoveredWidget?.id === widget.id ? 'border-primary shadow-md' : ''
                        }`}
                        onClick={() => handleSelect(widget)}
                        onMouseEnter={() => setHoveredWidget(widget)}
                        onMouseLeave={() => setHoveredWidget(null)}
                      >
                        <CardHeader className="pb-2 p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <CardTitle className="text-sm font-medium leading-tight">{widget.name}</CardTitle>
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-[10px] px-1.5 py-0 ${categoryColors[widget.category] || ''}`}
                                  >
                                    {PAGE_CATEGORIES.find(c => c.id === widget.category)?.name}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                                    <TypeIcon className="h-2.5 w-2.5" />
                                    {WIDGET_TYPES.find(t => t.id === widget.type)?.name}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 p-3">
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {widget.description || 'Açıklama yok'}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Sağ taraf - Önizleme */}
          <div className="border-l pl-4">
            <h4 className="text-sm font-medium mb-3">Önizleme</h4>
            {hoveredWidget ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = (LucideIcons as any)[hoveredWidget.icon || 'LayoutGrid'] || LucideIcons.LayoutGrid;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <span className="font-medium">{hoveredWidget.name}</span>
                </div>
                
                <WidgetPreview widget={hoveredWidget} />
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kategori:</span>
                    <Badge variant="secondary" className={`text-[10px] ${categoryColors[hoveredWidget.category] || ''}`}>
                      {PAGE_CATEGORIES.find(c => c.id === hoveredWidget.category)?.name}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tip:</span>
                    <span>{WIDGET_TYPES.find(t => t.id === hoveredWidget.type)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Boyut:</span>
                    <span>{hoveredWidget.size}</span>
                  </div>
                  {hoveredWidget.data_source && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Veri Kaynağı:</span>
                      <span className="text-[10px] font-mono bg-muted px-1 rounded">{hoveredWidget.data_source}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground border-t pt-2">
                  {hoveredWidget.description || 'Bu widget için açıklama bulunmuyor.'}
                </p>

                <Button 
                  className="w-full" 
                  size="sm"
                  onClick={() => handleSelect(hoveredWidget)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Widget'ı Ekle
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                <LayoutGrid className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Önizleme için bir widget üzerine gelin</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
          <span>{filteredWidgets.length} widget gösteriliyor</span>
          <span>Toplam {widgets.length} widget mevcut</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
