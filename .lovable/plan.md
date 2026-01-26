
# Global Filtre Widget Sistemi ve Satış Personeli Yetkilendirmesi

## Genel Bakış

Bu plan, tüm dashboard/sayfa widgetlarını etkileyen global filtre elemanları oluşturma, AI widget kurallarına filtre bilgisi ekleme ve DIA'daki satış elemanı/yetki kodu bazlı filtreleme desteğini kapsar.

---

## Bölüm 1: Mevcut Yapı Analizi

### Mevcut Filtre Sistemi

```text
┌─────────────────────────────────────────────────────────────┐
│  DashboardFilterContext (Mevcut)                            │
├─────────────────────────────────────────────────────────────┤
│  • cariTipi[], cariKartTipi[]                              │
│  • ozelkod1[], ozelkod2[], ozelkod3[]                      │
│  • sehir[], satisTemsilcisi[]                              │
│  • vadeDilimi, durum, gorunumModu                          │
│  • searchTerm                                              │
└─────────────────────────────────────────────────────────────┘
```

### Eksikler
1. Filtreler sadece frontend'de uygulanıyor (post-fetch)
2. DIA'ya gönderilen sorgulara otomatik eklenmiyor
3. AI widget üretirken filtre bilgisi aktarılmıyor
4. Sayfa bazlı özel filtreler tanımlanamıyor
5. Kullanıcı bazlı zorunlu filtreler (satış personeli) yok

---

## Bölüm 2: Yeni Filtreleme Mimarisi

### 2.1 Üç Katmanlı Filtre Sistemi

```text
┌─────────────────────────────────────────────────────────────┐
│  1. KULLANICI FİLTRELERİ (Zorunlu - Backend)               │
│     DIA kullanıcısına bağlı otomatik filtreler              │
│     Örn: satiselemani = "Ali Yılmaz" (değiştirilemez)      │
├─────────────────────────────────────────────────────────────┤
│  2. SAYFA FİLTRELERİ (Yapılandırılabilir)                  │
│     Sayfa bazında tanımlanan filtre alanları                │
│     Örn: Satış sayfası → tarih, müşteri, ürün grubu        │
├─────────────────────────────────────────────────────────────┤
│  3. KULLANICI SEÇİMİ (Dinamik)                              │
│     Kullanıcının seçtiği anlık filtreler                    │
│     Örn: "Bu ay", "Özel kod: VIP", "Şehir: İstanbul"       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Filtre Akış Şeması

```text
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Sayfa Açılır    │───▶│  PageFilterConfig│───▶│  FilterContext   │
│                  │    │  Yüklenir        │    │  Güncellenir     │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                                                        │
                                                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Widget Render   │◀───│  Data Loader     │◀───│  DIA API Call    │
│  (Filtered Data) │    │  Applies Filters │    │  + User Filters  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Bölüm 3: Veritabanı Değişiklikleri

### 3.1 profiles Tablosuna Yeni Alanlar

```sql
-- Satış personeli için DIA'daki kullanıcı adı
ALTER TABLE profiles ADD COLUMN dia_satis_elemani TEXT;
-- Yetki kodu (DIA'daki yetki sistemi)
ALTER TABLE profiles ADD COLUMN dia_yetki_kodu TEXT;
-- Otomatik uygulanacak zorunlu filtreler (JSON)
ALTER TABLE profiles ADD COLUMN dia_auto_filters JSONB DEFAULT '[]';
```

### 3.2 user_pages Tablosuna Filtre Konfigürasyonu

```sql
-- Sayfa bazlı filtre yapılandırması
ALTER TABLE user_pages ADD COLUMN filter_config JSONB DEFAULT NULL;

-- Örnek filter_config:
-- {
--   "availableFilters": ["tarih", "satisTemsilcisi", "ozelkod2", "sehir"],
--   "defaultFilters": { "tarih": "this_month" },
--   "filterLayout": "horizontal" | "sidebar",
--   "showFilterBar": true
-- }
```

### 3.3 Yeni Tablo: page_filter_presets

```sql
CREATE TABLE public.page_filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID REFERENCES user_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Bölüm 4: Genişletilmiş DashboardFilterContext

### 4.1 Yeni Interface

```typescript
interface ExtendedDashboardFilters extends DashboardFilters {
  // Mevcut filtreler...
  
  // Yeni Global Filtreler
  tarihAraligi: {
    period: DatePeriod;
    customStart?: string;
    customEnd?: string;
    field: string; // Hangi tarih alanına uygulanacak
  } | null;
  
