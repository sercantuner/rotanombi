// Widget Types - Veritabanı tabanlı widget sistemi için tip tanımları

import { WidgetBuilderConfig } from './widgetBuilderTypes';

export type WidgetCategory = 'dashboard' | 'satis' | 'finans' | 'cari';
export type WidgetType = 'kpi' | 'chart' | 'table' | 'list' | 'summary';
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type DataSource = 'genel' | 'satis' | 'finans' | 'mock';

// Filtreleme alanı yapılandırması
export interface FilterFieldConfig {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

export interface WidgetFilter {
  gorunumModu?: 'hepsi' | 'cari' | 'potansiyel';
  durum?: 'hepsi' | 'aktif' | 'pasif';
  cariKartTipi?: ('AL' | 'AS' | 'ST')[];
  ozelKodlar?: string[];
  sehirler?: string[];
  satisElemanlari?: string[];
}

// Veritabanından gelen widget tanımı
export interface Widget {
  id: string;
  widget_key: string;
  name: string;
  description: string | null;
  category: WidgetCategory;
  type: WidgetType;
  data_source: DataSource;
  size: WidgetSize;
  icon: string | null;
  default_page: WidgetCategory;
  default_visible: boolean;
  available_filters: string[];
  default_filters: WidgetFilter;
  min_height: string | null;
  grid_cols: number | null;
  is_active: boolean;
  is_default?: boolean; // Varsayılan widget mi?
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Yeni alanlar - çoklu boyut ve sayfa desteği
  available_sizes?: WidgetSize[];
  target_pages?: WidgetCategory[];
  filter_fields?: FilterFieldConfig[];
  builder_config: WidgetBuilderConfig | null; // Widget Builder yapılandırması
}

// Kullanıcı layout'unda widget yerleşimi
export interface WidgetLayout {
  id: string; // widget_key
  visible: boolean;
  order: number;
  size?: WidgetSize;
}

export interface PageLayout {
  widgets: WidgetLayout[];
}

// Super Admin widget form tipi
export interface WidgetFormData {
  widget_key: string;
  name: string;
  description: string;
  category: WidgetCategory;
  type: WidgetType;
  data_source: DataSource;
  size: WidgetSize;
  icon: string;
  default_page: WidgetCategory;
  default_visible: boolean;
  available_filters: string[];
  default_filters: WidgetFilter;
  min_height: string;
  grid_cols: number | null;
  is_active: boolean;
  is_default?: boolean; // Varsayılan widget mi?
  sort_order: number;
  builder_config?: WidgetBuilderConfig | null; // Widget Builder yapılandırması
  // Yeni alanlar - çoklu boyut ve sayfa desteği
  available_sizes?: WidgetSize[];
  target_pages?: WidgetCategory[];
  filter_fields?: FilterFieldConfig[];
}

// Sayfa kategorileri
export const PAGE_CATEGORIES: { id: WidgetCategory; name: string }[] = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'satis', name: 'Satış' },
  { id: 'finans', name: 'Finans' },
  { id: 'cari', name: 'Cari Hesaplar' },
];

// Widget tipleri
export const WIDGET_TYPES: { id: WidgetType; name: string }[] = [
  { id: 'kpi', name: 'KPI Kartı' },
  { id: 'chart', name: 'Grafik' },
  { id: 'table', name: 'Tablo' },
  { id: 'list', name: 'Liste' },
  { id: 'summary', name: 'Özet' },
];

// Widget boyutları
export const WIDGET_SIZES: { id: WidgetSize; name: string; cols: number }[] = [
  { id: 'sm', name: 'Küçük', cols: 1 },
  { id: 'md', name: 'Orta', cols: 2 },
  { id: 'lg', name: 'Büyük', cols: 3 },
  { id: 'xl', name: 'Çok Büyük', cols: 4 },
  { id: 'full', name: 'Tam Genişlik', cols: 5 },
];

// Veri kaynakları
export const DATA_SOURCES: { id: DataSource; name: string }[] = [
  { id: 'genel', name: 'Genel Rapor' },
  { id: 'satis', name: 'Satış Raporu' },
  { id: 'finans', name: 'Finans Raporu' },
  { id: 'mock', name: 'Demo Verisi' },
];

// Kullanılabilir filtreler
export const AVAILABLE_FILTERS: { id: keyof WidgetFilter; name: string }[] = [
  { id: 'gorunumModu', name: 'Görünüm Modu' },
  { id: 'durum', name: 'Durum' },
  { id: 'cariKartTipi', name: 'Cari Kart Tipi' },
  { id: 'ozelKodlar', name: 'Özel Kodlar' },
  { id: 'sehirler', name: 'Şehirler' },
  { id: 'satisElemanlari', name: 'Satış Elemanları' },
];
