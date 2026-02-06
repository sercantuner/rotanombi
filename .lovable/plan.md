
# Widget Kategori → Etiket (Tag) Dönüşüm Planı

## Mevcut Durum

Şu anda widget'lar **tek bir kategoriye** bağlı:
- `widgets` tablosunda `category` kolonu (TEXT, NOT NULL)
- `default_page` kolonu (category ile aynı değer)
- `widget_categories` tablosu kategorileri tanımlıyor

Bu yapı widget'ların yalnızca bir kategoride görünmesini sağlıyor. Etiket sistemine geçişle widget'lar **birden fazla etikete** sahip olabilecek.

---

## Yeni Mimari

### Veritabanı Değişiklikleri

1. **Yeni Tablo: `widget_tags`** (Many-to-Many ilişki tablosu)

```text
+-------------------+
| widget_tags       |
+-------------------+
| id (UUID, PK)     |
| widget_id (FK)    |
| category_id (FK)  |
| created_at        |
+-------------------+
```

2. **`widgets` Tablosu Değişiklikleri**
   - `category` kolonu: Kaldırılmayacak, varsayılan/ana etiket olarak kalacak (geriye uyumluluk)
   - `default_page`: Varsayılan sayfa olarak kullanılmaya devam edecek

3. **`widget_categories` Tablosu**
   - Değişiklik yok, etiket tanımları burada kalacak
   - Terminoloji: "Kategori" yerine "Etiket" olarak gösterilecek

---

## Etkilenen Dosyalar ve Değişiklikler

### 1. Veritabanı Migrasyon
```text
Yeni Tablo: widget_tags
  - widget_id (UUID, FK -> widgets.id, ON DELETE CASCADE)
  - category_id (UUID, FK -> widget_categories.id, ON DELETE CASCADE)
  - UNIQUE(widget_id, category_id)
  - RLS politikaları
```

### 2. Tip Tanımları
**Dosya:** `src/lib/widgetTypes.ts`
- `Widget` interface'ine `tags?: string[]` eklenmeli
- `WidgetFormData` interface'ine `tags?: string[]` eklenmeli
- `WidgetCategory` tipi `WidgetTag` olarak yeniden adlandırılmalı (veya alias)

### 3. Hook Güncellemeleri

**Dosya:** `src/hooks/useWidgetCategories.tsx`
- Hook adı: `useWidgetTags` olarak değiştirilmeli (veya alias eklenmeli)
- Terminoloji: "Kategori" -> "Etiket"
- Export'lar: `WidgetTag`, `WidgetTagFormData` alias'ları

**Dosya:** `src/hooks/useWidgets.tsx`
- Widget çekerken `widget_tags` tablosundan etiketleri JOIN etmeli
- `createWidget` ve `updateWidget` fonksiyonları çoklu etiket kaydetmeli
- `getWidgetsByCategory` -> `getWidgetsByTag` + çoklu etiket desteği

### 4. Admin Bileşenleri

**Dosya:** `src/components/admin/CategoryManager.tsx`
- Başlık: "Kategori Yönetimi" -> "Etiket Yönetimi"
- Terminoloji güncellemeleri

**Dosya:** `src/components/admin/CategoryPickerModal.tsx`
- Çoklu seçim (multi-select) desteği eklenmeli
- Seçili etiketler badge olarak gösterilmeli
- `onSelect` prop'u: `string` -> `string[]`

**Dosya:** `src/components/admin/WidgetPageSelector.tsx`
- `selectedCategory` -> `selectedTags` (string[])
- `onCategoryChange` -> `onTagsChange` (string[] => void)
- Çoklu etiket seçim arayüzü

**Dosya:** `src/components/admin/CustomCodeWidgetBuilder.tsx`
- `widgetCategory` state'i -> `widgetTags` (string[])
- Etiket seçim butonunda çoklu seçim badge'leri
- Form kaydetme: `widget_tags` tablosuna ekleme

### 5. Dashboard Bileşenleri

**Dosya:** `src/components/dashboard/WidgetMarketplace.tsx`
- Kategori filtreleme: Widget'ın herhangi bir etiketi seçili etikete eşleşmeli
- `w.category === selectedCategory` -> `w.tags?.includes(selectedCategory)`
- Sayaçlar: Etiket bazlı widget sayıları

**Dosya:** `src/components/admin/WidgetPermissionsPanel.tsx`
- Etiket filtreleme güncellemesi

**Dosya:** `src/components/admin/ExampleWidgetPickerModal.tsx`
- Etiket bazlı gruplama

**Dosya:** `src/components/admin/SuperAdminWidgetManager.tsx`
- Etiket filtreleme ve gösterim

---

## Uygulama Adımları

### Adim 1: Veritabanı Migrasyon
1. `widget_tags` tablosu oluştur
2. Mevcut `widgets.category` verilerini `widget_tags` tablosuna aktar
3. RLS politikaları ekle

### Adim 2: Hook'ları Güncelle
1. `useWidgetCategories` -> `useWidgetTags` alias
2. `useWidgets` hook'una JOIN ve çoklu etiket desteği

### Adim 3: Picker Bileşenlerini Güncelle
1. `CategoryPickerModal` -> Çoklu seçim modu
2. `WidgetPageSelector` -> Çoklu etiket seçimi

### Adim 4: Builder Güncelle
1. `CustomCodeWidgetBuilder` çoklu etiket state'i
2. Kaydetme mantığı güncelleme

### Adim 5: Marketplace ve Filtreleme
1. `WidgetMarketplace` etiket bazlı filtreleme
2. Diğer admin panelleri

### Adim 6: Terminoloji Değişiklikleri
1. UI metinlerinde "Kategori" -> "Etiket"
2. Başlıklar ve açıklamalar

---

## Teknik Detaylar

### Widget Tags Tablosu SQL
```sql
CREATE TABLE widget_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES widget_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(widget_id, category_id)
);

-- RLS
ALTER TABLE widget_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Herkes okuyabilir" ON widget_tags FOR SELECT USING (true);
CREATE POLICY "Admin ekleyebilir" ON widget_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
);
```

### Veri Migrasyon
```sql
-- Mevcut category değerlerini widget_tags'e aktar
INSERT INTO widget_tags (widget_id, category_id)
SELECT w.id, wc.id
FROM widgets w
JOIN widget_categories wc ON wc.slug = w.category;
```

### Widget Çekme Query Değişikliği
```typescript
// Eski
const { data } = await supabase.from('widgets').select('*');

// Yeni
const { data } = await supabase
  .from('widgets')
  .select(`
    *,
    widget_tags!inner (
      category_id,
      widget_categories!inner (slug, name, icon)
    )
  `);
```

---

## Geriye Uyumluluk

- `widgets.category` kolonu korunacak (ana/varsayılan etiket)
- Mevcut `default_page` mantığı değişmeyecek
- Eski API'ler çalışmaya devam edecek

---

## Test Planı

1. Yeni widget oluşturma - çoklu etiket seçimi
2. Mevcut widget düzenleme - etiket ekleme/çıkarma
3. Widget Marketplace - etiket filtreleme
4. Etiket yönetimi - CRUD işlemleri
5. Geriye uyumluluk - eski widget'lar düzgün görüntülenmeli
