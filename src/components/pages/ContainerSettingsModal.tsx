// Container Ayarları Modal - Konteyner özelleştirme

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageContainer } from '@/lib/pageTypes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Palette, Type, Square } from 'lucide-react';

interface ContainerSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: PageContainer;
  onSave: () => void;
}

// Renk seçenekleri
const BACKGROUND_COLORS = [
  { id: 'default', name: 'Varsayılan', class: 'bg-card' },
  { id: 'muted', name: 'Soluk', class: 'bg-muted' },
  { id: 'primary-soft', name: 'Birincil (Soft)', class: 'bg-primary/5' },
  { id: 'accent', name: 'Vurgu', class: 'bg-accent' },
  { id: 'blue-soft', name: 'Mavi', class: 'bg-blue-500/5' },
  { id: 'green-soft', name: 'Yeşil', class: 'bg-green-500/5' },
  { id: 'amber-soft', name: 'Amber', class: 'bg-amber-500/5' },
  { id: 'purple-soft', name: 'Mor', class: 'bg-purple-500/5' },
];

const BORDER_STYLES = [
  { id: 'default', name: 'Normal', class: 'border' },
  { id: 'none', name: 'Yok', class: 'border-0' },
  { id: 'dashed', name: 'Kesikli', class: 'border-dashed border' },
  { id: 'thick', name: 'Kalın', class: 'border-2' },
  { id: 'primary', name: 'Renkli', class: 'border-2 border-primary/30' },
];

export function ContainerSettingsModal({
  open,
  onOpenChange,
  container,
  onSave,
}: ContainerSettingsModalProps) {
  const [title, setTitle] = useState(container.title || '');
  const [settings, setSettings] = useState<Record<string, any>>(container.settings || {});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setTitle(container.title || '');
    setSettings(container.settings || {});
  }, [container]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('page_containers')
        .update({
          title: title || null,
          settings: settings,
        })
        .eq('id', container.id);

      if (error) throw error;

      toast.success('Konteyner ayarları kaydedildi');
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving container settings:', error);
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konteyner Ayarları</DialogTitle>
          <DialogDescription>
            Konteynerin görünümünü ve özelliklerini düzenleyin
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="flex items-center gap-1">
              <Type className="h-3 w-3" />
              Genel
            </TabsTrigger>
            <TabsTrigger value="style" className="flex items-center gap-1">
              <Palette className="h-3 w-3" />
              Stil
            </TabsTrigger>
            <TabsTrigger value="border" className="flex items-center gap-1">
              <Square className="h-3 w-3" />
              Kenarlık
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Konteyner Başlığı</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Başlık girin (opsiyonel)"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Başlığı Göster</Label>
                <p className="text-xs text-muted-foreground">
                  Konteyner başlığını görünür yap
                </p>
              </div>
              <Switch
                checked={settings.showTitle !== false}
                onCheckedChange={(checked) => updateSetting('showTitle', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Kompakt Mod</Label>
                <p className="text-xs text-muted-foreground">
                  Daha az boşluk kullan
                </p>
              </div>
              <Switch
                checked={settings.compact === true}
                onCheckedChange={(checked) => updateSetting('compact', checked)}
              />
            </div>
          </TabsContent>

          <TabsContent value="style" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Arka Plan Rengi</Label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => updateSetting('backgroundColor', color.id)}
                    className={`
                      p-3 rounded-lg border-2 text-xs font-medium text-center transition-all
                      ${color.class}
                      ${settings.backgroundColor === color.id 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-transparent hover:border-muted-foreground/20'
                      }
                    `}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Gölge Efekti</Label>
                <p className="text-xs text-muted-foreground">
                  Konteynere gölge ekle
                </p>
              </div>
              <Switch
                checked={settings.hasShadow === true}
                onCheckedChange={(checked) => updateSetting('hasShadow', checked)}
              />
            </div>
          </TabsContent>

          <TabsContent value="border" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Kenarlık Stili</Label>
              <div className="grid grid-cols-3 gap-2">
                {BORDER_STYLES.map((border) => (
                  <button
                    key={border.id}
                    onClick={() => updateSetting('borderStyle', border.id)}
                    className={`
                      p-4 rounded-lg text-xs font-medium text-center transition-all
                      ${border.class}
                      ${settings.borderStyle === border.id 
                        ? 'bg-primary/10 ring-2 ring-primary/20' 
                        : 'bg-card hover:bg-muted'
                      }
                    `}
                  >
                    {border.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Yuvarlatılmış Köşeler</Label>
                <p className="text-xs text-muted-foreground">
                  Köşeleri daha yuvarlak yap
                </p>
              </div>
              <Switch
                checked={settings.roundedCorners !== false}
                onCheckedChange={(checked) => updateSetting('roundedCorners', checked)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Yardımcı fonksiyon - container stil sınıflarını al
export function getContainerStyleClasses(settings: Record<string, any> = {}): string {
  const classes: string[] = [];

  // Arka plan rengi
  const bgColor = BACKGROUND_COLORS.find(c => c.id === settings.backgroundColor);
  if (bgColor && bgColor.id !== 'default') {
    classes.push(bgColor.class);
  }

  // Kenarlık stili
  const borderStyle = BORDER_STYLES.find(b => b.id === settings.borderStyle);
  if (borderStyle) {
    classes.push(borderStyle.class);
  }

  // Gölge
  if (settings.hasShadow) {
    classes.push('shadow-lg');
  }

  // Yuvarlatılmış köşeler
  if (settings.roundedCorners === false) {
    classes.push('rounded-none');
  }

  // Kompakt mod
  if (settings.compact) {
    classes.push('py-2');
  }

  return classes.join(' ');
}
