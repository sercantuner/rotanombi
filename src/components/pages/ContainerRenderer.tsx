// Dinamik Konteyner Render Bileşeni

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContainerWidgets } from '@/hooks/useUserPages';
// NOT: useDataSourceLoader KALDIRILDI - her container için ayrı instance oluşturuyordu!
// loadSingleDataSource artık prop olarak alınıyor
import { useChartColorPalette, COLOR_PALETTES } from '@/hooks/useChartColorPalette';
import { PageContainer, CONTAINER_TEMPLATES, ContainerType } from '@/lib/pageTypes';
import { Widget } from '@/lib/widgetTypes';
import { ContainerSettingsModal, getContainerStyleClasses } from './ContainerSettingsModal';
import { DynamicWidgetRenderer } from '@/components/dashboard/DynamicWidgetRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Trash2, GripVertical, Settings, X, Palette, Check, MessageSquarePlus, Calendar, Maximize2 } from 'lucide-react';
import { WidgetFeedbackButton } from '@/components/dashboard/WidgetFeedbackButton';
import { WidgetDateFilter, getDateRangeForPeriod } from '@/components/dashboard/WidgetDateFilter';
import { DatePeriod } from '@/lib/widgetBuilderTypes';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KpiFilter } from '@/components/dashboard/KpiFilterModal';

interface ContainerWidgetSettings {
  filters?: KpiFilter;
  heightMultiplier?: 1 | 1.5 | 2 | 2.5 | 3;
}

interface ContainerRendererProps {
  container: PageContainer;
  onDelete: () => void;
  isDragMode?: boolean;
  widgetData?: any;
  isLoading?: boolean;
  isWidgetEditMode?: boolean;
  pageId?: string | null; // Sayfa ID'si - veri kaynağı yüklemesi için (artık kullanılmıyor)
  loadSingleDataSource?: (dataSourceId: string) => Promise<any[] | null>; // Üst bileşenden prop olarak alınıyor
}

