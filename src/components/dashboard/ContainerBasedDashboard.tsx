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
}

// Sortable container wrapper
function SortableContainer({ 
  container, 
  onDelete, 
  isDragMode, 
  widgetData, 
  isLoading 
}: { 
  container: PageContainer; 
  onDelete: () => void; 
  isDragMode: boolean;
  widgetData?: any;
  isLoading?: boolean;
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
        />
      </div>
    </div>
  );
}

export function ContainerBasedDashboard({ pageId, widgetData = {}, isLoading = false }: ContainerBasedDashboardProps) {
  const { user } = useAuth();
  const { containers, addContainer, deleteContainer, reorderContainers, refreshContainers } = usePageContainers(pageId);
  const [isDragMode, setIsDragMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localContainers, setLocalContainers] = useState<PageContainer[]>([]);
  const [containerPickerOpen, setContainerPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Eğer hiç container yoksa boş durum göster
  if (containers.length === 0 && !isDragMode) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Dashboard Boş</h3>
          <p className="text-muted-foreground mb-4">
            Dashboard'unuzu oluşturmak için container ekleyin
          </p>
          <Button onClick={() => setContainerPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Container Ekle
          </Button>
          
          <ContainerPicker
            open={containerPickerOpen}
            onOpenChange={setContainerPickerOpen}
            onSelectContainer={handleAddContainer}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setContainerPickerOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Container Ekle
        </Button>

        <div className="flex items-center gap-2">
          {isDragMode ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                İptal
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
                <Check className="h-4 w-4 mr-2" />
                Kaydet
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsDragMode(true)}>
              <Move className="h-4 w-4 mr-2" />
              Düzenle
            </Button>
          )}
        </div>
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
