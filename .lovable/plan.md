

# Widget Filtre Sisteminin Duzeltilmesi

## Sorun Analizi

Grafiklerin calismamaya baslamasinin tek ve net sebebi `DynamicWidgetRenderer.tsx` dosyasindaki **filtre prop'u donusumudur** (satir 101-105):

```text
const builderWidgetFilters = widgetFilters ? {
  cariKartTipi: widgetFilters.cariKartTipi || [],
  gorunumModu: widgetFilters.gorunumModu || 'hepsi',
  durum: widgetFilters.durum || 'hepsi',
} : undefined;
```

Bu kod iki kritik sorun yaratiyor:

1. **Tum ozel filtreler siliniyor**: Kullanicinin sectigi `kullaniciadi`, `satisElemani`, `sube` gibi dinamik filtreler bu noktada kayboluyor. Sadece 3 hardcoded alan geciriliyor.

2. **Her widget'a gereksiz filtreler zorla veriliyor**: `gorunumModu: 'hepsi'` ve `durum: 'hepsi'` her widget'a gonderiliyor. `applyWidgetFilters` icindeki kontroller bunlari "hepsi" oldugundan pas geciyor ancak bazi edge case'lerde (`dataHasField` kontrolu ile birlikte) beklenmeyen filtreleme olusabiliyor. Ozellikle `cariKartTipi: []` bos dizi olarak gonderildiginde, bazi widget'larda veri donus yapisina gore sorun cikarabiliyor.

## Cozum

### 1. DynamicWidgetRenderer.tsx - Filtre Donusumunu Kaldir (Satir 101-117)

Mevcut 3-alan donusumu yerine `widgetFilters` objesi oldugu gibi (as-is) `BuilderWidgetRenderer`'a iletilecek. Boylece kullanicinin sectigi tum filtreler korunacak.

Degisiklik:
```text
// ONCE (hatali):
const builderWidgetFilters = widgetFilters ? {
  cariKartTipi: widgetFilters.cariKartTipi || [],
  gorunumModu: widgetFilters.gorunumModu || 'hepsi',
  durum: widgetFilters.durum || 'hepsi',
} : undefined;

// SONRA (dogru):
// widgetFilters'i oldugu gibi gecir, donusum yapma
```

`BuilderWidgetRenderer`'a `widgetFilters={widgetFilters}` seklinde dogrudan iletilecek. Eger `widgetFilters` undefined ise zaten `useDynamicWidgetData` icinde bos obje olarak ele aliniyor.

### 2. Baska Degisiklik Gerekmiyor

- `WidgetFiltersButton.tsx`: Onceki degisiklikler dogru, widgetData'dan opsiyon cikarma mantigi calisiyor.
- `BuilderWidgetRenderer.tsx`: `onDataLoaded` callback'i dogru calisiyor.
- `ContainerRenderer.tsx`: `widgetRawDataMap` state'i ve `WidgetFiltersButton`'a veri aktarimi dogru.
- `useDynamicWidgetData.tsx`: `applyWidgetFilters` icindeki dinamik filtre dongusu dogru; `widgetFilterDefs` parametresi `config?.widgetFilters` olarak geciliyor.

Sorunun tamami tek bir dosyadaki 5 satirlik donusum kodundan kaynaklaniyor.

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `src/components/dashboard/DynamicWidgetRenderer.tsx` | Satir 101-117: `builderWidgetFilters` donusumu kaldirilacak, `widgetFilters` dogrudan gecilecek |

## Beklenen Sonuc

- Widget'lar filtre uygulanmadan onceki gibi dogru sekilde render edilecek
- Kullanici filtre sectiginde tum filtre key'leri korunarak `applyWidgetFilters`'a ulasacak
- Dinamik filtre mekanizmasi (widgetFilterDefs dongusu) dogru calisacak
- Gereksiz `cariKartTipi: []`, `gorunumModu: 'hepsi'`, `durum: 'hepsi'` zorlamasi kaldirilacak

