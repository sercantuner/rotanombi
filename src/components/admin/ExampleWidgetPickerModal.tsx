// ExampleWidgetPickerModal - Örnek widget seçimi için tam ekran modal
// Tüm custom code widget'ları listeler ve seçim yapmaya olanak sağlar

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Search, Code, Check, Loader2, LayoutGrid, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExampleWidget {
  id: string;
  widget_key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  type: string;
  size: string;
  builder_config: any;
  created_at: string;
}

interface ExampleWidgetPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedWidgetKey?: string | null;
  onSelect: (widgetKey: string | null) => void;
  excludeWidgetId?: string; // Düzenlenen widget'ı hariç tut
}

// Dinamik ikon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Code className={className} />;
  return <Icon className={className} />;
};

export function ExampleWidgetPickerModal({
  open,
  onOpenChange,
  selectedWidgetKey,
  onSelect,
  excludeWidgetId,
}: ExampleWidgetPickerModalProps) {
  const [widgets, setWidgets] = useState<ExampleWidget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  // Widget'ları veritabanından çek
  useEffect(() => {
    if (!open) return;

    const fetchWidgets = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('widgets')
          .select('id, widget_key, name, description, icon, category, type, size, builder_config, created_at')
          .eq('is_active', true)
          .not('builder_config->customCode', 'is', null)
          .order('name', { ascending: true });

        if (error) throw error;

        // Düzenlenen widget'ı hariç tut
        const filtered = (data || []).filter(w => w.id !== excludeWidgetId);
        setWidgets(filtered as ExampleWidget[]);
      } catch (err: any) {
        console.error('Error fetching widgets:', err);
        toast.error('Widget listesi yüklenemedi');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWidgets();
  }, [open, excludeWidgetId]);

  // Kategorileri çıkar
  const categories = useMemo(() => {
    const cats = new Set<string>();
    widgets.forEach(w => cats.add(w.category));
    return Array.from(cats).sort();
  }, [widgets]);

  // Widget'ları filtrele
  const filteredWidgets = useMemo(() => {
    let result = widgets;

    // Kategori filtresi
    if (activeCategory !== 'all') {
      result = result.filter(w => w.category === activeCategory);
    }

    // Arama filtresi
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(term) ||
        w.widget_key.toLowerCase().includes(term) ||
        w.description?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [widgets, activeCategory, searchTerm]);

  const handleSelect = (widgetKey: string) => {
    if (selectedWidgetKey === widgetKey) {
      onSelect(null);
    } else {
      onSelect(widgetKey);
    }
  };

  const handleConfirm = () => {
    onOpenChange(false);
  };

  const handlePreview = (widget: ExampleWidget, e: React.MouseEvent) => {
    e.stopPropagation();
    const code = widget.builder_config?.customCode;
    if (code) {
      setPreviewCode(code);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Örnek Widget Seç
            </DialogTitle>
            <DialogDescription>
              Mevcut widget'lardan birini seçerek AI'ye yapısal ve stilsel referans olarak gönderin
            </DialogDescription>
          </DialogHeader>

          {/* Arama ve Kategori Filtreleri */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Widget ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Kategori Tabs */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all" className="text-xs">
                Tümü
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">
                  {widgets.length}
                </Badge>
              </TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="text-xs capitalize">
                  {cat}
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">
                    {widgets.filter(w => w.category === cat).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Widget Listesi */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Widget'lar yükleniyor...</span>
              </div>
            ) : filteredWidgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Code className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz custom code widget yok'}
                </p>
                <p className="text-xs mt-1">
                  AI ile yeni widget oluşturabilirsiniz
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                {filteredWidgets.map((widget) => {
                  const isSelected = selectedWidgetKey === widget.widget_key;

                  return (
                    <button
                      key={widget.id}
                      onClick={() => handleSelect(widget.widget_key)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg text-left transition-all border",
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "border-transparent hover:bg-muted hover:border-border"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <DynamicIcon
                          iconName={widget.icon || 'Code'}
                          className="h-5 w-5"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{widget.name}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>

                        {widget.description && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {widget.description}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-[10px] h-4 capitalize">
                            {widget.category}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {widget.type}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {widget.size}
                          </Badge>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => handlePreview(widget, e)}
                        title="Kodu önizle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {selectedWidgetKey ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Seçili: {widgets.find(w => w.widget_key === selectedWidgetKey)?.name}
                </span>
              ) : (
                `${filteredWidgets.length} widget listeleniyor`
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedWidgetKey && (
                <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
                  Seçimi Kaldır
                </Button>
              )}
              <Button size="sm" onClick={handleConfirm}>
                {selectedWidgetKey ? 'Seçimi Onayla' : 'Kapat'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kod Önizleme Modal */}
      <Dialog open={!!previewCode} onOpenChange={() => setPreviewCode(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Kod Önizleme</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px] border rounded-lg">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
              {previewCode}
            </pre>
          </ScrollArea>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPreviewCode(null)}>
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
