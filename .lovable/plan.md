
# Widget Düzenleme Aracı - Kapsamlı Yeniden Tasarım Planı

## Özet
Widget Builder ve CustomCodeWidgetBuilder bileşenlerini tam kapsamlı bir düzenleme aracına dönüştürmek için aşağıdaki değişiklikler yapılacak.

---

## Bölüm 1: Tespit Edilen Sorunlar ve Çözümler

### 1.1 İkonların Konumu
**Sorun:** İkonlar şu an "Ayarlar" sekmesinde ikon dropdown içinde.
**Çözüm:** İkonları en sona (kaydet butonlarının yanına) taşıyacağız. İsteğe bağlı ekleme butonu olacak.

### 1.2 Boyutlar - Önizleme ve Çoklu Seçim
**Sorun:** Boyut seçimi tek seçim (dropdown).
**Çözüm:** Boyutları görsel kartlar halinde göstereceğiz. Her kart tıklanabilir önizleme içerecek. Çoklu boyut seçimi desteklenecek (varsayılan + alternatif boyutlar).

### 1.3 Sayfa Ataması
**Sorun:** Sayfa seçimi en üstte.
**Çözüm:** Sayfa atamasını en sona alacağız. ComboBox ile birden fazla sayfaya eklenebilir olacak.

### 1.4 Veri Sekmesinde "Mevcut Alanlar"
**Sorun:** Veri kaynağı seçim alanında "Mevcut Alanlar" bölümü gereksiz gösteriliyor.
**Çözüm:** "Mevcut Alanlar" kısmını kaldıracağız.

### 1.5 Birleştirilmiş Alanlar Görselleştirmesi
**Sorun:** Birleştirilen sorguların sonucu net görünmüyor.
**Çözüm:** MultiQueryBuilder'da birleştirme sonucunu görsel bir diyagram şeklinde göstereceğiz:
```
[Cari Kart] ──LEFT JOIN──> [Vade Bakiye] = Zenginleştirilmiş Veri
     └─ carikartkodu ─────────┘
```

### 1.6 AI Kod Üret - Veri Analizi
**Sorun:** AI sekmesinde gereksiz "Veri Analizi" paneli var.
**Çözüm:** Veri Analizi panelini kaldıracağız. Yerine tüm sorgu alanlarını (birleşik sorgular dahil) liste halinde göstereceğiz.

### 1.7 Widget Düzenleme - Önizle ve Kaydet Çalışmıyor
**Sorun:** Mevcut widget düzenlerken önizleme ve kaydetme çalışmıyor.
**Kök Sebep:** `editingWidget` varken `sampleData` yüklenmiyor çünkü `fetchDataFromSource` fonksiyonu çağrılmıyor.
**Çözüm:** `useEffect` içinde düzenleme modunda otomatik veri çekme işlemi ekleyeceğiz.

### 1.8 Filtreleme Alanları Ekleme
**Sorun:** Widget'a hangi alanların filtrelenebileceği tanımlanamıyor.
**Çözüm:** Yeni bir "Filtreleme" sekmesi ekleyeceğiz. Kullanıcı tüm alanları görecek ve filtrelenebilir olanları seçebilecek. Seçilen filtreler widget'ın `available_filters` alanına kaydedilecek.

### 1.9 Global Filtrelere Otomatik Ekleme
**Sorun:** Widget'a eklenen yeni filtreler global filtre sistemine eklenmiyor.
**Çözüm:** Bir widget'a yeni bir filtre alanı eklendiğinde, eğer bu alan `ALL_AVAILABLE_FILTERS` listesinde yoksa, dinamik olarak global filtrelere ekleneceğiz.

---

## Bölüm 2: UI Düzeni Yeniden Tasarım

