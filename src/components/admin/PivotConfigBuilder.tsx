// PivotConfigBuilder - Pivot Rapor yapılandırma bileşeni

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LayoutGrid, Info } from 'lucide-react';
import { AggregationType, AGGREGATION_TYPES, PivotConfig } from '@/lib/widgetBuilderTypes';
import { SearchableFieldSelect } from './SearchableFieldSelect';

// Re-export for convenience
export type { PivotConfig };

interface PivotConfigBuilderProps {
  config: PivotConfig;
  onChange: (config: PivotConfig) => void;
  availableFields: string[];
  numericFields: string[];
  fieldTypes?: Record<string, string>;
}

// Varsayılan değerlerle birleştirilmiş config
const getConfigWithDefaults = (config: PivotConfig): Required<Pick<PivotConfig, 'showRowTotals' | 'showColumnTotals' | 'showGrandTotal'>> & PivotConfig => ({
  ...config,
  showRowTotals: config.showRowTotals ?? true,
  showColumnTotals: config.showColumnTotals ?? true,
  showGrandTotal: config.showGrandTotal ?? true,
});

export function PivotConfigBuilder({ config, onChange, availableFields, numericFields, fieldTypes = {} }: PivotConfigBuilderProps) {
  const safeConfig = getConfigWithDefaults(config);
  const updateConfig = (updates: Partial<PivotConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />
          Pivot Rapor Yapılandırması
        </CardTitle>
        <CardDescription>
          Satır, sütun ve değer alanlarını seçerek pivot tablo oluşturun
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {availableFields.length === 0 ? (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <Info className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Önce bir veri kaynağı seçin
            </p>
          </div>
        ) : (
          <>
            {/* Satır Alanları */}
            <div className="space-y-2">
              <Label>Satır Alanları (Gruplandırma)</Label>
              <SearchableFieldSelect
                value={config.rowFields[0] || ''}
                onValueChange={(v) => updateConfig({ rowFields: v && v !== '__none__' ? [v] : [] })}
                fields={availableFields}
                fieldTypes={fieldTypes}
                placeholder="Ana satır alanı seçin"
                showNoneOption
                noneLabel="Seçim yok"
              />
              <p className="text-xs text-muted-foreground">
                Pivot tablonun satırlarında gruplandırılacak alan
              </p>
            </div>

            {/* Sütun Alanı */}
            <div className="space-y-2">
              <Label>Sütun Alanı</Label>
              <SearchableFieldSelect
                value={config.columnField || '__none__'}
                onValueChange={(v) => updateConfig({ columnField: v === '__none__' ? '' : v })}
                fields={availableFields}
                fieldTypes={fieldTypes}
                placeholder="Sütun alanı seçin"
                showNoneOption
                noneLabel="Sütun yok"
              />
              <p className="text-xs text-muted-foreground">
                Her benzersiz değer için ayrı sütun oluşturulur
              </p>
            </div>

            {/* Değer Alanı */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Değer Alanı</Label>
                <SearchableFieldSelect
                  value={config.valueField}
                  onValueChange={(v) => updateConfig({ valueField: v === '__none__' ? '' : v })}
                  fields={numericFields}
                  fieldTypes={fieldTypes}
                  placeholder="Değer alanı seçin"
                />
              </div>

              <div className="space-y-2">
                <Label>Hesaplama</Label>
                <Select
                  value={config.aggregation}
                  onValueChange={(v: AggregationType) => updateConfig({ aggregation: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_TYPES.map(agg => (
                      <SelectItem key={agg.id} value={agg.id}>{agg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Toplam Seçenekleri */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <Label className="text-sm">Satır Toplamları</Label>
                <Switch
                  checked={safeConfig.showRowTotals}
                  onCheckedChange={(v) => updateConfig({ showRowTotals: v })}
                />
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <Label className="text-sm">Sütun Toplamları</Label>
                <Switch
                  checked={safeConfig.showColumnTotals}
                  onCheckedChange={(v) => updateConfig({ showColumnTotals: v })}
                />
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <Label className="text-sm">Genel Toplam</Label>
                <Switch
                  checked={safeConfig.showGrandTotal}
                  onCheckedChange={(v) => updateConfig({ showGrandTotal: v })}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export const getDefaultPivotConfig = (): PivotConfig => ({
  rowFields: [],
  columnField: '',
  valueField: '',
  aggregation: 'sum',
  showRowTotals: true,
  showColumnTotals: true,
  showGrandTotal: true,
});
