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
  | 'list'
  | 'pivot'         // Pivot rapor
  // Özel grafik tipleri
  | 'cashflow'      // Nakit akış projeksiyonu (vade yaşlandırma)
  | 'aging'         // Yaşlandırma grafiği
  | 'gauge'         // Gösterge (oran/yüzde)
  | 'waterfall'     // Şelale grafiği
  | 'custom';       // Özel kod widget

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
export type FilterOperator = '<' | '>' | '<=' | '>=' | '=' | '!' | '!=' | 'IN' | 'NOT IN' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_null' | 'is_not_null' | 'between';

export interface DiaApiFilter {
  field: string;
  operator?: FilterOperator;
  value: string;
  value2?: string; // between için ikinci değer
}

// Post-fetch filtre yapısı (çekilen veri üzerinde filtreleme)
export interface PostFetchFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  value2?: string;
  logicalOperator: 'AND' | 'OR';
}

// Pivot rapor yapılandırması
export interface PivotConfig {
  rowFields: string[];
  columnField: string;
  valueField: string;
  aggregation: AggregationType;
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  showGrandTotal?: boolean;
}

// DIA API Sıralama Yapısı
export type SortType = 'ASC' | 'DESC';

export interface DiaApiSort {
  field: string;
  sorttype: SortType;
}

