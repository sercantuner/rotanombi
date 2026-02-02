
## Widget Düzenleme Paneli İyileştirmeleri

### Tespit Edilen Sorunlar

**1. Örnek Widget Seç Listesi:**
Mevcut `customWidgetTemplates` filtresi `useWidgets()` hook'undan gelen `widgets` dizisini kullanıyor. Bu dizi:
- Modal açılırken henüz yüklenmemiş olabilir (`isLoading` true)
- Veritabanındaki tüm widget'ları çekiyor ancak listeleme sırasında `builder_config && 'customCode' in builder_config` şartını uyguluyor

**Çözüm:** Widget listesini doğrudan veritabanından (Supabase'den) çekmeli ve ayrı bir loading state ile yönetmeliyiz.

**2. Vade Yaşlandırma Widget'ı:**
- Widget veritabanında mevcut (`grafik_vade_yaslandirma`)
- Datasource (`Cari_vade_bakiye`) tanımlı
- Container'lara atanmış ve `dbWidget` prop'u gönderiliyor

Olası sorunlar:
- Datasource verisi dönmüyor
- Global filtrelerle uyumsuzluk
- Cache meselesi

---

### Planlanan Değişiklikler

#### Adım 1: Örnek Widget Listesini Veritabanından Çekme
`CustomCodeWidgetBuilder.tsx` bileşeninde:

1. Yeni bir `useEffect` ile veritabanından aktif widget'ları doğrudan çek
2. Filtreleme: `is_active = true` ve `builder_config->>'customCode' IS NOT NULL`
3. Kendi `isLoading` ve `error` state'leriyle yönet
4. Düzenlenen widget'ı (`editingWidget?.id`) listeden hariç tut

```text
┌──────────────────────────────────────────────────────┐
│                Örnek Widget Seç                      │
├──────────────────────────────────────────────────────┤
│  [Arama inputu - opsiyonel]                         │
├──────────────────────────────────────────────────────┤
│  📊 Vade Yaşlandırma                                │
│  📊 Çek Yaşlandırma                                 │
│  📊 Banka Bakiyeleri                                │
│  📊 Cari Sektör Dağılımı                            │
│  📊 Kasa Bakiyeleri                                 │
│  📊 Eksi Stok Bildirimi                             │
│  📊 Geciken Siparişler                              │
│  📊 Cari Kaynak Dağılımı                            │
│  ... (scroll)                                        │
├──────────────────────────────────────────────────────┤
│  Toplam: X widget                                    │
└──────────────────────────────────────────────────────┘
```

#### Adım 2: Vade Yaşlandırma Hata Ayıklama
- `BuilderWidgetRenderer` içinde hata/veri durumunu konsola loglama
- Datasource fetch'in başarılı olup olmadığını kontrol
- Eğer veri yoksa "Veri bulunamadı" mesajı göster

---

### Teknik Detaylar

**Dosya Değişiklikleri:**

1. **`src/components/admin/CustomCodeWidgetBuilder.tsx`**
   - `customWidgetTemplates` useMemo yerine doğrudan supabase sorgusu ile widget listesi çekme
   - Yeni `exampleWidgets` state'i ve `isLoadingExamples` loading state'i
   - Collapsible açıldığında lazy loading
   - Toplam widget sayısı gösterimi

2. **Vade Yaşlandırma Debug:**
   - `useDynamicWidgetData` hook'unda debug loglama
   - `BuilderWidgetRenderer`'da error state kontrolü

**Veritabanı Sorgusu:**
```sql
SELECT id, widget_key, name, icon, builder_config
FROM widgets
WHERE is_active = true
  AND builder_config->>'customCode' IS NOT NULL
ORDER BY name ASC
```
