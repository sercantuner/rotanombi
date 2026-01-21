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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, Move, Check, X, LayoutGrid, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CONTAINER_TEMPLATES, ContainerType, PageContainer } from '@/lib/pageTypes';

interface ContainerBasedDashboardProps {
  pageId: string;
  widgetData?: any;
  isLoading?: boolean;
}

// Floating Action Button Component
function FloatingActions({
  isDragMode,
  isWidgetEditMode,
  hasChanges,
  onContainerAdd,
  onDragModeToggle,
  onWidgetEditModeToggle,
  onSave,
  onCancel
}: {
  isDragMode: boolean;
  isWidgetEditMode: boolean;
  hasChanges: boolean;
  onContainerAdd: () => void;
  onDragModeToggle: () => void;
  onWidgetEditModeToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
      {isDragMode ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={onCancel}
                className="h-10 w-10 rounded-full shadow-lg bg-background"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">İptal</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="icon"
                onClick={onSave} 
                disabled={!hasChanges}
                className="h-10 w-10 rounded-full shadow-lg"
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Kaydet</TooltipContent>
          </Tooltip>
        </>
      ) : (
        <>
          {/* Widget Düzenle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={isWidgetEditMode ? 'default' : 'outline'}
                size="icon"
                onClick={onWidgetEditModeToggle}
                className="h-10 w-10 rounded-full shadow-lg bg-background"
              >
                {isWidgetEditMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isWidgetEditMode ? 'Düzenlemeyi Bitir' : 'Widget Düzenle'}
            </TooltipContent>
          </Tooltip>
          {/* Container Ekle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={onContainerAdd}
                className="h-10 w-10 rounded-full shadow-lg bg-background"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Container Ekle</TooltipContent>
          </Tooltip>
          {/* Container Düzenle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={onDragModeToggle}
                className="h-10 w-10 rounded-full shadow-lg bg-background"
              >
                <Move className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Container Sırala</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

// Sortable container wrapper
function SortableContainer({ 
  container, 
  onDelete, 
  isDragMode, 
  widgetData, 
  isLoading,
  isWidgetEditMode,
  pageId
}: { 
  container: PageContainer; 
  onDelete: () => void; 
  isDragMode: boolean;
  widgetData?: any;
  isLoading?: boolean;
  isWidgetEditMode?: boolean;
  pageId?: string;
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
          pageId={pageId}
        />
      </div>
    </div>
  );
}

export function ContainerBasedDashboard({ pageId, widgetData = {}, isLoading = false }: ContainerBasedDashboardProps) {
  const { user } = useAuth();
  const { containers, addContainer, deleteContainer, reorderContainers, refreshContainers, isLoading: containersLoading } = usePageContainers(pageId);
  const [isDragMode, setIsDragMode] = useState(false);
  const [isWidgetEditMode, setIsWidgetEditMode] = useState(false);
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
    <TooltipProvider delayDuration={0}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Floating Toolbar - Sağ Alt Köşe */}
        <FloatingActions
          isDragMode={isDragMode}
          isWidgetEditMode={isWidgetEditMode}
          hasChanges={hasChanges}
          onContainerAdd={() => setContainerPickerOpen(true)}
          onDragModeToggle={() => setIsDragMode(true)}
          onWidgetEditModeToggle={() => setIsWidgetEditMode(!isWidgetEditMode)}
          onSave={handleSave}
          onCancel={handleCancel}
        />

        {isDragMode && (
          <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary flex items-center gap-2">
            <Move className="h-4 w-4" />
            <span>Container'ları sürükleyerek yeniden sıralayabilirsiniz</span>
          </div>
        )}

        {isWidgetEditMode && (
          <div className="mb-4 p-3 rounded-lg bg-accent/20 border border-accent/30 text-sm text-accent-foreground flex items-center gap-2">
            <Edit className="h-4 w-4" />
            <span>Widget'ları düzenleyebilir veya silebilirsiniz. Bitirmek için sağ alttaki ✓ butonuna tıklayın.</span>
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
                pageId={pageId}
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
    </TooltipProvider>
  );
}
