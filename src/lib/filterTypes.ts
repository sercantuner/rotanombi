// Global Filter System - Tip Tanımları  
// Power BI benzeri çapraz filtreleme desteği
// DIA ERP entegrasyonlu sayfa ve widget bazlı filtreleme

// Tarih periyotları
export type DatePeriod = 
  | 'all' 
  | 'today' 
  | 'this_week' 
  | 'this_month' 
  | 'this_quarter' 
  | 'this_year' 
  | 'last_week' 
  | 'last_month' 
  | 'last_quarter' 
  | 'last_year' 
  | 'last_7_days' 
  | 'last_30_days' 
  | 'last_90_days' 
  | 'custom';

// Filtre türleri
export type FilterType = 
  | 'tarih'
  | 'tarihAraligi'
  | 'satisTemsilcisi'
  | 'sube'
  | 'depo'
  | 'cariTipi'
  | 'cariKartTipi'
  | 'ozelkod1'
  | 'ozelkod2'
  | 'ozelkod3'
  | 'sehir'
  | 'urunGrubu'
  | 'marka'
  | 'kategori'
  | 'search';

// Filtre layout türleri
export type FilterLayout = 'horizontal' | 'sidebar' | 'modal';

// DIA API'ye gönderilecek filtre formatı
export interface DiaApiFilter {
  field: string;
  operator?: string;  // =, !=, >, <, >=, <=, IN, NOT IN, contains
  value: string;
}

// DIA zorunlu kullanıcı filtreleri
export interface DiaAutoFilter {
  field: string;      // DIA alan adı (örn: satiselemani)
  operator: string;   // = veya IN
  value: string;      // Değer
  isLocked: boolean;  // Kullanıcı değiştiremez
  label?: string;     // Gösterilecek etiket
}

// Çapraz filtre (Power BI tarzı widget tıklaması ile filtreleme)
export interface CrossFilter {
  sourceWidgetId: string;    // Filtreyi oluşturan widget
  field: string;             // Global filtre key (örn: cariKartTipi)
  value: string | string[];  // Seçilen değer(ler)
  label?: string;            // Gösterilecek etiket
}

// Veri kaynağı filtrelenebilir alan tanımı
export interface FilterableFieldDefinition {
  field: string;           // Veri kaynağındaki alan adı
  globalFilterKey: string; // Global filtre key'i (örn: cariKartTipi)
  label: string;           // Görünen etiket
  operator: 'IN' | '=' | 'contains';
}

// Tarih aralığı filtresi
export interface DateRangeFilter {
  period: DatePeriod;
  field: string;        // Tarih alanı adı
  customStart?: string; // YYYY-MM-DD
  customEnd?: string;   // YYYY-MM-DD
}

// Filtrelenebilir alan yapılandırması
export interface FilterableFieldConfig {
  field: string;            // Kod adı
  label: string;            // Görünen ad
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'text' | 'toggle';
  diaField: string;         // DIA'daki alan adı
  options?: { value: string; label: string }[];
  loadOptionsFrom?: string; // Seçenekleri yükleyeceği DataSource ID
  icon?: string;            // Lucide icon adı
  defaultValue?: any;       // Varsayılan değer
  isLocked?: boolean;       // Kullanıcı değiştiremez (DIA yetki)
}

// Sayfa filtre yapılandırması
export interface PageFilterConfig {
  pageId: string;
  availableFilters: FilterType[];
  defaultFilters: Partial<GlobalFilters>;
  filterLayout: FilterLayout;
  showFilterBar: boolean;
  filterableFields: FilterableFieldConfig[];
  lockedFilters?: Record<string, string>;  // DIA'dan gelen kilitli filtreler
}

// Widget'ın etkileneceği global filtreler (Power BI tarzı)
export interface WidgetFilterBinding {
  globalFilterKey: string;  // 'cariKartTipi', 'satisTemsilcisi', vb.
  dataField: string;        // Verideki alan adı
  operator: 'IN' | '=' | 'contains';
}

// Widget'ın oluşturacağı çapraz filtre
export interface WidgetCrossFilterConfig {
  dataField: string;        // Verideki alan adı
  globalFilterKey: string;  // Global filtre key'i
  label: string;            // Gösterilecek etiket
}

// Global filtreler (genişletilmiş)
export interface GlobalFilters {
  // Arama
  searchTerm: string;
  
  // Tarih
  tarihAraligi: DateRangeFilter | null;
  