// Operatör seçenekleri - Tüm operatörler
export const FILTER_OPERATORS: { id: FilterOperator; name: string; example: string; requiresValue?: boolean; requiresSecondValue?: boolean }[] = [
  { id: '=', name: 'Eşittir', example: 'carikarttipi = "AL"', requiresValue: true },
  { id: '!=', name: 'Eşit Değil', example: 'carikartkodu != "001"', requiresValue: true },
  { id: '>', name: 'Büyük', example: 'toplambakiye > 1000', requiresValue: true },
  { id: '<', name: 'Küçük', example: 'toplambakiye < 1000', requiresValue: true },
  { id: '>=', name: 'Büyük Eşit', example: 'toplambakiye >= 1000', requiresValue: true },
  { id: '<=', name: 'Küçük Eşit', example: 'toplambakiye <= 1000', requiresValue: true },
  { id: 'IN', name: 'İçinde (Çoklu)', example: 'carikartkodu IN "001,002,003"', requiresValue: true },
  { id: 'NOT IN', name: 'İçinde Değil', example: 'sehir NOT IN "İstanbul,Ankara"', requiresValue: true },
  { id: 'not_contains', name: 'İçermiyor', example: 'ad not_contains "Test"', requiresValue: true },
  { id: 'contains', name: 'İçeriyor', example: 'unvan contains "Ltd"', requiresValue: true },
  { id: 'starts_with', name: 'İle Başlar', example: 'kod starts_with "TR"', requiresValue: true },
  { id: 'ends_with', name: 'İle Biter', example: 'ad ends_with "AŞ"', requiresValue: true },
  { id: 'is_null', name: 'Boş', example: 'alan is_null', requiresValue: false },
  { id: 'is_not_null', name: 'Dolu', example: 'alan is_not_null', requiresValue: false },
  { id: 'between', name: 'Arasında', example: 'tutar 100-500', requiresValue: true, requiresSecondValue: true },
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
  // Veri kaynağı referansı (varsa modül/metod yerine kullanılır)
  dataSourceId?: string;
  dataSourceName?: string;
  module: 'scf' | 'bcs' | 'fat' | 'sis' | 'stk' | 'gts' | string;
  method: string;
  parameters: {
    filters?: DiaApiFilter[];
    sorts?: DiaApiSort[];
    selectedcolumns?: string[];
    limit?: number;
  };
  // Veri kaynağından gelen alanlar veya test sonuçları
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

// Legend konumu
export type LegendPosition = 'bottom' | 'right' | 'hidden';

// Legend davranışı
export type LegendBehavior = 'auto' | 'always_visible' | 'always_hidden' | 'collapsible';

export const LEGEND_BEHAVIORS: { id: LegendBehavior; name: string; description: string }[] = [
  { id: 'auto', name: 'Otomatik (%40)', description: 'Legend %40\'tan fazla yer kaplıyorsa gizle' },
  { id: 'always_visible', name: 'Her Zaman Açık', description: 'Legend her zaman görünür' },
  { id: 'always_hidden', name: 'Her Zaman Kapalı', description: 'Legend hiç gösterilmez' },
  { id: 'collapsible', name: 'Katlanabilir', description: 'Legend kapalı başlar, kullanıcı açabilir' },
];

export interface ChartConfig {
  chartType: ChartType;
  xAxis?: ChartAxisConfig;
  yAxis?: ChartAxisConfig;
  series?: ChartSeriesConfig[];
  legendField?: string;
  valueField?: string;
  tooltipFields?: string[];
  colors?: string[];
  colorPalette?: string;           // Renk paleti adı (pastel, vivid, vb.)
  showLegend?: boolean;
  legendPosition?: LegendPosition; // Legend konumu (alt, sağ, gizli)
  legendBehavior?: LegendBehavior; // Legend davranışı (auto, always_visible, always_hidden, collapsible)
  legendThreshold?: number;        // Legend gizleme eşiği (0-100, varsayılan: 40)
  showGrid?: boolean;
  stacked?: boolean;
  displayLimit?: number;           // Grafikte gösterilecek maksimum kayıt sayısı (varsayılan: 10)
  // Power BI özellikleri
  showTrendLine?: boolean;         // Trend çizgisi göster
  showAverageLine?: boolean;       // Ortalama çizgisi göster
  showMinMaxMarkers?: boolean;     // Min/Max noktalarını işaretle
  trendLineColor?: string;         // Trend çizgisi rengi
  averageLineColor?: string;       // Ortalama çizgisi rengi
}

export interface TableConfig {
  columns: {
    field: string;
    header: string;
    format?: 'currency' | 'number' | 'date' | 'text' | 'badge' | 'percentage';
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    sortable?: boolean;
    defaultSort?: 'ASC' | 'DESC';
    align?: 'left' | 'center' | 'right';
  }[];
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
  stripedRows?: boolean;
  compactMode?: boolean;
}

// Widget için kullanılabilir filtreler
export interface WidgetFilterConfig {
  field: string;         // DIA alan adı
  label: string;         // UI etiketi
  type: 'toggle' | 'multi-select' | 'dropdown' | 'range' | 'date-range';
  options?: { value: any; label: string }[];
  defaultValue?: any;
}

// Özel grafik yapılandırması
export interface SpecialChartConfig {
  type: 'cashflow' | 'aging' | 'gauge' | 'waterfall';
  
  // Cashflow/Aging için segment tanımları
  segments?: {
    name: string;
    valueField: string;
    color: string;
    type: 'past' | 'current' | 'future';
  }[];
  
  // Periyot desteği
  periodOptions?: ('daily' | 'weekly' | 'monthly')[];
  defaultPeriod?: 'daily' | 'weekly' | 'monthly';
  
  // Gauge için
  minValue?: number;
  maxValue?: number;
  thresholds?: { value: number; color: string; label: string }[];
  
  // Waterfall için
  showTotal?: boolean;
  positiveColor?: string;
  negativeColor?: string;
}

export interface WidgetBuilderConfig {
  // Merkezi veri kaynağı referansı (opsiyonel - varsa diaApi yerine kullanılır)
  dataSourceId?: string;
  dataSourceSlug?: string;
  
  diaApi: DiaApiConfig;
  
  // Çoklu sorgu (yeni)
  multiQuery?: MultiQueryConfig;
  
  // Hesaplama alanları (yeni)
  calculatedFields?: CalculatedField[];
  
  // Tarih filtreleme (yeni)
  dateFilter?: DateFilterConfig;
  
  // Post-fetch veri filtreleme (çekilen veri üzerinde)
  postFetchFilters?: PostFetchFilter[];
  
  // Tablo kolon yapılandırması
  tableColumns?: TableConfig['columns'];
  
  // Pivot rapor yapılandırması (üst seviye)
  pivot?: PivotConfig;
  
  // Field Wells yapılandırması (Power BI tarzı)
  fieldWells?: {
    xAxis?: { field: string; label?: string; format?: string; aggregation?: AggregationType };
    yAxis?: { field: string; label?: string; format?: string; aggregation?: AggregationType; color?: string }[];
    legend?: { field: string; label?: string };
    value?: { field: string; label?: string; format?: string; aggregation?: AggregationType };
    category?: { field: string; label?: string };
    tooltip?: { field: string; label?: string }[];
  };
  
  // Chart ayarları (renk paleti, legend, grid vb.)
  chartSettings?: {
    colorPalette?: string;
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right' | 'hidden';
    legendBehavior?: LegendBehavior; // Legend davranışı
    legendThreshold?: number;        // Legend gizleme eşiği (%30-%60)
    showGrid?: boolean;
    stacked?: boolean;
    displayLimit?: number;
    showTrendLine?: boolean;
    showAverageLine?: boolean;
    showMinMaxMarkers?: boolean;
    trendLineColor?: string;
    averageLineColor?: string;
  };
  
  visualization: {
    type: ChartType;
    kpi?: KpiConfig;
    chart?: ChartConfig;
    table?: TableConfig;
    pivot?: PivotConfig;  // Pivot rapor yapılandırması
    specialChart?: SpecialChartConfig; // Özel grafik yapılandırması
  };
  
  availableFilters?: WidgetFilterConfig[]; // Widget için tanımlı filtreler
  refreshInterval?: number; // dakika
  // Raw mode için
  rawMode?: boolean;
  rawPayload?: string;
  // Varsayılan widget
  isDefault?: boolean;
  defaultSortOrder?: number;
  // Drill-down yapılandırması
  drillDown?: DrillDownConfig;
  
  // Power BI tarzı filtre bağlamaları
  // Bu widget'ın etkileneceği global filtreler
  affectedByFilters?: {
    globalFilterKey: string;  // 'cariKartTipi', 'satisTemsilcisi', vb.
    dataField: string;        // Verideki alan adı
    operator: 'IN' | '=' | 'contains';
  }[];
  
  // Bu widget'ın oluşturacağı cross-filter (tıklanınca diğer widget'ları etkiler)
  crossFilterField?: {
    dataField: string;
    globalFilterKey: string;
    label: string;
  };
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
  { id: 'pivot', name: 'Pivot Rapor', icon: 'Grid3x3', description: 'Satır/sütun bazlı özet rapor' },
  // Özel grafik tipleri
  { id: 'cashflow', name: 'Nakit Akış', icon: 'Calendar', description: 'Nakit akış projeksiyonu ve vade yaşlandırma' },
  { id: 'aging', name: 'Yaşlandırma', icon: 'Clock', description: 'Vade bazlı yaşlandırma grafiği' },
  { id: 'gauge', name: 'Gösterge', icon: 'Gauge', description: 'Oran veya yüzde göstergesi' },
  { id: 'waterfall', name: 'Şelale', icon: 'BarChart2', description: 'Kümülatif değişim analizi' },
  { id: 'custom', name: 'Özel Kod', icon: 'Code', description: 'React/JavaScript ile özel widget' },
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

// ============= TARİH FİLTRELEME SİSTEMİ =============

// Tarih periyotları
export type DatePeriod = 
  | 'all'          // Tüm zamanlar
  | 'today'        // Bugün
  | 'yesterday'    // Dün
  | 'this_week'    // Bu hafta
  | 'last_week'    // Geçen hafta
  | 'this_month'   // Bu ay
  | 'last_month'   // Geçen ay
  | 'this_quarter' // Bu çeyrek
  | 'last_quarter' // Geçen çeyrek
  | 'this_year'    // Bu yıl
  | 'last_year'    // Geçen yıl
  | 'last_7_days'  // Son 7 gün
  | 'last_30_days' // Son 30 gün
  | 'last_90_days' // Son 90 gün
  | 'custom';      // Özel aralık

export const DATE_PERIODS: { id: DatePeriod; name: string; icon: string }[] = [
  { id: 'all', name: 'Tüm Zamanlar', icon: 'Infinity' },
  { id: 'today', name: 'Bugün', icon: 'Calendar' },
  { id: 'yesterday', name: 'Dün', icon: 'CalendarMinus' },
  { id: 'this_week', name: 'Bu Hafta', icon: 'CalendarDays' },
  { id: 'last_week', name: 'Geçen Hafta', icon: 'CalendarDays' },
  { id: 'last_7_days', name: 'Son 7 Gün', icon: 'CalendarDays' },
  { id: 'this_month', name: 'Bu Ay', icon: 'CalendarRange' },
  { id: 'last_month', name: 'Geçen Ay', icon: 'CalendarRange' },
  { id: 'last_30_days', name: 'Son 30 Gün', icon: 'CalendarRange' },
  { id: 'last_90_days', name: 'Son 90 Gün', icon: 'CalendarRange' },
  { id: 'this_quarter', name: 'Bu Çeyrek', icon: 'CalendarClock' },
  { id: 'last_quarter', name: 'Geçen Çeyrek', icon: 'CalendarClock' },
  { id: 'this_year', name: 'Bu Yıl', icon: 'CalendarCheck' },
  { id: 'last_year', name: 'Geçen Yıl', icon: 'CalendarCheck' },
  { id: 'custom', name: 'Özel Aralık', icon: 'CalendarSearch' },
];

// Tarih filtre konfigürasyonu
export interface DateFilterConfig {
  enabled: boolean;
  dateField: string;            // Filtrelenecek tarih alanı
  defaultPeriod: DatePeriod;
  allowedPeriods?: DatePeriod[]; // Hangi periyotlar gösterilsin
  showInWidget: boolean;        // Widget üzerinde seçici göster
  customStartDate?: string;     // Özel aralık için başlangıç
  customEndDate?: string;       // Özel aralık için bitiş
}

// ============= DÖNEM YAPILANDIRMASI =============

// Dönem yapılandırması (DIA ERP için mali dönemler)
export interface PeriodConfig {
  enabled: boolean;              // Dönem bağımlı mı?
  periodField: string;           // DIA'daki dönem alanı (genelde "donem" veya "donemkodu")
  currentPeriod?: number;        // Mevcut dönem (otomatik alınabilir)
  fetchHistorical: boolean;      // Eski dönemleri de çek
  historicalCount: number;       // Kaç dönem geriye git (örn: 12 = son 12 dönem)
  mergeStrategy: 'union' | 'separate'; // Verileri birleştir mi yoksa ayrı tut mu
}

export const getDefaultPeriodConfig = (): PeriodConfig => ({
  enabled: false,
  periodField: '_level2',  // DIA ERP için standart dönem alanı
  currentPeriod: undefined,
  fetchHistorical: false,
  historicalCount: 12,
  mergeStrategy: 'union',
});

// ============= DRILL-DOWN YAPILANDIRMASI =============

// Drill-down yapılandırması (grafik/KPI tıklandığında açılan popup ayarları)
export interface DrillDownConfig {
  enabled: boolean;                  // Drill-down aktif mi?
  displayColumns?: string[];         // Popup'ta gösterilecek kolonlar
  sortBy?: string;                   // Sıralama alanı
  sortDirection?: 'asc' | 'desc';    // Sıralama yönü
  maxRows?: number;                  // Maksimum satır sayısı (varsayılan: 100)
  searchEnabled?: boolean;           // Arama aktif mi?
  exportEnabled?: boolean;           // CSV export aktif mi?
  primaryField?: string;             // Ana görüntüleme alanı
  valueField?: string;               // Değer alanı
}

export const getDefaultDrillDownConfig = (): DrillDownConfig => ({
  enabled: true,
  searchEnabled: true,
  exportEnabled: true,
  maxRows: 100,
  sortDirection: 'desc',
});

// ============= MERKEZİ VERİ KAYNAĞI =============

// Veri kaynağı referansı
export interface DataSourceReference {
  id: string;                   // data_sources.id
  slug: string;                 // data_sources.slug
  name: string;                 // Görüntülenen ad
}

// ============= ALERT/HEDEF SİSTEMİ =============

// Alert/Hedef koşulu
export type AlertCondition = 'above' | 'below' | 'equals' | 'between';

// Bildirim tipi
export type AlertNotificationType = 'critical' | 'warning' | 'info' | 'success';

// Alert yapılandırması
export interface AlertConfig {
  id: string;
  name: string;                              // "Aylık Satış Hedefi"
  enabled: boolean;
  field: string;                             // Hangi alanda kontrol edilecek
  aggregation: AggregationType;              // sum, avg, max, count
  condition: AlertCondition;                 // above, below, equals, between
  threshold: number;                         // 500000 (₺500K hedef)
  threshold2?: number;                       // between için ikinci eşik
  notificationType: AlertNotificationType;   // critical, warning, info, success
  showReferenceLine: boolean;                // Grafikte çizgi göster
  referenceLineColor?: string;               // Çizgi rengi
  referenceLineLabel?: string;               // "Hedef: ₺500K"
  notifyOnce?: boolean;                      // Sadece bir kez bildir
  lastTriggered?: string;                    // Son tetiklenme tarihi
}

// Varsayılan alert
export const getDefaultAlertConfig = (): AlertConfig => ({
  id: '',
  name: '',
  enabled: true,
  field: '',
  aggregation: 'sum',
  condition: 'above',
  threshold: 0,
  notificationType: 'info',
  showReferenceLine: true,
  notifyOnce: false,
});

// ============= PARA BİRİMİ SİSTEMİ =============

// Desteklenen para birimleri
export const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺',
  TL: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'Fr.',
  JPY: '¥',
  CNY: '¥',
  RUB: '₽',
  AED: 'د.إ',
  SAR: '﷼',
  KWD: 'د.ك',
  QAR: 'ر.ق',
};

// Para birimi formatı
export const formatCurrencyValue = (value: number, currency: string = 'TRY'): string => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  const absValue = Math.abs(value);
  let formatted: string;
  
  if (absValue >= 1000000000) {
    formatted = (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    formatted = (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    formatted = (value / 1000).toFixed(0) + 'K';
  } else {
    formatted = value.toLocaleString('tr-TR');
  }
  
  return symbol + formatted;
};

// ============= TREND VE İSTATİSTİK =============

// Trend line hesaplama fonksiyonu
export const calculateTrendLine = (data: any[], yField: string): { slope: number; intercept: number; points: number[] } | null => {
  const n = data.length;
  if (n < 2) return null;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  data.forEach((item, i) => {
    const x = i;
    const y = parseFloat(item[yField]) || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const points = data.map((_, i) => intercept + slope * i);
  
  return { slope, intercept, points };
};

// ============= DIA MODEL REFERANSLARI =============

// DIA dokümantasyon link referansı
export interface DiaModelReference {
  url: string;
  modelName: string; // URL'den otomatik çıkarılır
}

// DIA URL'inden model adını çıkar
export const extractModelNameFromUrl = (url: string): string => {
  // https://doc.dia.com.tr/doku.php?id=gelistirici:models:scf_carikart_liste_view_model
  const match = url.match(/models:([^&]+)/);
  if (match) {
    // scf_carikart_liste_view_model -> ScfCarikartListeViewModel
    return match[1]
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
  return 'UnknownModel';
};

// ============= AI ZORUNLULUKLARI =============

// AI kuralı/zorunluluğu
export interface AIRequirement {
  id: string;
  label: string;
  description: string;
  isDefault: boolean;  // Varsayılan ve değiştirilemez
  isActive: boolean;
  promptAddition: string;  // AI prompt'a eklenecek metin
}

// Varsayılan AI kuralları
export const DEFAULT_AI_REQUIREMENTS: AIRequirement[] = [
  {
    id: 'color_system',
    label: 'Renk sistemi',
    description: 'CSS değişkenleri zorunlu (text-foreground, bg-card vb.)',
    isDefault: true,
    isActive: true,
    promptAddition: 'Renk için sadece CSS değişkenlerini kullan (text-foreground, bg-card, text-success, text-destructive).'
  },
  {
    id: 'currency_format',
    label: 'Para birimi formatı',
    description: '₺, K, M, B formatında göster',
    isDefault: true,
    isActive: true,
    promptAddition: 'Para değerlerini formatCurrency fonksiyonu ile ₺, K, M, B formatında göster.'
  },
  {
    id: 'no_jsx',
    label: 'React.createElement kullan',
    description: 'JSX syntax yasak',
    isDefault: true,
    isActive: true,
    promptAddition: 'JSX KULLANMA! Sadece React.createElement kullan.'
  },
  {
    id: 'date_chronology',
    label: 'Tarih kronolojisi',
    description: 'Eksik günleri 0 ile doldur',
    isDefault: false,
    isActive: false,
    promptAddition: 'Tarih bazlı grafiklerde TÜM tarihleri göster. Eksik günleri 0 değeriyle doldur. fillMissingDates helper fonksiyonunu kullan.'
  },
  {
    id: 'trend_line',
    label: 'Trend çizgisi',
    description: 'Linear regression trend çizgisi ekle',
    isDefault: false,
    isActive: false,
    promptAddition: 'Grafiğe linear regression trend çizgisi ekle. calculateTrendLine fonksiyonunu kullan ve kesikli çizgi (strokeDasharray: "8 4") ile göster.'
  },
  {
    id: 'average_line',
    label: 'Ortalama çizgisi',
    description: 'Yatay ortalama çizgisi ekle',
    isDefault: false,
    isActive: false,
    promptAddition: 'Grafiğe ortalama değerini gösteren yatay ReferenceLine ekle.'
  },
  {
    id: 'min_max_markers',
    label: 'Min/Max işaretleri',
    description: 'Minimum ve maksimum noktaları işaretle',
    isDefault: false,
    isActive: false,
    promptAddition: 'Grafikte minimum ve maksimum noktaları ReferenceDot ile özel işaretlerle göster.'
  }
];
