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

// DIA API Filtre Yapısı
export type FilterOperator = '<' | '>' | '<=' | '>=' | '=' | '!' | '!=' | 'IN' | 'NOT IN' | 'contains';

export interface DiaApiFilter {
  field: string;
  operator?: FilterOperator;
  value: string;
}

// DIA API Sıralama Yapısı
export type SortType = 'ASC' | 'DESC';

export interface DiaApiSort {
  field: string;
  sorttype: SortType;
}

// Operatör seçenekleri
export const FILTER_OPERATORS: { id: FilterOperator; name: string; example: string }[] = [
  { id: '=', name: 'Eşittir', example: 'carikarttipi = "AL"' },
  { id: '!=', name: 'Eşit Değil', example: 'carikartkodu != "001"' },
  { id: '>', name: 'Büyük', example: 'toplambakiye > 1000' },
  { id: '<', name: 'Küçük', example: 'toplambakiye < 1000' },
  { id: '>=', name: 'Büyük Eşit', example: 'toplambakiye >= 1000' },
  { id: '<=', name: 'Küçük Eşit', example: 'toplambakiye <= 1000' },
  { id: 'IN', name: 'İçinde (Çoklu)', example: 'carikartkodu IN "001,002,003"' },
  { id: 'NOT IN', name: 'İçinde Değil', example: 'sehir NOT IN "İstanbul,Ankara"' },
  { id: '!', name: 'İçermiyor', example: 'unvan ! "ANONİM"' },
  { id: 'contains', name: 'İçeriyor', example: 'unvan "ANONİM" (operatör olmadan)' },
];

// Sıralama seçenekleri
export const SORT_TYPES: { id: SortType; name: string }[] = [
  { id: 'ASC', name: 'Artan (A-Z, 0-9)' },
  { id: 'DESC', name: 'Azalan (Z-A, 9-0)' },
];

// ============= ÇOKLU SORGU VE BİRLEŞTİRME TİPLERİ =============

// Birleştirme türleri
export type MergeType = 
  | 'left_join'     // Sol tablodaki tüm kayıtlar + eşleşen sağ
  | 'inner_join'    // Sadece her iki tabloda eşleşenler
  | 'right_join'    // Sağ tablodaki tüm kayıtlar + eşleşen sol
  | 'full_join'     // Her iki tablodaki tüm kayıtlar
  | 'union'         // Alt alta birleştir (aynı kolonlar)
  | 'union_all'     // Alt alta birleştir (tekrarlar dahil)
  | 'cross_join';   // Kartezyen çarpım (her satır x her satır)

export const MERGE_TYPES: { id: MergeType; name: string; description: string; icon: string }[] = [
  { id: 'left_join', name: 'LEFT JOIN', description: 'Ana tablodaki tüm kayıtlar + eşleşen ikinci tablo verileri', icon: 'ArrowLeftRight' },
  { id: 'inner_join', name: 'INNER JOIN', description: 'Sadece her iki tabloda eşleşen kayıtlar', icon: 'Merge' },
  { id: 'right_join', name: 'RIGHT JOIN', description: 'İkinci tablodaki tüm kayıtlar + eşleşen ana tablo verileri', icon: 'ArrowRightLeft' },
  { id: 'full_join', name: 'FULL JOIN', description: 'Her iki tablodaki tüm kayıtlar (eşleşmeyenler dahil)', icon: 'Maximize2' },
  { id: 'union', name: 'UNION', description: 'İki tabloyu alt alta birleştir (tekrarsız)', icon: 'Layers' },
  { id: 'union_all', name: 'UNION ALL', description: 'İki tabloyu alt alta birleştir (tekrarlar dahil)', icon: 'Copy' },
  { id: 'cross_join', name: 'CROSS JOIN', description: 'Kartezyen çarpım (dikkatli kullanın!)', icon: 'Grid3x3' },
];