  // Cari filtreler
  cariTipi: string[];
  cariKartTipi: string[];      // AL, AS, ST
  
  // Özel kodlar
  ozelkod1: string[];
  ozelkod2: string[];
  ozelkod3: string[];
  
  // Coğrafi
  sehir: string[];
  
  // Organizasyon
  satisTemsilcisi: string[];
  sube: string[];
  depo: string[];
  
  // Ürün filtreler
  urunGrubu: string[];
  marka: string[];
  kategori: string[];
  
  // Durum filtreleri
  vadeDilimi: string | null;
  durum: 'hepsi' | 'aktif' | 'pasif';
  gorunumModu: 'hepsi' | 'potansiyel' | 'cari';
  
  // DIA Zorunlu Filtreler (değiştirilemez)
  _diaAutoFilters: DiaAutoFilter[];
  
  // Çapraz Filtre (widget tıklamasından gelen geçici filtre)
  _crossFilter: CrossFilter | null;
}

// Filtre preset (kayıtlı filtre)
export interface FilterPreset {
  id: string;
  userId: string;
  pageId: string | null;
  name: string;
  filters: Partial<GlobalFilters>;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Filtre seçenekleri (dropdown'larda gösterilecek)
export interface FilterOptions {
  cariTipleri: string[];
  cariKartTipleri: string[];
  ozelkodlar1: { value: string; label: string }[];
  ozelkodlar2: { value: string; label: string }[];
  ozelkodlar3: { value: string; label: string }[];
  sehirler: string[];
  satisTemsilcileri: string[];
  subeler: { value: string; label: string }[];
  depolar: { value: string; label: string }[];
  urunGruplari: string[];
  markalar: string[];
  kategoriler: string[];
}

// Filtre context değeri
export interface GlobalFilterContextType {
  // Filtreler
  filters: GlobalFilters;
  filterOptions: FilterOptions;
  pageConfig: PageFilterConfig | null;
  
  // Filtre işlemleri
  setFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  toggleArrayFilter: (key: keyof GlobalFilters, value: string) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof GlobalFilters) => void;
  
  // Sayfa yapılandırması
  setPageConfig: (config: PageFilterConfig | null) => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  
  // DIA filtreler
  setDiaAutoFilters: (filters: DiaAutoFilter[]) => void;
  
  // Preset işlemleri
  presets: FilterPreset[];
  savePreset: (name: string) => Promise<void>;
  loadPreset: (preset: FilterPreset) => void;
  deletePreset: (presetId: string) => Promise<void>;
  
  // İstatistikler
  activeFilterCount: number;
  isFiltering: boolean;
  
  // DIA sorgusu için filtre dizisi oluştur
  toDiaFilters: () => DiaApiFilter[];
  
  // Çapraz filtreleme (Power BI tarzı)
  crossFilter: CrossFilter | null;
  setCrossFilter: (filter: CrossFilter | null) => void;
  clearCrossFilter: () => void;
}

// Varsayılan filtreler
export const defaultGlobalFilters: GlobalFilters = {
  searchTerm: '',
  tarihAraligi: null,
  cariTipi: [],
  cariKartTipi: [],
  ozelkod1: [],
  ozelkod2: [],
  ozelkod3: [],
  sehir: [],
  satisTemsilcisi: [],
  sube: [],
  depo: [],
  urunGrubu: [],
  marka: [],
  kategori: [],
  vadeDilimi: null,
  durum: 'hepsi',
  gorunumModu: 'hepsi',
  _diaAutoFilters: [],
  _crossFilter: null,
};

// Varsayılan filtre seçenekleri
export const defaultFilterOptions: FilterOptions = {
  cariTipleri: [],
  cariKartTipleri: ['AL', 'AS', 'ST'],
  ozelkodlar1: [],
  ozelkodlar2: [],
  ozelkodlar3: [],
  sehirler: [],
  satisTemsilcileri: [],
  subeler: [],
  depolar: [],
  urunGruplari: [],
  markalar: [],
  kategoriler: [],
};

// Tarih periyodu etiketleri
export const datePeriodLabels: Record<DatePeriod, string> = {
  all: 'Tümü',
  today: 'Bugün',
  this_week: 'Bu Hafta',
  this_month: 'Bu Ay',
  this_quarter: 'Bu Çeyrek',
  this_year: 'Bu Yıl',
  last_week: 'Geçen Hafta',
  last_month: 'Geçen Ay',
  last_quarter: 'Geçen Çeyrek',
  last_year: 'Geçen Yıl',
  last_7_days: 'Son 7 Gün',
  last_30_days: 'Son 30 Gün',
  last_90_days: 'Son 90 Gün',
  custom: 'Özel Aralık',
};

// Filtre tipi etiketleri
export const filterTypeLabels: Record<FilterType, string> = {
  tarih: 'Tarih',
  tarihAraligi: 'Tarih Aralığı',
  satisTemsilcisi: 'Satış Temsilcisi',
  sube: 'Şube',
  depo: 'Depo',
  cariTipi: 'Cari Tipi',
  cariKartTipi: 'Kart Tipi',
  ozelkod1: 'Özel Kod 1',
  ozelkod2: 'Özel Kod 2',
  ozelkod3: 'Özel Kod 3',
  sehir: 'Şehir',
  urunGrubu: 'Ürün Grubu',
  marka: 'Marka',
  kategori: 'Kategori',
  search: 'Arama',
};

// Cari kart tipi etiketleri
export const cariKartTipiLabels: Record<string, string> = {
  AL: 'Alıcı',
  AS: 'Al-Sat',
  ST: 'Satıcı',
};

// Global filtreleri DIA API formatına dönüştür
export function convertToDiaFilters(
  filters: GlobalFilters,
  fieldMappings?: Record<string, string>
): DiaApiFilter[] {
  const diaFilters: DiaApiFilter[] = [];
  
  // Zorunlu DIA filtreleri (değiştirilemez)
  if (filters._diaAutoFilters && filters._diaAutoFilters.length > 0) {
    filters._diaAutoFilters.forEach(f => {
      diaFilters.push({
        field: f.field,
        operator: f.operator,
        value: f.value,
      });
    });
  }
  
  // Satış temsilcisi
  if (filters.satisTemsilcisi.length > 0) {
    const field = fieldMappings?.satisTemsilcisi || 'satiselemani';
    if (filters.satisTemsilcisi.length === 1) {
      diaFilters.push({ field, operator: '=', value: filters.satisTemsilcisi[0] });
    } else {
      diaFilters.push({ field, operator: 'IN', value: filters.satisTemsilcisi.join(',') });
    }
  }
  
  // Şube
  if (filters.sube.length > 0) {
    const field = fieldMappings?.sube || 'subekodu';
    if (filters.sube.length === 1) {
      diaFilters.push({ field, operator: '=', value: filters.sube[0] });
    } else {
      diaFilters.push({ field, operator: 'IN', value: filters.sube.join(',') });
    }
  }
  
  // Depo
  if (filters.depo.length > 0) {
    const field = fieldMappings?.depo || 'depokodu';
    if (filters.depo.length === 1) {
      diaFilters.push({ field, operator: '=', value: filters.depo[0] });
    } else {
      diaFilters.push({ field, operator: 'IN', value: filters.depo.join(',') });
    }
  }
  
  // Cari kart tipi (AL, AS, ST)
  if (filters.cariKartTipi.length > 0) {
    const field = fieldMappings?.cariKartTipi || 'carikarttipi';
    if (filters.cariKartTipi.length === 1) {
      diaFilters.push({ field, operator: '=', value: filters.cariKartTipi[0] });
    } else {
      diaFilters.push({ field, operator: 'IN', value: filters.cariKartTipi.join(',') });
    }
  }
  
  // Özel kodlar
  ['ozelkod1', 'ozelkod2', 'ozelkod3'].forEach((key, idx) => {
    const values = filters[key as keyof GlobalFilters] as string[];
    if (values && values.length > 0) {
      const field = fieldMappings?.[key] || `ozelkod${idx + 1}kod`;
      if (values.length === 1) {
        diaFilters.push({ field, operator: '=', value: values[0] });
      } else {
        diaFilters.push({ field, operator: 'IN', value: values.join(',') });
      }
    }
  });
  
  // Şehir
  if (filters.sehir.length > 0) {
    const field = fieldMappings?.sehir || 'sehir';
    if (filters.sehir.length === 1) {
      diaFilters.push({ field, operator: '=', value: filters.sehir[0] });
    } else {
      diaFilters.push({ field, operator: 'IN', value: filters.sehir.join(',') });
    }
  }
  
  // Arama terimi
  if (filters.searchTerm && filters.searchTerm.trim()) {
    const field = fieldMappings?.search || 'cariunvan';
    diaFilters.push({ field, value: filters.searchTerm.trim() }); // contains (operatör yok)
  }
  
  return diaFilters;
}