  depo: string[];           // Depo filtresi
  sube: string[];           // Şube filtresi
  urunGrubu: string[];      // Ürün grubu
  marka: string[];          // Marka
  kategori: string[];       // Kategori
  
  // DIA Zorunlu Filtreler (değiştirilemez)
  _diaAutoFilters: DiaApiFilter[];
}

interface PageFilterConfig {
  pageId: string;
  availableFilters: FilterType[];
  defaultFilters: Partial<ExtendedDashboardFilters>;
  filterLayout: 'horizontal' | 'sidebar' | 'modal';
  showFilterBar: boolean;
  filterableFields: FilterableFieldConfig[];
}

interface FilterableFieldConfig {
  field: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'number' | 'text';
  diaField: string; // DIA'daki alan adı
  options?: { value: string; label: string }[];
  loadOptionsFrom?: string; // DataSource ID
}
```

### 4.2 Filtre Türleri

| Filtre Tipi | UI Bileşeni | Kullanım |
|-------------|-------------|----------|
| `select` | Dropdown | Tek seçim |
| `multiselect` | Checkbox grubu | Çoklu seçim |
| `date` | DatePicker | Tek tarih |
| `daterange` | DateRangePicker | Tarih aralığı |
| `number` | Slider/Input | Sayı aralığı |
| `text` | Input | Metin arama |
| `toggle` | Switch | Açık/Kapalı |

---

## Bölüm 5: Filtre Widget Bileşenleri

### 5.1 Ana Filtre Bileşenleri

```text
┌─────────────────────────────────────────────────────────────┐
│  Yeni Bileşenler                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📁 src/components/filters/                                 │
│  ├── GlobalFilterBar.tsx      (Üst bar)                    │
│  ├── FilterSidebar.tsx        (Yan panel)                  │
│  ├── FilterModal.tsx          (Popup modal)                │
│  ├── FilterPresetSelector.tsx (Kayıtlı filtreler)          │
│  ├── DateRangeFilter.tsx      (Tarih aralığı)              │
│  ├── MultiSelectFilter.tsx    (Çoklu seçim)                │
│  ├── NumberRangeFilter.tsx    (Sayı aralığı)               │
│  └── SearchFilter.tsx         (Hızlı arama)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 GlobalFilterBar Tasarımı

```text
┌────────────────────────────────────────────────────────────────────────┐
│  🔍 Ara...  │ 📅 Bu Ay ▼ │ 👤 Tüm Temsilciler ▼ │ 🏷️ +3 Filtre │ ✕ Temizle │
└────────────────────────────────────────────────────────────────────────┘
                    │                │
                    ▼                ▼
         ┌─────────────────┐  ┌─────────────────┐
         │ [○] Bugün       │  │ [✓] Ali Yılmaz  │
         │ [○] Bu Hafta    │  │ [✓] Mehmet Öz   │
         │ [●] Bu Ay       │  │ [ ] Ayşe Demir  │
         │ [○] Bu Yıl      │  │ [ ] Fatih Kara  │
         │ [○] Özel...     │  └─────────────────┘
         └─────────────────┘
```

### 5.3 FilterSidebar Tasarımı (Satış Takip Sayfası İçin)

```text
┌─────────────────────────────────────┐
│  📊 Filtreler                   [x] │
├─────────────────────────────────────┤
│                                     │
│  📅 Tarih Aralığı                   │
│  ┌─────────────────────────────────┐│
│  │ Bu Ay                      ▼  ││
│  └─────────────────────────────────┘│
│                                     │
│  👤 Satış Temsilcisi                │
│  ┌─────────────────────────────────┐│
│  │ 🔒 Ali Yılmaz (Siz)           ││
│  └─────────────────────────────────┘│
│  (Değiştirilemez - DIA yetkiniz)    │
│                                     │
│  🏢 Müşteri Grubu                   │
│  [ ] Altın Müşteriler               │
│  [ ] VIP                            │
│  [ ] Yeni Müşteriler                │
│                                     │
│  📦 Ürün Kategorisi                 │
│  [Tümü                          ▼] │
│                                     │
│  💰 Tutar Aralığı                   │
│  ₺0 ═══════●═══════ ₺100K          │
│                                     │
│  [Filtreleri Uygula]  [Sıfırla]     │
└─────────────────────────────────────┘
```

---

## Bölüm 6: AI Widget Kurallarına Filtre Bilgisi Ekleme

### 6.1 Güncellenmiş AI System Prompt

