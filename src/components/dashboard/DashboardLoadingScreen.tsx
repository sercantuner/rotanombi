// DashboardLoadingScreen - Sayfa yüklenirken gösterilen loading ekranı

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Database } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LoadedSourceInfo {
  id: string;
  name: string;
}

interface DashboardLoadingScreenProps {
  progress: number;
  loadedSources: LoadedSourceInfo[];
  totalSources: number;
  currentSourceName: string | null;
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

// Tek kaynak gösterimi - animasyonlu geçiş
function SourceDisplay({ 
  currentSourceName, 
  lastLoadedSource 
}: { 
  currentSourceName: string | null;
  lastLoadedSource: LoadedSourceInfo | null;
}) {
  const [displayedSource, setDisplayedSource] = useState<{name: string; status: 'loading' | 'loaded'} | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (currentSourceName) {
      // Yeni kaynak yüklenmeye başladı
      setIsAnimating(true);
      setTimeout(() => {
        setDisplayedSource({ name: currentSourceName, status: 'loading' });
        setIsAnimating(false);
      }, 150);
    } else if (lastLoadedSource) {
      // Son kaynak yüklendi, kısa süre göster ve kaybet
      setDisplayedSource({ name: lastLoadedSource.name, status: 'loaded' });
      setTimeout(() => {
        setIsAnimating(true);
        setTimeout(() => {
          setDisplayedSource(null);
          setIsAnimating(false);
        }, 150);
      }, 500);
    }
  }, [currentSourceName, lastLoadedSource?.id]);

  if (!displayedSource) {
    return (
      <div className="h-10 flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Hazırlanıyor...</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "h-10 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-150",
        displayedSource.status === 'loading' 
          ? "bg-primary/10 text-primary" 
          : "bg-green-500/10 text-green-600 dark:text-green-400",
        isAnimating && "opacity-0 scale-95"
      )}
    >
      {displayedSource.status === 'loading' ? (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="text-sm font-medium truncate max-w-[200px]">
        {displayedSource.name}
      </span>
    </div>
  );
}

export function DashboardLoadingScreen({
  progress,
  loadedSources,
  totalSources,
  currentSourceName,
}: DashboardLoadingScreenProps) {
  const lastLoadedSource = loadedSources.length > 0 
    ? loadedSources[loadedSources.length - 1] 
    : null;

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
              <span>{loadedSources.length} / {totalSources} kaynak</span>
              <span>%{progress}</span>
            </div>
          </div>

          {/* Dynamic Source Display - Tek satır, animasyonlu */}
          <div className="flex justify-center">
            <SourceDisplay 
              currentSourceName={currentSourceName} 
              lastLoadedSource={lastLoadedSource}
            />
          </div>

          {/* Loaded Sources Summary */}
          {loadedSources.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {loadedSources.slice(-3).map((source) => (
                <span 
                  key={source.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {source.name}
                </span>
              ))}
              {loadedSources.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                  +{loadedSources.length - 3} daha
                </span>
              )}
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
