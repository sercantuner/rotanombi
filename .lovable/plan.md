
# Global Filtre Sistemi - Kapsamlı Güncelleme Planı

## Özet
Bu plan, global filtrelerin tüm widget'lar (özellikle Nakit Akış Projeksiyonu) tarafından kullanılmasını, kullanıcı bazlı filtre yönetimi UI'ını ve AI widget kurallarına filtre bilgisi eklenmesini kapsar.

---

## Bölüm 1: Tespit Edilen Sorunlar

### 1.1 Nakit Akış Projeksiyonu Filtrelere Tepki Vermiyor

**Kök Sebep:**
`BuilderWidgetRenderer.tsx` bileşeninde `useGlobalFilters` hook'u import edilmiş ancak **hiç kullanılmamış**. `useDynamicWidgetData(builderConfig)` çağrısı, ikinci parametre olan `globalFilters` argümanı olmadan yapılıyor.

```text
Mevcut Durum (Satır 143):
  useDynamicWidgetData(builderConfig)  ← globalFilters YOK!

Olması Gereken:
  useDynamicWidgetData(builderConfig, filters)  ← filters eklenmeli
```

### 1.2 Vade Yaşlandırma Verisinde Filtrelenebilir Alanlar Yok

`Cari_vade_bakiye` veri kaynağı `__borchareketler` içeriyor ancak üst seviyede `satiselemani`, `ozelkod1kod`, `carikarttipi` gibi alanlar yok. Dolayısıyla `applyGlobalFilters` fonksiyonu bu alanları bulamıyor.

**Çözüm:** `Cari Kart Listesi` ile `Cari_vade_bakiye` birleştirilerek (LEFT JOIN) filtrelenebilir alanlar eklenmeli.

### 1.3 GlobalFilterBar'da Filtre Yönetimi Yok

Kullanıcı hangi filtrelerin görüneceğini seçemiyor. Tarih hariç tüm filtreler (şube, depo, özel kodlar vb.) yönetilebilir olmalı.

---

## Bölüm 2: Veritabanı Değişiklikleri

### 2.1 Yeni Tablo: user_filter_preferences

Kullanıcının hangi filtreleri görmek istediğini saklar:

```sql
CREATE TABLE public.user_filter_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  visible_filters TEXT[] DEFAULT ARRAY['satisTemsilcisi', 'cariKartTipi'],
  filter_order TEXT[] DEFAULT ARRAY['tarih', 'satisTemsilcisi', 'cariKartTipi'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE public.user_filter_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON public.user_filter_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
ON public.user_filter_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
ON public.user_filter_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());
```

---

## Bölüm 3: Frontend Değişiklikleri

### 3.1 BuilderWidgetRenderer - Global Filtre Entegrasyonu

**Dosya:** `src/components/dashboard/BuilderWidgetRenderer.tsx`

```text
ÖNCE (Satır 143):
  const { data, rawData, isLoading, error, refetch } = useDynamicWidgetData(builderConfig);

SONRA:
  const { filters } = useGlobalFilters();
  const { data, rawData, isLoading, error, refetch } = useDynamicWidgetData(builderConfig, filters);
```

Bu değişiklik ile tüm Builder widget'ları (KPI, Bar, Pie, Custom Code dahil) global filtrelere tepki verecek.

### 3.2 useDynamicWidgetData - Veri Zenginleştirme (Data Enrichment)

**Dosya:** `src/hooks/useDynamicWidgetData.tsx`

Eğer veri kaynağı `cari_vade_bakiye` gibi filtrelenebilir alanları içermiyorsa, `Cari Kart Listesi` verileriyle otomatik zenginleştirme yapılacak:

```typescript
// Veri zenginleştirme - cari verilerini join et
function enrichWithCariData(data: any[], cariData: any[]): any[] {
  if (!cariData || cariData.length === 0) return data;
  
  const cariMap = new Map(cariData.map(c => [
    c.carikartkodu || c._key,
    {
      satiselemani: c.satiselemani,
      ozelkod1kod: c.ozelkod1kod,
      ozelkod2kod: c.ozelkod2kod,
      ozelkod3kod: c.ozelkod3kod,
      carikarttipi: c.carikarttipi,
      sehir: c.sehir,
      potansiyel: c.potansiyel,
      durum: c.durum,
    }
  ]));
  
  return data.map(row => {
    const cariKey = row.carikartkodu || row._key_scf_carikart;
    const cariInfo = cariMap.get(cariKey);
    return cariInfo ? { ...row, ...cariInfo } : row;
  });
}
```

### 3.3 GlobalFilterBar - Filtre Yönetimi UI

**Dosya:** `src/components/filters/GlobalFilterBar.tsx`

