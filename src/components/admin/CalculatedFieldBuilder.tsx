// CalculatedFieldBuilder - Görsel hesaplama alanı oluşturucu

import React, { useState, useMemo } from 'react';
import { CalculatedField, CalculationExpression, MathOperator, MATH_OPERATORS, MATH_FUNCTIONS, CALCULATION_TEMPLATES, FORMAT_OPTIONS } from '@/lib/widgetBuilderTypes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Calculator, Variable, Hash, Sparkles, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CompactSearchableFieldSelect } from './SearchableFieldSelect';

interface CalculatedFieldBuilderProps {
  calculatedFields: CalculatedField[];
  onChange: (fields: CalculatedField[]) => void;
  availableFields: string[];
  fieldTypes?: Record<string, string>;
  sampleData?: any[];
}

// Formülü metin olarak göster
function expressionToString(expr: CalculationExpression): string {
  if (!expr) return '';
  
  switch (expr.type) {
    case 'field':
      return `[${expr.field}]`;
    case 'constant':
      return String(expr.value ?? 0);
    case 'operation':
      const left = expressionToString(expr.left!);
      const right = expressionToString(expr.right!);
      const opSymbol = MATH_OPERATORS.find(o => o.id === expr.operator)?.symbol || expr.operator;
      return `(${left} ${opSymbol} ${right})`;
    case 'function':
      const args = expr.arguments?.map(a => expressionToString(a)).join(', ') || '';
      return `${expr.functionName?.toUpperCase()}(${args})`;
    default:
      return '';
  }
}

// İfadeyi değerlendir
function evaluateExpression(expr: CalculationExpression, row: Record<string, any>): number {
  if (!expr) return 0;
  
  switch (expr.type) {
    case 'field':
      const val = row[expr.field!];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
      return 0;
    case 'constant':
      return expr.value ?? 0;
    case 'operation':
      const left = evaluateExpression(expr.left!, row);
      const right = evaluateExpression(expr.right!, row);
      switch (expr.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '%': return left % right;
        default: return 0;
      }
    case 'function':
      const args = expr.arguments?.map(a => evaluateExpression(a, row)) || [];
      switch (expr.functionName) {
        case 'abs': return Math.abs(args[0] || 0);
        case 'round': return Math.round(args[0] || 0);
        case 'floor': return Math.floor(args[0] || 0);
        case 'ceil': return Math.ceil(args[0] || 0);
        case 'sqrt': return Math.sqrt(args[0] || 0);
        case 'pow': return Math.pow(args[0] || 0, args[1] || 0);
        case 'min': return Math.min(...args);
        case 'max': return Math.max(...args);
        default: return 0;
      }
    default:
      return 0;
  }
}

