// DataSourceCard - Veri Modeli canvas'ında gösterilen sürüklenebilir kart

import React, { useRef, useCallback } from 'react';
import { Database, Key, Hash, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DataSource } from '@/hooks/useDataSources';

interface DataSourceCardProps {
  dataSource: DataSource;
  position: { x: number; y: number };
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onFieldDragStart: (dataSourceId: string, field: string, position: { x: number; y: number }) => void;
  onFieldDrop: (dataSourceId: string, field: string, position: { x: number; y: number }) => void;
  isDraggingField: boolean;
  isDropTarget: boolean;
  highlightedField?: string;
}

// Alan tipi ikonları
const getFieldIcon = (fieldName: string) => {
  // Primary key benzeri alanlar
  if (fieldName.toLowerCase().includes('kod') || 
      fieldName.toLowerCase().includes('_key') ||
      fieldName.toLowerCase() === 'id') {
    return <Key className="w-3 h-3 text-warning" />;
  }
  // Sayısal alanlar
  if (fieldName.toLowerCase().includes('tutar') || 
      fieldName.toLowerCase().includes('miktar') ||
      fieldName.toLowerCase().includes('bakiye') ||
      fieldName.toLowerCase().includes('fiyat')) {
    return <Hash className="w-3 h-3 text-primary" />;
  }
  return null;
};

export function DataSourceCard({
  dataSource,
  position,
  onPositionChange,
  onFieldDragStart,
  onFieldDrop,
  isDraggingField,
  isDropTarget,
  highlightedField,
}: DataSourceCardProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const initialPos = useRef<{ x: number; y: number } | null>(null);

  const fields = dataSource.last_fields || [];

  // Kart sürükleme
  const handleCardMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.field-item')) return;
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartPos.current || !initialPos.current) return;
      
      const deltaX = moveEvent.clientX - dragStartPos.current.x;
      const deltaY = moveEvent.clientY - dragStartPos.current.y;
      
      onPositionChange(dataSource.id, {
        x: initialPos.current.x + deltaX,
        y: initialPos.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartPos.current = null;
      initialPos.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dataSource.id, position, onPositionChange]);

  // Alan sürükleme başlat
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, field: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const startPos = { x: rect.right, y: rect.top + rect.height / 2 };
    
    onFieldDragStart(dataSource.id, field, startPos);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Sürükleme çizgisi için pozisyon güncelleme ana bileşende yapılır
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      onFieldDrop(dataSource.id, field, { x: upEvent.clientX, y: upEvent.clientY });
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dataSource.id, onFieldDragStart, onFieldDrop]);

  return (
    <Card
      ref={cardRef}
      className={cn(
        "absolute w-64 shadow-lg transition-shadow select-none",
        isDragging && "shadow-xl z-50",
        isDropTarget && "ring-2 ring-primary",
        "bg-card border-border"
      )}
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleCardMouseDown}
    >
      <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <Database className="w-4 h-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-medium truncate">
            {dataSource.name}
          </CardTitle>
        </div>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
          {dataSource.last_record_count ?? 0}
        </Badge>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="border-t border-border">
          <ScrollArea className="h-48 px-2 py-1">
            {fields.map((field) => (
              <div
                key={field}
                className={cn(
                  "field-item group flex items-center gap-2 py-1.5 px-2 rounded-md text-sm",
                  "hover:bg-muted/50 cursor-crosshair transition-colors",
                  highlightedField === field && "bg-primary/10 ring-1 ring-primary",
                  isDraggingField && isDropTarget && "hover:bg-primary/20"
                )}
                onMouseDown={(e) => handleFieldMouseDown(e, field)}
              >
                <div className="w-4 flex justify-center">
                  {getFieldIcon(field)}
                </div>
                <span className="truncate flex-1 text-foreground">{field}</span>
                <div 
                  className={cn(
                    "w-3 h-3 rounded-full border-2 border-muted-foreground/30",
                    "group-hover:border-primary group-hover:bg-primary/20",
                    "transition-colors shrink-0"
                  )}
                />
              </div>
            ))}
          </ScrollArea>
        </div>

        <div className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground text-center">
          {fields.length} alan
        </div>
      </CardContent>
    </Card>
  );
}
