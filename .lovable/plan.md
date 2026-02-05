
# Power BI Benzeri Veri Modeli İlişki Yönetimi Sistemi

## Genel Bakış

Power BI'ın Model View'ına benzer şekilde, veri kaynaklarını (Data Sources) görsel kartlar olarak gösteren ve aralarındaki ilişkileri sürükle-bırak ile kurabileceğiniz bir arayüz oluşturulacak. Bu yapı:
- Mevcut widget'ları etkilemeyecek (geriye uyumluluk)
- Yeni oluşturulan widget'lar otomatik olarak bu ilişkileri kullanacak
- Cross-filtering (çapraz filtreleme) için alan eşleştirmelerini görsel olarak yapabileceksiniz

---

## Teknik Mimari

### 1. Veritabanı Değişiklikleri

Yeni bir tablo oluşturulacak: `data_source_relationships`

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | Primary key |
| source_data_source_id | uuid | Kaynak veri kaynağı (FK) |
| target_data_source_id | uuid | Hedef veri kaynağı (FK) |
| source_field | text | Kaynak tablodaki alan |
| target_field | text | Hedef tablodaki alan |
| relationship_type | text | 'one_to_many', 'many_to_one', 'one_to_one' |
| cross_filter_direction | text | 'single', 'both', 'none' |
| is_active | boolean | Aktif/pasif |
| created_at | timestamptz | Oluşturulma tarihi |
| user_id | uuid | Oluşturan kullanıcı |

### 2. Bileşen Yapısı

```text
SuperAdminPanel
└── Tabs
    └── "Veri Modeli" (yeni sekme)
        └── DataModelView
            ├── DataModelCanvas (ana görsel alan)
            │   ├── DataSourceCard (sürüklenebilir kartlar)
            │   │   ├── Kart başlığı (veri kaynağı adı)
            │   │   ├── Alan listesi (scroll edilebilir)
            │   │   └── Bağlantı noktaları (connection points)
            │   └── RelationshipLine (bağlantı çizgileri - SVG)
            ├── RelationshipEditor (ilişki düzenleme modal)
            └── ModelToolbar (zoom, fit, layout düğmeleri)
```

### 3. Görsel Tasarım

Her veri kaynağı bir kart olarak görünecek:

```text
┌─────────────────────────────┐
│ 📊 Cari Kart Listesi    ... │  ← Kart başlığı + menü
├─────────────────────────────┤
│ 🔑 carikartkodu             │  ← Primary key (anahtar ikonu)
│    carikarttipi             │
│    cariunvan                │
│ Σ  bakiye                   │  ← Sayısal alanlar
│    satiselemani             │
│    ozelkod1kod              │
│    ...                      │
├─────────────────────────────┤
│ ↓ Daralt (15 daha)          │  ← Expand/collapse
└─────────────────────────────┘
```

İlişkiler çizgilerle gösterilecek:
- **1:N** → Tek çizgi + çoklu işaret
- **1:1** → Tek çizgi
- **Çift yönlü filtre** → Çift ok başlı çizgi

---

## Uygulama Detayları

### Dosya 1: Veritabanı Migration

```sql
-- Veri kaynakları arası ilişkiler
CREATE TABLE data_source_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  target_data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'one_to_many',
  cross_filter_direction TEXT NOT NULL DEFAULT 'single',
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_relationship UNIQUE (source_data_source_id, target_data_source_id, source_field, target_field)
);

-- RLS politikaları
ALTER TABLE data_source_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read relationships" 
  ON data_source_relationships FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Super admins can manage relationships"
  ON data_source_relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Kart pozisyonlarını saklamak için data_sources tablosuna ekleme
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS model_position JSONB;
```

### Dosya 2: Hook - useDataSourceRelationships

Konum: `src/hooks/useDataSourceRelationships.tsx`

```typescript
// Veri kaynağı ilişkilerini yönetir
interface DataSourceRelationship {
  id: string;
  sourceDataSourceId: string;
  targetDataSourceId: string;
  sourceField: string;
  targetField: string;
  relationshipType: 'one_to_many' | 'many_to_one' | 'one_to_one';
  crossFilterDirection: 'single' | 'both' | 'none';
  isActive: boolean;
}

// CRUD işlemleri ve React Query entegrasyonu
```

### Dosya 3: DataModelView Ana Bileşeni

Konum: `src/components/admin/DataModelView.tsx`

