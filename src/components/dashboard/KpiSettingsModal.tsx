// KPI Settings Modal - KPI widget görsel ayarları

import React, { useState, useEffect } from 'react';
import { Settings, Palette, Type, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KpiSettings {
  // Sayı formatı
  numberFormat: 'full' | 'million' | 'thousand' | 'auto';
  decimalPlaces: number;
  
  // Renk ayarları
  textColor?: string;
  backgroundColor?: string;
  iconColor?: string;
  
  // Font ayarları
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  
  // Ek ayarlar
  showTrend: boolean;
  showIcon: boolean;
  showSubtitle: boolean;
}

export const DEFAULT_KPI_SETTINGS: KpiSettings = {
  numberFormat: 'auto',
  decimalPlaces: 1,
  fontSize: 'md',
  fontWeight: 'semibold',
  showTrend: true,
  showIcon: true,
  showSubtitle: true,
};

interface KpiSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerWidgetId?: string;
  widgetName: string;
  currentSettings?: KpiSettings;
  onSettingsChange?: (settings: KpiSettings) => void;
}

const NUMBER_FORMAT_OPTIONS = [
  { value: 'auto', label: 'Otomatik (M/K)', description: 'Değere göre otomatik kısaltma' },
  { value: 'full', label: 'Tam Sayı', description: '1.234.567' },
  { value: 'million', label: 'Milyon (M)', description: '1.23M' },
  { value: 'thousand', label: 'Bin (K)', description: '1.234K' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'sm', label: 'Küçük' },
  { value: 'md', label: 'Normal' },
  { value: 'lg', label: 'Büyük' },
  { value: 'xl', label: 'Çok Büyük' },
];

const COLOR_PRESETS = [
  { value: 'default', label: 'Varsayılan', color: 'hsl(var(--primary))' },
  { value: 'success', label: 'Yeşil', color: 'hsl(var(--success))' },
  { value: 'warning', label: 'Turuncu', color: 'hsl(var(--warning))' },
  { value: 'destructive', label: 'Kırmızı', color: 'hsl(var(--destructive))' },
];

export function KpiSettingsModal({
  open,
  onOpenChange,
  containerWidgetId,
  widgetName,
  currentSettings,
  onSettingsChange,
}: KpiSettingsModalProps) {
  const [settings, setSettings] = useState<KpiSettings>(currentSettings || DEFAULT_KPI_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    } else {
      setSettings(DEFAULT_KPI_SETTINGS);
    }
  }, [currentSettings, open]);

  const handleSave = async () => {
    if (!containerWidgetId) {
      toast.error('Container widget bulunamadı');
      return;
    }

    setIsSaving(true);
    try {
      // Mevcut settings'i oku ve birleştir
      const { data: existing } = await supabase
        .from('container_widgets')
        .select('settings')
        .eq('id', containerWidgetId)
        .single();

      const existingSettings = (existing?.settings as Record<string, any>) || {};
      
      const { error } = await supabase
        .from('container_widgets')
        .update({
          settings: {
            ...existingSettings,
            kpiSettings: settings as unknown as Record<string, any>,
          } as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', containerWidgetId);

      if (error) throw error;

      toast.success('Ayarlar kaydedildi');
      onSettingsChange?.(settings);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving KPI settings:', error);
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_KPI_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            KPI Ayarları
          </DialogTitle>
          <DialogDescription>
            "{widgetName}" görsel ayarlarını yapılandırın
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="format" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="format" className="gap-1">
              <Type className="h-3.5 w-3.5" />
              Format
            </TabsTrigger>
            <TabsTrigger value="colors" className="gap-1">
              <Palette className="h-3.5 w-3.5" />
              Renkler
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-1">
              <Eye className="h-3.5 w-3.5" />
              Görünüm
            </TabsTrigger>
          </TabsList>

          {/* FORMAT TAB */}
          <TabsContent value="format" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Sayı Formatı</Label>
              <RadioGroup
                value={settings.numberFormat}
                onValueChange={(value) => setSettings(prev => ({ ...prev, numberFormat: value as any }))}
                className="space-y-2"
              >
                {NUMBER_FORMAT_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value={option.value} id={`format-${option.value}`} />
                    <Label htmlFor={`format-${option.value}`} className="flex-1 cursor-pointer">
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Ondalık Basamak</Label>
              <Select
                value={settings.decimalPlaces.toString()}
                onValueChange={(value) => setSettings(prev => ({ ...prev, decimalPlaces: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 (1M)</SelectItem>
                  <SelectItem value="1">1 (1.2M)</SelectItem>
                  <SelectItem value="2">2 (1.23M)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Font Boyutu</Label>
              <Select
                value={settings.fontSize}
                onValueChange={(value) => setSettings(prev => ({ ...prev, fontSize: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* COLORS TAB */}
          <TabsContent value="colors" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Metin Rengi</Label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`p-3 rounded-lg border-2 transition-all ${
                      settings.textColor === preset.value 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setSettings(prev => ({ ...prev, textColor: preset.value }))}
                  >
                    <div 
                      className="w-full h-4 rounded"
                      style={{ backgroundColor: preset.color }}
                    />
                    <div className="text-xs mt-1 text-center">{preset.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Arka Plan Rengi</Label>
              <Select
                value={settings.backgroundColor || 'default'}
                onValueChange={(value) => setSettings(prev => ({ ...prev, backgroundColor: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Varsayılan</SelectItem>
                  <SelectItem value="transparent">Şeffaf</SelectItem>
                  <SelectItem value="subtle">Hafif Tonlu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* DISPLAY TAB */}
          <TabsContent value="display" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label className="font-medium">İkon Göster</Label>
                <p className="text-xs text-muted-foreground">Widget ikonunu göster/gizle</p>
              </div>
              <Switch
                checked={settings.showIcon}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showIcon: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label className="font-medium">Trend Göster</Label>
                <p className="text-xs text-muted-foreground">Trend yönü ikonunu göster</p>
              </div>
              <Switch
                checked={settings.showTrend}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showTrend: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label className="font-medium">Alt Başlık Göster</Label>
                <p className="text-xs text-muted-foreground">Ek bilgi satırını göster</p>
              </div>
              <Switch
                checked={settings.showSubtitle}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showSubtitle: checked }))}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Sıfırla
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
