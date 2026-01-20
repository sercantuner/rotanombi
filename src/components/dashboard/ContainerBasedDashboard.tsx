// Container Based Dashboard - Konteyner tabanlı dashboard sistemi

import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContainerRenderer } from '@/components/pages/ContainerRenderer';
import { ContainerPicker } from '@/components/pages/ContainerPicker';
import { usePageContainers } from '@/hooks/useUserPages';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Move, Check, X, LayoutGrid, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CONTAINER_TEMPLATES, ContainerType, PageContainer } from '@/lib/pageTypes';

interface ContainerBasedDashboardProps {
  pageId: string;
  widgetData?: any;
  isLoading?: boolean;
  isWidgetEditMode?: boolean;
}

// Sortable container wrapper
function SortableContainer({ 
  container, 
  onDelete, 
  isDragMode, 
  widgetData, 
  isLoading,
  isWidgetEditMode
}: { 
  container: PageContainer; 
  onDelete: () => void; 
  isDragMode: boolean;
  widgetData?: any;
  isLoading?: boolean;
  isWidgetEditMode?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: container.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        'transition-opacity',
        isDragging && 'opacity-50'
      )}
    >
      <div className={cn(isDragMode && 'relative')}>
        {isDragMode && (
          <div 
            {...listeners}
            className="absolute -left-3 top-1/2 -translate-y-1/2 p-2 cursor-grab active:cursor-grabbing z-10 bg-background border rounded-lg shadow-sm"
          >
            <Move className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <ContainerRenderer
          container={container}
          onDelete={onDelete}
          isDragMode={isDragMode}
          widgetData={widgetData}
          isLoading={isLoading}
          isWidgetEditMode={isWidgetEditMode}
        />
      </div>
    </div>
  );
}

export function ContainerBasedDashboard({ pageId, widgetData = {}, isLoading = false, isWidgetEditMode = false }: ContainerBasedDashboardProps) {
  const { user } = useAuth();
  const { containers, addContainer, deleteContainer, reorderContainers, refreshContainers, isLoading: containersLoading } = usePageContainers(pageId);
  const [isDragMode, setIsDragMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localContainers, setLocalContainers] = useState<PageContainer[]>([]);
  const [containerPickerOpen, setContainerPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [defaultContainersCreated, setDefaultContainersCreated] = useState(false);

  // Varsayılan container'ları oluştur
  useEffect(() => {
    const createDefaultContainers = async () => {
      if (containersLoading || defaultContainersCreated) return;
      if (containers.length === 0 && pageId) {
        // 5'li KPI satırı oluştur
        await addContainer('kpi_row_5', 'KPI Özeti');
        // 2'li grafik alanı oluştur
        await addContainer('chart_half', 'Grafik Alanı');
        refreshContainers();
        setDefaultContainersCreated(true);
      }
    };

    createDefaultContainers();
  }, [containers.length, containersLoading, pageId, defaultContainersCreated]);

  useEffect(() => {
    if (!isDragMode) {
      setLocalContainers(containers);
    }
  }, [containers, isDragMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    setLocalContainers((items) => {
      const oldIndex = items.findIndex(c => c.id === active.id);
      const newIndex = items.findIndex(c => c.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    try {
      const newOrder = localContainers.map(c => c.id);
      await reorderContainers(newOrder);
      setHasChanges(false);
      setIsDragMode(false);
      toast.success('Düzen kaydedildi');
    } catch (error) {
      toast.error('Kaydetme hatası');
    }
  };

  const handleCancel = () => {
    setLocalContainers(containers);
    setHasChanges(false);
    setIsDragMode(false);
  };

  const handleAddContainer = async (containerType: ContainerType) => {
    await addContainer(containerType);
    refreshContainers();
  };

  const handleDeleteContainer = async (containerId: string) => {
    await deleteContainer(containerId);
    refreshContainers();
  };

  const activeContainer = activeId ? localContainers.find(c => c.id === activeId) : null;

  // Yükleniyor durumu
  if (containersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Floating Toolbar - Sağ Alt Köşe */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        {isDragMode ? (
          <>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleCancel}
              className="h-10 w-10 rounded-full shadow-lg bg-background"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button 
              size="icon"
              onClick={handleSave} 
              disabled={!hasChanges}
              className="h-10 w-10 rounded-full shadow-lg"
            >
              <Check className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setContainerPickerOpen(true)}
              className="h-10 w-10 rounded-full shadow-lg bg-background"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setIsDragMode(true)}
              className="h-10 w-10 rounded-full shadow-lg bg-background"
            >
              <Move className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {isDragMode && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary flex items-center gap-2">
          <Move className="h-4 w-4" />
          <span>Container'ları sürükleyerek yeniden sıralayabilirsiniz</span>
        </div>
      )}

      {/* Containers */}
      <SortableContext
        items={localContainers.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {localContainers.map(container => (
            <SortableContainer
              key={container.id}
              container={container}
              onDelete={() => handleDeleteContainer(container.id)}
              isDragMode={isDragMode}
              widgetData={widgetData}
              isLoading={isLoading}
              isWidgetEditMode={isWidgetEditMode}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeContainer && (
          <div className="opacity-90 shadow-2xl">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  {CONTAINER_TEMPLATES.find(t => t.id === activeContainer.container_type)?.name}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}
      </DragOverlay>

      {/* Container Picker */}
      <ContainerPicker
        open={containerPickerOpen}
        onOpenChange={setContainerPickerOpen}
        onSelectContainer={handleAddContainer}
      />
    </DndContext>
  );
}
