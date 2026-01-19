// Draggable Widget Grid - Widget sürükle-bırak grid container
import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableWidget } from './SortableWidget';
import { DynamicWidgetRenderer } from './DynamicWidgetRenderer';
import { WidgetLayout, WidgetSize, WidgetCategory } from '@/lib/widgetRegistry';
import { cn } from '@/lib/utils';
import { Move, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DraggableWidgetGridProps {
  widgets: WidgetLayout[];
  currentPage: WidgetCategory;
  data: any;
  isLoading?: boolean;
  onReorder: (newOrder: string[]) => Promise<void>;
}

export function DraggableWidgetGrid({
  widgets,
  currentPage,
  data,
  isLoading = false,
  onReorder,
}: DraggableWidgetGridProps) {
  const [isDragMode, setIsDragMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localWidgets, setLocalWidgets] = useState(widgets);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local widgets when props change
  React.useEffect(() => {
    if (!isDragMode) {
      setLocalWidgets(widgets);
    }
  }, [widgets, isDragMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Separate KPI widgets from other widgets
  const kpiWidgets = localWidgets.filter(w => w.id.startsWith('kpi_') && w.visible !== false);
  const otherWidgets = localWidgets.filter(w => !w.id.startsWith('kpi_') && w.visible !== false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeWidget = localWidgets.find(w => w.id === active.id);
    const overWidget = localWidgets.find(w => w.id === over.id);

    if (!activeWidget || !overWidget) return;

    // Only allow reordering within the same group (KPI or Other)
    const isActiveKPI = activeWidget.id.startsWith('kpi_');
    const isOverKPI = overWidget.id.startsWith('kpi_');

    if (isActiveKPI !== isOverKPI) {
      toast.info('KPI kartları sadece kendi aralarında sıralanabilir');
      return;
    }

    setLocalWidgets((items) => {
      const oldIndex = items.findIndex(w => w.id === active.id);
      const newIndex = items.findIndex(w => w.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setHasChanges(true);
  }, [localWidgets]);

  const handleSave = async () => {
    try {
      const newOrder = localWidgets.map(w => w.id);
      await onReorder(newOrder);
      setHasChanges(false);
      setIsDragMode(false);
      toast.success('Widget sıralaması kaydedildi');
    } catch (error) {
      console.error('Error saving widget order:', error);
      toast.error('Sıralama kaydedilemedi');
    }
  };

  const handleCancel = () => {
    setLocalWidgets(widgets);
    setHasChanges(false);
    setIsDragMode(false);
  };

  const getGridClass = (size: WidgetSize | undefined): string => {
    switch (size) {
      case 'sm': return 'col-span-1';
      case 'md': return 'col-span-1 lg:col-span-2';
      case 'lg': return 'col-span-1 lg:col-span-3';
      case 'xl': return 'col-span-1 lg:col-span-4';
      case 'full': return 'col-span-full';
      default: return 'col-span-1';
    }
  };

  const activeWidget = activeId ? localWidgets.find(w => w.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Drag Mode Toggle */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {isDragMode ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              İptal
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Kaydet
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDragMode(true)}
            className="gap-2"
          >
            <Move className="w-4 h-4" />
            Düzenle
          </Button>
        )}
      </div>

      {isDragMode && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary flex items-center gap-2">
          <Move className="w-4 h-4" />
          <span>Widget'ları sürükleyerek yeniden sıralayabilirsiniz</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      {kpiWidgets.length > 0 && (
        <SortableContext
          items={kpiWidgets.map(w => w.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {kpiWidgets
              .sort((a, b) => a.order - b.order)
              .map((widget) => (
                <SortableWidget 
                  key={widget.id} 
                  id={widget.id}
                  isKPI={true}
                  isDragMode={isDragMode}
                >
                  <DynamicWidgetRenderer
                    widgetId={widget.id}
                    currentPage={currentPage}
                    data={data}
                    isLoading={isLoading}
                  />
                </SortableWidget>
              ))}
          </div>
        </SortableContext>
      )}

      {/* Other Widgets Grid */}
      {otherWidgets.length > 0 && (
        <SortableContext
          items={otherWidgets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
            {otherWidgets
              .sort((a, b) => a.order - b.order)
              .map((widget) => (
                <SortableWidget
                  key={widget.id}
                  id={widget.id}
                  className={getGridClass(widget.size)}
                  isDragMode={isDragMode}
                >
                  <DynamicWidgetRenderer
                    widgetId={widget.id}
                    currentPage={currentPage}
                    data={data}
                    isLoading={isLoading}
                  />
                </SortableWidget>
              ))}
          </div>
        </SortableContext>
      )}

      {/* Drag Overlay */}
      <DragOverlay>
        {activeWidget ? (
          <div className={cn(
            'opacity-90 shadow-2xl rounded-xl',
            activeWidget.id.startsWith('kpi_') ? '' : getGridClass(activeWidget.size)
          )}>
            <DynamicWidgetRenderer
              widgetId={activeWidget.id}
              currentPage={currentPage}
              data={data}
              isLoading={isLoading}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
