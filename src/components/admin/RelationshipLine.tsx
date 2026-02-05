// RelationshipLine - SVG ile iki veri kaynağı arasındaki ilişki çizgisi

import React from 'react';
import { cn } from '@/lib/utils';
import { DataSourceRelationship, RelationshipType, CrossFilterDirection } from '@/hooks/useDataSourceRelationships';

interface RelationshipLineProps {
  relationship: DataSourceRelationship;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  onClick: (relationship: DataSourceRelationship) => void;
  onHoverChange?: (relationship: DataSourceRelationship | null) => void;
  isSelected?: boolean;
}

// İlişki tipine göre çizgi stili
const getLineStyle = (type: RelationshipType, direction: CrossFilterDirection) => {
  const baseClass = "transition-all duration-200 cursor-pointer";
  
  if (direction === 'both') {
    return `${baseClass} stroke-primary`;
  }
  return `${baseClass} stroke-muted-foreground`;
};

// İlişki tipine göre ok ucu
const getMarkerEnd = (type: RelationshipType) => {
  switch (type) {
    case 'one_to_many':
      return 'url(#arrow-many)';
    case 'many_to_one':
      return 'url(#arrow-one)';
    case 'one_to_one':
      return 'url(#arrow-one)';
    default:
      return 'url(#arrow-one)';
  }
};

const getMarkerStart = (type: RelationshipType, direction: CrossFilterDirection) => {
  if (direction === 'both') {
    return type === 'many_to_one' ? 'url(#arrow-many)' : 'url(#arrow-one)';
  }
  return undefined;
};

export function RelationshipLine({
  relationship,
  sourcePosition,
  targetPosition,
  onClick,
  onHoverChange,
  isSelected,
}: RelationshipLineProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // Bezier eğrisi hesapla
  const dx = targetPosition.x - sourcePosition.x;
  const dy = targetPosition.y - sourcePosition.y;
  
  // Kontrol noktaları - yatay eğri için
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);
  
  const path = `
    M ${sourcePosition.x} ${sourcePosition.y}
    C ${sourcePosition.x + controlOffset} ${sourcePosition.y},
      ${targetPosition.x - controlOffset} ${targetPosition.y},
      ${targetPosition.x} ${targetPosition.y}
  `;

  // Orta nokta (etiket için)
  const midX = (sourcePosition.x + targetPosition.x) / 2;
  const midY = (sourcePosition.y + targetPosition.y) / 2;
  
  // İlişki tipine göre label metni
  const typeLabel = relationship.relationship_type === 'one_to_many' ? '1:N' : 
                    relationship.relationship_type === 'many_to_one' ? 'N:1' : '1:1';

  // Alan adları kısaltma
  const truncateField = (field: string, maxLen: number = 10) => {
    if (field.length <= maxLen) return field;
    return field.slice(0, maxLen - 2) + '..';
  };

  return (
    <g
      onClick={() => onClick(relationship)}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(relationship);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(null);
      }}
      className="cursor-pointer"
    >
      {/* Ana çizgi - hover alanı için geniş */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />
      
      {/* Görünür çizgi */}
      <path
        d={path}
        fill="none"
        strokeWidth={isSelected || isHovered ? 3 : 2}
        strokeDasharray={relationship.is_active ? undefined : "5,5"}
        markerEnd={getMarkerEnd(relationship.relationship_type)}
        markerStart={getMarkerStart(relationship.relationship_type, relationship.cross_filter_direction)}
        className={getLineStyle(relationship.relationship_type, relationship.cross_filter_direction)}
        style={{
          stroke: isSelected 
            ? 'hsl(var(--primary))' 
            : relationship.cross_filter_direction === 'both' 
              ? 'hsl(var(--primary))' 
              : 'hsl(var(--muted-foreground))',
          opacity: relationship.is_active ? (isHovered ? 1 : 0.9) : 0.5,
        }}
      />

      {/* İlişki etiketi - her zaman görünür */}
      <g transform={`translate(${midX}, ${midY})`}>
        {/* Arka plan kutusu */}
        <rect
          x="-45"
          y="-22"
          width="90"
          height="44"
          rx="6"
          className={cn(
            "transition-colors",
            isSelected || isHovered ? "fill-primary/10 stroke-primary" : "fill-background stroke-border"
          )}
          strokeWidth={isSelected || isHovered ? 2 : 1}
        />
        
        {/* İlişki tipi */}
        <text
          textAnchor="middle"
          y="-7"
          className="text-[10px] font-bold pointer-events-none"
          style={{ fill: isSelected || isHovered ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}
        >
          {typeLabel}
        </text>
        
        {/* Alan adları */}
        <text
          textAnchor="middle"
          y="8"
          className="text-[9px] pointer-events-none"
          style={{ fill: 'hsl(var(--muted-foreground))' }}
        >
          {truncateField(relationship.source_field)} → {truncateField(relationship.target_field)}
        </text>
      </g>
    </g>
  );
}

// SVG Marker tanımları - ana bileşende kullanılacak
export function RelationshipMarkers() {
  return (
    <defs>
      {/* Tek ok (1 tarafı için) */}
      <marker
        id="arrow-one"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path
          d="M 0 0 L 10 5 L 0 10 z"
          className="fill-muted-foreground"
        />
      </marker>
      
      {/* Çoklu ok (N tarafı için) */}
      <marker
        id="arrow-many"
        viewBox="0 0 14 10"
        refX="13"
        refY="5"
        markerWidth="8"
        markerHeight="8"
        orient="auto-start-reverse"
      >
        <path
          d="M 0 0 L 7 5 L 0 10 M 7 0 L 14 5 L 7 10"
          fill="none"
          strokeWidth="2"
          className="stroke-muted-foreground"
        />
      </marker>
    </defs>
  );
}