### 2.1 Yeni Sekme Sıralaması (WidgetBuilder)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [Şablonlar] [Veri] [Birleştir] [Hesapla] [Filtrele] [Tarih] [Görsel] [Kod] [Önizle]  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Değişiklikler:**
- "Ayarlar" sekmesi kaldırılacak
- Ayarlardaki alanlar (isim, açıklama) "Veri" sekmesine
- Ayarlardaki alanlar (ikon, boyut, sayfa) diyaloğun alt kısmına (footer) taşınacak

### 2.2 Dialog Footer Yeniden Tasarımı

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [İkon Seç ▼]  [Boyutlar: ⬚sm ⬜md ☑lg ⬜xl ⬜full]  [Sayfalar: + Ekle ▼]  │
│                                                                             │
│  [İptal]                                            [Varsayılan Widget ☐]  [Kaydet]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Boyut Seçici - Görsel Önizleme

Boyutları görsel kart sistemine çevireceğiz:

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Boyut Seç (Birden fazla seçebilirsiniz)                                  │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌───┐  ┌──────┐  ┌─────────┐  ┌────────────┐  ┌───────────────────────┐  │
│  │ S │  │  M   │  │    L    │  │     XL     │  │         Full          │  │
│  │   │  │      │  │         │  │            │  │                       │  │
│  └───┘  └──────┘  └─────────┘  └────────────┘  └───────────────────────┘  │
│   ☐       ☑         ☑            ☐               ☐                        │
│  Küçük   Orta      Büyük      Çok Büyük       Tam Genişlik               │
│  1 kolon 2 kolon   3 kolon     4 kolon         5 kolon                    │
└───────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Sayfa Ataması - Multi-Select ComboBox

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Sayfalar   [Dashboard ×] [Finans ×] [+ Ekle ▼]                             │
│                            ┌────────────────────┐                           │
│                            │ ☐ Satış            │                           │
│                            │ ☐ Cari Hesaplar    │                           │
│                            └────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bölüm 3: Birleştirilmiş Alanlar Görselleştirmesi

### 3.1 MergeVisualization Bileşeni

MultiQueryBuilder içinde birleştirme sonucunu görsel olarak göstereceğiz:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Birleştirme Sonucu                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐          ┌─────────────┐         ┌───────────────────────┐ │
│  │ Cari Kart   │    +     │ Vade Bakiye │    =    │ Zenginleştirilmiş     │ │
│  │ 15 alan     │  LEFT    │ 8 alan      │  ───►   │ Sonuç: 21 alan        │ │
│  │ 250 kayıt   │  JOIN    │ 180 kayıt   │         │ ~180 kayıt (tahmini)  │ │
│  └─────────────┘          └─────────────┘         └───────────────────────┘ │
│        │                         │                                          │
│        └─── carikartkodu ────────┘                                          │
│                                                                             │
│  Sonuç Alanları:                                                            │
│  [carikartkodu] [cariunvan] [satiselemani] [ozelkod1] [toplambakiye] ...   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bölüm 4: AI Kod Üret Sekmesi Yeniden Tasarım

### 4.1 Veri Analizi Paneli Kaldırılacak

