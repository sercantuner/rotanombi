// Dinamik Konteyner Render Bileşeni

import { useState, useEffect, useCallback } from 'react';
import { useContainerWidgets } from '@/hooks/useUserPages';
import { PageContainer, CONTAINER_TEMPLATES, ContainerType } from '@/lib/pageTypes';
import { Widget } from '@/lib/widgetTypes';
import { WidgetSlotPicker } from './WidgetSlotPicker';
import { DynamicWidgetRenderer } from '@/components/dashboard/DynamicWidgetRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ContainerRendererProps {
  container: PageContainer;
  onDelete: () => void;
  isDragMode?: boolean;
  widgetData?: any;
  isLoading?: boolean;
}

export function ContainerRenderer({ 
  container, 
  onDelete, 
  isDragMode = false,
  widgetData = {},
  isLoading = false 
}: ContainerRendererProps) {
  const { widgets: containerWidgets, addWidget, removeWidget, refreshWidgets } = useContainerWidgets(container.id);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [widgetDetails, setWidgetDetails] = useState<Record<string, Widget>>({});

  const template = CONTAINER_TEMPLATES.find(t => t.id === container.container_type);
  if (!template) return null;

  // Widget detaylarını yükle
  useEffect(() => {
    const loadWidgetDetails = async () => {
      if (containerWidgets.length === 0) return;
      
      const widgetIds = containerWidgets.map(w => w.widget_id);
      const { data } = await supabase
        .from('widgets')
        .select('*')
        .in('id', widgetIds);
      
      if (data) {
        const details: Record<string, Widget> = {};
        data.forEach((w: any) => {
          details[w.id] = w as Widget;
        });
        setWidgetDetails(details);
      }
    };
    
    loadWidgetDetails();
  }, [containerWidgets]);

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
  };

  const handleRemoveWidget = async (widgetRecordId: string) => {
    await removeWidget(widgetRecordId);
    refreshWidgets();
  };

  // Slot'ların render'ını oluştur
  const renderSlots = () => {
    return Array.from({ length: template.slots }).map((_, slotIndex) => {
      const slotWidget = containerWidgets.find(w => w.slot_index === slotIndex);
      const widgetDetail = slotWidget ? widgetDetails[slotWidget.widget_id] : null;

      if (slotWidget && widgetDetail) {
        // Widget var, render et
        return (
          <div key={slotIndex} className="relative group min-h-[120px]">
            <DynamicWidgetRenderer
              widgetId={widgetDetail.widget_key}
              data={widgetData}
              isLoading={isLoading}
              currentPage="dashboard"
            />
            {!isDragMode && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveWidget(slotWidget.id)}
              >
                <Trash2 className="h-3 w-3" />
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
    <Card className={cn('mb-4', isDragMode && 'ring-2 ring-primary/20')}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {isDragMode && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
          <CardTitle className="text-sm font-medium">
            {container.title || template.name}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
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
      <CardContent className="p-4 pt-0">
        <div className={cn('grid gap-4', template.gridClass)}>
          {renderSlots()}
        </div>
      </CardContent>

      {/* Widget Picker */}
      <WidgetSlotPicker
        open={widgetPickerOpen}
        onOpenChange={setWidgetPickerOpen}
        onSelectWidget={handleWidgetSelect}
        slotIndex={selectedSlot}
      />
    </Card>
  );
}
