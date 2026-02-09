

## Widget Filtre Seceneklerinin Otomatik Doldurulmasi

### Sorun

Widget filtreleri (ornegin "Kullanici", "Satis Elemani", "Sube") `multi-select` tipinde tanimlanmis ancak `options` dizisi bos veya tanimlanmamis. Bu nedenle filtre popover'i acildiginda sadece etiket gorunuyor, secim yapilacak hicbir oge yok.

### Cozum

Widget'in gercek verisinden (rawData) benzersiz degerleri cikararak bos `options` dizilerini otomatik doldurmak. Ayrica `DynamicWidgetRenderer`'daki hardcoded filtre kilitlemesini kaldirmak.

### Degisecek Dosyalar

**1. `src/components/dashboard/BuilderWidgetRenderer.tsx`**
- Props arayuzune `onDataLoaded?: (data: any[]) => void` callback eklenmesi
- `rawData` degistikce (ve bos degilse) bu callback'in cagirilmasi (`useEffect` ile)

**2. `src/components/dashboard/DynamicWidgetRenderer.tsx`**
- Satir 96-113 arasindaki hardcoded `builderWidgetFilters` mantigi kaldirilacak
- `widgetFilters` oldugu gibi (as-is) `BuilderWidgetRenderer`'a iletilecek
- Yeni `onDataLoaded` prop'u `BuilderWidgetRenderer`'a gecilecek

**3. `src/components/pages/ContainerRenderer.tsx`**
- Her slot icin `widgetRawData` state'i (Record<string, any[]>) tutulmasi
- `DynamicWidgetRenderer`'a `onDataLoaded` callback'i eklenmesi - veri yuklendikce state guncellenir
- `WidgetFiltersButton`'a `widgetData` prop'u olarak ilgili slot'un verisini gecmek

**4. `src/components/dashboard/WidgetFiltersButton.tsx`**
- Props arayuzune `widgetData?: any[]` eklenmesi
- `DynamicField` bileseninde `resolvedOptions` hesaplamasi:
  - `def.options` doluysa: mevcut options kullanilir (degisiklik yok)
  - `def.options` bos/undefined VE `widgetData` mevcutsa: `widgetData` icerisinden `def.key` alanindaki benzersiz (unique) degerler cikarilir, `{ value, label }` formatina donusturulur
  - null/undefined/bos degerler filtrelenir, alfabetik siralanir
- 5'ten fazla secenek varsa arama kutusu (search input) gosterilmesi
- `multi-select` ve `dropdown` tipleri icin resolvedOptions kullanilmasi

### Teknik Akis

```text
BuilderWidgetRenderer
  |-- useDynamicWidgetData() -> rawData
  |-- useEffect: rawData degisince onDataLoaded(rawData) cagir
  |
  v
ContainerRenderer
  |-- widgetRawData state (Record<slotId, any[]>)
  |-- onDataLoaded callback ile state guncelle
  |
  v
WidgetFiltersButton (widgetData prop)
  |
  v
DynamicField
  |-- def.options bos mu?
  |     Evet -> widgetData'dan unique degerler cikar
  |     Hayir -> mevcut options kullan
  |-- 5+ secenek -> arama kutusu goster
```

### Beklenen Sonuc

- Filtre popover'i acildiginda, widget verisinden cikarilan gercek degerler (sube adlari, kullanici adlari, satis elemanlari vb.) secim listesi olarak gorunecek
- Kullanici secim yapabilecek ve widget verisi buna gore filtrelenecek
- Statik options tanimlanmis filtreler icin davranis degismeyecek
- Filtre butonu her zaman gorunur kalacak (mevcut davranis korunacak)

