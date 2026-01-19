// Widget Templates - Hazır widget şablonları

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  WidgetBuilderConfig,
  ChartType,
  DiaApiFilter,
  DiaApiSort,
} from '@/lib/widgetBuilderTypes';
import {
  Hash, BarChart3, TrendingUp, PieChart, Table, List,
  Users, Wallet, CreditCard, Package, FileText, Calendar,
  Target, Activity, DollarSign, ShoppingCart, Truck, AlertTriangle,
  Star, Zap, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  category: 'cari' | 'finans' | 'satis' | 'stok' | 'genel';
  icon: string;
  previewIcon: React.ReactNode;
  config: Partial<WidgetBuilderConfig>;
  suggestedName: string;
  suggestedKey: string;
  filters?: DiaApiFilter[];
  sorts?: DiaApiSort[];
  selectedColumns?: string[];
}

// Hazır şablonlar
export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  // ============= CARİ ŞABLONları =============
  {
    id: 'cari_toplam_alacak',
    name: 'Toplam Alacak KPI',
    description: 'Tüm carilerden olan toplam alacak tutarı',
    category: 'cari',
    icon: 'Wallet',
    previewIcon: <Wallet className="h-8 w-8 text-green-500" />,
    suggestedName: 'Toplam Alacak',
    suggestedKey: 'kpi_toplam_alacak',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'toplambakiye',
          aggregation: 'sum',
          format: 'currency',
        },
      },
    },
    filters: [
      { field: 'toplambakiye', operator: '>', value: '0' }
    ],
  },
  {
    id: 'cari_toplam_borc',
    name: 'Toplam Borç KPI',
    description: 'Tedarikçilere olan toplam borç tutarı',
    category: 'cari',
    icon: 'CreditCard',
    previewIcon: <CreditCard className="h-8 w-8 text-red-500" />,
    suggestedName: 'Toplam Borç',
    suggestedKey: 'kpi_toplam_borc',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'toplambakiye',
          aggregation: 'sum',
          format: 'currency',
        },
      },
    },
    filters: [
      { field: 'toplambakiye', operator: '<', value: '0' }
    ],
  },
  {
    id: 'cari_musteri_sayisi',
    name: 'Müşteri Sayısı KPI',
    description: 'Aktif müşteri sayısı',
    category: 'cari',
    icon: 'Users',
    previewIcon: <Users className="h-8 w-8 text-blue-500" />,
    suggestedName: 'Müşteri Sayısı',
    suggestedKey: 'kpi_musteri_sayisi',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'carikartkodu',
          aggregation: 'count',
          format: 'count',
        },
      },
    },
    filters: [
      { field: 'potansiyel', operator: '=', value: 'H' },
      { field: 'aktif', operator: '=', value: 'E' }
    ],
  },
  {
    id: 'cari_sektor_dagilimi',
    name: 'Sektör Dağılımı',
    description: 'Carilerin sektörlere göre dağılımı (Pasta Grafik)',
    category: 'cari',
    icon: 'PieChart',
    previewIcon: <PieChart className="h-8 w-8 text-purple-500" />,
    suggestedName: 'Sektör Dağılımı',
    suggestedKey: 'chart_sektor_dagilimi',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'pie',
        chart: {
          chartType: 'pie',
          xAxis: { field: 'sektorler' },
          showLegend: true,
          displayLimit: 10,
        },
      },
    },
    selectedColumns: ['carikartkodu', 'unvan', 'sektorler'],
  },
  {
    id: 'cari_ozelkod_dagilimi',
    name: 'Özel Kod Dağılımı',
    description: 'Carilerin özel kod 1\'e göre dağılımı (Donut)',
    category: 'cari',
    icon: 'Target',
    previewIcon: <Target className="h-8 w-8 text-orange-500" />,
    suggestedName: 'Özel Kod Dağılımı',
    suggestedKey: 'chart_ozelkod_dagilimi',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'donut',
        chart: {
          chartType: 'donut',
          xAxis: { field: 'ozelkod1' },
          showLegend: true,
          displayLimit: 8,
        },
      },
    },
    selectedColumns: ['carikartkodu', 'unvan', 'ozelkod1', 'ozelkod1kod'],
  },
  {
    id: 'cari_lokasyon_bar',
    name: 'Lokasyon Dağılımı',
    description: 'Şehirlere göre cari sayısı (Bar Grafik)',
    category: 'cari',
    icon: 'BarChart3',
    previewIcon: <BarChart3 className="h-8 w-8 text-cyan-500" />,
    suggestedName: 'Lokasyon Dağılımı',
    suggestedKey: 'chart_lokasyon_dagilimi',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'bar',
        chart: {
          chartType: 'bar',
          xAxis: { field: 'sehir' },
          yAxis: { field: 'carikartkodu', aggregation: 'count' },
          showLegend: false,
          showGrid: true,
          displayLimit: 10,
        },
      },
    },
    selectedColumns: ['carikartkodu', 'unvan', 'sehir'],
  },
  {
    id: 'cari_listesi_tablo',
    name: 'Cari Listesi Tablosu',
    description: 'Detaylı cari kart listesi tablosu',
    category: 'cari',
    icon: 'Table',
    previewIcon: <Table className="h-8 w-8 text-slate-500" />,
    suggestedName: 'Cari Listesi',
    suggestedKey: 'table_cari_listesi',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 100 },
      },
      visualization: {
        type: 'table',
        table: {
          columns: [
            { field: 'carikartkodu', header: 'Kod', sortable: true },
            { field: 'unvan', header: 'Ünvan', sortable: true },
            { field: 'sehir', header: 'Şehir', sortable: true },
            { field: 'toplambakiye', header: 'Bakiye', format: 'currency', sortable: true },
          ],
          pagination: true,
          pageSize: 10,
          searchable: true,
        },
      },
    },
    selectedColumns: ['carikartkodu', 'unvan', 'sehir', 'toplambakiye', 'telefon1', 'email'],
    sorts: [{ field: 'toplambakiye', sorttype: 'DESC' }],
  },

  // ============= FİNANS ŞABLONları =============
  {
    id: 'finans_vadesi_gecen',
    name: 'Vadesi Geçen Alacak',
    description: 'Vadesi geçmiş toplam alacak tutarı',
    category: 'finans',
    icon: 'AlertTriangle',
    previewIcon: <AlertTriangle className="h-8 w-8 text-amber-500" />,
    suggestedName: 'Vadesi Geçen Alacak',
    suggestedKey: 'kpi_vadesi_gecen_alacak',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_vade_bakiye_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'vadesigecentutar',
          aggregation: 'sum',
          format: 'currency',
        },
      },
    },
    filters: [
      { field: 'vadesigecentutar', operator: '>', value: '0' }
    ],
  },
  {
    id: 'finans_net_bakiye',
    name: 'Net Bakiye KPI',
    description: 'Toplam alacak - borç = net bakiye',
    category: 'finans',
    icon: 'DollarSign',
    previewIcon: <DollarSign className="h-8 w-8 text-emerald-500" />,
    suggestedName: 'Net Bakiye',
    suggestedKey: 'kpi_net_bakiye',
    config: {
      diaApi: {
        module: 'scf',
        method: 'carikart_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'toplambakiye',
          aggregation: 'sum',
          format: 'currency',
        },
      },
    },
  },

  // ============= SATIŞ ŞABLONları =============
  {
    id: 'satis_toplam_tutar',
    name: 'Toplam Satış KPI',
    description: 'Toplam satış tutarı',
    category: 'satis',
    icon: 'ShoppingCart',
    previewIcon: <ShoppingCart className="h-8 w-8 text-indigo-500" />,
    suggestedName: 'Toplam Satış',
    suggestedKey: 'kpi_toplam_satis',
    config: {
      diaApi: {
        module: 'fat',
        method: 'fatura_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'toplam',
          aggregation: 'sum',
          format: 'currency',
        },
      },
    },
  },
  {
    id: 'satis_fatura_sayisi',
    name: 'Fatura Sayısı KPI',
    description: 'Kesilen toplam fatura adedi',
    category: 'satis',
    icon: 'FileText',
    previewIcon: <FileText className="h-8 w-8 text-teal-500" />,
    suggestedName: 'Fatura Sayısı',
    suggestedKey: 'kpi_fatura_sayisi',
    config: {
      diaApi: {
        module: 'fat',
        method: 'fatura_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'faturano',
          aggregation: 'count',
          format: 'count',
        },
      },
    },
  },
  {
    id: 'satis_trend_line',
    name: 'Satış Trend Grafiği',
    description: 'Aylık satış trendi çizgi grafiği',
    category: 'satis',
    icon: 'TrendingUp',
    previewIcon: <TrendingUp className="h-8 w-8 text-rose-500" />,
    suggestedName: 'Satış Trendi',
    suggestedKey: 'chart_satis_trend',
    config: {
      diaApi: {
        module: 'fat',
        method: 'fatura_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'line',
        chart: {
          chartType: 'line',
          xAxis: { field: 'faturatarihi', format: 'date' },
          yAxis: { field: 'toplam', aggregation: 'sum' },
          showLegend: false,
          showGrid: true,
        },
      },
    },
    selectedColumns: ['faturano', 'faturatarihi', 'toplam', 'cariadi'],
    sorts: [{ field: 'faturatarihi', sorttype: 'ASC' }],
  },

  // ============= STOK ŞABLONları =============
  {
    id: 'stok_urun_sayisi',
    name: 'Ürün Sayısı KPI',
    description: 'Sistemdeki toplam ürün adedi',
    category: 'stok',
    icon: 'Package',
    previewIcon: <Package className="h-8 w-8 text-violet-500" />,
    suggestedName: 'Ürün Sayısı',
    suggestedKey: 'kpi_urun_sayisi',
    config: {
      diaApi: {
        module: 'stk',
        method: 'stok_listele',
        parameters: { limit: 0 },
      },
      visualization: {
        type: 'kpi',
        kpi: {
          valueField: 'stokkodu',
          aggregation: 'count',
          format: 'count',
        },
      },
    },
  },

  // ============= GENEL ŞABLONları =============
  {
    id: 'genel_aktivite_listesi',
    name: 'Aktivite Listesi',
    description: 'Son aktiviteler tablosu',
    category: 'genel',
    icon: 'Activity',
    previewIcon: <Activity className="h-8 w-8 text-pink-500" />,
    suggestedName: 'Son Aktiviteler',
    suggestedKey: 'table_aktiviteler',
    config: {
      diaApi: {
        module: 'gts',
        method: 'aktivite_listele',
        parameters: { limit: 50 },
      },
      visualization: {
        type: 'table',
        table: {
          columns: [],
          pagination: true,
          pageSize: 10,
        },
      },
    },
    sorts: [{ field: 'tarih', sorttype: 'DESC' }],
  },
  {
    id: 'genel_gorev_listesi',
    name: 'Görev Listesi',
    description: 'Açık görevler listesi',
    category: 'genel',
    icon: 'Calendar',
    previewIcon: <Calendar className="h-8 w-8 text-sky-500" />,
    suggestedName: 'Açık Görevler',
    suggestedKey: 'list_gorevler',
    config: {
      diaApi: {
        module: 'gts',
        method: 'gorev_listele',
        parameters: { limit: 20 },
      },
      visualization: {
        type: 'list',
      },
    },
  },
];