Sağ taraftaki "Veri Analizi" paneli kaldırılacak. Yerine:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI ile Widget Kodu Üret                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐              │
│  │  Ne tür bir widget istediğinizi açıklayın...              │              │
│  │                                                           │              │
│  │  Örnek: Vade yaşlandırma grafiği oluştur. X ekseninde     │              │
│  │  vade dilimleri, Y ekseninde toplam bakiye göster...      │              │
│  │                                                           │              │
│  └───────────────────────────────────────────────────────────┘              │
│                                                                             │
│  [AI ile Kod Üret]                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  📋 Kullanılabilir Alanlar (tıkla prompt'a ekle)                            │
│                                                                             │
│  Ana Sorgu (Cari Kart):                                                     │
│  [carikartkodu] [cariunvan] [satiselemani] [toplambakiye] ...               │
│                                                                             │
│  Birleşik Sorgu (Vade Bakiye):                                              │
│  [carikartkodu] [vadetarihi] [borc] [alacak] [bakiye] ...                   │
│                                                                             │
│  Hesaplanan Alanlar:                                                        │
│  [aylik_toplam] [bakiye_yuzdesi] ...                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bölüm 5: Filtreleme Alanları Yönetimi

### 5.1 Yeni Sekme: "Widget Filtreleri"

WidgetBuilder'a yeni bir sekme ekleyeceğiz:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍 Widget Filtreleme Alanları                                              │
│  Bu widget hangi alanlara göre filtrelenebilsin?                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Mevcut Alanlar               Seçili Filtre Alanları                        │
│  ┌────────────────────────┐   ┌────────────────────────┐                    │
│  │ 🔍 Alan ara...          │   │                        │                    │
│  ├────────────────────────┤   │ ☑ satiselemani         │                    │
│  │ ○ carikartkodu         │   │   → Satış Temsilcisi   │                    │
│  │ ○ cariunvan            │   │                        │                    │
│  │ ● satiselemani  [+]    │   │ ☑ carikarttipi         │                    │
│  │ ● ozelkod1kod   [+]    │   │   → Kart Tipi          │                    │
│  │ ● carikarttipi  [+]    │   │                        │                    │
│  │ ○ toplambakiye         │   │ ☑ ozelkod1kod          │                    │
│  │ ○ sehir         [+]    │   │   → Özel Kod 1         │                    │
│  │ ...                    │   │                        │                    │
│  └────────────────────────┘   └────────────────────────┘                    │
│                                                                             │
│  ⚡ Not: Seçilen filtreler global filtre barında da görünecektir.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Global Filtrelere Otomatik Ekleme Mantığı

```typescript
// Widget kaydedilirken:
const newFilterFields = widgetFilterFields.filter(
  field => !ALL_AVAILABLE_FILTERS.some(f => f.key === field)
);

if (newFilterFields.length > 0) {
  // Bu alanları user_filter_preferences'a dinamik olarak ekle
  // veya widget bazında custom filter tanımı oluştur
}
```

---

## Bölüm 6: Düzenleme Modunda Veri Yükleme Sorunu

### 6.1 Kök Sebep

`CustomCodeWidgetBuilder.tsx` satır 279-330 arasında `editingWidget` kontrol ediliyor ama veri kaynağından veri çekme işlemi yapılmıyor.

### 6.2 Çözüm

```typescript
// useEffect içinde düzenleme modunda otomatik veri yükleme
useEffect(() => {
  if (editingWidget && open) {
    // ... mevcut config yükleme kodu ...
    
    // VERİ YÜKLEME EKLENMELİ:
    if (config?.dataSourceId && !sampleData.length) {
      const ds = getDataSourceById(config.dataSourceId);
      if (ds) {
        if (ds.last_sample_data) {
          setSampleData(ds.last_sample_data as any[]);
        } else {
          // API'den veri çek
          fetchDataFromSource(ds);
        }
      }
    }
  }
}, [editingWidget, open]);
```

---

## Bölüm 7: Dosya Değişiklikleri Özeti

### Yeni Bileşenler

| Dosya | Açıklama |
|-------|----------|
| `src/components/admin/WidgetSizeSelector.tsx` | Görsel boyut seçici |
| `src/components/admin/WidgetPageSelector.tsx` | Multi-select sayfa seçici |
| `src/components/admin/WidgetFilterFieldsBuilder.tsx` | Filtreleme alanları seçici |
| `src/components/admin/MergeResultVisualization.tsx` | Birleştirme sonuç görselleştirmesi |

### Güncellenecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/admin/WidgetBuilder.tsx` | UI yeniden düzenleme, sekme kaldırma, footer tasarımı |
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | Veri yükleme düzeltmesi, AI sekmesi yeniden tasarım |
| `src/components/admin/MultiQueryBuilder.tsx` | Birleştirme sonucu görselleştirmesi ekleme |
| `src/components/admin/DataSourceSelector.tsx` | "Mevcut Alanlar" kaldırma |
| `src/hooks/useFilterPreferences.tsx` | Dinamik filtre alanı ekleme desteği |
| `src/lib/widgetTypes.ts` | `available_sizes` ve `target_pages` alanları ekleme |

### Veritabanı Değişiklikleri

```sql
-- Widget'ın birden fazla boyutu desteklemesi için
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS available_sizes TEXT[] DEFAULT ARRAY['md'];

-- Widget'ın birden fazla sayfada görünmesi için
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS target_pages TEXT[] DEFAULT ARRAY['dashboard'];

-- Widget bazlı custom filter tanımları
CREATE TABLE IF NOT EXISTS widget_filter_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT DEFAULT 'string',
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Bölüm 8: Uygulama Sırası

### Faz 1: Kritik Düzeltmeler
1. `CustomCodeWidgetBuilder.tsx` - Düzenleme modunda veri yükleme sorunu
2. `DataSourceSelector.tsx` - "Mevcut Alanlar" kaldırma

### Faz 2: UI Yeniden Düzenleme
3. `WidgetSizeSelector.tsx` - Görsel boyut seçici bileşeni
4. `WidgetPageSelector.tsx` - Multi-select sayfa seçici
5. `WidgetBuilder.tsx` - Footer tasarımı ve sekme düzenlemesi

### Faz 3: Birleştirme Görselleştirmesi
6. `MergeResultVisualization.tsx` - Birleştirme sonucu gösterimi
7. `MultiQueryBuilder.tsx` - Görselleştirme entegrasyonu

### Faz 4: AI Sekmesi İyileştirmesi
8. `CustomCodeWidgetBuilder.tsx` - AI sekmesi yeniden tasarım (Veri Analizi kaldırma)

### Faz 5: Filtreleme Sistemi
9. Veritabanı migrasyonu: `widget_filter_fields` tablosu
10. `WidgetFilterFieldsBuilder.tsx` - Filtre alanları seçici
11. `useFilterPreferences.tsx` - Dinamik filtre ekleme
12. `WidgetBuilder.tsx` - Filtreleme sekmesi entegrasyonu

---

## Bölüm 9: Teknik Detaylar

### 9.1 Boyut Seçici Bileşeni

```typescript
interface WidgetSizeSelectorProps {
  selectedSizes: WidgetSize[];
  defaultSize: WidgetSize;
  onChange: (sizes: WidgetSize[], defaultSize: WidgetSize) => void;
}

// Kullanım
<WidgetSizeSelector
  selectedSizes={['md', 'lg']}
  defaultSize="lg"
  onChange={(sizes, def) => {
    setAvailableSizes(sizes);
    setWidgetSize(def);
  }}
/>
```

### 9.2 Sayfa Seçici Bileşeni

```typescript
interface WidgetPageSelectorProps {
  selectedPages: WidgetCategory[];
  defaultPage: WidgetCategory;
  onChange: (pages: WidgetCategory[], defaultPage: WidgetCategory) => void;
}
```

### 9.3 Birleştirme Sonucu Görselleştirmesi

```typescript
interface MergeResultVisualizationProps {
  queries: DiaApiQuery[];
  merges: QueryMerge[];
  mergedData: Record<string, any[]>;
}

// Bileşen çıktısı:
// - Sol sorgu kartı (alan sayısı, kayıt sayısı)
// - Birleştirme operatörü (LEFT JOIN, UNION vb.)
// - Sağ sorgu kartı
// - Sonuç kartı (birleşik alan sayısı, tahmini kayıt sayısı)
// - Birleşim alanı gösterimi (ok ile)
```

### 9.4 Widget Filter Fields Builder

```typescript
interface WidgetFilterFieldsBuilderProps {
  availableFields: string[];
  selectedFields: string[];
  fieldLabels: Record<string, string>;
  onChange: (fields: string[], labels: Record<string, string>) => void;
}
```
