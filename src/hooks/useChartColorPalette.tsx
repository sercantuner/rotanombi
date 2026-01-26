import { useCallback, useMemo } from 'react';
import { useUserSettings } from '@/contexts/UserSettingsContext';

export type ColorPaletteName = 
  | 'corporate' 
  | 'ocean' 
  | 'forest' 
  | 'sunset' 
  | 'monochrome' 
  | 'vibrant'
  | 'pastel'
  | 'warm'
  | 'cool';

// Widget bazında palet seçimi için options
export interface UseChartColorPaletteOptions {
  widgetId?: string; // Widget ID verilirse widget-specific palet kullanılır
}

export interface ColorPalette {
  name: ColorPaletteName;
  label: string;
  colors: string[];
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    name: 'corporate',
    label: 'Kurumsal',
    colors: [
      'hsl(220, 70%, 50%)',
      'hsl(220, 60%, 60%)',
      'hsl(220, 50%, 70%)',
      'hsl(220, 40%, 45%)',
      'hsl(200, 65%, 55%)',
      'hsl(240, 50%, 55%)',
      'hsl(210, 55%, 50%)',
      'hsl(230, 45%, 60%)',
    ],
  },
  {
    name: 'ocean',
    label: 'Okyanus',
    colors: [
      'hsl(200, 80%, 50%)',
      'hsl(180, 70%, 45%)',
      'hsl(190, 75%, 55%)',
      'hsl(210, 65%, 50%)',
      'hsl(170, 60%, 45%)',
      'hsl(195, 70%, 40%)',
      'hsl(185, 65%, 50%)',
      'hsl(175, 55%, 55%)',
    ],
  },
  {
    name: 'forest',
    label: 'Orman',
    colors: [
      'hsl(140, 60%, 40%)',
      'hsl(120, 50%, 45%)',
      'hsl(160, 55%, 35%)',
      'hsl(100, 45%, 50%)',
      'hsl(150, 50%, 40%)',
      'hsl(130, 55%, 45%)',
      'hsl(110, 40%, 50%)',
      'hsl(145, 60%, 38%)',
    ],
  },
  {
    name: 'sunset',
    label: 'Gün Batımı',
    colors: [
      'hsl(20, 80%, 55%)',
      'hsl(35, 85%, 50%)',
      'hsl(10, 75%, 50%)',
      'hsl(45, 90%, 55%)',
      'hsl(0, 70%, 55%)',
      'hsl(30, 80%, 45%)',
      'hsl(15, 75%, 50%)',
      'hsl(40, 85%, 50%)',
    ],
  },
  {
    name: 'monochrome',
    label: 'Tek Ton',
    colors: [
      'hsl(220, 15%, 30%)',
      'hsl(220, 15%, 45%)',
      'hsl(220, 15%, 55%)',
      'hsl(220, 15%, 65%)',
      'hsl(220, 15%, 40%)',
      'hsl(220, 15%, 50%)',
      'hsl(220, 15%, 60%)',
      'hsl(220, 15%, 70%)',
    ],
  },
  {
    name: 'vibrant',
    label: 'Canlı',
    colors: [
      'hsl(340, 80%, 55%)',
      'hsl(200, 85%, 50%)',
      'hsl(45, 90%, 50%)',
      'hsl(280, 70%, 55%)',
      'hsl(160, 75%, 45%)',
      'hsl(25, 85%, 55%)',
      'hsl(320, 75%, 50%)',
      'hsl(180, 70%, 45%)',
    ],
  },
  {
    name: 'pastel',
    label: 'Pastel',
    colors: [
      'hsl(200, 60%, 75%)',
      'hsl(340, 55%, 75%)',
      'hsl(120, 50%, 75%)',
      'hsl(45, 65%, 75%)',
      'hsl(280, 50%, 75%)',
      'hsl(20, 60%, 75%)',
      'hsl(160, 55%, 75%)',
      'hsl(300, 45%, 75%)',
    ],
  },
  {
    name: 'warm',
    label: 'Sıcak',
    colors: [
      'hsl(0, 70%, 55%)',
      'hsl(25, 80%, 50%)',
      'hsl(45, 85%, 55%)',
      'hsl(15, 75%, 50%)',
      'hsl(35, 80%, 45%)',
      'hsl(5, 65%, 55%)',
      'hsl(55, 75%, 50%)',
      'hsl(20, 70%, 55%)',
    ],
  },
  {
    name: 'cool',
    label: 'Soğuk',
    colors: [
      'hsl(200, 70%, 50%)',
      'hsl(220, 65%, 55%)',
      'hsl(180, 60%, 45%)',
      'hsl(240, 55%, 55%)',
      'hsl(190, 65%, 50%)',
      'hsl(260, 50%, 55%)',
      'hsl(170, 55%, 50%)',
      'hsl(210, 60%, 50%)',
    ],
  },
];

export function useChartColorPalette(options: UseChartColorPaletteOptions = {}) {
  const { widgetId } = options;
  const { settings, updateSettings, getWidgetFilters, saveWidgetFilters } = useUserSettings();
  
  // Global varsayılan palet
  const globalPaletteName = (settings?.chart_color_palette || 'corporate') as ColorPaletteName;
  
  // Widget-specific palet (varsa)
  const widgetFilters = widgetId ? getWidgetFilters(widgetId) : null;
  const widgetPaletteName = widgetFilters?.colorPalette as ColorPaletteName | undefined;
  
  // Aktif palet: Widget seviyesi varsa onu kullan, yoksa global
  const currentPaletteName = widgetPaletteName || globalPaletteName;
  
  const currentPalette = useMemo(() => 
    COLOR_PALETTES.find(p => p.name === currentPaletteName) || COLOR_PALETTES[0],
    [currentPaletteName]
  );
  
  // Global paleti değiştir
  const setGlobalPalette = useCallback(async (paletteName: ColorPaletteName) => {
    await updateSettings({ chart_color_palette: paletteName });
  }, [updateSettings]);
  
  // Widget bazında paleti değiştir
  const setWidgetPalette = useCallback(async (paletteName: ColorPaletteName | null) => {
    if (!widgetId) {
      console.warn('setWidgetPalette requires a widgetId');
      return;
    }
    
    const currentFilters = getWidgetFilters(widgetId);
    
    if (paletteName === null) {
      // Widget paletini sil, global'e dön
      const { colorPalette, ...restFilters } = currentFilters;
      await saveWidgetFilters(widgetId, restFilters);
    } else {
      // Widget için palet ayarla
      await saveWidgetFilters(widgetId, { 
        ...currentFilters, 
        colorPalette: paletteName 
      });
    }
  }, [widgetId, getWidgetFilters, saveWidgetFilters]);
  
  // Geriye uyumluluk için setPalette - widget varsa widget'a, yoksa global'e kaydet
  const setPalette = useCallback(async (paletteName: ColorPaletteName) => {
    if (widgetId) {
      await setWidgetPalette(paletteName);
    } else {
      await setGlobalPalette(paletteName);
    }
  }, [widgetId, setWidgetPalette, setGlobalPalette]);
  
  const getColor = useCallback((index: number): string => {
    return currentPalette.colors[index % currentPalette.colors.length];
  }, [currentPalette]);
  
  // Widget'ın özel paleti var mı?
  const hasWidgetPalette = Boolean(widgetPaletteName);
  
  return {
    currentPalette,
    currentPaletteName,
    globalPaletteName,
    widgetPaletteName,
    hasWidgetPalette,
    palettes: COLOR_PALETTES,
    setPalette,
    setGlobalPalette,
    setWidgetPalette,
    getColor,
    colors: currentPalette.colors,
  };
}
