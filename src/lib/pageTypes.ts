// Page ve Container tipleri

export interface UserPage {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ContainerType = 
  | 'kpi_row_5'
  | 'kpi_row_4'
  | 'kpi_row_3'
  | 'chart_full'
  | 'chart_half'
  | 'chart_third'
  | 'info_cards_3'
  | 'info_cards_2'
  | 'table_full'
  | 'list_full'
  | 'custom_grid';

export interface PageContainer {
  id: string;
  page_id: string;
  container_type: ContainerType;
  title?: string;
  sort_order: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ContainerWidget {
  id: string;
  container_id: string;
  widget_id: string;
  slot_index: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WidgetPermission {
  id: string;
  user_id: string;
  widget_id: string;
  can_view: boolean;
  can_add: boolean;
  granted_by?: string;
  granted_at: string;
}

// Konteyner şablonları - Mobil responsive grid sınıfları
export const CONTAINER_TEMPLATES: {
  id: ContainerType;
  name: string;
  description: string;
  icon: string;
  slots: number;
  gridClass: string;
}[] = [
  {
    id: 'kpi_row_5',
    name: '5 KPI Satırı',
    description: '5 adet KPI kartı yan yana',
    icon: 'LayoutGrid',
    slots: 5,
    gridClass: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
  },
  {
    id: 'kpi_row_4',
    name: '4 KPI Satırı',
    description: '4 adet KPI kartı yan yana',
    icon: 'LayoutGrid',
    slots: 4,
    gridClass: 'grid-cols-2 md:grid-cols-4',
  },
  {
    id: 'kpi_row_3',
    name: '3 KPI Satırı',
    description: '3 adet KPI kartı yan yana',
    icon: 'LayoutGrid',
    slots: 3,
    gridClass: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  },
  {
    id: 'chart_full',
    name: 'Tam Genişlik Grafik',
    description: 'Tek grafik, tam genişlik',
    icon: 'BarChart3',
    slots: 1,
    gridClass: 'grid-cols-1',
  },
  {
    id: 'chart_half',
    name: '2 Grafik Yan Yana',
    description: '2 grafik yan yana',
    icon: 'PieChart',
    slots: 2,
    gridClass: 'grid-cols-1 md:grid-cols-2',
  },
  {
    id: 'chart_third',
    name: '3 Grafik Yan Yana',
    description: '3 grafik yan yana',
    icon: 'Activity',
    slots: 3,
    gridClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  },
  {
    id: 'info_cards_3',
    name: '3 Bilgi Kartı',
    description: '3 bilgi kartı yan yana',
    icon: 'CreditCard',
    slots: 3,
    gridClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  },
  {
    id: 'info_cards_2',
    name: '2 Bilgi Kartı',
    description: '2 bilgi kartı yan yana',
    icon: 'CreditCard',
    slots: 2,
    gridClass: 'grid-cols-1 md:grid-cols-2',
  },
  {
    id: 'table_full',
    name: 'Tablo',
    description: 'Tam genişlik tablo',
    icon: 'Table',
    slots: 1,
    gridClass: 'grid-cols-1',
  },
  {
    id: 'list_full',
    name: 'Liste',
    description: 'Tam genişlik liste',
    icon: 'List',
    slots: 1,
    gridClass: 'grid-cols-1',
  },
  {
    id: 'custom_grid',
    name: 'Özel Grid',
    description: 'Esnek 6 slot grid',
    icon: 'Grid3x3',
    slots: 6,
    gridClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  },
];

// Sayfa ikonları
export const PAGE_ICONS = [
  'LayoutDashboard',
  'TrendingUp',
  'Wallet',
  'Users',
  'ShoppingCart',
  'Package',
  'FileText',
  'BarChart3',
  'PieChart',
  'Activity',
  'Calendar',
  'Clock',
  'Target',
  'Briefcase',
  'Building',
  'Factory',
  'Truck',
  'Map',
  'Globe',
  'Star',
];