Yeni özellikler:
- Hızlı arama kaldırılacak
- Filtre ekle/kaldır butonu (+ ⚙️ ikonu)
- Filtre seçim modalı

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📅 Bu Ay ▼ │ 👤 Temsilci ▼ │ 🏷️ AL/AS/ST │ +Filtre │ ✕ Temizle │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼ (+Filtre tıklandığında)
┌─────────────────────────────────────────────────────────────────────┐
│  Görünür Filtreleri Seç                                    [Kaydet] │
├─────────────────────────────────────────────────────────────────────┤
│  📅 Tarih Aralığı              [🔒 Zorunlu - Kaldırılamaz]          │
│  [✓] Satış Temsilcisi                                               │
│  [✓] Cari Kart Tipi (AL/AS/ST)                                      │
│  [ ] Şube                                                           │
│  [ ] Depo                                                           │
│  [ ] Özel Kod 1                                                     │
│  [ ] Özel Kod 2                                                     │
│  [ ] Özel Kod 3                                                     │
│  [ ] Şehir                                                          │
│  [ ] Durum (Aktif/Pasif)                                            │
│  [ ] Görünüm Modu (Potansiyel/Cari)                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.4 Yeni Hook: useFilterPreferences

**Dosya:** `src/hooks/useFilterPreferences.tsx`

```typescript
interface FilterPreferences {
  visibleFilters: string[];
  filterOrder: string[];
}

function useFilterPreferences() {
  // Kullanıcının filtre tercihlerini yükle/kaydet
  const loadPreferences = async (): Promise<FilterPreferences>;
  const savePreferences = async (prefs: FilterPreferences): Promise<void>;
  
  return { preferences, isLoading, savePreferences };
}
```

### 3.5 Yeni Bileşen: FilterManagerModal

**Dosya:** `src/components/filters/FilterManagerModal.tsx`

Kullanıcının hangi filtreleri göreceğini seçtiği modal:

```typescript
interface FilterManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilters: string[];
  onSave: (filters: string[]) => void;
}
```

---

## Bölüm 4: AI Kod Kurallarına Global Filtre Ekleme

### 4.1 ai-code-generator System Prompt Güncelleme

**Dosya:** `supabase/functions/ai-code-generator/index.ts`

Mevcut system prompt'a eklenecek bölüm:

```text
═══════════════════════════════════════════════════════════════════════════════

🔍 GLOBAL FİLTRE SİSTEMİ
───────────────────────────────────────────────────────────────────────────────

Widget'a "filters" prop'u da geçilir. Bu prop aktif global filtreleri içerir:

function Widget({ data, colors, filters }) {
  // filters objesi örneği:
  // {
  //   tarihAraligi: { period: 'this_month', field: 'tarih' },
  //   satisTemsilcisi: ['Ali Yılmaz'],
  //   ozelkod2: ['VIP'],
  //   cariKartTipi: ['AL', 'AS'],
  //   searchTerm: ''
  // }

  // NOT: "data" zaten filtrelenmiş olarak gelir!
  // Widget içinde tekrar filtreleme YAPMA.
  // "filters" prop'unu sadece hangi filtrelerin aktif olduğunu
  // göstermek için kullan (opsiyonel bilgi gösterimi).
}

ZORUNLU İMZA (Güncellendi):
  function Widget({ data, colors, filters })

═══════════════════════════════════════════════════════════════════════════════
```

### 4.2 BuilderWidgetRenderer - filters Prop'unu Custom Widget'lara Geç

**Dosya:** `src/components/dashboard/BuilderWidgetRenderer.tsx`

```typescript
// Mevcut (Satır 398-408):
const fn = new Function(
  'React',
  'data',
  'LucideIcons',
  'Recharts',
  'colors',
  customCode
);
const WidgetComponent = fn(React, filteredData, LucideIcons, RechartsScope, userColors);

// Yeni - filters ekleniyor:
const fn = new Function(
  'React',
  'data',
  'LucideIcons',
  'Recharts',
  'colors',
  'filters',  // YENİ
  customCode
);
const WidgetComponent = fn(React, filteredData, LucideIcons, RechartsScope, userColors, filters);
```

---

## Bölüm 5: Yetki Kodu (Lock Gösterimi)

Yetki kodu aktif ise GlobalFilterBar'da görsel lock gösterimi:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📅 Bu Ay │ 🔒 Temsilci: Ali Yılmaz │ 🏷️ AL/AS/ST │ +Filtre │      │
└─────────────────────────────────────────────────────────────────────┘
            ↑ Kilitli - tıklanamaz, değiştirilemez