```text
═══════════════════════════════════════════════════════════════════════════════
🔍 GLOBAL FİLTRE SİSTEMİ
───────────────────────────────────────────────────────────────────────────────

Widget'a "filters" prop'u da geçilir. Bu prop aktif filtreleri içerir:

function Widget({ data, colors, filters }) {
  // filters objesi:
  // {
  //   tarihAraligi: { period: 'this_month', field: 'tarih' },
  //   satisTemsilcisi: ['Ali Yılmaz'],
  //   ozelkod2: ['VIP'],
  //   searchTerm: 'ABC Ltd'
  // }

  // Filtre bilgisini widget'ta göster (opsiyonel)
  var filterInfo = '';
  if (filters && filters.satisTemsilcisi && filters.satisTemsilcisi.length > 0) {
    filterInfo = 'Temsilci: ' + filters.satisTemsilcisi.join(', ');
  }
}

NOT: Veri zaten filtrelenmiş olarak gelir. Widget içinde tekrar filtreleme YAPMA!
Sadece hangi filtrelerin aktif olduğunu göstermek için filters prop'unu kullan.
```

### 6.2 Veri Analizi Bilgisi (Wizard Adım 1)

AI widget oluştururken gösterilecek veri analizi:

```text
┌─────────────────────────────────────────────────────────────┐
│  📊 Veri Analizi                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Kayıt Sayısı: 1,245                                        │
│  Alan Sayısı: 24                                            │
│                                                             │
│  🔢 SAYISAL ALANLAR (Filtrelenebilir)                      │
│  ┌─────────────────────────────────────────────────────────┐
│  │ toplambakiye   Min: -50K   Max: 2.5M   Avg: 125K       │
│  │ vadesigecentutar   Min: 0   Max: 500K   Avg: 45K       │
│  │ riskSkoru      Min: 0      Max: 100    Avg: 35         │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
│  📝 METİN ALANLARI (Filtrelenebilir)                       │
│  ┌─────────────────────────────────────────────────────────┐
│  │ satiselemani   ▸ 12 benzersiz değer                     │
│  │   [Ali Yılmaz] [Mehmet Öz] [Ayşe Demir] ...            │
│  │ ozelkod2kod    ▸ 8 benzersiz değer                      │
│  │   [VIP] [ALTIN] [NORMAL] [YENİ] ...                    │
│  │ sehir          ▸ 45 benzersiz değer                     │
│  │   [İstanbul] [Ankara] [İzmir] ...                      │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
│  📅 TARİH ALANLARI                                          │
│  ┌─────────────────────────────────────────────────────────┐
│  │ tarih          Min: 2024-01-01   Max: 2024-12-31       │
│  │ vadetarihi     Min: 2024-01-15   Max: 2025-06-30       │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Bölüm 7: DIA Entegrasyonu

### 7.1 Zorunlu Kullanıcı Filtreleri

```typescript
// profiles tablosundan zorunlu filtreler
interface DiaAutoFilter {
  field: string;      // DIA alan adı (örn: satiselemani)
  operator: string;   // = veya IN
  value: string;      // Değer
  isLocked: boolean;  // Kullanıcı değiştiremez
}

// Örnek: Satış personeli için
{
  "dia_auto_filters": [
    { "field": "satiselemani", "operator": "=", "value": "Ali Yılmaz", "isLocked": true }
  ]
}
```

### 7.2 dia-api-test Güncellemesi

```typescript
interface TestApiRequest {
  // Mevcut alanlar...
  
  // Yeni: Kullanıcı filtreleri (profiles'dan otomatik)
  applyUserFilters?: boolean;
  
  // Yeni: Sayfa filtreleri
  pageFilters?: {
    tarihAraligi?: { period: string; field: string };
    satisTemsilcisi?: string[];
    ozelkod?: string[];
    // ...
  };
}
```

### 7.3 Filtre Birleştirme Mantığı

```text
DIA Sorgusu Oluşturma:

1. DataSource.filters (Veri kaynağı tanımı)
   +
2. profiles.dia_auto_filters (Zorunlu kullanıcı filtreleri)
   +
3. PageFilters (Sayfa bazlı seçimler)
   +
4. WidgetConfig.filters (Widget özel filtreleri)
   =
   → FİNAL FİLTRE DİZİSİ
