// Widget Builder Types - Gelişmiş widget oluşturma sistemi

export type ChartType = 
  | 'kpi'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'radar'
  | 'scatter'
  | 'funnel'
  | 'treemap'
  | 'table'
  | 'list';

export type AggregationType = 
  | 'sum'
  | 'avg'
  | 'count'
  | 'count_distinct'
  | 'min'
  | 'max'
  | 'first'
  | 'last';

export interface DiaApiConfig {
  // DIA API endpoint bilgileri
  module: 'scf' | 'bcs' | 'fat' | 'sis' | 'stk';
  method: string;
  parameters: {
    filters?: Record<string, any>;
    selectedcolumns?: string;
    limit?: number;
    orderby?: string;
  };
}

export interface KpiConfig {
  valueField: string;
  aggregation: AggregationType;
  format: 'currency' | 'number' | 'percentage' | 'count';
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trendField?: string;
  trendComparison?: 'previous' | 'percentage';
}

export interface ChartAxisConfig {
  field: string;
  label?: string;
  format?: 'currency' | 'number' | 'date' | 'text';
  aggregation?: AggregationType;
}

export interface ChartSeriesConfig {
  field: string;
  name?: string;
  color?: string;
  type?: 'bar' | 'line' | 'area';
}

export interface ChartConfig {
  chartType: ChartType;
  xAxis?: ChartAxisConfig;
  yAxis?: ChartAxisConfig;
  series?: ChartSeriesConfig[];
  legendField?: string;
  valueField?: string;
  tooltipFields?: string[];
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  stacked?: boolean;
}

export interface TableConfig {
  columns: {
    field: string;
    header: string;
    format?: 'currency' | 'number' | 'date' | 'text' | 'badge';
    width?: string;
    sortable?: boolean;
  }[];
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
}

export interface WidgetBuilderConfig {
  diaApi: DiaApiConfig;
  visualization: {
    type: ChartType;
    kpi?: KpiConfig;
    chart?: ChartConfig;
    table?: TableConfig;
  };
  refreshInterval?: number; // dakika
}

// Grafik tipleri listesi
export const CHART_TYPES: { id: ChartType; name: string; icon: string; description: string }[] = [
  { id: 'kpi', name: 'KPI Kartı', icon: 'Hash', description: 'Tek değer gösterimi' },
  { id: 'bar', name: 'Çubuk Grafik', icon: 'BarChart3', description: 'Kategorik karşılaştırma' },
  { id: 'line', name: 'Çizgi Grafik', icon: 'TrendingUp', description: 'Zaman serisi trendi' },
  { id: 'area', name: 'Alan Grafik', icon: 'Activity', description: 'Kümülatif değişim' },
  { id: 'pie', name: 'Pasta Grafik', icon: 'PieChart', description: 'Oransal dağılım' },
  { id: 'donut', name: 'Simit Grafik', icon: 'Circle', description: 'Oransal dağılım (ortası boş)' },
  { id: 'radar', name: 'Radar Grafik', icon: 'Radar', description: 'Çok boyutlu karşılaştırma' },
  { id: 'scatter', name: 'Dağılım Grafik', icon: 'Crosshair', description: 'İki değişken ilişkisi' },
  { id: 'funnel', name: 'Huni Grafik', icon: 'Filter', description: 'Aşamalı dönüşüm' },
  { id: 'treemap', name: 'Treemap', icon: 'LayoutGrid', description: 'Hiyerarşik dağılım' },
  { id: 'table', name: 'Tablo', icon: 'Table', description: 'Detaylı veri listesi' },
  { id: 'list', name: 'Liste', icon: 'List', description: 'Basit liste görünümü' },
];

// Aggregation tipleri
export const AGGREGATION_TYPES: { id: AggregationType; name: string; description: string }[] = [
  { id: 'sum', name: 'Toplam', description: 'Tüm değerlerin toplamı' },
  { id: 'avg', name: 'Ortalama', description: 'Değerlerin ortalaması' },
  { id: 'count', name: 'Sayı', description: 'Kayıt sayısı' },
  { id: 'count_distinct', name: 'Benzersiz Sayı', description: 'Tekil değer sayısı' },
  { id: 'min', name: 'Minimum', description: 'En küçük değer' },
  { id: 'max', name: 'Maksimum', description: 'En büyük değer' },
  { id: 'first', name: 'İlk', description: 'İlk değer' },
  { id: 'last', name: 'Son', description: 'Son değer' },
];

// DIA modülleri
export const DIA_MODULES: { id: string; name: string; methods: string[] }[] = [
  { 
    id: 'scf', 
    name: 'Cari / Finans', 
    methods: ['carikart_listele', 'carikart_bakiye_listele', 'cari_hareket_listele', 'cek_senet_listele'] 
  },
  { 
    id: 'bcs', 
    name: 'Banka / Kasa', 
    methods: ['banka_hesap_listele', 'kasa_listele', 'banka_hareket_listele'] 
  },
  { 
    id: 'fat', 
    name: 'Fatura', 
    methods: ['fatura_listele', 'fatura_detay', 'irsaliye_listele'] 
  },
  { 
    id: 'stk', 
    name: 'Stok', 
    methods: ['stok_listele', 'stok_hareket_listele', 'depo_listele'] 
  },
];

// Format seçenekleri
export const FORMAT_OPTIONS = [
  { id: 'currency', name: 'Para Birimi', example: '₺1.234,56' },
  { id: 'number', name: 'Sayı', example: '1.234,56' },
  { id: 'percentage', name: 'Yüzde', example: '%45,6' },
  { id: 'count', name: 'Adet', example: '1.234' },
  { id: 'date', name: 'Tarih', example: '19.01.2026' },
  { id: 'text', name: 'Metin', example: 'Örnek metin' },
];