Özellikler:
- Canvas üzerinde sürüklenebilir veri kaynağı kartları
- Alanlar arasında bağlantı çizgileri (SVG path)
- Zoom in/out, pan, fit-to-view
- Kart pozisyonlarını veritabanına kaydetme

### Dosya 4: DataSourceCard Bileşeni

Konum: `src/components/admin/DataSourceCard.tsx`

- Kart başlığı: veri kaynağı adı + metot bilgisi
- Alan listesi: `last_fields` array'inden çekilecek
- Bağlantı noktaları: her alanın yanında küçük daire
- Sürükle-bırak: @dnd-kit kullanarak pozisyon değişikliği

### Dosya 5: RelationshipLine Bileşeni

Konum: `src/components/admin/RelationshipLine.tsx`

- SVG path ile iki kart arasında çizgi
- Bezier eğrisi kullanarak estetik görünüm
- İlişki tipine göre farklı stil (1:N, 1:1)
- Çizgiye tıklanınca düzenleme modalı

### Dosya 6: RelationshipEditor Modal

Konum: `src/components/admin/RelationshipEditor.tsx`

- Kaynak/hedef alan seçimi (aranabilir dropdown)
- İlişki tipi seçimi (1:N, N:1, 1:1)
- Çapraz filtre yönü seçimi (tek yön, çift yön, kapalı)
- Aktif/pasif toggle

---

## Mevcut Widget'larla Uyumluluk

### Geriye Dönük Uyumluluk

Mevcut widget'lar `builder_config.multiQuery.merges` ve `builder_config.affectedByFilters` alanlarını kullanmaya devam edecek. Bu değişiklikler:

1. **Eski widget'lar**: Mevcut yapılandırma korunur, hiçbir değişiklik gerekmez
2. **Yeni widget'lar**: İlişki tanımlıysa, widget oluşturulurken otomatik olarak `affectedByFilters` doldurulabilir

### İlişkilerin Widget'lara Uygulanması

`useDynamicWidgetData` hook'u, widget'ın bağlı olduğu veri kaynakları için tanımlı ilişkileri okuyacak ve:
- Cross-filter aktifse, ilgili global filtre değerlerini otomatik uygulayacak
- Multi-query merge'lerde ilişki alanlarını önerecek

---

## Ekran Akışı

```text
1. Kullanıcı "Veri Modeli" sekmesine tıklar
                ↓
2. Canvas yüklenir, mevcut veri kaynakları kart olarak gösterilir
                ↓
3. Kullanıcı bir alanın yanındaki bağlantı noktasını sürükler
                ↓
4. Hedef karttaki alana bırakır
                ↓
5. İlişki düzenleme modalı açılır
   - İlişki tipi seçimi
   - Çapraz filtre yönü seçimi
                ↓
6. "Kaydet" → İlişki çizgisi gösterilir + veritabanına kaydedilir
```

---

## Değiştirilecek/Oluşturulacak Dosyalar

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `supabase/migrations/xxx_add_relationships.sql` | Yeni | İlişkiler tablosu |
| `src/hooks/useDataSourceRelationships.tsx` | Yeni | İlişki CRUD hook'u |
| `src/components/admin/DataModelView.tsx` | Yeni | Ana görsel bileşen |
| `src/components/admin/DataSourceCard.tsx` | Yeni | Sürüklenebilir kart |
| `src/components/admin/RelationshipLine.tsx` | Yeni | SVG bağlantı çizgisi |
| `src/components/admin/RelationshipEditor.tsx` | Yeni | İlişki düzenleme modal |
| `src/pages/SuperAdminPanel.tsx` | Güncelleme | "Veri Modeli" sekmesi ekleme |
| `src/hooks/useDataSources.tsx` | Güncelleme | `model_position` alanı desteği |

---

## Teknik Notlar

1. **Canvas Kütüphanesi**: React Flow yerine manuel SVG + @dnd-kit kullanılacak (mevcut proje pattern'i)
2. **Performans**: Lazy loading ile sadece görünür alanlar render edilecek
3. **Pozisyon Kaydetme**: Debounced (1sn) olarak veritabanına kaydedilecek
4. **Responsive**: Minimum 1024px genişlik gerektirir (mobilde uyarı gösterilir)

---

## Sonraki Adımlar

1. Migration dosyası oluştur ve tabloyu aktif et
2. Hook'u implement et
3. Görsel bileşenleri oluştur
4. SuperAdminPanel'e entegre et
5. Test ve iyileştirmeler
