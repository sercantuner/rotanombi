// Widget Registry - Merkezi widget tanımları
// Her widget için metadata, varsayılan filtreler ve boyut bilgileri

export type WidgetCategory = 'dashboard' | 'satis' | 'finans' | 'cari';
export type WidgetType = 'kpi' | 'chart' | 'table' | 'list' | 'summary';
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type DataSource = 'genel' | 'satis' | 'finans' | 'mock';

export interface WidgetFilter {
  gorunumModu?: 'hepsi' | 'cari' | 'potansiyel';
  durum?: 'hepsi' | 'aktif' | 'pasif';
  cariKartTipi?: ('AL' | 'AS' | 'ST')[];
  ozelKodlar?: string[];
  sehirler?: string[];
  satisElemanlari?: string[];
}

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  type: WidgetType;
  dataSource: DataSource;
  defaultVisible: boolean;
  defaultPage: WidgetCategory;
  availableFilters: (keyof WidgetFilter)[];
  defaultFilters: WidgetFilter;
  size: WidgetSize;
  gridCols?: number;
  minHeight?: string;
  icon?: string;
}

export interface WidgetLayout {
  id: string;
  visible: boolean;
  order: number;
  size?: WidgetSize;
}

export interface PageLayout {
  widgets: WidgetLayout[];
}