// Benzersiz ID oluştur
function generateId(): string {
  return `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Tek bir hesaplama alanı düzenleyici
function CalculatedFieldEditor({
  field,
  onChange,
  onDelete,
  availableFields,
  fieldTypes,
  sampleData,
}: {
  field: CalculatedField;
  onChange: (field: CalculatedField) => void;
  onDelete: () => void;
  availableFields: string[];
  fieldTypes?: Record<string, string>;
  sampleData?: any[];
}) {
  const [formulaParts, setFormulaParts] = useState<(string | { type: 'field' | 'op' | 'const' | 'func'; value: string })[]>(() => {
    // Mevcut expression'ı parçalara ayır (basit görselleştirme için)
    return [{ type: 'field', value: field.expression.field || availableFields[0] || '' }];
  });
  
  // Formül string olarak
  const formulaString = expressionToString(field.expression);
  
  // Önizleme değeri hesapla
  const previewValue = sampleData && sampleData.length > 0 
    ? evaluateExpression(field.expression, sampleData[0])
    : null;
  
  // Basit formül builder - iki alan ve bir operatör
  const [leftField, setLeftField] = useState(field.expression.left?.field || field.expression.field || '');
  const [rightField, setRightField] = useState(field.expression.right?.field || '');
  const [operator, setOperator] = useState<MathOperator>(field.expression.operator || '+');
  const [constantValue, setConstantValue] = useState<number>(field.expression.right?.value || 0);
  const [useConstant, setUseConstant] = useState(field.expression.right?.type === 'constant');
  
  // Expression'ı güncelle
  const updateExpression = (left: string, op: MathOperator, right: string | number, isConstant: boolean) => {
    const newExpression: CalculationExpression = {
      type: 'operation',
      operator: op,
      left: { type: 'field', field: left },
      right: isConstant 
        ? { type: 'constant', value: Number(right) }
        : { type: 'field', field: String(right) }
    };
    onChange({ ...field, expression: newExpression });
  };
  
  // Sayısal alanları filtrele
  const numericFields = availableFields.filter(f => {
    const type = fieldTypes?.[f];
    return type === 'number' || type === 'number-string';
  });
  
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Alan Adı</Label>
            <Input
              value={field.name}
              onChange={(e) => onChange({ ...field, name: e.target.value.replace(/\s/g, '_').toLowerCase() })}
              placeholder="hesaplanan_alan"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiket</Label>
            <Input
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              placeholder="Hesaplanan Alan"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Formül Builder */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Formül</Label>
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border">
          {/* Sol Alan - Aranabilir */}
          <CompactSearchableFieldSelect
            value={leftField}
            onValueChange={(v) => { setLeftField(v === '__none__' ? '' : v); updateExpression(v === '__none__' ? '' : v, operator, useConstant ? constantValue : rightField, useConstant); }}
            fields={numericFields.length > 0 ? numericFields : availableFields}
            fieldTypes={fieldTypes}
            placeholder="Alan seç"
            className="w-[140px]"
          />
          
          {/* Operatör */}
          <div className="flex gap-1">
            {MATH_OPERATORS.map(op => (
              <Button
                key={op.id}
                variant={operator === op.id ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0 text-lg"
                onClick={() => { setOperator(op.id); updateExpression(leftField, op.id, useConstant ? constantValue : rightField, useConstant); }}
              >
                {op.symbol}
              </Button>
            ))}
          </div>
          
          {/* Sağ Alan veya Sabit */}
          <div className="flex items-center gap-2">
            <Button
              variant={!useConstant ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => { setUseConstant(false); updateExpression(leftField, operator, rightField, false); }}
            >
              <Variable className="h-3.5 w-3.5 mr-1" />
              Alan
            </Button>
            <Button
              variant={useConstant ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => { setUseConstant(true); updateExpression(leftField, operator, constantValue, true); }}
            >
              <Hash className="h-3.5 w-3.5 mr-1" />
              Sabit
            </Button>
          </div>
          
          {useConstant ? (
            <Input
              type="number"
              value={constantValue}
              onChange={(e) => { 
                const val = parseFloat(e.target.value) || 0;
                setConstantValue(val); 
                updateExpression(leftField, operator, val, true); 
              }}
              className="w-[100px] h-8 text-sm"
              placeholder="100"
            />
          ) : (
            <CompactSearchableFieldSelect
              value={rightField}
              onValueChange={(v) => { setRightField(v === '__none__' ? '' : v); updateExpression(leftField, operator, v === '__none__' ? '' : v, false); }}
              fields={numericFields.length > 0 ? numericFields : availableFields}
              fieldTypes={fieldTypes}
              placeholder="Alan seç"
              className="w-[140px]"
            />
          )}
        </div>
        
        {/* Formül Özeti */}
        <div className="flex items-center justify-between text-xs">
          <code className="px-2 py-1 bg-muted rounded text-muted-foreground">
            {expressionToString(field.expression) || 'Formül oluşturun'}
          </code>
          {previewValue !== null && (
            <Badge variant="outline" className="text-xs">
              Önizleme: {field.format === 'currency' 
                ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(previewValue)
                : field.format === 'percentage'
                  ? `%${previewValue.toFixed(field.decimals ?? 2)}`
                  : previewValue.toFixed(field.decimals ?? 2)
              }
            </Badge>
          )}
        </div>
      </div>
      
      {/* Format Ayarları */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Format</Label>
          <Select value={field.format || 'number'} onValueChange={(v: any) => onChange({ ...field, format: v })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.filter(f => ['currency', 'number', 'percentage'].includes(f.id)).map(fmt => (
                <SelectItem key={fmt.id} value={fmt.id}>{fmt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ondalık</Label>
          <Input
            type="number"
            min={0}
            max={6}
            value={field.decimals ?? 2}
            onChange={(e) => onChange({ ...field, decimals: parseInt(e.target.value) || 0 })}
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export function CalculatedFieldBuilder({
  calculatedFields,
  onChange,
  availableFields,
  fieldTypes,
  sampleData,
}: CalculatedFieldBuilderProps) {
  // Yeni hesaplama alanı ekle
  const addCalculatedField = () => {
    const numericField = availableFields.find(f => {
      const type = fieldTypes?.[f];
      return type === 'number' || type === 'number-string';
    }) || availableFields[0] || '';
    
    const newField: CalculatedField = {
      id: generateId(),
      name: `hesaplama_${calculatedFields.length + 1}`,
      label: `Hesaplanan Alan ${calculatedFields.length + 1}`,
      expression: {
        type: 'field',
        field: numericField,
      },
      format: 'number',
      decimals: 2,
    };
    onChange([...calculatedFields, newField]);
  };
  
  // Hesaplama alanını güncelle
  const updateField = (index: number, updatedField: CalculatedField) => {
    const newFields = [...calculatedFields];
    newFields[index] = updatedField;
    onChange(newFields);
  };
  
  // Hesaplama alanını sil
  const deleteField = (index: number) => {
    const newFields = calculatedFields.filter((_, i) => i !== index);
    onChange(newFields);
  };
  
  // Şablon uygula
  const applyTemplate = (templateId: string) => {
    const template = CALCULATION_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    // Sayısal alanları bul
    const numericFields = availableFields.filter(f => {
      const type = fieldTypes?.[f];
      return type === 'number' || type === 'number-string';
    });
    
    if (numericFields.length < 2) {
      toast.error('Şablon için en az 2 sayısal alan gerekli');
      return;
    }
    
    let expression: CalculationExpression;
    
    switch (templateId) {
      case 'difference':
      case 'net':
        expression = {
          type: 'operation',
          operator: '-',
          left: { type: 'field', field: numericFields[0] },
          right: { type: 'field', field: numericFields[1] },
        };
        break;
      case 'total':
        expression = {
          type: 'operation',
          operator: '+',
          left: { type: 'field', field: numericFields[0] },
          right: { type: 'field', field: numericFields[1] },
        };
        break;
      case 'percentage':
        expression = {
          type: 'operation',
          operator: '*',
          left: {
            type: 'operation',
            operator: '/',
            left: { type: 'field', field: numericFields[0] },
            right: { type: 'field', field: numericFields[1] },
          },
          right: { type: 'constant', value: 100 },
        };
        break;
      case 'average':
        expression = {
          type: 'operation',
          operator: '/',
          left: {
            type: 'operation',
            operator: '+',
            left: { type: 'field', field: numericFields[0] },
            right: { type: 'field', field: numericFields[1] },
          },
          right: { type: 'constant', value: 2 },
        };
        break;
      case 'margin':
        expression = {
          type: 'operation',
          operator: '*',
          left: {
            type: 'operation',
            operator: '/',
            left: {
              type: 'operation',
              operator: '-',
              left: { type: 'field', field: numericFields[0] },
              right: { type: 'field', field: numericFields[1] },
            },
            right: { type: 'field', field: numericFields[0] },
          },
          right: { type: 'constant', value: 100 },
        };
        break;
      default:
        expression = { type: 'field', field: numericFields[0] };
    }
    
    const newField: CalculatedField = {
      id: generateId(),
      name: template.id,
      label: template.name,
      expression,
      format: templateId === 'percentage' || templateId === 'margin' ? 'percentage' : 'number',
      decimals: 2,
    };
    
    onChange([...calculatedFields, newField]);
    toast.success(`"${template.name}" şablonu eklendi`);
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Hesaplama Alanları
            </CardTitle>
            <CardDescription>
              Sayısal alanlar üzerinde matematiksel işlemler tanımlayın
            </CardDescription>
          </div>
          <Button size="sm" onClick={addCalculatedField} disabled={availableFields.length === 0}>
            <Plus className="h-4 w-4 mr-1" />
            Hesaplama Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Şablonlar */}
        {calculatedFields.length === 0 && availableFields.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Hazır Şablonlar</Label>
            <div className="flex flex-wrap gap-2">
              {CALCULATION_TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyTemplate(template.id)}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {template.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Hesaplama Alanları Listesi */}
        {calculatedFields.length > 0 ? (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {calculatedFields.map((field, index) => (
                <CalculatedFieldEditor
                  key={field.id}
                  field={field}
                  onChange={(f) => updateField(index, f)}
                  onDelete={() => deleteField(index)}
                  availableFields={availableFields}
                  fieldTypes={fieldTypes}
                  sampleData={sampleData}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Henüz hesaplama alanı eklenmedi</p>
            <p className="text-xs mt-1">
              {availableFields.length === 0 
                ? 'Önce API testi yaparak alanları yükleyin'
                : 'Yukarıdaki butona tıklayarak hesaplama ekleyin'
              }
            </p>
          </div>
        )}
        
        {/* Kullanılabilir Alanlar */}
        {availableFields.length > 0 && calculatedFields.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Kullanılabilir Sayısal Alanlar</Label>
              <div className="flex flex-wrap gap-1.5">
                {availableFields
                  .filter(f => {
                    const type = fieldTypes?.[f];
                    return type === 'number' || type === 'number-string';
                  })
                  .map(field => (
                    <Badge 
                      key={field} 
                      variant="outline" 
                      className="text-xs cursor-pointer hover:bg-primary/10 bg-blue-500/10 text-blue-600 border-blue-500/30"
                      onClick={() => {
                        navigator.clipboard.writeText(field);
                        toast.success(`"${field}" kopyalandı`);
                      }}
                    >
                      {field}
                    </Badge>
                  ))
                }
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}