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
    <div className="stat-card animate-slide-up p-3 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="metric-label mb-0.5 md:mb-1 line-clamp-2 min-h-[2rem] md:min-h-[2.5rem] text-xs md:text-sm">{title}</p>
          <p className={`metric-value text-lg md:text-2xl ${variantStyles[variant]}`}>{value}</p>
          {subtitle && (
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 md:p-3 rounded-lg bg-secondary hidden sm:block ${variantStyles[variant]}`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
      </div>
      
      {trendValue && (
        <div className={`flex items-center gap-1 mt-2 md:mt-3 text-xs md:text-sm ${trendColors[trend]}`}>
          <TrendIcon className="w-3 h-3 md:w-4 md:h-4" />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
