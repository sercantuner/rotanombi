
# Widget Filtre ve Parametre Sisteminin Tamamlanmasi

## Sorun

Widget filtreleri iki noktada calismaz durumda:

1. **Bos secenekler**: `multi-select` ve `dropdown` tipindeki filtrelerin `options` dizisi bos veya tanimlanmamis. Popover acildiginda sadece filtre etiketi gorunuyor, secim yapilacak oge yok.

2. **Filtreleme uygulanmiyor**: `useDynamicWidgetData` icindeki `applyWidgetFilters` fonksiyonu sadece hardcoded alan adlarini (cariKartTipi, sube, satisTemsilcisi vb.) taniyor. Widget kodunda tanimlanan ozel filtreler (kullaniciadi, satisElemani, sube gibi) icin genel bir eslestirme mekanizmasi yok. Yani kullanici bir filtre secse bile veriye uygulanmiyor.

## Cozum Ozeti

- Widget'in gercek verisinden benzersiz degerleri cikararak bos `options` dizilerini otomatik doldurmak
- `applyWidgetFilters` fonksiyonuna, widget'in `builder_config.widgetFilters` tanimlarindan gelen tum `multi-select` ve `dropdown` filtrelerini dinamik olarak uygulayan genel bir mekanizma eklemek

## Teknik Detaylar

### 1. WidgetFiltersButton - Dinamik Opsiyon Uretimi

**Dosya:** `src/components/dashboard/WidgetFiltersButton.tsx`

- Yeni prop: `widgetData?: any[]`
- `DynamicField` bilesenine `resolvedOptions` hesaplamasi:
  - `def.options` doluysa: mevcut options kullanilir (degisiklik yok)
  - `def.options` bos/undefined ve `widgetData` mevcutsa: veriden `def.key` alanindaki benzersiz degerler cikarilir, `{ value, label }` formatina donusturulur, alfabetik siralanir
  - null/undefined/bos string degerler filtrelenir
- Secenek sayisi fazla oldugunda (5+) arama kutusu gosterilir

### 2. BuilderWidgetRenderer - Veri Callback

**Dosya:** `src/components/dashboard/BuilderWidgetRenderer.tsx`

- Yeni prop: `onDataLoaded?: (data: any[]) => void`
- `rawData` yuklendikten sonra bu callback cagirilir (useEffect ile)
- Bu sayede ust bilesen (ContainerRenderer) widget verisine erisebilir

### 3. ContainerRenderer - Veri Aktarimi

**Dosya:** `src/components/pages/ContainerRenderer.tsx`

- Her slot icin `widgetRawData` state'i tutulur
- `BuilderWidgetRenderer` yerine `DynamicWidgetRenderer` zaten kullaniliyor; `DynamicWidgetRenderer` icerisinden `BuilderWidgetRenderer`'a `onDataLoaded` prop'u iletilir
- Bu veri `WidgetFiltersButton`'a `widgetData` prop'u olarak gecilir

### 4. DynamicWidgetRenderer - Prop Gecisi

**Dosya:** `src/components/dashboard/DynamicWidgetRenderer.tsx`

- `onDataLoaded` prop'u eklenir ve `BuilderWidgetRenderer`'a iletilir

### 5. applyWidgetFilters - Dinamik Filtre Uygulama

**Dosya:** `src/hooks/useDynamicWidgetData.tsx`

`applyWidgetFilters` fonksiyonuna, mevcut hardcoded filtrelerden sonra calisan genel bir dongu eklenir:

- `widgetFilters` objesindeki her key icin:
  - Eger deger bir dizi ise (multi-select) ve verinin ilk satirinda o alan varsa, veriyi filtreler
  - Eger deger bir string ise (dropdown) ve verinin ilk satirinda o alan varsa, esleseni filtreler
  - Zaten hardcoded olarak islenen key'ler (cariKartTipi, sube vb.) atlanir

Bu yaklasim, widget kodunda tanimlanan herhangi bir filtre key'inin (kullaniciadi, satisElemani, personel vb.) otomatik olarak veriye uygulanmasini saglar.

### 6. useDynamicWidgetData - builderConfig Erisimi

`applyWidgetFilters` fonksiyonuna ek parametre olarak `widgetFilterDefs` (builder_config.widgetFilters) gecilir. Bu sayede fonksiyon hangi key'lerin multi-select, hangisinin dropdown oldugunu bilir ve uygun filtreleme yapar.

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `src/components/dashboard/WidgetFiltersButton.tsx` | `widgetData` prop, resolvedOptions hesaplama, arama destegi |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | `onDataLoaded` callback prop |
| `src/components/dashboard/DynamicWidgetRenderer.tsx` | `onDataLoaded` prop gecisi |
| `src/components/pages/ContainerRenderer.tsx` | widgetRawData state, WidgetFiltersButton'a veri aktarimi |
| `src/hooks/useDynamicWidgetData.tsx` | applyWidgetFilters'a dinamik filtre mekanizmasi |

## Beklenen Sonuc

- Filtre popover'i acildiginda widget verisinden cikartilan gercek degerler (sube adlari, kullanici adlari vb.) secim listesi olarak gorunecek
- Kullanici secim yaptiginda widget verisi filtrelenecek ve grafik/tablo aninda guncellenecek
- Statik options tanimli filtreler icin davranis degismeyecek
- Hardcoded filtreler (cariKartTipi vb.) aynen calismaya devam edecek
