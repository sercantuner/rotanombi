// ChartSettingsPanel - Genel grafik görünüm ayarları
// Renk paleti, legend, grid, trend çizgileri vb.

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Palette, LayoutGrid, TrendingUp, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartType, LegendPosition } from '@/lib/widgetBuilderTypes';
import { useState } from 'react';

// Renk paletleri
export const COLOR_PALETTES = {
  default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
  pastel: ['#93c5fd', '#86efac', '#fcd34d', '#fca5a5', '#c4b5fd', '#f9a8d4'],
  vivid: ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'],
  ocean: ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'],
  sunset: ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6'],
  earth: ['#78716c', '#a8a29e', '#d6d3d1', '#92400e', '#b45309', '#ca8a04'],
  neon: ['#22d3ee', '#a3e635', '#facc15', '#fb923c', '#f472b6', '#a78bfa'],
  mono: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db'],
  corporate: ['#1e40af', '#1e3a8a', '#312e81', '#4c1d95', '#581c87', '#701a75'],
  nature: ['#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac'],
  warm: ['#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5'],
  cool: ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
};

export type PaletteKey = keyof typeof COLOR_PALETTES;

export interface ChartSettingsData {
  colorPalette: PaletteKey;
  showLegend: boolean;
  legendPosition: LegendPosition;
  showGrid: boolean;
  stacked: boolean;
  displayLimit: number;
  showTrendLine: boolean;
  showAverageLine: boolean;
  showMinMaxMarkers: boolean;
  trendLineColor: string;
  averageLineColor: string;
}

interface ChartSettingsPanelProps {
  chartType: ChartType;
  settings: ChartSettingsData;
  onChange: (settings: ChartSettingsData) => void;
  className?: string;
}

const getDefaultSettings = (): ChartSettingsData => ({
  colorPalette: 'default',
  showLegend: true,
  legendPosition: 'bottom',
  showGrid: true,
  stacked: false,
  displayLimit: 10,
  showTrendLine: false,
  showAverageLine: false,
  showMinMaxMarkers: false,
  trendLineColor: '#ef4444',
  averageLineColor: '#22c55e',
});

export function ChartSettingsPanel({
  chartType,
  settings,
  onChange,
  className,
}: ChartSettingsPanelProps) {
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [linesOpen, setLinesOpen] = useState(false);

  const handleChange = (updates: Partial<ChartSettingsData>) => {
    onChange({ ...settings, ...updates });
  };

  const showBarLineAreaSettings = ['bar', 'line', 'area'].includes(chartType);
  const showPieDonutSettings = ['pie', 'donut'].includes(chartType);
  const showStackedOption = ['bar', 'area'].includes(chartType);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Görünüm Ayarları */}
      <Collapsible open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 h-9 font-medium"
          >
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span>Görünüm Ayarları</span>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              appearanceOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-4">
          {/* Renk Paleti */}
          <div className="space-y-2">
            <Label className="text-xs">Renk Paleti</Label>
            <Select
              value={settings.colorPalette}
              onValueChange={(v) => handleChange({ colorPalette: v as PaletteKey })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COLOR_PALETTES).map(([key, colors]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {colors.slice(0, 5).map((color, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="capitalize">{key}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Renk önizleme */}
            <div className="flex gap-1 p-2 rounded-md bg-secondary/30">
              {COLOR_PALETTES[settings.colorPalette].map((color, i) => (
                <div
                  key={i}
                  className="flex-1 h-6 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Legend Ayarları */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Legend Göster</Label>
            <Switch
              checked={settings.showLegend}
              onCheckedChange={(v) => handleChange({ showLegend: v })}
            />
          </div>

          {settings.showLegend && (
            <div className="space-y-2">
              <Label className="text-xs">Legend Konumu</Label>
              <Select
                value={settings.legendPosition}
                onValueChange={(v) => handleChange({ legendPosition: v as LegendPosition })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Alt</SelectItem>
                  <SelectItem value="right">Sağ</SelectItem>
                  <SelectItem value="hidden">Gizli</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Grid */}
          {showBarLineAreaSettings && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">Grid Göster</Label>
              <Switch
                checked={settings.showGrid}
                onCheckedChange={(v) => handleChange({ showGrid: v })}
              />
            </div>
          )}

          {/* Stacked */}
          {showStackedOption && (
            <div className="flex items-center justify-between">
              <Label className="text-xs">Yığılmış (Stacked)</Label>
              <Switch
                checked={settings.stacked}
                onCheckedChange={(v) => handleChange({ stacked: v })}
              />
            </div>
          )}

          {/* Maksimum Kayıt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Maksimum Kayıt</Label>
              <span className="text-xs text-muted-foreground">{settings.displayLimit}</span>
            </div>
            <Slider
              value={[settings.displayLimit]}
              onValueChange={([v]) => handleChange({ displayLimit: v })}
              min={5}
              max={50}
              step={5}
              className="w-full"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Ek Çizgiler (Bar/Line/Area için) */}
      {showBarLineAreaSettings && (
        <>
          <Separator />
          <Collapsible open={linesOpen} onOpenChange={setLinesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-2 h-9 font-medium"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>Ek Çizgiler</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  linesOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-4">
              {/* Trend Çizgisi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Trend Çizgisi</Label>
                  <Switch
                    checked={settings.showTrendLine}
                    onCheckedChange={(v) => handleChange({ showTrendLine: v })}
                  />
                </div>
                {settings.showTrendLine && (
                  <Select
                    value={settings.trendLineColor}
                    onValueChange={(v) => handleChange({ trendLineColor: v })}
                  >
                    <SelectTrigger className="h-8">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: settings.trendLineColor }}
                        />
                        <span className="text-xs">Renk</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#6b7280'].map(color => (
                        <SelectItem key={color} value={color}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Ortalama Çizgisi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Ortalama Çizgisi</Label>
                  <Switch
                    checked={settings.showAverageLine}
                    onCheckedChange={(v) => handleChange({ showAverageLine: v })}
                  />
                </div>
                {settings.showAverageLine && (
                  <Select
                    value={settings.averageLineColor}
                    onValueChange={(v) => handleChange({ averageLineColor: v })}
                  >
                    <SelectTrigger className="h-8">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: settings.averageLineColor }}
                        />
                        <span className="text-xs">Renk</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'].map(color => (
                        <SelectItem key={color} value={color}>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Min/Max İşaretleyiciler */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Min/Max İşaretleyiciler</Label>
                <Switch
                  checked={settings.showMinMaxMarkers}
                  onCheckedChange={(v) => handleChange({ showMinMaxMarkers: v })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}

export { getDefaultSettings as getDefaultChartSettings };
