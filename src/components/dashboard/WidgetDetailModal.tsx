// Widget Detail Modal - Marketplace'de widget detaylarını gösteren modal
// Preview image, teknik notlar, açıklamalar ve etiketler gösterilir

import React from 'react';
import { Widget, TechnicalNotes } from '@/lib/widgetTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Plus, ChevronRight, Database, Calculator, GitBranch, 
  FileText, BookOpen, Tags, LayoutGrid, Clock
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWidgetCategories } from '@/hooks/useWidgetCategories';
import { WIDGET_TYPES, WIDGET_SIZES } from '@/lib/widgetTypes';

interface WidgetDetailModalProps {
  widget: Widget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widgetKey: string) => void;
  isAdding?: boolean;
}

// Dinamik icon renderer
const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <LayoutGrid className={className} />;
  return <Icon className={className} />;
};

export function WidgetDetailModal({ 
  widget, 
  open, 
  onOpenChange, 
  onAddWidget,
  isAdding = false 
}: WidgetDetailModalProps) {
  const { activeCategories } = useWidgetCategories();
  
  if (!widget) return null;

  const technicalNotes = widget.technical_notes as TechnicalNotes | null;
  const hasMetadata = widget.short_description || widget.long_description || technicalNotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start gap-4 pr-8">
            {/* Preview Image veya Icon */}
            <div className="shrink-0">
              {widget.preview_image ? (
                <img 
                  src={widget.preview_image} 
                  alt={widget.name}
                  className="w-24 h-16 object-cover rounded-lg border"
                />
              ) : (
                <div className="w-24 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <DynamicIcon iconName={widget.icon || 'LayoutGrid'} className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <DynamicIcon iconName={widget.icon || 'LayoutGrid'} className="h-5 w-5 text-primary shrink-0" />
                {widget.name}
              </DialogTitle>
              <DialogDescription className="mt-1 line-clamp-2">
                {widget.short_description || widget.description || 'Açıklama yok'}
              </DialogDescription>
              
              {/* Etiketler */}
              <div className="flex flex-wrap gap-1 mt-2">
                {(widget.tags || [widget.category]).slice(0, 5).map((tag, idx) => {
                  const category = activeCategories.find(c => c.slug === tag);
                  return (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {category?.name || tag}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Büyük Preview (varsa) */}
            {widget.preview_image && (
              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <img 
                  src={widget.preview_image} 
                  alt={`${widget.name} önizleme`}
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>
            )}

            {/* Widget Bilgileri */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tip:</span>
                <Badge variant="outline" className="text-xs">
                  {WIDGET_TYPES.find(t => t.id === widget.type)?.name || widget.type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <LucideIcons.Maximize2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Boyut:</span>
                <Badge variant="outline" className="text-xs">
                  {WIDGET_SIZES.find(s => s.id === widget.size)?.name || widget.size}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Uzun Açıklama */}
            {widget.long_description && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Detaylı Açıklama
                </h4>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                  {widget.long_description}
                </div>
              </div>
            )}

            {/* Teknik Notlar */}
            {technicalNotes && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <LucideIcons.Wrench className="h-4 w-4 text-primary" />
                  Teknik Bilgiler
                </h4>

                {/* Kullanılan Alanlar */}
                {technicalNotes.usedFields && technicalNotes.usedFields.length > 0 && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-1">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>svg]:rotate-90" />
                      <Database className="h-4 w-4" />
                      Kullanılan Veri Alanları ({technicalNotes.usedFields.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 pt-2">
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        {technicalNotes.usedFields.map((field, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <code className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                              {field.name}
                            </code>
                            <span className="text-muted-foreground text-xs">({field.type})</span>
                            <span className="text-foreground">- {field.usage}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Hesaplamalar */}
                {technicalNotes.calculations && technicalNotes.calculations.length > 0 && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-1">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>svg]:rotate-90" />
                      <Calculator className="h-4 w-4" />
                      Hesaplamalar ({technicalNotes.calculations.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 pt-2">
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        {technicalNotes.calculations.map((calc, idx) => (
                          <div key={idx} className="text-sm">
                            <div className="font-medium">{calc.name}</div>
                            <code className="text-xs text-primary font-mono">{calc.formula}</code>
                            {calc.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">{calc.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Veri Akışı */}
                {technicalNotes.dataFlow && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full py-1">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>svg]:rotate-90" />
                      <GitBranch className="h-4 w-4" />
                      Veri Akışı
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 pt-2">
                      <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                        {technicalNotes.dataFlow}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Oluşturulma Tarihi */}
                {technicalNotes.generatedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
                    <Clock className="h-3 w-3" />
                    AI tarafından oluşturuldu: {new Date(technicalNotes.generatedAt).toLocaleDateString('tr-TR')}
                  </div>
                )}
              </div>
            )}

            {/* AI Önerilen Etiketler */}
            {widget.ai_suggested_tags && widget.ai_suggested_tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Tags className="h-4 w-4 text-primary" />
                  AI Önerilen Etiketler
                </h4>
                <div className="flex flex-wrap gap-1">
                  {widget.ai_suggested_tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-primary/5">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata yoksa basit mesaj */}
            {!hasMetadata && !widget.preview_image && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Bu widget için detaylı bilgi bulunmuyor</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button
            onClick={() => onAddWidget(widget.widget_key)}
            disabled={isAdding}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Bu Widget'ı Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
