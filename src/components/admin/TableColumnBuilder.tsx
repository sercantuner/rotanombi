// TableColumnBuilder - Tablo/Liste/Pivot için kolon yapılandırma bileşeni

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, Table, Columns, Info } from 'lucide-react';
import { TableConfig } from '@/lib/widgetBuilderTypes';
import { cn } from '@/lib/utils';
import { SearchableFieldSelect } from './SearchableFieldSelect';

export interface TableColumn {
  field: string;
  header: string;
  format?: 'currency' | 'number' | 'date' | 'text' | 'badge' | 'percentage';
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface TableColumnBuilderProps {
  columns: TableColumn[];
  onChange: (columns: TableColumn[]) => void;
  availableFields: string[];
  visualizationType: 'table' | 'list' | 'pivot';
  fieldTypes?: Record<string, string>;
}

const FORMAT_OPTIONS = [
  { id: 'text', name: 'Metin' },
  { id: 'number', name: 'Sayı' },
  { id: 'currency', name: 'Para Birimi' },
  { id: 'percentage', name: 'Yüzde' },
  { id: 'date', name: 'Tarih' },
  { id: 'badge', name: 'Badge' },
];

const ALIGN_OPTIONS = [
  { id: 'left', name: 'Sol' },
  { id: 'center', name: 'Orta' },
  { id: 'right', name: 'Sağ' },
];

const generateId = () => `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function TableColumnBuilder({ columns, onChange, availableFields, visualizationType, fieldTypes = {} }: TableColumnBuilderProps) {
  const addColumn = () => {
    const nextField = availableFields.find(f => !columns.some(c => c.field === f)) || availableFields[0] || '';
    onChange([...columns, {
      field: nextField,
      header: nextField,
      format: 'text',
      sortable: true,
      align: 'left',
    }]);
  };

  const updateColumn = (index: number, updates: Partial<TableColumn>) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeColumn = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= columns.length) return;
    const updated = [...columns];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  // Otomatik tüm alanları ekle
  const addAllFields = () => {
    const newColumns = availableFields
      .filter(f => !columns.some(c => c.field === f))
      .map(field => ({
        field,
        header: field,
        format: 'text' as const,
        sortable: true,
        align: 'left' as const,
      }));
    onChange([...columns, ...newColumns]);
  };

  const getTitle = () => {
    switch (visualizationType) {
      case 'table': return 'Tablo Kolonları';
      case 'list': return 'Liste Alanları';
      case 'pivot': return 'Pivot Alanları';
      default: return 'Kolon Yapılandırması';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Columns className="h-5 w-5 text-primary" />
          {getTitle()}
        </CardTitle>
        <CardDescription>
          Görüntülenecek kolonları seçin ve sıralayın
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {columns.length === 0 && (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">
              Henüz kolon eklenmedi. Gösterilecek alanları ekleyin veya tümünü ekleyin.
            </p>
            <Button variant="outline" size="sm" onClick={addAllFields} disabled={availableFields.length === 0}>
              Tüm Alanları Ekle
            </Button>
          </div>
        )}

        {columns.map((column, index) => (
          <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
            {/* Sürükleme tutacağı */}
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => moveColumn(index, index - 1)}
                disabled={index === 0}
              >
                <span className="text-xs">↑</span>
              </Button>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => moveColumn(index, index + 1)}
                disabled={index === columns.length - 1}
              >
                <span className="text-xs">↓</span>
              </Button>
            </div>

            {/* Alan seçimi - Aranabilir */}
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Alan</Label>
              <SearchableFieldSelect
                value={column.field}
                onValueChange={(v) => updateColumn(index, { field: v === '__none__' ? '' : v, header: v === '__none__' ? '' : v })}
                fields={availableFields}
                fieldTypes={fieldTypes}
                placeholder="Alan seçin"
                triggerClassName="h-8"
              />
            </div>

            {/* Başlık */}
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Başlık</Label>
              <Input
                className="h-8"
                value={column.header}
                onChange={(e) => updateColumn(index, { header: e.target.value })}
                placeholder="Kolon başlığı"
              />
            </div>

            {/* Format */}
            <div className="w-28 space-y-1">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select
                value={column.format || 'text'}
                onValueChange={(v: any) => updateColumn(index, { format: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map(fmt => (
                    <SelectItem key={fmt.id} value={fmt.id}>{fmt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hizalama */}
            <div className="w-20 space-y-1">
              <Label className="text-xs text-muted-foreground">Hiza</Label>
              <Select
                value={column.align || 'left'}
                onValueChange={(v: any) => updateColumn(index, { align: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALIGN_OPTIONS.map(al => (
                    <SelectItem key={al.id} value={al.id}>{al.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sıralanabilir */}
            <div className="flex flex-col items-center gap-1">
              <Label className="text-xs text-muted-foreground">Sırala</Label>
              <Switch
                checked={column.sortable !== false}
                onCheckedChange={(v) => updateColumn(index, { sortable: v })}
              />
            </div>

            {/* Silme */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => removeColumn(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addColumn}
            disabled={availableFields.length === 0}
            className="flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Kolon Ekle
          </Button>
          {columns.length > 0 && columns.length < availableFields.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={addAllFields}
            >
              Kalanları Ekle
            </Button>
          )}
        </div>

        {availableFields.length === 0 && (
          <p className="text-xs text-amber-600 text-center">
            Önce bir veri kaynağı seçin
          </p>
        )}

        {/* Seçili kolonlar özeti */}
        {columns.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            <span className="text-xs text-muted-foreground mr-1">Sıra:</span>
            {columns.map((col, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {i + 1}. {col.header}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
