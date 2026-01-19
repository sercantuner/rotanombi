// Global Search Index - Tüm aranabilir içerikler
import { WIDGET_REGISTRY } from './widgetRegistry';

export interface SearchItem {
  id: string;
  type: 'widget' | 'page' | 'setting' | 'action';
  title: string;
  description: string;
  keywords: string[];
  path: string;
  category: string;
  icon?: string;
}

// Widget'lardan otomatik arama öğeleri oluştur
const widgetSearchItems: SearchItem[] = WIDGET_REGISTRY.map(widget => ({
  id: widget.id,
  type: 'widget' as const,
  title: widget.name,
  description: widget.description,
  keywords: [widget.name.toLowerCase(), widget.description.toLowerCase(), widget.category],
  path: `/${widget.defaultPage === 'dashboard' ? 'dashboard' : widget.defaultPage}`,
  category: widget.category,
  icon: widget.type === 'kpi' ? 'BarChart3' : widget.type === 'chart' ? 'PieChart' : 'List',
}));

// Sayfa arama öğeleri
const pageSearchItems: SearchItem[] = [
  {
    id: 'page_dashboard',
    type: 'page',
    title: 'Dashboard',
    description: 'Ana gösterge paneli - günlük özet ve kritik bilgiler',
    keywords: ['dashboard', 'ana sayfa', 'özet', 'gösterge'],
    path: '/dashboard',
    category: 'sayfa',
    icon: 'LayoutDashboard',
  },
  {
    id: 'page_satis',
    type: 'page',
    title: 'Satış Raporu',
    description: 'Satış performansı, marka dağılımı ve satış elemanı analizi',
    keywords: ['satış', 'sales', 'rapor', 'marka', 'performans'],
    path: '/satis',
    category: 'sayfa',
    icon: 'ShoppingCart',
  },
  {
    id: 'page_finans',
    type: 'page',
    title: 'Finans',
    description: 'Finansal raporlar, alacak/borç takibi ve nakit akışı',
    keywords: ['finans', 'alacak', 'borç', 'nakit', 'vade'],
    path: '/finans',
    category: 'sayfa',
    icon: 'Wallet',
  },
  {
    id: 'page_cari',
    type: 'page',
    title: 'Cari Hesaplar',
    description: 'Müşteri ve tedarikçi cari hesap yönetimi',
    keywords: ['cari', 'müşteri', 'tedarikçi', 'hesap', 'customer'],
    path: '/cari',
    category: 'sayfa',
    icon: 'Users',
  },
  {
    id: 'page_ayarlar',
    type: 'page',
    title: 'Ayarlar',
    description: 'Uygulama ayarları ve DIA bağlantı yapılandırması',
    keywords: ['ayarlar', 'settings', 'yapılandırma', 'dia', 'bağlantı'],
    path: '/ayarlar',
    category: 'sayfa',
    icon: 'Settings',
  },
];

// Ayar arama öğeleri
const settingSearchItems: SearchItem[] = [
  {
    id: 'setting_dia',
    type: 'setting',
    title: 'DIA Bağlantı Ayarları',
    description: 'DIA ERP sistemi bağlantı bilgilerini yapılandır',
    keywords: ['dia', 'bağlantı', 'erp', 'sunucu', 'api'],
    path: '/ayarlar',
    category: 'ayar',
    icon: 'Link',
  },
  {
    id: 'setting_demo',
    type: 'setting',
    title: 'Demo Modu',
    description: 'Demo verileriyle test modunu etkinleştir',
    keywords: ['demo', 'test', 'mock', 'örnek'],
    path: '/ayarlar',
    category: 'ayar',
    icon: 'FlaskConical',
  },
  {
    id: 'setting_theme',
    type: 'setting',
    title: 'Tema Ayarları',
    description: 'Açık veya koyu tema tercihini değiştir',
    keywords: ['tema', 'theme', 'koyu', 'açık', 'dark', 'light'],
    path: '/ayarlar',
    category: 'ayar',
    icon: 'Palette',
  },
  {
    id: 'setting_admin',
    type: 'setting',
    title: 'Kullanıcı Yönetimi',
    description: 'Kullanıcı rolleri ve yetkileri yönet',
    keywords: ['admin', 'yetki', 'kullanıcı', 'rol', 'izin'],
    path: '/admin',
    category: 'ayar',
    icon: 'Shield',
  },
];

// Aksiyon arama öğeleri
const actionSearchItems: SearchItem[] = [
  {
    id: 'action_refresh',
    type: 'action',
    title: 'Verileri Yenile',
    description: 'Tüm verileri DIA sisteminden güncelle',
    keywords: ['yenile', 'refresh', 'güncelle', 'sync'],
    path: '/dashboard',
    category: 'aksiyon',
    icon: 'RefreshCw',
  },
  {
    id: 'action_add_widget',
    type: 'action',
    title: 'Widget Ekle',
    description: 'Dashboard\'a yeni widget ekle',
    keywords: ['widget', 'ekle', 'add', 'yeni'],
    path: '/dashboard',
    category: 'aksiyon',
    icon: 'Plus',
  },
];

// Tüm arama öğelerini birleştir
export const SEARCH_INDEX: SearchItem[] = [
  ...pageSearchItems,
  ...widgetSearchItems,
  ...settingSearchItems,
  ...actionSearchItems,
];

// Arama fonksiyonu
export function searchItems(query: string): SearchItem[] {
  if (!query || query.length < 2) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);
  
  return SEARCH_INDEX.filter(item => {
    const titleMatch = item.title.toLowerCase().includes(normalizedQuery);
    const descMatch = item.description.toLowerCase().includes(normalizedQuery);
    const keywordMatch = item.keywords.some(kw => 
      words.some(word => kw.includes(word) || word.includes(kw))
    );
    
    return titleMatch || descMatch || keywordMatch;
  }).sort((a, b) => {
    // Prioritize exact title matches
    const aExact = a.title.toLowerCase() === normalizedQuery;
    const bExact = b.title.toLowerCase() === normalizedQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // Then prioritize pages over widgets
    if (a.type === 'page' && b.type !== 'page') return -1;
    if (a.type !== 'page' && b.type === 'page') return 1;
    
    return 0;
  });
}

// Kategoriye göre grupla
export function groupSearchResults(items: SearchItem[]): Record<string, SearchItem[]> {
  return items.reduce((acc, item) => {
    const group = item.type === 'page' ? 'Sayfalar' 
      : item.type === 'widget' ? 'Widget\'lar'
      : item.type === 'setting' ? 'Ayarlar'
      : 'Aksiyonlar';
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, SearchItem[]>);
}
