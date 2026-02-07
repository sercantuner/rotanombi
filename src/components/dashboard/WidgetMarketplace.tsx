// Widget Marketplace - Kullanıcıların widget ekleyebileceği arayüz
// Dinamik kategori desteği + Widget detay modalı ile

import React, { useState, useMemo } from 'react';
import { useWidgets } from '@/hooks/useWidgets';
import { useWidgetPermissions } from '@/hooks/useWidgetPermissions';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { Widget, WidgetCategory, WIDGET_TYPES, WIDGET_SIZES } from '@/lib/widgetTypes';
import { useWidgetCategories } from '@/hooks/useWidgetCategories';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Check, LayoutGrid, PieChart, Table2, List, Activity, Loader2, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDetailModal } from './WidgetDetailModal';

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

export function WidgetMarketplace({ 
  currentPage, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  onWidgetAdded,
  hideTrigger = false 
}: WidgetMarketplaceProps) {
  const { widgets, isLoading } = useWidgets();
  const { filterAccessibleWidgets, canAddWidget } = useWidgetPermissions();
  const { getPageLayout, addWidgetToPage } = useUserSettings();
   const { activeCategories, isLoading: isCategoriesLoading } = useWidgetCategories();
  
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [addingWidgetId, setAddingWidgetId] = useState<string | null>(null);
  
  // Widget detay modalı
  const [detailWidget, setDetailWidget] = useState<Widget | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Kontrollü veya kontrolsüz mod
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;

  // Mevcut sayfadaki widget'ları al
  const currentLayout = getPageLayout(currentPage);
  const currentWidgetKeys = currentLayout.widgets.map(w => w.id);

  // Kullanılabilir widget'ları filtrele (izin verilmiş ve sayfada olmayanlar)
  const availableWidgets = useMemo(() => {
    // Önce izin verilen widget'ları al
    const accessibleWidgets = filterAccessibleWidgets(widgets);
    
    return accessibleWidgets.filter(w => {
      // Aktif olmalı ve sayfada olmamalı
      if (!w.is_active || currentWidgetKeys.includes(w.widget_key)) return false;
      
      // Ekleme izni kontrolü
      if (!canAddWidget(w.id)) return false;
      
      // Arama filtresi
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (w.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Kategori/etiket filtresi (çoklu etiket desteği)
      const matchesCategory = selectedCategory === 'all' || 
        w.category === selectedCategory || 
        w.tags?.includes(selectedCategory);
      
      return matchesSearch && matchesCategory;
    });
  }, [widgets, filterAccessibleWidgets, canAddWidget, currentWidgetKeys, searchTerm, selectedCategory]);

   // Kategori sayaçları
   const categoryCounts = useMemo(() => {
     const counts: Record<string, number> = { all: 0 };
     
     // Erişilebilir widget'ları filtrele (sayfada olmayanlar)
     const accessibleWidgets = filterAccessibleWidgets(widgets).filter(w => 
       w.is_active && !currentWidgetKeys.includes(w.widget_key) && canAddWidget(w.id)
     );
     
     counts.all = accessibleWidgets.length;
     
      activeCategories.forEach(cat => {
        // Etiket bazlı sayım (çoklu etiket desteği)
        counts[cat.slug] = accessibleWidgets.filter(w => 
          w.category === cat.slug || w.tags?.includes(cat.slug)
        ).length;
      });
     
     return counts;
   }, [widgets, filterAccessibleWidgets, canAddWidget, currentWidgetKeys, activeCategories]);
   
   // Seçili kategori objesi
   const selectedCategoryObj = useMemo(() => {
     if (selectedCategory === 'all') return null;
     return activeCategories.find(c => c.slug === selectedCategory);
   }, [selectedCategory, activeCategories]);

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
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Widget Ekle
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-3xl max-h-[85vh] max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0">
        <DialogHeader>
          <DialogTitle>Widget Ekle</DialogTitle>
          <DialogDescription>
             {activeCategories.find(c => c.slug === currentPage)?.name || currentPage} sayfasına eklemek istediğiniz widget'ı seçin
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

         {/* Category Pills - Horizontal Scroll */}
         <div className="relative">
           {isCategoriesLoading ? (
             <div className="flex items-center justify-center py-2">
               <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
             </div>
           ) : (
             <ScrollArea className="w-full" type="scroll">
               <div className="flex gap-2 pb-2">
                 {/* Tümü butonu */}
                 <button
                   onClick={() => setSelectedCategory('all')}
                   className={cn(
                     "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                     "border",
                     selectedCategory === 'all'
                       ? "bg-primary text-primary-foreground border-primary"
                       : "bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                   )}
                 >
                   <LayoutGrid className="h-3.5 w-3.5" />
                   Tümü
                   <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-background/50">
                     {categoryCounts.all}
                   </Badge>
                 </button>
                 
                 {/* Dinamik kategoriler */}
                 {activeCategories.map(cat => {
                   const count = categoryCounts[cat.slug] || 0;
                   const isSelected = selectedCategory === cat.slug;
                   
                   return (
                     <button
                       key={cat.id}
                       onClick={() => setSelectedCategory(cat.slug)}
                       className={cn(
                         "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                         "border",
                         isSelected
                           ? "bg-primary text-primary-foreground border-primary"
                           : "bg-background hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                       )}
                     >
                       <DynamicIcon iconName={cat.icon || 'Folder'} className="h-3.5 w-3.5" />
                       {cat.name}
                       {count > 0 && (
                         <Badge 
                           variant="secondary" 
                           className={cn(
                             "ml-1 h-5 px-1.5 text-xs",
                             isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted"
                           )}
                         >
                           {count}
                         </Badge>
                       )}
                     </button>
                   );
                 })}
               </div>
             </ScrollArea>
           )}
         </div>

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
                const hasMetadata = widget.short_description || widget.long_description || widget.technical_notes || widget.preview_image;
                
                return (
                  <Card
                    key={widget.id}
                    className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                    onClick={() => !isAdding && handleAddWidget(widget.widget_key)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {/* Preview image veya icon */}
                          {widget.preview_image ? (
                            <img 
                              src={widget.preview_image} 
                              alt={widget.name}
                              className="w-10 h-10 object-cover rounded-md"
                            />
                          ) : (
                            <div className="p-2 rounded-md bg-muted">
                              <DynamicIcon iconName={widget.icon || 'LayoutGrid'} className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
                            <div className="flex items-center gap-1 mt-1">
                               <Badge variant="secondary" className="text-xs">
                                 {activeCategories.find(c => c.slug === widget.category)?.name || widget.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Detay butonu - her zaman görünür */}
                          {hasMetadata && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 bg-primary/10 hover:bg-primary/20 text-primary rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailWidget(widget);
                                setShowDetailModal(true);
                              }}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {widget.short_description || widget.description || 'Açıklama yok'}
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
    
    {/* Widget Detay Modalı */}
    <WidgetDetailModal
      widget={detailWidget}
      open={showDetailModal}
      onOpenChange={setShowDetailModal}
      onAddWidget={(widgetKey) => {
        handleAddWidget(widgetKey);
        setShowDetailModal(false);
      }}
      isAdding={addingWidgetId === detailWidget?.widget_key}
    />
    </>
  );
}
