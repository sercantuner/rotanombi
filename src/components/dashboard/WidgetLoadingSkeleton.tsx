// WidgetLoadingSkeleton - Widget bazlı kompakt loading göstergesi
// Full-screen loading yerine her widget kendi loading animasyonunu gösterir

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Mini bar chart animasyonu - DashboardLoadingScreen'den alındı, küçültüldü
function MiniBarChartAnimation() {
  return (
    <div className="flex items-end justify-center gap-0.5 h-8">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-1.5 bg-primary/60 rounded-t-sm animate-bar-bounce"
          style={{
            animationDelay: `${i * 0.15}s`,
            height: '100%',
          }}
        />
      ))}
    </div>
  );
}

interface WidgetLoadingSkeletonProps {
  className?: string;
}

export function WidgetLoadingSkeleton({ className }: WidgetLoadingSkeletonProps) {
  return (
    <Card className={cn('isolate overflow-visible', className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 gap-3 min-h-[120px]">
        <MiniBarChartAnimation />
        <span className="text-xs text-muted-foreground">Yükleniyor...</span>
      </CardContent>
    </Card>
  );
}
