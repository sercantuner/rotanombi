// WidgetFilterFieldsBuilder - Widget filtreleme alanları seçici
// Kullanıcı tüm alanları görür ve filtrelenebilir olanları seçer

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, Plus, X, Filter, Tag, Hash, Calendar, Type, ToggleLeft, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FilterFieldConfig {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

interface WidgetFilterFieldsBuilderProps {
  availableFields: string[];
  selectedFields: FilterFieldConfig[];
  onChange: (fields: FilterFieldConfig[]) => void;
  className?: string;
}

// Alan tipi tespit et
const detectFieldType = (fieldName: string): 'string' | 'number' | 'date' | 'boolean' => {
  const lowerName = fieldName.toLowerCase();
  
  // Tarih alanları
  if (lowerName.includes('tarih') || lowerName.includes('date') || lowerName.includes('_at') || lowerName.includes('zaman')) {
    return 'date';
  }
  
  // Sayısal alanlar
  if (lowerName.includes('tutar') || lowerName.includes('bakiye') || lowerName.includes('miktar') || 
      lowerName.includes('fiyat') || lowerName.includes('adet') || lowerName.includes('toplam') ||
      lowerName.includes('oran') || lowerName.includes('count') || lowerName.includes('sum')) {
    return 'number';
  }
  
  // Boolean alanları
  if (lowerName.includes('is_') || lowerName.includes('has_') || lowerName.includes('aktif') || 
      lowerName.includes('pasif') || lowerName.includes('durum') || lowerName.includes('enabled')) {
    return 'boolean';
  }
  
  return 'string';
};

// Alan için varsayılan etiket oluştur
const generateDefaultLabel = (fieldName: string): string => {
  // camelCase veya snake_case'i boşluklara çevir ve ilk harfleri büyük yap
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
};

// Tip ikonu
const FieldTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'number': return <Hash className="h-3 w-3" />;
    case 'date': return <Calendar className="h-3 w-3" />;
    case 'boolean': return <ToggleLeft className="h-3 w-3" />;
    default: return <Type className="h-3 w-3" />;
  }
};

export function WidgetFilterFieldsBuilder({
  availableFields,
  selectedFields,
  onChange,
  className,
}: WidgetFilterFieldsBuilderProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState('');

  // Seçili alan key'leri
  const selectedKeys = useMemo(() => selectedFields.map(f => f.key), [selectedFields]);

  // Filtrelenmiş alanlar (seçili olmayanlar + arama)
  const filteredAvailableFields = useMemo(() => {
    return availableFields
      .filter(field => !selectedKeys.includes(field))
      .filter(field => 
        !searchTerm || 
        field.toLowerCase().includes(searchTerm.toLowerCase()) ||
        generateDefaultLabel(field).toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.localeCompare(b, 'tr'));
  }, [availableFields, selectedKeys, searchTerm]);

  // Alan ekle
  const handleAddField = (fieldName: string) => {
    const newField: FilterFieldConfig = {
      key: fieldName,
      label: generateDefaultLabel(fieldName),
      type: detectFieldType(fieldName),
    };
    onChange([...selectedFields, newField]);
  };

  // Alan kaldır
  const handleRemoveField = (fieldKey: string) => {
    onChange(selectedFields.filter(f => f.key !== fieldKey));
  };

  // Etiket düzenlemeyi başlat
  const startEditLabel = (field: FilterFieldConfig) => {
    setEditingLabel(field.key);
    setTempLabel(field.label);
  };

  // Etiket kaydet
  const saveLabel = () => {
    if (editingLabel && tempLabel.trim()) {
      onChange(selectedFields.map(f => 
        f.key === editingLabel ? { ...f, label: tempLabel.trim() } : f
      ));
    }
    setEditingLabel(null);
    setTempLabel('');
  };

  return (
    <TooltipProvider>
      <div className={cn("grid grid-cols-2 gap-4", className)}>
        {/* Sol Panel: Mevcut Alanlar */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Mevcut Alanlar
            </CardTitle>
            <CardDescription className="text-xs">
              Tıklayarak filtre alanı ekle
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            {/* Arama */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Alan ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <ScrollArea className="h-[250px]">
              <div className="space-y-1 pr-2">
                {filteredAvailableFields.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {searchTerm ? 'Eşleşen alan bulunamadı' : 'Tüm alanlar eklendi'}
                  </p>
                ) : (
                  filteredAvailableFields.map((field) => {
                    const fieldType = detectFieldType(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => handleAddField(field)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm transition-colors group"
                      >
                        <FieldTypeIcon type={fieldType} />
                        <span className="flex-1 text-left truncate">{field}</span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Sağ Panel: Seçili Filtre Alanları */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Seçili Filtre Alanları
              {selectedFields.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {selectedFields.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Widget bu alanlara göre filtrelenebilir
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[250px]">
              <div className="space-y-1.5 pr-2">
                {selectedFields.length === 0 ? (
                  <div className="text-center py-8">
                    <Filter className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Henüz filtre alanı eklenmedi
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      Sol panelden alan seçin
                    </p>
                  </div>
                ) : (
                  selectedFields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 border"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-shrink-0">
                            <FieldTypeIcon type={field.type || 'string'} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          Tip: {field.type || 'string'}
                        </TooltipContent>
                      </Tooltip>

                      <div className="flex-1 min-w-0">
                        {editingLabel === field.key ? (
                          <Input
                            value={tempLabel}
                            onChange={(e) => setTempLabel(e.target.value)}
                            onBlur={saveLabel}
                            onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
                            className="h-6 text-xs"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditLabel(field)}
                            className="w-full text-left"
                          >
                            <span className="text-sm font-medium block truncate">
                              {field.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {field.key}
                            </span>
                          </button>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveField(field.key)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Alt Bilgi */}
        <div className="col-span-2">
          <Alert className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Seçilen filtreler widget'ın üst kısmında görünecektir. 
              Global filtre barına henüz eklenmemiş alanlar otomatik olarak eklenecektir.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </TooltipProvider>
  );
}