// Tek bir sorgu tanımı
export interface DiaApiQuery {
  id: string;
  name: string;
  module: 'scf' | 'bcs' | 'fat' | 'sis' | 'stk' | 'gts';
  method: string;
  parameters: {
    filters?: DiaApiFilter[];
    sorts?: DiaApiSort[];
    selectedcolumns?: string[];
    limit?: number;
  };
  // Test sonuçları (geçici)
  testResult?: {
    sampleFields?: string[];
    fieldTypes?: Record<string, string>;
  };
}

// Sorgular arası birleştirme
export interface QueryMerge {
  leftQueryId: string;
  leftField: string;        // JOIN için key alan
  rightQueryId: string;
  rightField: string;       // JOIN için key alan
  mergeType: MergeType;
  // UNION için kolon eşleştirmesi
  columnMapping?: { left: string; right: string }[];
}

// Çoklu sorgu yapısı
export interface MultiQueryConfig {
  queries: DiaApiQuery[];
  merges: QueryMerge[];
  primaryQueryId: string;
}

// ============= HESAPLAMA ALANLARI =============

// Matematiksel operatörler
export type MathOperator = '+' | '-' | '*' | '/' | '%';

// Hesaplama ifadesi (recursive yapı)
export interface CalculationExpression {
  type: 'field' | 'constant' | 'operation' | 'function';
  // field için
  field?: string;
  // constant için
  value?: number;
  // operation için
  operator?: MathOperator;
  left?: CalculationExpression;
  right?: CalculationExpression;
  // function için (abs, round, vb.)
  functionName?: 'abs' | 'round' | 'floor' | 'ceil' | 'min' | 'max' | 'sqrt' | 'pow';
  arguments?: CalculationExpression[];
}

// Hesaplama alanı tanımı
export interface CalculatedField {
  id: string;              // Benzersiz ID
  name: string;            // Alan adı (ör: "kar_marji")
  label: string;           // Görüntülenecek ad (ör: "Kâr Marjı")
  expression: CalculationExpression;
  format?: 'currency' | 'number' | 'percentage';
  decimals?: number;
}

// Önceden tanımlı hesaplama şablonları
export const CALCULATION_TEMPLATES: { id: string; name: string; description: string; fields: string[] }[] = [
  { id: 'margin', name: 'Kâr Marjı', description: '(satis - maliyet) / satis * 100', fields: ['satis', 'maliyet'] },
  { id: 'difference', name: 'Fark', description: 'alan1 - alan2', fields: ['alan1', 'alan2'] },
  { id: 'percentage', name: 'Yüzde', description: 'alan1 / alan2 * 100', fields: ['alan1', 'alan2'] },
  { id: 'total', name: 'Toplam', description: 'alan1 + alan2', fields: ['alan1', 'alan2'] },
  { id: 'average', name: 'Ortalama', description: '(alan1 + alan2) / 2', fields: ['alan1', 'alan2'] },
  { id: 'net', name: 'Net Değer', description: 'brut - kesinti', fields: ['brut', 'kesinti'] },
];

// Matematiksel operatör listesi
export const MATH_OPERATORS: { id: MathOperator; symbol: string; name: string }[] = [
  { id: '+', symbol: '+', name: 'Toplama' },
  { id: '-', symbol: '-', name: 'Çıkarma' },
  { id: '*', symbol: '×', name: 'Çarpma' },
  { id: '/', symbol: '÷', name: 'Bölme' },
  { id: '%', symbol: '%', name: 'Mod (Kalan)' },
];

export const MATH_FUNCTIONS: { id: string; name: string; args: number; description: string }[] = [
  { id: 'abs', name: 'ABS', args: 1, description: 'Mutlak değer' },
  { id: 'round', name: 'ROUND', args: 1, description: 'Yuvarla' },
  { id: 'floor', name: 'FLOOR', args: 1, description: 'Aşağı yuvarla' },
  { id: 'ceil', name: 'CEIL', args: 1, description: 'Yukarı yuvarla' },
  { id: 'sqrt', name: 'SQRT', args: 1, description: 'Karekök' },
  { id: 'pow', name: 'POW', args: 2, description: 'Üs alma' },
  { id: 'min', name: 'MIN', args: 2, description: 'Minimum' },
  { id: 'max', name: 'MAX', args: 2, description: 'Maksimum' },
];

