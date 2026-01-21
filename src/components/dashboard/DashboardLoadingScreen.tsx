// DashboardLoadingScreen - Sayfa yüklenirken gösterilen loading ekranı

import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface DashboardLoadingScreenProps {
  progress: number;
  loadedSources: number;
  totalSources: number;
  currentSourceName?: string;
}

// Dikey bar chart animasyonu
function BarChartAnimation() {
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-3 bg-primary rounded-t-sm animate-bar-bounce"
          style={{
            animationDelay: `${i * 0.15}s`,
            height: '100%',
          }}
        />
      ))}
    </div>
  );
}

export function DashboardLoadingScreen({
  progress,
  loadedSources,
  totalSources,
  currentSourceName,
}: DashboardLoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto px-6">
        <div className="text-center space-y-6">
          {/* Bar Chart Animation */}
          <div className="flex justify-center">
            <BarChartAnimation />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Dashboard Hazırlanıyor</h2>
            <p className="text-sm text-muted-foreground">
              Veri kaynakları yükleniyor...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{loadedSources} / {totalSources} kaynak</span>
              <span>%{progress}</span>
            </div>
          </div>

          {/* Source List */}
          {totalSources > 0 && (
            <div className="text-left bg-muted/50 rounded-lg p-4 space-y-2 max-h-40 overflow-y-auto">
              {Array.from({ length: totalSources }).map((_, index) => {
                const isLoaded = index < loadedSources;
                const isLoading = index === loadedSources;
                
                return (
                  <div 
                    key={index}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-all",
                      isLoaded && "text-green-600 dark:text-green-400",
                      isLoading && "text-primary",
                      !isLoaded && !isLoading && "text-muted-foreground"
                    )}
                  >
                    {isLoaded ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    ) : isLoading ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border flex-shrink-0" />
                    )}
                    <span>Veri Kaynağı {index + 1}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Hint */}
          <p className="text-xs text-muted-foreground">
            Veriler 10 dakika boyunca önbelleğe alınacak
          </p>
        </div>
      </div>
    </div>
  );
}