export function ContainerRenderer({ 
  container, 
  onDelete, 
  isDragMode = false,
  widgetData = {},
  isLoading = false,
  isWidgetEditMode = false,
  pageId = null,
  loadSingleDataSource
}: ContainerRendererProps) {
  const navigate = useNavigate();
  const { widgets: containerWidgets, addWidget, removeWidget, refreshWidgets } = useContainerWidgets(container.id);
  const { currentPaletteName, setPalette } = useChartColorPalette();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [widgetDetails, setWidgetDetails] = useState<Record<string, Widget>>({});
  const [localContainer, setLocalContainer] = useState(container);

  const template = CONTAINER_TEMPLATES.find(t => t.id === container.container_type);

  // Widget detaylarını yükle (builder_config dahil)
  // Ayrıca silinmiş widget'ları tespit et
  const [orphanSlots, setOrphanSlots] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const loadWidgetDetails = async () => {
      if (containerWidgets.length === 0) {
        setWidgetDetails({});
        setOrphanSlots(new Set());
        return;
      }
      
      const widgetIds = containerWidgets.map(w => w.widget_id);
      const { data } = await supabase
        .from('widgets')
        .select('*')
        .in('id', widgetIds);
      
      if (data) {
        const details: Record<string, Widget> = {};
        const foundIds = new Set<string>();
        
        data.forEach((w: any) => {
          foundIds.add(w.id);
          details[w.id] = {
            id: w.id,
            widget_key: w.widget_key,
            name: w.name,
            description: w.description,
            category: w.category,
            type: w.type,
            data_source: w.data_source,
            size: w.size,
            icon: w.icon,
            default_page: w.default_page,
            default_visible: w.default_visible,
            available_filters: w.available_filters || [],
            default_filters: w.default_filters || {},
            min_height: w.min_height,
            grid_cols: w.grid_cols,
            is_active: w.is_active,
            sort_order: w.sort_order,
            created_at: w.created_at,
            updated_at: w.updated_at,
            created_by: w.created_by,
            builder_config: w.builder_config || null,
          };
        });
        
        // Orphan widget'ları tespit et (container_widgets'ta var ama widgets tablosunda yok)
        const orphans = new Set<string>();
        containerWidgets.forEach(cw => {
          if (!foundIds.has(cw.widget_id)) {
            orphans.add(cw.id);
          }
        });
        
        setWidgetDetails(details);
        setOrphanSlots(orphans);
      }
    };
    
    loadWidgetDetails();
  }, [containerWidgets]);

  // Container güncellenince localContainer'ı güncelle
  useEffect(() => {
    setLocalContainer(container);
  }, [container]);

  const handleSlotClick = (slotIndex: number) => {
    // Bu slotta zaten widget var mı?
    const existingWidget = containerWidgets.find(w => w.slot_index === slotIndex);
    if (!existingWidget) {
      // Tam sayfa marketplace'e yönlendir
      const params = new URLSearchParams();
      if (pageId) params.set('page', pageId);
      params.set('container', container.id);
      params.set('slot', slotIndex.toString());
      navigate(`/marketplace?${params.toString()}`);
    }
  };

  // handleWidgetSelect artık marketplace'den yapılıyor

  const handleRemoveWidget = async (containerWidgetId: string, widgetName?: string) => {
    try {
      await removeWidget(containerWidgetId);
      refreshWidgets();
      toast.success(widgetName ? `${widgetName} kaldırıldı` : 'Widget kaldırıldı');
    } catch (error) {
      console.error('Error removing widget:', error);
      toast.error('Widget kaldırılamadı');
    }
  };

  const handleSettingsSave = async () => {
    // Container'ı yeniden yükle
    const { data } = await supabase
      .from('page_containers')
      .select('*')
      .eq('id', container.id)
      .single();
    
    if (data) {
      setLocalContainer(data as unknown as PageContainer);
    }
  };

  // Stil sınıflarını al
  const styleClasses = getContainerStyleClasses(localContainer.settings || {});
  const showTitle = localContainer.settings?.showTitle !== false;
  const isCompact = localContainer.settings?.compact === true;

  // Widget filtre değişikliğini handle et
  const handleWidgetFilterChange = async (containerWidgetId: string, filters: KpiFilter) => {
    try {
      const existingWidget = containerWidgets.find(w => w.id === containerWidgetId);
      const existingSettings = (existingWidget?.settings as ContainerWidgetSettings) || {};
      const { error } = await supabase
        .from('container_widgets')
        .update({
          settings: { ...existingSettings, filters } as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', containerWidgetId);

      if (error) throw error;
      refreshWidgets();
    } catch (error) {
      console.error('Error saving widget filters:', error);
    }
  };

  // Widget yükseklik çarpanını değiştir
  const handleHeightMultiplierChange = async (containerWidgetId: string, multiplier: 1 | 1.5 | 2 | 2.5 | 3) => {
    try {
      const existingWidget = containerWidgets.find(w => w.id === containerWidgetId);
      const existingSettings = (existingWidget?.settings as ContainerWidgetSettings) || {};
      const { error } = await supabase
        .from('container_widgets')
        .update({
          settings: { ...existingSettings, heightMultiplier: multiplier } as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', containerWidgetId);

      if (error) throw error;
      refreshWidgets();
      toast.success(`Yükseklik ${multiplier}x olarak ayarlandı`);
    } catch (error) {
      console.error('Error saving height multiplier:', error);
      toast.error('Yükseklik ayarlanamadı');
    }
  };

  // Slot'ların render'ını oluştur
  if (!template) return null;
  const renderSlots = () => {
    return Array.from({ length: template.slots }).map((_, slotIndex) => {
      const slotWidget = containerWidgets.find(w => w.slot_index === slotIndex);
      const widgetDetail = slotWidget ? widgetDetails[slotWidget.widget_id] : null;
      const isOrphan = slotWidget && orphanSlots.has(slotWidget.id);

      // Orphan slot - widget silinmiş ama container_widgets'ta kayıt kalmış
      if (isOrphan && slotWidget) {
        return (
          <div key={slotIndex} className="relative min-h-[80px] rounded border border-dashed border-destructive/50 bg-destructive/5 flex flex-col items-center justify-center gap-1 p-2">
            <span className="text-[10px] text-destructive font-medium">Silinmiş Widget</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  handleRemoveWidget(slotWidget.id);
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Temizle
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  handleRemoveWidget(slotWidget.id);
                  // Marketplace'e yönlendir
                  const params = new URLSearchParams();
                  if (pageId) params.set('page', pageId);
                  params.set('container', container.id);
                  params.set('slot', slotIndex.toString());
                  navigate(`/marketplace?${params.toString()}`);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Değiştir
              </Button>
            </div>
          </div>
        );
      }

      // Widget var ama detayları henüz yüklenmedi
      // Kısa süreli yüklemelerde flicker önlemek için hafif placeholder kullan
      if (slotWidget && !widgetDetail) {
        return (
          <div key={slotIndex} className="h-full w-full min-h-[80px] rounded bg-muted/20 transition-opacity" />
        );
      }

      if (slotWidget && widgetDetail) {
        // Widget ayarlarını parse et
        const widgetSettings = slotWidget.settings as ContainerWidgetSettings | null;
        const widgetFilters = widgetSettings?.filters;
        const heightMultiplier = widgetSettings?.heightMultiplier || 1;

        // Yükseklik çarpanına göre min-height hesapla
        const heightStyle: React.CSSProperties = heightMultiplier > 1 
          ? { minHeight: `${heightMultiplier * 280}px` } 
          : {};

        // Widget var, render et - CSS izolasyonu için isolate class, h-full eklendi
        return (
          <div key={slotIndex} className="relative group h-full min-h-[80px] isolate" style={heightStyle}>
            <DynamicWidgetRenderer
              widgetId={widgetDetail.widget_key}
              data={widgetData}
              isLoading={isLoading}
              currentPage="dashboard"
              dbWidget={widgetDetail}
              containerWidgetId={slotWidget.id}
              widgetFilters={widgetFilters}
              onFiltersChange={(filters) => handleWidgetFilterChange(slotWidget.id, filters)}
              isWidgetEditMode={isWidgetEditMode}
            />
            
            {/* Hover kontrolleri - sağ üst */}
            <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              {/* Tarih filtresi - eğer widget'ta tarih filtresi aktifse */}
              {widgetDetail.builder_config?.dateFilter?.enabled && widgetDetail.builder_config?.dateFilter?.showInWidget && (
                <div className="bg-background/90 backdrop-blur-sm rounded shadow-sm">
                  <WidgetDateFilter
                    config={widgetDetail.builder_config.dateFilter}
                    currentPeriod={widgetDetail.builder_config.dateFilter.defaultPeriod || 'all'}
                    onPeriodChange={() => {}}
                    compact
                  />
                </div>
              )}
              {/* Feedback butonu */}
              <WidgetFeedbackButton 
                widgetId={widgetDetail.id} 
                widgetName={widgetDetail.name}
              />
            </div>
            
            {/* Edit mode kontrolleri - sol üstte */}
            {isWidgetEditMode && (
              <div className="absolute top-1 left-1 flex items-center gap-0.5 z-20">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-5 w-5 shadow-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveWidget(slotWidget.id, widgetDetail.name);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                {/* Yükseklik seçici */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-5 w-5 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    {([1, 1.5, 2, 2.5, 3] as const).map(m => (
                      <DropdownMenuItem
                        key={m}
                        onClick={() => handleHeightMultiplierChange(slotWidget.id, m)}
                        className="gap-2"
                      >
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="flex gap-0.5 items-end">
                            {Array.from({ length: Math.ceil(m) }).map((_, i) => (
                              <div
                                key={i}
                                className="w-2.5 rounded-sm bg-primary"
                                style={{ height: `${6 + i * 3 + (m % 1 ? 1 : 0)}px` }}
                              />
                            ))}
                          </div>
                          <span className="text-xs">{m}x Yükseklik</span>
                        </div>
                        {heightMultiplier === m && (
                          <Check className="w-3 h-3 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Renk paleti seçici */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-5 w-5 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Palette className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    {COLOR_PALETTES.map(palette => (
                      <DropdownMenuItem
                        key={palette.name}
                        onClick={() => setPalette(palette.name)}
                        className="gap-2"
                      >
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="flex gap-0.5">
                            {palette.colors.slice(0, 4).map((color, i) => (
                              <div
                                key={i}
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="text-xs">{palette.label}</span>
                        </div>
                        {currentPaletteName === palette.name && (
                          <Check className="w-3 h-3 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        );
      }

      // Boş slot
      return (
        <button
          key={slotIndex}
          onClick={() => handleSlotClick(slotIndex)}
          className={cn(
            'min-h-[80px] rounded border border-dashed border-muted-foreground/20',
            'flex flex-col items-center justify-center gap-1 p-2',
            'text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5',
            'transition-all cursor-pointer'
          )}
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-medium">Widget Ekle</span>
        </button>
      );
    });
  };

  return (
    <>
      <Card className={cn(
        'mb-1 md:mb-2',
        isDragMode && 'ring-1 ring-primary/20',
        styleClasses
      )}>
        {/* Konteyner başlığı sadece drag mode'da görünür */}
        {showTitle && isDragMode && (
          <CardHeader className={cn('flex flex-row items-center justify-between', isCompact ? 'py-1 px-1.5' : 'py-1.5 px-2')}>
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
              <CardTitle className="text-xs font-medium">
                {localContainer.title || template.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-0.5">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className={cn(
          isCompact ? 'p-0.5 md:p-1' : 'p-1 md:p-2', 
          showTitle ? 'pt-0' : ''
        )}>
          {/* Başlık kapalıyken ayar/sil butonları - sadece drag modda görünür */}
          {!showTitle && isDragMode && (
            <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-6 w-6"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          {/* 
            Grafik container'ları için minimum yükseklik:
            - chart_full, chart_half, chart_third: min-h-[280px] (donut/pie için gerekli)
            - info_cards: min-h-[200px]
            - KPI satırları: min-h yok (auto)
          */}
          <div className={cn(
            'grid gap-1 md:gap-2 items-stretch [&>*]:h-full',
            template.gridClass,
            // Harita container'ları - max-h yok, daha büyük min-h (Leaflet için gerekli)
            (container.container_type === 'map_full' || 
             container.container_type === 'map_half') && '[&>*]:min-h-[400px]',
            // Grafik container'ları için min yükseklik (max-h kaldırıldı - heightMultiplier ile çakışıyordu)
            (container.container_type === 'chart_full' || 
             container.container_type === 'chart_half' || 
             container.container_type === 'chart_third') && '[&>*]:min-h-[280px]',
            (container.container_type === 'info_cards_2' ||
             container.container_type === 'info_cards_3') && '[&>*]:min-h-[200px]'
          )}>
            {renderSlots()}
          </div>
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <ContainerSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        container={localContainer}
        onSave={handleSettingsSave}
      />
    </>
  );
}