// ============= DIA API CONFIG =============

export interface DiaApiConfig {
  // DIA API endpoint bilgileri
  module: 'scf' | 'bcs' | 'fat' | 'sis' | 'stk' | 'gts';
  method: string;
  parameters: {
    filters?: DiaApiFilter[] | Record<string, any>;  // Array (yeni) veya Object (eski uyumluluk)
    sorts?: DiaApiSort[];      // Array olarak no-code sıralama
    selectedcolumns?: string[] | string;  // Array (yeni) veya string (eski uyumluluk)
    params?: Record<string, any>; // Ekstra parametreler
    limit?: number;
    orderby?: string; // Eski uyumluluk için
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
  displayLimit?: number; // Grafikte gösterilecek maksimum kayıt sayısı (varsayılan: 10)
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

// Widget için kullanılabilir filtreler
export interface WidgetFilterConfig {
  field: string;         // DIA alan adı
  label: string;         // UI etiketi
  type: 'toggle' | 'multi-select' | 'dropdown' | 'range' | 'date-range';
  options?: { value: any; label: string }[];
  defaultValue?: any;
}

export interface WidgetBuilderConfig {
  diaApi: DiaApiConfig;
  
  // Çoklu sorgu (yeni)
  multiQuery?: MultiQueryConfig;
  
  // Hesaplama alanları (yeni)
  calculatedFields?: CalculatedField[];
  
  visualization: {
    type: ChartType;
    kpi?: KpiConfig;
    chart?: ChartConfig;
    table?: TableConfig;
  };
  
  availableFilters?: WidgetFilterConfig[]; // Widget için tanımlı filtreler
  refreshInterval?: number; // dakika
  // Raw mode için
  rawMode?: boolean;
  rawPayload?: string;
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

// DIA modülleri - doğru API metodları
export const DIA_MODULES: { id: string; name: string; methods: string[] }[] = [
  { 
    id: 'scf', 
    name: 'Cari / Finans', 
    methods: ['carikart_listele', 'carikart_vade_bakiye_listele', 'cari_hareket_listele', 'cek_senet_listele'] 
  },
  { 
    id: 'bcs', 
    name: 'Banka / Kasa', 
    methods: ['banka_hesap_listele', 'kasa_listele', 'banka_hareket_listele', 'kasa_hareket_listele'] 
  },
  { 
    id: 'fat', 
    name: 'Fatura', 
    methods: ['fatura_listele', 'fatura_detay', 'irsaliye_listele', 'siparis_listele'] 
  },
  { 
    id: 'stk', 
    name: 'Stok', 
    methods: ['stok_listele', 'stok_hareket_listele', 'depo_listele'] 
  },
  { 
    id: 'gts', 
    name: 'Görev / Aktivite', 
    methods: ['gorev_listele', 'aktivite_listele', 'hatirlatma_listele'] 
  },
  { 
    id: 'sis', 
    name: 'Sistem', 
    methods: ['kullanici_listele', 'parametre_listele'] 
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

// Filtre tipleri
export const FILTER_TYPES = [
  { id: 'toggle', name: 'Toggle (Açık/Kapalı)', description: 'Evet/Hayır seçimi' },
  { id: 'multi-select', name: 'Çoklu Seçim', description: 'Birden fazla değer seçimi' },
  { id: 'dropdown', name: 'Dropdown', description: 'Tek değer seçimi' },
  { id: 'range', name: 'Aralık', description: 'Sayısal aralık' },
  { id: 'date-range', name: 'Tarih Aralığı', description: 'Başlangıç-bitiş tarihi' },
];
