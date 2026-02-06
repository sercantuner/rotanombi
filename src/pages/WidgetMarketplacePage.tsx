// Widget Marketplace - Tam Sayfa Versiyon
// Kullanıcıların widget ekleyebileceği arayüz

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWidgets } from '@/hooks/useWidgets';
import { useWidgetPermissions } from '@/hooks/useWidgetPermissions';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { Widget, WidgetCategory, WIDGET_TYPES, WIDGET_SIZES } from '@/lib/widgetTypes';
import { useWidgetCategories } from '@/hooks/useWidgetCategories';
import { useWidgetFeedback } from '@/hooks/useWidgetFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Check, LayoutGrid, PieChart, Table2, List, Activity, Loader2, Info, ArrowLeft, Grid3X3, Star, Tag, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDetailModal } from '@/components/dashboard/WidgetDetailModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TagFilterPopover } from '@/components/marketplace/TagFilterPopover';

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

export function WidgetMarketplacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL parametrelerini oku
  const targetPage = (searchParams.get('page') || 'dashboard') as WidgetCategory;
  const containerId = searchParams.get('container');
  const slotIndex = searchParams.get('slot');
  
  const { widgets, isLoading } = useWidgets();
  const { filterAccessibleWidgets, canAddWidget } = useWidgetPermissions();
  const { getPageLayout, addWidgetToPage } = useUserSettings();
  const { activeCategories, isLoading: isCategoriesLoading } = useWidgetCategories();
  const { getWidgetAverageRating } = useWidgetFeedback();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [addingWidgetId, setAddingWidgetId] = useState<string | null>(null);
  const [avgRatings, setAvgRatings] = useState<Record<string, number | null>>({});
  
  // Widget detay modalı
  const [detailWidget, setDetailWidget] = useState<Widget | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Mevcut sayfadaki widget'ları al (sadece sayfa modu için)
  const currentLayout = getPageLayout(targetPage);
  const currentWidgetKeys = containerId ? [] : currentLayout.widgets.map(w => w.id);

  // Kullanılabilir widget'ları filtrele
  const availableWidgets = useMemo(() => {
    const accessibleWidgets = filterAccessibleWidgets(widgets);
    
    return accessibleWidgets.filter(w => {
      if (!w.is_active || currentWidgetKeys.includes(w.widget_key)) return false;
      if (!canAddWidget(w.id)) return false;
      
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (w.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || 
        w.category === selectedCategory || 
        w.tags?.includes(selectedCategory);
      
      // Etiket filtresi: seçilen tüm etiketlere sahip olmalı
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every(tag => w.tags?.includes(tag) || w.ai_suggested_tags?.includes(tag));
      
      return matchesSearch && matchesCategory && matchesTags;
    });
  }, [widgets, filterAccessibleWidgets, canAddWidget, currentWidgetKeys, searchTerm, selectedCategory, selectedTags]);

  // Kategori sayaçları
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    
    const accessibleWidgets = filterAccessibleWidgets(widgets).filter(w => 
      w.is_active && !currentWidgetKeys.includes(w.widget_key) && canAddWidget(w.id)
    );
    
    counts.all = accessibleWidgets.length;
    
    activeCategories.forEach(cat => {
      counts[cat.slug] = accessibleWidgets.filter(w => 
        w.category === cat.slug || w.tags?.includes(cat.slug)
      ).length;
    });
    
    return counts;
  }, [widgets, filterAccessibleWidgets, canAddWidget, currentWidgetKeys, activeCategories]);

  // Widget ortalama puanlarını yükle
  useEffect(() => {
    const loadRatings = async () => {
      if (availableWidgets.length === 0) return;
      
      const ratings: Record<string, number | null> = {};
      // Paralel olarak tüm rating'leri çek
      await Promise.all(
        availableWidgets.map(async (widget) => {
          const avg = await getWidgetAverageRating(widget.id);
          ratings[widget.id] = avg;
        })
      );
      setAvgRatings(ratings);
    };
    
    loadRatings();
  }, [availableWidgets.length, getWidgetAverageRating]);

  // Widget ekle
  // Akıllı geri dönüş - navigate(-1) yerine URL parametrelerine göre
  const getReturnPath = () => {
    if (containerId && targetPage) {
      // Container modunda ise sayfaya dön
      return targetPage === 'dashboard' ? '/dashboard' : `/page/${targetPage}`;
    }
    if (targetPage && targetPage !== 'dashboard') {
      return `/page/${targetPage}`;
    }
    return '/dashboard';
  };

  const handleAddWidget = async (widgetKey: string, widgetId: string) => {
    setAddingWidgetId(widgetKey);
    
    try {
      // Container slot modunda mı?
      if (containerId && slotIndex !== null) {
        // Container slot'una ekle
        const { error } = await supabase
          .from('container_widgets')
          .insert({
            container_id: containerId,
            widget_id: widgetId,
            slot_index: parseInt(slotIndex)
          });
        
        if (error) throw error;
        toast.success('Widget eklendi');
      } else {
        // Sayfa layout'una ekle (eski davranış)
        await addWidgetToPage(widgetKey, targetPage);
      }
    } catch (error) {
      console.error('Widget ekleme hatası:', error);
      toast.error('Widget eklenemedi');
      setAddingWidgetId(null);
      return;
    }
    
    setAddingWidgetId(null);
    navigate(getReturnPath()); // Akıllı geri dön
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(getReturnPath())}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Grid3X3 className="h-6 w-6 text-primary" />
                Widget Marketplace
              </h1>
              <p className="text-sm text-muted-foreground">
                {containerId 
                  ? `Container slot #${slotIndex}'a widget ekleyin`
                  : `${activeCategories.find(c => c.slug === targetPage)?.name || targetPage} sayfasına widget ekleyin`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{availableWidgets.length} widget eklenebilir</span>
            <span>•</span>
            <span>{currentWidgetKeys.length} widget sayfada mevcut</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex-shrink-0 px-6 py-4 space-y-4 border-b bg-card/50">
        {/* Search + Tag Filter Row */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Widget ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Tag Filter Popover */}
          <TagFilterPopover
            categories={activeCategories}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            tagCounts={categoryCounts}
            isLoading={isCategoriesLoading}
          />
        </div>

        {/* Seçili etiketler badge'leri */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {selectedTags.map(tag => (
              <Badge 
                key={tag} 
                variant="default" 
                className="gap-1 cursor-pointer hover:bg-primary/80"
                onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
              >
                {activeCategories.find(c => c.slug === tag)?.name || tag}
                <X className="h-3 w-3" />
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSelectedTags([])}
            >
              Tümünü Temizle
            </Button>
          </div>
        )}

        {/* Popular Category Pills - Sadece en popüler 6 kategori */}
        {isCategoriesLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedTags([]);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                "border",
                selectedCategory === 'all' && selectedTags.length === 0
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
            
            {/* Sadece popüler 6 kategori (widget sayısına göre sıralı) */}
            {activeCategories
              .filter(cat => (categoryCounts[cat.slug] || 0) > 0)
              .sort((a, b) => (categoryCounts[b.slug] || 0) - (categoryCounts[a.slug] || 0))
              .slice(0, 6)
              .map(cat => {
                const count = categoryCounts[cat.slug] || 0;
                const isSelected = selectedCategory === cat.slug;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(isSelected ? 'all' : cat.slug);
                    }}
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
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "ml-1 h-5 px-1.5 text-xs",
                        isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {count}
                    </Badge>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Widget Grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : availableWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <LayoutGrid className="h-16 w-16 text-muted-foreground/50 mb-6" />
            <h3 className="text-xl font-medium">Widget bulunamadı</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              {currentWidgetKeys.length > 0 
                ? 'Tüm uygun widget\'lar zaten sayfada mevcut'
                : 'Arama kriterlerinize uygun widget yok'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableWidgets.map((widget) => {
              const TypeIcon = typeIcons[widget.type] || LayoutGrid;
              const isAdding = addingWidgetId === widget.widget_key;
              const hasMetadata = widget.short_description || widget.long_description || widget.technical_notes || widget.preview_image;
              
              return (
                <Card
                  key={widget.id}
                  className="cursor-pointer transition-all hover:border-primary hover:shadow-lg group flex flex-col"
                  onClick={() => !isAdding && handleAddWidget(widget.widget_key, widget.id)}
                >
                  <CardHeader className="pb-2 flex-shrink-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {widget.preview_image ? (
                          <img 
                            src={widget.preview_image} 
                            alt={widget.name}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="p-2.5 rounded-lg bg-muted">
                            <DynamicIcon iconName={widget.icon || 'LayoutGrid'} className="h-6 w-6" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base font-semibold">{widget.name}</CardTitle>
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
                            className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailWidget(widget);
                              setShowDetailModal(true);
                            }}
                          >
                            <Info className="h-4 w-4" />
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
                  <CardContent className="pt-0 flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                      {widget.short_description || widget.description || 'Açıklama yok'}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {WIDGET_TYPES.find(t => t.id === widget.type)?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {WIDGET_SIZES.find(s => s.id === widget.size)?.name}
                        </span>
                      </div>
                      {/* Yıldız Puanı */}
                      {avgRatings[widget.id] !== undefined && avgRatings[widget.id] !== null && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          <span className="text-xs font-medium">{avgRatings[widget.id]!.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Widget Detay Modalı */}
      <WidgetDetailModal
        widget={detailWidget}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        onAddWidget={(widgetKey) => {
          if (detailWidget) {
            handleAddWidget(widgetKey, detailWidget.id);
          }
          setShowDetailModal(false);
        }}
        isAdding={addingWidgetId === detailWidget?.widget_key}
      />
    </div>
  );
}

export default WidgetMarketplacePage;