// Kategori bilgileri
const TEMPLATE_CATEGORIES = [
  { id: 'cari', name: 'Cari', icon: <Users className="h-4 w-4" /> },
  { id: 'finans', name: 'Finans', icon: <Wallet className="h-4 w-4" /> },
  { id: 'satis', name: 'Satış', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'stok', name: 'Stok', icon: <Package className="h-4 w-4" /> },
  { id: 'genel', name: 'Genel', icon: <Activity className="h-4 w-4" /> },
];

interface WidgetTemplatesProps {
  onSelectTemplate: (template: WidgetTemplate) => void;
  selectedTemplateId?: string;
}

export function WidgetTemplates({ onSelectTemplate, selectedTemplateId }: WidgetTemplatesProps) {
  const [activeCategory, setActiveCategory] = React.useState<string>('cari');

  const filteredTemplates = WIDGET_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4">
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-5 h-9">
          {TEMPLATE_CATEGORIES.map(cat => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className="text-xs gap-1.5"
            >
              {cat.icon}
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {filteredTemplates.map(template => (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
                    selectedTemplateId === template.id && 'border-primary ring-2 ring-primary/20'
                  )}
                  onClick={() => onSelectTemplate(template)}
                >
                  <CardHeader className="pb-2 pt-3 px-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {template.previewIcon}
                        <div>
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {template.config.visualization?.type}
                          </Badge>
                        </div>
                      </div>
                      {selectedTemplateId === template.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <CardDescription className="text-xs line-clamp-2">
                      {template.description}
                    </CardDescription>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {template.config.diaApi?.module}/{template.config.diaApi?.method}
                      </Badge>
                      {template.filters && template.filters.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {template.filters.length} filtre
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