```

---

## Bölüm 8: Satış Takip Sayfası Örneği

### 8.1 Sayfa Yapılandırması

```json
{
  "name": "Satış Takip",
  "slug": "satis-takip",
  "filter_config": {
    "availableFilters": ["tarih", "musteri", "urunGrubu", "durum"],
    "defaultFilters": {
      "tarih": { "period": "this_month", "field": "tarih" }
    },
    "filterLayout": "sidebar",
    "showFilterBar": true,
    "lockedFilters": {
      "satisTemsilcisi": "$CURRENT_USER" // DIA kullanıcısı
    }
  }
}
```

### 8.2 Sayfa Görünümü

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Satış Takip - Ali Yılmaz                              [Filtreler 🔽]       │
├────────────────────┬────────────────────────────────────────────────────────┤
│  📊 Filtreler      │  ┌──────────────────────────────────────────────────┐ │
│  ──────────────    │  │  KPI SATIRII: Toplam | Hedef | Gerçekleşme      │ │
│                    │  │  ₺85K          ₺100K    %85                      │ │
│  📅 Bu Ay     ▼    │  └──────────────────────────────────────────────────┘ │
│                    │                                                        │
│  👤 Ali Yılmaz     │  ┌──────────────────────────────────────────────────┐ │
│  🔒 (Sizin kaydınız)│  │  SATIŞLARIM GRAFİĞİ (Bar Chart)                  │ │
│                    │  │  ████ ████ ████ ███ ██                            │ │
│  🏢 Müşteri        │  └──────────────────────────────────────────────────┘ │
│  [ ] ABC Ltd       │                                                        │
│  [ ] XYZ A.Ş.      │  ┌──────────────────────────────────────────────────┐ │
│  [ ] 123 Tic.      │  │  MÜŞTERİ LİSTESİ (Tablo)                         │ │
│                    │  │  ─────────────────────────────────────            │ │
│  📦 Ürün Grubu     │  │  ABC Ltd    │ ₺25K  │ Aktif                       │ │
│  [Tümü        ▼]   │  │  XYZ A.Ş.   │ ₺18K  │ Beklemede                   │ │
│                    │  │  123 Tic.   │ ₺12K  │ Tamamlandı                  │ │
│  [Uygula]          │  └──────────────────────────────────────────────────┘ │
└────────────────────┴────────────────────────────────────────────────────────┘
```

---

## Bölüm 9: Dosya Değişiklikleri

### Yeni Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `src/components/filters/GlobalFilterBar.tsx` | Üst filtre barı |
| `src/components/filters/FilterSidebar.tsx` | Yan filtre paneli |
| `src/components/filters/DateRangeFilter.tsx` | Tarih aralığı |
| `src/components/filters/MultiSelectFilter.tsx` | Çoklu seçim |
| `src/components/filters/FilterPresetSelector.tsx` | Kayıtlı filtreler |
| `src/hooks/usePageFilters.tsx` | Sayfa filtre hook'u |
| `src/lib/filterTypes.ts` | Filtre tipleri |

### Güncellenecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/contexts/DashboardFilterContext.tsx` | Genişletilmiş filtreler |
| `src/hooks/useDynamicWidgetData.tsx` | Filtre entegrasyonu |
| `supabase/functions/dia-api-test/index.ts` | Kullanıcı filtreleri |
| `supabase/functions/ai-code-generator/index.ts` | filters prop bilgisi |
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | Veri analizi paneli |

### Veritabanı Migrasyonları

1. `profiles` tablosuna `dia_satis_elemani`, `dia_yetki_kodu`, `dia_auto_filters` alanları
2. `user_pages` tablosuna `filter_config` alanı
3. Yeni `page_filter_presets` tablosu

---

## Bölüm 10: Uygulama Öncelik Sırası

### Faz 1: Temel Altyapı
1. Veritabanı migrasyonları
2. `DashboardFilterContext` genişletme
3. `dia-api-test` kullanıcı filtresi desteği

### Faz 2: Filtre Bileşenleri
4. `GlobalFilterBar` ve `FilterSidebar` bileşenleri
5. `DateRangeFilter` ve `MultiSelectFilter`
6. Sayfa bazlı filtre yapılandırması

### Faz 3: AI Entegrasyonu
7. AI system prompt'a filtre bilgisi ekleme
8. Widget builder'da veri analizi paneli
9. Filtrelenebilir alanları gösterme

### Faz 4: Kullanıcı Deneyimi
10. Filtre preset'leri (kayıtlı filtreler)
11. Satış takip sayfası örneği
12. Mobil uyumluluk

---

## Sonuç

Bu plan uygulandığında:
- ✅ Tüm widgetları etkileyen global filtreler
- ✅ DIA yetki kodu ve satış elemanı bazlı zorunlu filtreler
- ✅ Sayfa bazlı özelleştirilebilir filtre yapılandırması
- ✅ AI widget üretirken filtrelenebilir alan bilgisi
- ✅ Veri analizi panelinde tüm alanların görünmesi
- ✅ Satış personeli sayfası için kilitli filtreler
- ✅ Filtre preset'leri ile hızlı erişim
