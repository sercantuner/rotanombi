// Dinamik Konteyner Render Bileşeni

import { useState, useEffect, useCallback } from 'react';
import { useContainerWidgets } from '@/hooks/useUserPages';
import { PageContainer, CONTAINER_TEMPLATES, ContainerType } from '@/lib/pageTypes';
import { Widget } from '@/lib/widgetTypes';
import { WidgetSlotPicker } from './WidgetSlotPicker';
import { ContainerSettingsModal, getContainerStyleClasses } from './ContainerSettingsModal';
import { DynamicWidgetRenderer } from '@/components/dashboard/DynamicWidgetRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, GripVertical, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { KpiFilter } from '@/components/dashboard/KpiFilterModal';

interface ContainerWidgetSettings {
  filters?: KpiFilter;
}

interface ContainerRendererProps {
  container: PageContainer;
  onDelete: () => void;
  isDragMode?: boolean;
  widgetData?: any;
  isLoading?: boolean;
  isWidgetEditMode?: boolean;
}

export function ContainerRenderer({ 
  container, 
  onDelete, 
  isDragMode = false,
  widgetData = {},
  isLoading = false,
  isWidgetEditMode = false
}: ContainerRendererProps) {
  const { widgets: containerWidgets, addWidget, removeWidget, refreshWidgets } = useContainerWidgets(container.id);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [widgetDetails, setWidgetDetails] = useState<Record<string, Widget>>({});
  const [localContainer, setLocalContainer] = useState(container);

  const template = CONTAINER_TEMPLATES.find(t => t.id === container.container_type);
  if (!template) return null;

  // Widget detaylarını yükle (builder_config dahil)
  useEffect(() => {
    const loadWidgetDetails = async () => {
      if (containerWidgets.length === 0) {
        setWidgetDetails({});
        return;
      }
      
      const widgetIds = containerWidgets.map(w => w.widget_id);
      const { data } = await supabase
        .from('widgets')
        .select('*')
        .in('id', widgetIds);
      
      if (data) {
        const details: Record<string, Widget> = {};
        data.forEach((w: any) => {
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
            builder_config: w.builder_config || null, // builder_config dahil et
          };
        });
        setWidgetDetails(details);
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
      setSelectedSlot(slotIndex);
      setWidgetPickerOpen(true);
    }
  };

  const handleWidgetSelect = async (widget: Widget) => {
    await addWidget(widget.id, selectedSlot);
    refreshWidgets();
    toast.success(`${widget.name} eklendi`);
  };

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
      const { error } = await supabase
        .from('container_widgets')
        .update({
          settings: { filters } as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', containerWidgetId);

      if (error) throw error;
      refreshWidgets();
    } catch (error) {
      console.error('Error saving widget filters:', error);
    }
  };

  // Slot'ların render'ını oluştur
  const renderSlots = () => {
    return Array.from({ length: template.slots }).map((_, slotIndex) => {
      const slotWidget = containerWidgets.find(w => w.slot_index === slotIndex);
      const widgetDetail = slotWidget ? widgetDetails[slotWidget.widget_id] : null;

      // Widget var ama detayları henüz yüklenmedi - skeleton göster
      if (slotWidget && !widgetDetail) {
        return (
          <Skeleton key={slotIndex} className="h-full w-full min-h-[120px] rounded-xl" />
        );
      }

      if (slotWidget && widgetDetail) {
        // Widget ayarlarını parse et
        const widgetSettings = slotWidget.settings as ContainerWidgetSettings | null;
        const widgetFilters = widgetSettings?.filters;

        // Widget var, render et - CSS izolasyonu için isolate class, h-full eklendi
        return (
          <div key={slotIndex} className="relative group h-full min-h-[120px] isolate">
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
            {isWidgetEditMode && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 left-2 h-7 w-7 shadow-md z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveWidget(slotWidget.id, widgetDetail.name);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
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
            'min-h-[120px] rounded-lg border-2 border-dashed border-muted-foreground/30',
            'flex flex-col items-center justify-center gap-2 p-4',
            'text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5',
            'transition-all cursor-pointer'
          )}
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">Widget Ekle</span>
          <span className="text-xs">Slot {slotIndex + 1}</span>
        </button>
      );
    });
  };

  return (
    <>
      <Card className={cn(
        'mb-4',
        isDragMode && 'ring-2 ring-primary/20',
        styleClasses
      )}>
        {showTitle && (
          <CardHeader className={cn('flex flex-row items-center justify-between', isCompact ? 'py-2 px-3' : 'py-3 px-4')}>
            <div className="flex items-center gap-2">
              {isDragMode && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
              <CardTitle className="text-sm font-medium">
                {localContainer.title || template.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className={cn(isCompact ? 'p-2' : 'p-4', showTitle ? 'pt-0' : '')}>
          {!showTitle && (
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-7 w-7"
                onClick={onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className={cn('grid gap-4 items-stretch [&>*]:h-full', template.gridClass)}>
            {renderSlots()}
          </div>
        </CardContent>
      </Card>

      {/* Widget Picker */}
      <WidgetSlotPicker
        open={widgetPickerOpen}
        onOpenChange={setWidgetPickerOpen}
        onSelectWidget={handleWidgetSelect}
        slotIndex={selectedSlot}
      />

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
