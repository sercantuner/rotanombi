// ResponsiveLegend - Collapsible legend bileşeni
// %40 eşiğine göre otomatik gizleme ve aç/kapa düğmesi

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LegendBehavior } from '@/lib/widgetBuilderTypes';

export interface LegendItem {
  name: string;
  value: number;
  color: string;
}

export interface ResponsiveLegendProps {
  items: LegendItem[];
  displayLimit?: number;
  behavior?: LegendBehavior;
  threshold?: number; // 0-100 arası, varsayılan 40
  containerRef: React.RefObject<HTMLDivElement>;
  onItemClick?: (item: LegendItem, index: number) => void;
  className?: string;
  showPercentage?: boolean;
  totalValue?: number;
}

export function ResponsiveLegend({
  items,
  displayLimit = 10,
  behavior = 'auto',
  threshold = 40,
  containerRef,
  onItemClick,
  className,
  showPercentage = true,
  totalValue,
}: ResponsiveLegendProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [hasEnoughSpace, setHasEnoughSpace] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);

  const total = totalValue ?? items.reduce((sum, item) => sum + item.value, 0);
  const displayItems = items.slice(0, displayLimit);
  const hiddenCount = items.length - displayLimit;

  // Oran kontrolü - legend yüksekliği konteyner yüksekliğinin threshold'undan fazla mı?
  const checkRatio = useCallback(() => {
    // Davranış kontrolü
    if (behavior === 'always_visible') {
      setHasEnoughSpace(true);
      return;
    }
    if (behavior === 'always_hidden') {
      setHasEnoughSpace(false);
      setLegendExpanded(false);
      return;
    }
    if (behavior === 'collapsible') {
      setHasEnoughSpace(false);
      return;
    }

    // Auto mod - oran hesapla
    if (containerRef.current && measureRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const computedContentHeight = Math.max(0, containerRect.height - 56); // Header offset
      setContentHeight(computedContentHeight);

      // Ölçüm div genişliğini ayarla
      const targetLegendWidth = Math.max(220, Math.min(containerRect.width - 32, 380));
      measureRef.current.style.width = `${targetLegendWidth}px`;

      const legendHeight = measureRef.current.scrollHeight || measureRef.current.offsetHeight;
      const thresholdValue = computedContentHeight * (threshold / 100);

      if (computedContentHeight <= 0) {
        setHasEnoughSpace(false);
        setLegendExpanded(false);
        return;
      }

      const enough = legendHeight <= thresholdValue;
      setHasEnoughSpace(enough);
      if (enough) {
        setLegendExpanded(false);
      }
    }
  }, [behavior, threshold, containerRef]);

  useEffect(() => {
    const timer = setTimeout(checkRatio, 150);
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(checkRatio, 50);
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [checkRatio, items.length, displayLimit]);

  // Always hidden durumunda hiçbir şey gösterme
  if (behavior === 'always_hidden') {
    return null;
  }

  const LegendItems = () => (
    <>
      {displayItems.map((item, index) => {
        const percent = showPercentage && total > 0 
          ? ((item.value / total) * 100).toFixed(1) 
          : null;
        
        return (
          <div 
            key={index} 
            className={cn(
              "flex items-center gap-1.5 text-[11px] rounded px-1 py-0.5",
              onItemClick && "cursor-pointer hover:bg-muted/50"
            )}
            onClick={() => onItemClick?.(item, index)}
          >
            <div 
              className="w-2 h-2 rounded-sm flex-shrink-0" 
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate flex-1" title={item.name}>
              {String(item.name).slice(0, 14)}
            </span>
            {percent && (
              <span className="text-muted-foreground text-[10px]">%{percent}</span>
            )}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <span className="text-[10px] text-muted-foreground col-span-2 text-center">
          +{hiddenCount} daha...
        </span>
      )}
    </>
  );

  const showToggle = !hasEnoughSpace;
  const showLegend = hasEnoughSpace || legendExpanded;

  return (
    <>
      {/* Görünmez ölçüm div'i */}
      <div 
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none grid grid-cols-2 gap-x-3 gap-y-0.5 max-w-[380px]"
        style={{ visibility: 'hidden', position: 'fixed', top: -9999, left: 0 }}
        aria-hidden="true"
      >
        <LegendItems />
      </div>

      {/* Toggle butonu */}
      {showToggle && (
        <div className="w-full flex items-center justify-center flex-shrink-0">
          <button
            type="button"
            onClick={() => setLegendExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50"
          >
            <span>{legendExpanded ? 'Gizle' : 'Detaylar'}</span>
            <ChevronDown 
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                legendExpanded && "rotate-180"
              )} 
            />
          </button>
        </div>
      )}

      {/* Legend içeriği */}
      {showLegend && (
        <div 
          className={cn(
            "w-full max-w-[380px] flex-shrink-0",
            !hasEnoughSpace && legendExpanded && "mt-2 pt-2 border-t border-border",
            className
          )}
          style={!hasEnoughSpace && legendExpanded && contentHeight > 0
            ? { maxHeight: Math.max(96, Math.floor(contentHeight * 0.6)), overflowY: 'auto' as const }
            : undefined
          }
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <LegendItems />
          </div>
        </div>
      )}
    </>
  );
}