// ============ WIDGET DEFINITIONS ============

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  // ========== KPI WIDGETS ==========
  {
    id: 'kpi_toplam_alacak',
    name: 'Toplam Alacak',
    description: 'Toplam alacak bakiyesi',
    category: 'finans',
    type: 'kpi',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_gecikmis_alacak',
    name: 'Gecikmiş Alacak',
    description: 'Vadesi geçmiş alacaklar',
    category: 'finans',
    type: 'kpi',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_toplam_borc',
    name: 'Toplam Borç',
    description: 'Toplam borç bakiyesi',
    category: 'finans',
    type: 'kpi',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_gecikmis_borc',
    name: 'Gecikmiş Borç',
    description: 'Vadesi geçmiş borçlar',
    category: 'finans',
    type: 'kpi',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_net_bakiye',
    name: 'Net Bakiye',
    description: 'Alacak - Borç farkı',
    category: 'finans',
    type: 'kpi',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_musteri_sayisi',
    name: 'Müşteri Sayısı',
    description: 'Toplam cari hesap sayısı',
    category: 'cari',
    type: 'kpi',
    dataSource: 'genel',
    defaultVisible: false,
    defaultPage: 'cari',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: { gorunumModu: 'cari', durum: 'aktif', cariKartTipi: ['AL'] },
    size: 'sm',
  },
  {
    id: 'kpi_net_satis',
    name: 'Net Satış',
    description: 'Toplam net satış tutarı',
    category: 'satis',
    type: 'kpi',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'satis',
    availableFilters: [],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_brut_satis',
    name: 'Brüt Satış',
    description: 'Toplam brüt satış tutarı',
    category: 'satis',
    type: 'kpi',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'satis',
    availableFilters: [],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_iade_tutari',
    name: 'İade Tutarı',
    description: 'Toplam iade tutarı',
    category: 'satis',
    type: 'kpi',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'satis',
    availableFilters: [],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_fatura_sayisi',
    name: 'Fatura Sayısı',
    description: 'Toplam fatura adedi',
    category: 'satis',
    type: 'kpi',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'satis',
    availableFilters: [],
    defaultFilters: {},
    size: 'sm',
  },
  {
    id: 'kpi_banka_bakiyesi',
    name: 'Banka Bakiyesi',
    description: 'Toplam banka bakiyesi',
    category: 'finans',
    type: 'kpi',
    dataSource: 'finans',
    defaultVisible: true,
    defaultPage: 'finans',
    availableFilters: [],
    defaultFilters: {},
    size: 'sm',
  },

  // ========== CHART WIDGETS ==========
  {
    id: 'grafik_vade_yaslandirma',
    name: 'Vade Yaşlandırma',
    description: 'Nakit akış projeksiyonu grafiği',
    category: 'finans',
    type: 'chart',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'full',
    minHeight: '300px',
  },
  {
    id: 'grafik_sektor_dagilimi',
    name: 'Sektör Dağılımı',
    description: 'Carilerin sektörel dağılımı',
    category: 'cari',
    type: 'chart',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'cari',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'md',
  },
  {
    id: 'grafik_kaynak_dagilimi',
    name: 'Kaynak Dağılımı',
    description: 'Müşteri edinme kaynaklarının dağılımı',
    category: 'cari',
    type: 'chart',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'cari',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'md',
  },
  {
    id: 'grafik_ozelkod_dagilimi',
    name: 'Özel Kod Dağılımı',
    description: 'Carilerin özel kod dağılımı',
    category: 'cari',
    type: 'chart',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'cari',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'md',
  },
  {
    id: 'grafik_lokasyon_dagilimi',
    name: 'Lokasyon Dağılımı',
    description: 'Şehir bazlı müşteri dağılımı',
    category: 'cari',
    type: 'chart',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'cari',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'lg',
  },
  {
    id: 'grafik_cari_donusum_trend',
    name: 'Cari Dönüşüm Trendi',
    description: 'Potansiyelden cariye dönüşüm trendi',
    category: 'cari',
    type: 'chart',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'cari',
    availableFilters: [],
    defaultFilters: {},
    size: 'lg',
  },
  {
    id: 'grafik_marka_dagilimi',
    name: 'Marka Dağılımı',
    description: 'Satışların marka bazlı dağılımı',
    category: 'satis',
    type: 'chart',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'satis',
    availableFilters: [],
    defaultFilters: {},
    size: 'md',
  },

  // ========== LIST/TABLE WIDGETS ==========
  {
    id: 'liste_kritik_stok',
    name: 'Kritik Stok Uyarıları',
    description: 'Stok seviyesi kritik olan ürünler',
    category: 'satis',
    type: 'list',
    dataSource: 'mock',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: [],
    defaultFilters: {},
    size: 'md',
    minHeight: '250px',
  },
  {
    id: 'liste_bugun_vade',
    name: 'Bugün Vadesi Gelenler',
    description: 'Bugün vadesi gelen alacak ve borçlar',
    category: 'finans',
    type: 'list',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'md',
    minHeight: '250px',
  },
  {
    id: 'liste_aranacak_musteriler',
    name: 'Aranacak Müşteriler',
    description: 'Bugün takip edilmesi gereken müşteriler',
    category: 'cari',
    type: 'list',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'md',
    minHeight: '250px',
  },
  {
    id: 'liste_en_borclu',
    name: 'En Borçlu/Alacaklı',
    description: 'En yüksek bakiyeli cariler',
    category: 'finans',
    type: 'list',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi'],
    defaultFilters: {},
    size: 'lg',
  },
  {
    id: 'liste_banka_hesaplari',
    name: 'Banka Hesapları',
    description: 'Banka hesapları ve bakiyeleri',
    category: 'finans',
    type: 'list',
    dataSource: 'finans',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: [],
    defaultFilters: {},
    size: 'lg',
  },
  {
    id: 'liste_satis_elemani_performans',
    name: 'Satış Elemanı Performansı',
    description: 'Satış temsilcileri performans listesi',
    category: 'satis',
    type: 'list',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: [],
    defaultFilters: {},
    size: 'full',
  },
  {
    id: 'liste_cari',
    name: 'Cari Listesi',
    description: 'Tüm cariler tablosu',
    category: 'cari',
    type: 'table',
    dataSource: 'genel',
    defaultVisible: true,
    defaultPage: 'cari',
    availableFilters: ['gorunumModu', 'durum', 'cariKartTipi', 'ozelKodlar', 'sehirler', 'satisElemanlari'],
    defaultFilters: {},
    size: 'full',
  },
  {
    id: 'liste_top_urunler',
    name: 'En Çok Satan Ürünler',
    description: 'En çok satılan ürünler listesi',
    category: 'satis',
    type: 'table',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'satis',
    availableFilters: [],
    defaultFilters: {},
    size: 'lg',
  },

  // ========== SUMMARY WIDGETS ==========
  {
    id: 'ozet_gunluk',
    name: 'Günlük Özet',
    description: 'Günlük satış, tahsilat ve ödeme özeti',
    category: 'dashboard',
    type: 'summary',
    dataSource: 'satis',
    defaultVisible: true,
    defaultPage: 'dashboard',
    availableFilters: [],
    defaultFilters: {},
    size: 'full',
  },
];

// ============ HELPER FUNCTIONS ============

export function getWidgetById(id: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.id === id);
}

export function getWidgetsByCategory(category: WidgetCategory): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter(w => w.category === category);
}

export function getWidgetsByDefaultPage(page: WidgetCategory): WidgetDefinition[] {
  return WIDGET_REGISTRY.filter(w => w.defaultPage === page);
}

export function getDefaultLayoutForPage(page: WidgetCategory): PageLayout {
  const widgets = WIDGET_REGISTRY
    .filter(w => w.defaultPage === page && w.defaultVisible)
    .map((w, index) => ({
      id: w.id,
      visible: true,
      order: index,
      size: w.size,
    }));

  return { widgets };
}

export function getAllAvailableWidgetsForPage(page: WidgetCategory): WidgetDefinition[] {
  // Return widgets that can be shown on this page (default page or compatible category)
  return WIDGET_REGISTRY.filter(w => 
    w.defaultPage === page || 
    w.category === page || 
    w.category === 'dashboard'
  );
}

export function getPageCategories(): { id: WidgetCategory; name: string }[] {
  return [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'satis', name: 'Satış' },
    { id: 'finans', name: 'Finans' },
    { id: 'cari', name: 'Cari Hesaplar' },
  ];
}
