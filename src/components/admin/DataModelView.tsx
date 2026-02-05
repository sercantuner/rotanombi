// DataModelView - Power BI benzeri veri modeli görünümü

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Save, 
  AlertCircle,
  Loader2,
  Database,
  LayoutGrid,
  Shuffle,
  Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDataSources, DataSource } from '@/hooks/useDataSources';
import { useDataSourceRelationships, DataSourceRelationship, RelationshipFormData } from '@/hooks/useDataSourceRelationships';
import { DataSourceCard } from './DataSourceCard';
import { RelationshipLine, RelationshipMarkers } from './RelationshipLine';
import { RelationshipEditor } from './RelationshipEditor';
import { DataTransformEditor } from './DataTransformEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Grid ayarları
const GRID_SIZE = 20;
const CARD_WIDTH = 256;
const CARD_HEIGHT = 280;
const GAP = 60;

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

// Snap to grid helper
function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Kart pozisyonu tipi
interface CardPosition {
  x: number;
  y: number;
}

// Sürükleme durumu
interface DragState {
  isDragging: boolean;
  sourceDataSourceId: string;
  sourceField: string;
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
}

export function DataModelView() {
  const { dataSources, updateDataSource, isLoading: dsLoading } = useDataSources();
  const { 
    relationships, 
    createRelationship, 
    updateRelationship, 
    deleteRelationship,
    isLoading: relLoading,
    isCreating,
    isUpdating,
    isDeleting,
  } = useDataSourceRelationships();

  // Canvas state
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Kart pozisyonları
  const [cardPositions, setCardPositions] = useState<Record<string, CardPosition>>({});
  const [positionsChanged, setPositionsChanged] = useState(false);
  
  // Grid/snap ayarları
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  // Pan için space tuşu desteği
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Sürükleme durumu (alan sürükleme)
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dataSourceId: string; field: string } | null>(null);

  // Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState<DataSourceRelationship | null>(null);
  const [hoveredRelationship, setHoveredRelationship] = useState<DataSourceRelationship | null>(null);
  const [newRelationshipData, setNewRelationshipData] = useState<{
    sourceDs?: DataSource;
    targetDs?: DataSource;
    sourceField?: string;
    targetField?: string;
  } | null>(null);

  // Data Transform Editor state
  const [transformEditorOpen, setTransformEditorOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);

  // Aktif veri kaynakları (last_fields olanlar)
  const activeDataSources = useMemo(() => {
    return dataSources.filter(ds => ds.last_fields && ds.last_fields.length > 0);
  }, [dataSources]);

  // Space basılı mı? (pan için)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as any).isContentEditable)) return;
      if (e.code === 'Space') setIsSpacePressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan.x, pan.y, zoom]);

  // İlk yüklemede pozisyonları ayarla
  useEffect(() => {
    if (activeDataSources.length === 0) return;

    const positions: Record<string, CardPosition> = {};
    const COLS = Math.ceil(Math.sqrt(activeDataSources.length));

    activeDataSources.forEach((ds, index) => {
      // Veritabanındaki pozisyon varsa kullan
      if (ds.model_position) {
        const pos = ds.model_position as { x?: number; y?: number };
        if (typeof pos.x === 'number' && typeof pos.y === 'number') {
          positions[ds.id] = { x: pos.x, y: pos.y };
          return;
        }
      }
      
      // Varsayılan grid pozisyonu
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      positions[ds.id] = {
        x: snapToGrid(col * (CARD_WIDTH + GAP) + 50),
        y: snapToGrid(row * (CARD_HEIGHT + GAP) + 50),
      };
    });

    setCardPositions(positions);
  }, [activeDataSources]);

  // Pozisyon değişikliği kaydet (debounced)
  const savePositions = useCallback(
    debounce(async (positions: Record<string, CardPosition>) => {
      // Manuel güncelleme - JSON formatında kaydet
      for (const [dsId, pos] of Object.entries(positions)) {
        await supabase
          .from('data_sources')
          .update({ model_position: { x: pos.x, y: pos.y } as any })
          .eq('id', dsId);
      }
      setPositionsChanged(false);
      toast.success('Pozisyonlar kaydedildi');
    }, 1000),
    []
  );

  // Kart pozisyonu değiştiğinde (snap-to-grid)
  const handlePositionChange = useCallback((id: string, position: CardPosition) => {
    const finalPos = snapToGridEnabled 
      ? { x: snapToGrid(position.x), y: snapToGrid(position.y) }
      : position;
    setCardPositions(prev => ({
      ...prev,
      [id]: finalPos,
    }));
    setPositionsChanged(true);
  }, [snapToGridEnabled]);
  
  // Otomatik layout algoritması - force-directed benzeri
  const handleAutoLayout = useCallback(() => {
    if (activeDataSources.length === 0) return;
    
    // İlişkilere göre kartları grupla
    const relationshipMap: Record<string, Set<string>> = {};
    
    activeDataSources.forEach(ds => {
      relationshipMap[ds.id] = new Set<string>();
    });
    
    relationships.forEach(rel => {
      relationshipMap[rel.source_data_source_id]?.add(rel.target_data_source_id);
      relationshipMap[rel.target_data_source_id]?.add(rel.source_data_source_id);
    });
    
    // En çok bağlantısı olan kartları merkeze yakın yerleştir
    const sortedByConnections = [...activeDataSources].sort((a, b) => {
      const aConns = relationshipMap[a.id]?.size || 0;
      const bConns = relationshipMap[b.id]?.size || 0;
      return bConns - aConns;
    });
    
    const newPositions: Record<string, CardPosition> = {};
    const placed = new Set<string>();
    
    // Merkez nokta
    const centerX = 400;
    const centerY = 200;
    
    // İlk kartı merkeze yerleştir
    if (sortedByConnections.length > 0) {
      const first = sortedByConnections[0];
      newPositions[first.id] = { x: snapToGrid(centerX), y: snapToGrid(centerY) };
      placed.add(first.id);
    }
    
    // Diğer kartları spiral şeklinde yerleştir
    let angle = 0;
    let radius = CARD_WIDTH + GAP * 2;
    let layer = 1;
    
    for (let i = 1; i < sortedByConnections.length; i++) {
      const ds = sortedByConnections[i];
      
      // İlişkili kartlara yakın yerleştir
      const connectedTo = relationshipMap[ds.id];
      let targetX = centerX + Math.cos(angle) * radius;
      let targetY = centerY + Math.sin(angle) * radius;
      
      if (connectedTo && connectedTo.size > 0) {
        // İlişkili kartların ortalamasına yakın yerleştir
        let sumX = 0, sumY = 0, count = 0;
        connectedTo.forEach(connId => {
          if (newPositions[connId]) {
            sumX += newPositions[connId].x;
            sumY += newPositions[connId].y;
            count++;
          }
        });
        if (count > 0) {
          targetX = sumX / count + (CARD_WIDTH + GAP) * Math.cos(angle);
          targetY = sumY / count + (CARD_HEIGHT + GAP) * Math.sin(angle);
        }
      }
      
      newPositions[ds.id] = { x: snapToGrid(targetX), y: snapToGrid(Math.max(40, targetY)) };
      placed.add(ds.id);
      
      angle += Math.PI / 3;
      if (angle >= Math.PI * 2) {
        angle = 0;
        layer++;
        radius = (CARD_WIDTH + GAP * 2) * layer;
      }
    }
    
    setCardPositions(newPositions);
    setPositionsChanged(true);
    toast.success('Kartlar otomatik olarak yerleştirildi');
  }, [activeDataSources, relationships, snapToGridEnabled]);

  // Alan sürükleme başlat
  const handleFieldDragStart = useCallback((dataSourceId: string, field: string, position: { x: number; y: number }) => {
    const worldPos = clientToWorld(position.x, position.y);
    setDragState({
      isDragging: true,
      sourceDataSourceId: dataSourceId,
      sourceField: field,
      startPosition: worldPos,
      currentPosition: worldPos,
    });
  }, [clientToWorld]);

  // Mouse move - sürükleme çizgisi için
  useEffect(() => {
    if (!dragState?.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => prev ? {
        ...prev,
        currentPosition: clientToWorld(e.clientX, e.clientY),
      } : null);

      // Drop hedefini bul
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const fieldItem = element?.closest('.field-item') as HTMLElement | null;
      if (fieldItem) {
        const card = fieldItem.closest('[data-datasource-id]') as HTMLElement | null;
        const dsId = card?.getAttribute('data-datasource-id');
        // data-field-name attribute'undan field adını al
        const fieldName = fieldItem.getAttribute('data-field-name');
        if (dsId && fieldName && dsId !== dragState.sourceDataSourceId) {
          setDropTarget({ dataSourceId: dsId, field: fieldName });
          return;
        }
      }
      setDropTarget(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [dragState?.isDragging, dragState?.sourceDataSourceId, clientToWorld]);

  // Alan bırakıldığında
  const handleFieldDrop = useCallback((sourceDataSourceId: string, sourceField: string, position: { x: number; y: number }) => {
    // Drop anında hedefi yeniden çöz (dropTarget state'i bazen kaçırabiliyor)
    const element = document.elementFromPoint(position.x, position.y);
    const fieldItem = element?.closest('.field-item') as HTMLElement | null;
    const cardEl = (fieldItem?.closest('[data-datasource-id]') || element?.closest('[data-datasource-id]')) as HTMLElement | null;
    const targetDsId = cardEl?.getAttribute('data-datasource-id') || undefined;
    const targetField = fieldItem?.getAttribute('data-field-name') || undefined;

    if (targetDsId && targetDsId !== sourceDataSourceId) {
      const sourceDs = activeDataSources.find(ds => ds.id === sourceDataSourceId);
      const targetDs = activeDataSources.find(ds => ds.id === targetDsId);
      if (sourceDs && targetDs) {
        setNewRelationshipData({
          sourceDs,
          targetDs,
          sourceField,
          targetField,
        });
        setSelectedRelationship(null);
        setEditorOpen(true);
      }
    }
    
    setDragState(null);
    setDropTarget(null);
  }, [dropTarget, activeDataSources]);

  // İlişki çizgisine tıklandığında
  const handleRelationshipClick = useCallback((relationship: DataSourceRelationship) => {
    setSelectedRelationship(relationship);
    setNewRelationshipData(null);
    setEditorOpen(true);
  }, []);

  // İlişki kaydet
  const handleSaveRelationship = async (data: RelationshipFormData) => {
    if (selectedRelationship) {
      await updateRelationship(selectedRelationship.id, data);
    } else {
      await createRelationship(data);
    }
  };

  // Kart tıklandığında - Transform editörünü aç
  const handleCardClick = useCallback((dataSource: DataSource) => {
    setSelectedDataSource(dataSource);
    setTransformEditorOpen(true);
  }, []);

  // Veri kaynağını güncelle
  const handleSaveDataSource = async (ds: DataSource, updates: Partial<DataSource>) => {
    await updateDataSource(ds.id, {
      filters: updates.filters,
      sorts: updates.sorts,
      selected_columns: updates.selected_columns,
      limit_count: updates.limit_count,
    } as any);
  };

  // Canvas pan - middle mouse button veya boş alana tıklama
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button ile her yerden pan yapılabilir
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
    
    // Sol tık ile boş alandan; veya Space/Alt basılıyken her yerden pan
    // Kartların veya grid dışı alanların tıklanmasına izin ver
    const target = e.target as HTMLElement;
    const isEmptyArea = target === canvasRef.current || 
                        target.classList.contains('canvas-content') ||
                        target.tagName === 'svg';

    // input/scroll gibi alanlarda pan başlatma
    if (target.closest('input') || target.closest('textarea') || target.closest('[data-radix-scroll-area-viewport]')) return;
    
    if (e.button === 0 && (isEmptyArea || isSpacePressed || e.altKey)) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [pan, isSpacePressed]);

  const handleCanvasWheel = useCallback((e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    // Kart içindeki listede scroll'u bozma
    if (target.closest('[data-radix-scroll-area-viewport]')) return;

    // Ctrl + wheel => zoom
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setZoom(prev => Math.max(0.25, Math.min(2, prev + delta)));
      return;
    }

    // Wheel => pan
    e.preventDefault();
    setPan(prev => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY,
    }));
  }, []);

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (panStartRef.current) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  // Zoom
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.25, Math.min(2, prev + delta)));
  }, []);

  // Fit to view
  const handleFitToView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // İlişki çizgileri için pozisyon hesapla
  const getRelationshipPositions = useCallback((rel: DataSourceRelationship) => {
    const sourcePos = cardPositions[rel.source_data_source_id];
    const targetPos = cardPositions[rel.target_data_source_id];
    
    if (!sourcePos || !targetPos) return null;

    // Kartın sağ kenarından çıkış, sol kenarına giriş
    const CARD_WIDTH = 256;
    const CARD_HEIGHT = 40; // Yaklaşık alan yüksekliği
    
    return {
      source: {
        x: sourcePos.x + CARD_WIDTH,
        y: sourcePos.y + 60, // Header + alan offseti
      },
      target: {
        x: targetPos.x,
        y: targetPos.y + 60,
      },
    };
  }, [cardPositions]);

  // Mini-map hesaplamaları
  const minimapData = useMemo(() => {
    if (Object.keys(cardPositions).length === 0) return null;
    
    const positions = Object.values(cardPositions);
    const minX = Math.min(...positions.map(p => p.x)) - 50;
    const minY = Math.min(...positions.map(p => p.y)) - 50;
    const maxX = Math.max(...positions.map(p => p.x + CARD_WIDTH)) + 50;
    const maxY = Math.max(...positions.map(p => p.y + CARD_HEIGHT)) + 50;
    
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    
    // Mini-map boyutları
    const minimapWidth = 180;
    const minimapHeight = 120;
    const scale = Math.min(minimapWidth / worldWidth, minimapHeight / worldHeight);
    
    return {
      minX,
      minY,
      worldWidth,
      worldHeight,
      scale,
      minimapWidth,
      minimapHeight,
    };
  }, [cardPositions]);

  const isLoading = dsLoading || relLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activeDataSources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Database className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Veri Kaynağı Bulunamadı</h3>
        <p className="text-muted-foreground max-w-md">
          İlişki kurmak için önce veri kaynaklarınızı oluşturun ve en az bir kez çalıştırarak 
          alan bilgilerini alın.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {activeDataSources.length} veri kaynağı • {relationships.length} ilişki
          </span>
          
          <div className="flex items-center gap-2">
            <Switch
              id="showGrid"
              checked={showGrid}
              onCheckedChange={setShowGrid}
            />
            <Label htmlFor="showGrid" className="text-xs flex items-center gap-1">
              <LayoutGrid className="w-3 h-3" />
              Grid
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="showMinimap"
              checked={showMinimap}
              onCheckedChange={setShowMinimap}
            />
            <Label htmlFor="showMinimap" className="text-xs flex items-center gap-1">
              <Map className="w-3 h-3" />
              Harita
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="snapToGrid"
              checked={snapToGridEnabled}
              onCheckedChange={setSnapToGridEnabled}
            />
            <Label htmlFor="snapToGrid" className="text-xs">Snap</Label>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handleAutoLayout}>
            <Shuffle className="w-4 h-4 mr-1" />
            Otomatik Yerleştir
          </Button>
          
          <div className="w-px h-6 bg-border mx-2" />
          
          <Button variant="ghost" size="icon" onClick={() => handleZoom(0.1)}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={() => handleZoom(-0.1)}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFitToView}>
            <Maximize2 className="w-4 h-4" />
          </Button>
          {positionsChanged && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => savePositions(cardPositions)}
              className="ml-2"
            >
              <Save className="w-4 h-4 mr-1" />
              Kaydet
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden cursor-grab"
         style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
         onWheel={handleCanvasWheel}
      >
        {/* Grid Background */}
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
              backgroundPosition: `${pan.x % (GRID_SIZE * zoom)}px ${pan.y % (GRID_SIZE * zoom)}px`,
            }}
          />
        )}
        
        <div
          className="absolute inset-0 canvas-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minWidth: '3000px',
            minHeight: '2000px',
          }}
        >
          {/* SVG Layer - İlişki çizgileri */}
          <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ overflow: 'visible' }}>
            <RelationshipMarkers />
            
            {relationships.map(rel => {
              const positions = getRelationshipPositions(rel);
              if (!positions) return null;
              
              return (
                <RelationshipLine
                  key={rel.id}
                  relationship={rel}
                  sourcePosition={positions.source}
                  targetPosition={positions.target}
                  onClick={handleRelationshipClick}
                  onHoverChange={setHoveredRelationship}
                  isSelected={selectedRelationship?.id === rel.id}
                />
              );
            })}

            {/* Sürükleme çizgisi */}
            {dragState?.isDragging && (
              <line
                x1={dragState.startPosition.x}
                y1={dragState.startPosition.y}
                x2={dragState.currentPosition.x}
                y2={dragState.currentPosition.y}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5,5"
                className="pointer-events-none"
              />
            )}
          </svg>

          {/* Hover/Seçili ilişki detayları */}
          {(hoveredRelationship || selectedRelationship) && (
            <div className="absolute left-3 top-3 z-40 max-w-sm bg-background/95 border border-border rounded-md shadow-sm px-3 py-2">
              {(() => {
                const rel = hoveredRelationship || selectedRelationship;
                if (!rel) return null;
                const source = activeDataSources.find(d => d.id === rel.source_data_source_id);
                const target = activeDataSources.find(d => d.id === rel.target_data_source_id);
                return (
                  <div className="space-y-1">
                    <div className="text-xs font-medium">İlişki Detayı</div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{source?.name || 'Kaynak'}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="font-mono">{rel.source_field}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium text-foreground">{target?.name || 'Hedef'}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="font-mono">{rel.target_field}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Tip: <span className="text-foreground">{rel.relationship_type}</span> · Yön: <span className="text-foreground">{rel.cross_filter_direction}</span> · Durum: <span className="text-foreground">{rel.is_active ? 'aktif' : 'pasif'}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Kartlar */}
          {activeDataSources.map(ds => (
            <DataSourceCard
              key={ds.id}
              dataSource={ds}
              position={cardPositions[ds.id] || { x: 0, y: 0 }}
              onPositionChange={handlePositionChange}
              onFieldDragStart={handleFieldDragStart}
              onFieldDrop={handleFieldDrop}
              isDraggingField={!!dragState?.isDragging}
              isDropTarget={dropTarget?.dataSourceId === ds.id}
              highlightedField={dropTarget?.dataSourceId === ds.id ? dropTarget.field : undefined}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
        
        {/* Mini-map */}
        {showMinimap && minimapData && (
          <div 
            className="absolute bottom-4 right-4 bg-background/95 border border-border rounded-lg shadow-lg overflow-hidden"
            style={{ width: minimapData.minimapWidth, height: minimapData.minimapHeight }}
          >
            <svg width={minimapData.minimapWidth} height={minimapData.minimapHeight} className="absolute inset-0">
              {/* Kartlar */}
              {Object.entries(cardPositions).map(([dsId, pos]) => {
                const ds = activeDataSources.find(d => d.id === dsId);
                if (!ds) return null;
                const x = (pos.x - minimapData.minX) * minimapData.scale;
                const y = (pos.y - minimapData.minY) * minimapData.scale;
                const w = CARD_WIDTH * minimapData.scale;
                const h = CARD_HEIGHT * minimapData.scale;
                return (
                  <rect
                    key={dsId}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={2}
                    className="fill-primary/20 stroke-primary"
                    strokeWidth={0.5}
                  />
                );
              })}
              
              {/* İlişki çizgileri */}
              {relationships.map(rel => {
                const sourcePos = cardPositions[rel.source_data_source_id];
                const targetPos = cardPositions[rel.target_data_source_id];
                if (!sourcePos || !targetPos) return null;
                
                const x1 = (sourcePos.x + CARD_WIDTH - minimapData.minX) * minimapData.scale;
                const y1 = (sourcePos.y + CARD_HEIGHT / 2 - minimapData.minY) * minimapData.scale;
                const x2 = (targetPos.x - minimapData.minX) * minimapData.scale;
                const y2 = (targetPos.y + CARD_HEIGHT / 2 - minimapData.minY) * minimapData.scale;
                
                return (
                  <line
                    key={rel.id}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="stroke-primary/50"
                    strokeWidth={1}
                  />
                );
              })}
              
              {/* Görünür alan göstergesi (viewport) */}
              <rect
                x={(-pan.x / zoom - minimapData.minX) * minimapData.scale}
                y={(-pan.y / zoom - minimapData.minY) * minimapData.scale}
                width={(canvasRef.current?.clientWidth || 800) / zoom * minimapData.scale}
                height={(canvasRef.current?.clientHeight || 400) / zoom * minimapData.scale}
                className="fill-primary/10 stroke-primary"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            </svg>
            
            {/* Mini-map başlık */}
            <div className="absolute bottom-0 left-0 right-0 bg-background/90 text-[10px] text-muted-foreground text-center py-0.5 border-t border-border">
              Harita
            </div>
          </div>
        )}
      </div>

      {/* Mobil uyarı */}
      <div className="md:hidden p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Veri modeli görünümü için lütfen daha geniş bir ekran kullanın.
          </AlertDescription>
        </Alert>
      </div>

      {/* İlişki Editörü */}
      <RelationshipEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        relationship={selectedRelationship}
        sourceDataSource={selectedRelationship 
          ? activeDataSources.find(ds => ds.id === selectedRelationship.source_data_source_id)
          : newRelationshipData?.sourceDs
        }
        targetDataSource={selectedRelationship
          ? activeDataSources.find(ds => ds.id === selectedRelationship.target_data_source_id)
          : newRelationshipData?.targetDs
        }
        initialSourceField={newRelationshipData?.sourceField}
        initialTargetField={newRelationshipData?.targetField}
        onSave={handleSaveRelationship}
        onDelete={deleteRelationship}
        isLoading={isCreating || isUpdating || isDeleting}
      />

      {/* Veri Dönüşüm Editörü */}
      <DataTransformEditor
        dataSource={selectedDataSource}
        open={transformEditorOpen}
        onOpenChange={setTransformEditorOpen}
        onSave={handleSaveDataSource}
      />
    </div>
  );
}