```

Bu zaten `_diaAutoFilters` ile destekleniyor, sadece UI'da gösterim eklenmeli.

---

## Bölüm 6: Dosya Değişiklikleri Özeti

### Yeni Dosyalar
| Dosya | Açıklama |
|-------|----------|
| `src/hooks/useFilterPreferences.tsx` | Kullanıcı filtre tercihleri hook'u |
| `src/components/filters/FilterManagerModal.tsx` | Filtre seçim modalı |

### Güncellenecek Dosyalar
| Dosya | Değişiklik |
|-------|------------|
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | useGlobalFilters kullanımı, filters prop'u geçirme |
| `src/hooks/useDynamicWidgetData.tsx` | Veri zenginleştirme (cari join), globalFilters kullanımı |
| `src/components/filters/GlobalFilterBar.tsx` | Hızlı arama kaldırma, filtre yönetimi butonu ekleme |
| `supabase/functions/ai-code-generator/index.ts` | filters prop dokümantasyonu |

### Veritabanı
| Migrasyon | Açıklama |
|-----------|----------|
| `user_filter_preferences` tablosu | Kullanıcı filtre tercihleri |

---

## Bölüm 7: Uygulama Sırası

### Faz 1: Kritik Düzeltme (Nakit Akış Tepkisi)
1. `BuilderWidgetRenderer.tsx` - `useGlobalFilters` entegrasyonu
2. `useDynamicWidgetData.tsx` - `globalFilters` parametresini kullan

### Faz 2: Veri Zenginleştirme
3. `useDynamicWidgetData.tsx` - Cari verilerle join (enrichWithCariData)

### Faz 3: Filtre Yönetimi UI
4. Veritabanı migrasyonu: `user_filter_preferences`
5. `useFilterPreferences.tsx` hook'u oluştur
6. `FilterManagerModal.tsx` bileşeni oluştur
7. `GlobalFilterBar.tsx` güncelle (hızlı arama kaldır, +Filtre butonu)

### Faz 4: AI Entegrasyonu
8. `ai-code-generator/index.ts` - filters prop dokümantasyonu
9. `BuilderWidgetRenderer.tsx` - Custom widget'lara filters geçir

---

## Bölüm 8: Teknik Detaylar

### 8.1 Mevcut Filtre Operatörleri
`applyGlobalFilters` fonksiyonu şu alanları destekliyor:
- `searchTerm` - Metin arama (tüm alanlarda)
- `cariKartTipi` - AL, AS, ST
- `satisTemsilcisi` - Satış elemanı
- `sube` - Şube kodu
- `depo` - Depo kodu
- `ozelkod1/2/3` - Özel kodlar
- `sehir` - Şehir
- `durum` - Aktif/Pasif
- `gorunumModu` - Potansiyel/Cari
- `_diaAutoFilters` - Zorunlu kilitli filtreler

### 8.2 Veri Zenginleştirme Mantığı

```text
┌───────────────────┐     ┌───────────────────┐
│ Cari_vade_bakiye  │     │ Cari Kart Listesi │
│ (vade hareketleri)│     │ (metadata)        │
├───────────────────┤     ├───────────────────┤
│ carikartkodu      │◄────│ carikartkodu      │
│ toplambakiye      │     │ satiselemani      │
│ __borchareketler  │     │ ozelkod1kod       │
└───────────────────┘     │ carikarttipi      │
         │                │ sehir             │
         │                └───────────────────┘
         ▼
┌───────────────────────────────────────┐
│ Zenginleştirilmiş Veri                │
│ (Filtrelenebilir alanlar eklendi)     │
├───────────────────────────────────────┤
│ carikartkodu, toplambakiye,           │
│ __borchareketler, satiselemani,       │
│ ozelkod1kod, carikarttipi, sehir...   │
└───────────────────────────────────────┘
```

### 8.3 Filtre Tercihleri Varsayılanları

```typescript
const DEFAULT_VISIBLE_FILTERS = [
  'tarihAraligi',       // Zorunlu - kaldırılamaz
  'satisTemsilcisi',
  'cariKartTipi',
];

const ALL_AVAILABLE_FILTERS = [
  { key: 'tarihAraligi', label: 'Tarih Aralığı', locked: true },
  { key: 'satisTemsilcisi', label: 'Satış Temsilcisi' },
  { key: 'cariKartTipi', label: 'Cari Kart Tipi' },
  { key: 'sube', label: 'Şube' },
  { key: 'depo', label: 'Depo' },
  { key: 'ozelkod1', label: 'Özel Kod 1' },
  { key: 'ozelkod2', label: 'Özel Kod 2' },
  { key: 'ozelkod3', label: 'Özel Kod 3' },
  { key: 'sehir', label: 'Şehir' },
  { key: 'durum', label: 'Durum (Aktif/Pasif)' },
  { key: 'gorunumModu', label: 'Görünüm Modu' },
];
```
