// RelationshipEditor - İlişki düzenleme modalı

import React, { useState, useEffect } from 'react';
import { Link2, Trash2, ArrowRight, ArrowLeftRight, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DataSourceRelationship, 
  RelationshipType, 
  CrossFilterDirection,
  RelationshipFormData 
} from '@/hooks/useDataSourceRelationships';
import { DataSource } from '@/hooks/useDataSources';

interface RelationshipEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationship?: DataSourceRelationship | null;
  sourceDataSource?: DataSource | null;
  targetDataSource?: DataSource | null;
  initialSourceField?: string;
  initialTargetField?: string;
  onSave: (data: RelationshipFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isLoading?: boolean;
}

const relationshipTypes: { value: RelationshipType; label: string; description: string }[] = [
  { value: 'one_to_many', label: '1:N (Bir-Çok)', description: 'Kaynak bir kayıt, hedefte çok kayda karşılık gelir' },
  { value: 'many_to_one', label: 'N:1 (Çok-Bir)', description: 'Kaynakta çok kayıt, hedefte bir kayda karşılık gelir' },
  { value: 'one_to_one', label: '1:1 (Bir-Bir)', description: 'Kaynak ve hedefte birer kayıt birbirine karşılık gelir' },
];

const filterDirections: { value: CrossFilterDirection; label: string; icon: React.ReactNode }[] = [
  { value: 'single', label: 'Tek Yön', icon: <ArrowRight className="w-4 h-4" /> },
  { value: 'both', label: 'Çift Yön', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: 'none', label: 'Kapalı', icon: <X className="w-4 h-4" /> },
];

export function RelationshipEditor({
  open,
  onOpenChange,
  relationship,
  sourceDataSource,
  targetDataSource,
  initialSourceField,
  initialTargetField,
  onSave,
  onDelete,
  isLoading,
}: RelationshipEditorProps) {
  const [sourceField, setSourceField] = useState(initialSourceField || '');
  const [targetField, setTargetField] = useState(initialTargetField || '');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('one_to_many');
  const [crossFilterDirection, setCrossFilterDirection] = useState<CrossFilterDirection>('single');
  const [isActive, setIsActive] = useState(true);

  const isEditing = !!relationship;

  // Form değerlerini güncelle
  useEffect(() => {
    if (relationship) {
      setSourceField(relationship.source_field);
      setTargetField(relationship.target_field);
      setRelationshipType(relationship.relationship_type);
      setCrossFilterDirection(relationship.cross_filter_direction);
      setIsActive(relationship.is_active);
    } else {
      setSourceField(initialSourceField || '');
      setTargetField(initialTargetField || '');
      setRelationshipType('one_to_many');
      setCrossFilterDirection('single');
      setIsActive(true);
    }
  }, [relationship, initialSourceField, initialTargetField, open]);

  const sourceFields = sourceDataSource?.last_fields || [];
  const targetFields = targetDataSource?.last_fields || [];

  const handleSave = async () => {
    if (!sourceDataSource || !targetDataSource || !sourceField || !targetField) return;

    await onSave({
      source_data_source_id: sourceDataSource.id,
      target_data_source_id: targetDataSource.id,
      source_field: sourceField,
      target_field: targetField,
      relationship_type: relationshipType,
      cross_filter_direction: crossFilterDirection,
      is_active: isActive,
    });
    
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!relationship || !onDelete) return;
    await onDelete(relationship.id);
    onOpenChange(false);
  };

  const canSave = sourceField && targetField && sourceDataSource && targetDataSource;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            {isEditing ? 'İlişkiyi Düzenle' : 'Yeni İlişki Oluştur'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Kaynak ve Hedef */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label className="text-xs text-muted-foreground">Kaynak</Label>
              <Badge variant="secondary" className="w-full justify-center py-2">
                {sourceDataSource?.name || 'Seçilmedi'}
              </Badge>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 space-y-2">
              <Label className="text-xs text-muted-foreground">Hedef</Label>
              <Badge variant="secondary" className="w-full justify-center py-2">
                {targetDataSource?.name || 'Seçilmedi'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Alan Seçimi */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kaynak Alan</Label>
              <Select value={sourceField} onValueChange={setSourceField}>
                <SelectTrigger>
                  <SelectValue placeholder="Alan seçin" />
                </SelectTrigger>
                <SelectContent>
                  {sourceFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hedef Alan</Label>
              <Select value={targetField} onValueChange={setTargetField}>
                <SelectTrigger>
                  <SelectValue placeholder="Alan seçin" />
                </SelectTrigger>
                <SelectContent>
                  {targetFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* İlişki Tipi */}
          <div className="space-y-2">
            <Label>İlişki Tipi</Label>
            <Select 
              value={relationshipType} 
              onValueChange={(v) => setRelationshipType(v as RelationshipType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Çapraz Filtre Yönü */}
          <div className="space-y-2">
            <Label>Çapraz Filtre Yönü</Label>
            <div className="flex gap-2">
              {filterDirections.map((dir) => (
                <Button
                  key={dir.value}
                  type="button"
                  variant={crossFilterDirection === dir.value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setCrossFilterDirection(dir.value)}
                >
                  {dir.icon}
                  <span className="ml-1">{dir.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {crossFilterDirection === 'both' 
                ? 'Her iki yönde de filtre uygulanır'
                : crossFilterDirection === 'single'
                  ? 'Sadece kaynak → hedef yönünde filtre uygulanır'
                  : 'Çapraz filtreleme kapalı'}
            </p>
          </div>

          {/* Aktif/Pasif */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Aktif</Label>
              <p className="text-xs text-muted-foreground">
                İlişki widget'larda kullanılsın mı?
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {isEditing && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Sil
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isLoading}>
              {isLoading ? 'Kaydediliyor...' : isEditing ? 'Güncelle' : 'Oluştur'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
