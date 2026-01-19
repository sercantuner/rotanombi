// Sortable Widget - Drag & Drop destekli widget wrapper
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  isKPI?: boolean;
  isDragMode?: boolean;
}

export function SortableWidget({ 
  id, 
  children, 
  className,
  isKPI = false,
  isDragMode = false,
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        'relative group',
        isDragging && 'ring-2 ring-primary ring-offset-2 rounded-xl',
        className
      )}
    >
      {/* Drag Handle - Only visible in drag mode */}
      {isDragMode && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'absolute z-10 cursor-grab active:cursor-grabbing',
            'bg-secondary/80 backdrop-blur-sm rounded-md p-1',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'hover:bg-primary/20',
            isKPI ? 'top-1 right-1' : '-top-2 left-1/2 -translate-x-1/2'
          )}
          title="Sürükleyerek taşı"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  );
}
