import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend = 'neutral',
  trendValue,
  variant = 'default' 
}: StatCardProps) {
  const variantStyles = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  };

  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  const TrendIcon = trendIcons[trend];

  return (
    <div className="stat-card animate-slide-up p-2 md:p-3">
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="metric-label mb-0.5 line-clamp-2 min-h-[1.75rem] md:min-h-[2rem] text-[10px] md:text-xs">{title}</p>
          <p className={`metric-value text-sm md:text-lg lg:text-xl truncate ${variantStyles[variant]}`}>{value}</p>
          {subtitle && (
            <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-1.5 md:p-2 rounded-md bg-secondary hidden sm:block ${variantStyles[variant]}`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
      
      {trendValue && (
        <div className={`flex items-center gap-0.5 mt-1.5 text-[10px] md:text-xs ${trendColors[trend]}`}>
          <TrendIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
