

# Widget Bazli Dinamik Filtre ve Parametre Sistemi v2

## Ozet
Mevcut sabit/standart filtre bloklari (cariKartTipi, gorunumModu, durum) kaldirilacak. Yerine her widget'in kendi kodunda tanimladigi filtre ve parametreler kullanilacak. AI widget ureticisi, widget kodunun yaninda filtre/parametre tanimlari da uretecek. Ayni widget farkli filtre/parametre kombinasyonlariyla birden fazla kullanilabilecek (widget instance kavrami).

## Mevcut Durum ve Sorunlar
- `WidgetFiltersButton` sabit 3 filtre blogu gosteriyor (cariKartTipi, gorunumModu, durum)
- `widgets.available_filters` alani var ama sadece string listesi olarak kullaniliyor (`['cariKartTipi', 'gorunumModu']`)
- AI uretici `filters` prop'unu widget'a geciyor ama hangi filtrelerin gosterilecegini widget kodu belirleyemiyor
- Kullanici ayni grafigi farkli parametrelerle goremez (tek instance)

## Yeni Sistem Tasarimi

### 1. Widget Kodu Icinde Filtre/Parametre Tanimlari
AI tarafindan uretilen her widget kodu, `return Widget;` satirindan once iki ozel alan tanimlayacak:

```text
Widget.filters = [
  { key: 'cariTipi', label: 'Kart Tipi', type: 'multi-select', options: [{value:'AL',label:'Alici'},{value:'ST',label:'Satici'}] },
  { key: 'minBakiye', label: 'Min Bakiye', type: 'number', defaultValue: 0 }
];

Widget.parameters = [
  { key: 'gosterimSayisi', label: 'Gosterim Sayisi', type: 'number', defaultValue: 10 },
  { key: 'siralamaTuru', label: 'Siralama', type: 'dropdown', options: [{value:'desc',label:'Azalan'},{value:'asc',label:'Artan'}], defaultValue: 'desc' }
];

return Widget;
```

- **Filtreler**: Veriyi daraltir (hangi kayitlar gosterilsin)
- **Parametreler**: Gorseli ayarlar (kac kayit gosterilsin, siralama, gosterim modu vb.)

### 2. Filtre/Parametre Tipleri

```text
type: 'multi-select'  -> Coklu secim (checkbox grubu)
type: 'dropdown'      -> Tek secim (select)
type: 'toggle'        -> Acik/Kapali (switch)
type: 'number'        -> Sayi girisi (input)
type: 'text'          -> Metin girisi (input)
type: 'date-range'    -> Tarih araligi
type: 'range'         -> Min-Max slider
```

### 3. builder_config Guncelleme
`WidgetBuilderConfig` icindeki `availableFilters` alani yerine iki yeni alan:

```text
widgetFilters?: WidgetFilterDef[]    -> Widget'in tanimladigi filtreler
widgetParameters?: WidgetParamDef[] -> Widget'in tanimladigi parametreler
```

Bu alanlar AI kodu uretildikten sonra `Widget.filters` ve `Widget.parameters` degerlerinden otomatik parse edilip `builder_config`'e yazilacak.

### 4. WidgetFiltersButton Yeniden Tasarimi
- Sabit filtre bloklari (cariKartTipi, gorunumModu vb.) kaldirilacak
- Widget'in `builder_config.widgetFilters` ve `builder_config.widgetParameters` dizilerine gore dinamik UI uretilecek
- Iki sekme: "Filtreler" ve "Parametreler"
- Deger degistikce aninda widget'a yansiyacak (debounce olmadan)
- Kaydetme ise debounced olarak `user_widget_filters` tablosuna yazilacak

### 5. Ayni Widget Farkli Parametrelerle
Zaten mevcut mimari bunu destekliyor: `container_widgets` tablosundaki her satir bir widget instance'i. Ayni `widget_id` farkli `container_widgets` satirlarinda farkli `settings.filters` degerlerine sahip olabiliyor. Ekstra olarak:
- Kullanici dashboard'da ayni widget'i baska bir slot'a eklediginde farkli filtre/parametre secebilecek
- `user_widget_filters` tablosu `widget_id` olarak `container_widget.id` kullanacak (zaten boyle)

### 6. Filtrelerin Aninda Etkisi
`WidgetFiltersButton` icinde filtre degistiginde:
1. `onFiltersChange` callback'i aninda cagirilir
2. `ContainerRenderer` state'i guncellenir
3. `DynamicWidgetRenderer` -> `BuilderWidgetRenderer` prop degisikligi ile yeniden render olur
4. Custom code widget `filters` prop'unu guncel degerlerle alir
5. Debounced olarak `user_widget_filters`'a kaydedilir (800ms)

## Teknik Uygulama Adimlari

### Adim 1: Tip Tanimlari
`widgetBuilderTypes.ts` dosyasina yeni tipler ekle:

```text
interface WidgetFilterDef {
  key: string;
  label: string;
  type: 'multi-select' | 'dropdown' | 'toggle' | 'number' | 'text' | 'date-range' | 'range';
  options?: { value: any; label: string }[];
  defaultValue?: any;
  min?: number;  // range/number icin
  max?: number;
}

interface WidgetParamDef {
  key: string;
  label: string;
  type: 'dropdown' | 'toggle' | 'number' | 'text' | 'range';
  options?: { value: any; label: string }[];
  defaultValue?: any;
  min?: number;
  max?: number;
}
```

`WidgetBuilderConfig` icine ekle:
```text
widgetFilters?: WidgetFilterDef[];
widgetParameters?: WidgetParamDef[];
```

### Adim 2: WidgetFiltersButton Yeniden Yaz
- Sabit filtre bloklarini kaldir
- `widgetFilters` ve `widgetParameters` prop'lari al (builder_config'den)
- Dinamik olarak her filtre/parametre icin uygun UI bilesenini render et
- Iki bolum: "Filtreler" ve "Parametreler" (separator ile ayrilmis)
- Deger degisince aninda `onFiltersChange` cagir

### Adim 3: ContainerRenderer Guncelle
- `WidgetFiltersButton`'a widget'in `builder_config.widgetFilters` ve `builder_config.widgetParameters` degerlerini gecir
- `availableFilters` string listesi yerine yeni yapilari kullan

### Adim 4: useWidgetLocalFilters Guncelle
- `WidgetLocalFilters` interface'ini daha jenerik yap (sabit alanlar yerine `Record<string, any>`)
- Ya da mevcut sabit alanlari koruyup ek `customFilters` ve `customParams` alanlari ekle

### Adim 5: AI Kod Ureticisi (ai-code-generator) Guncelle
- System prompt'a `Widget.filters` ve `Widget.parameters` tanimlama kurallarini ekle
- AI'nin her widget icin uygun filtre/parametre tanimlari uretmesini zorunlu kil
- Widget kodunu kaydederken `Widget.filters` ve `Widget.parameters` degerlerini parse edip `builder_config.widgetFilters` ve `builder_config.widgetParameters` olarak kaydet

### Adim 6: CustomCodeWidgetBuilder Guncelle
- AI kodu uretildikten sonra `Widget.filters` ve `Widget.parameters` satirlarini parse et
- Parse edilen degerleri `builder_config`'e otomatik yaz

### Adim 7: BuilderWidgetRenderer Guncelle
- `filters` prop'unu widget'a gecerken hem standart filtre degerlerini hem de custom filtre/parametre degerlerini birlestir
- Widget kodu `filters.cariTipi`, `filters.gosterimSayisi` gibi key'lerle erismeli

### Adim 8: Mevcut Sabit Filtre Yapisini Temizle
- `WidgetLocalFilters` interface'indeki sabit alanlar (cariKartTipi, gorunumModu, durum vb.) kaldirilabilir veya legacy olarak korunabilir
- `DynamicWidgetRenderer` icindeki hardcoded filtre uygulama mantigi (`getFilteredCariler`, `getFilteredKpis`) korunacak (legacy KPI widget'lari icin)

## Ozet Degisiklik Listesi
| Dosya | Islem |
|---|---|
| `src/lib/widgetBuilderTypes.ts` | `WidgetFilterDef`, `WidgetParamDef` tipleri + `WidgetBuilderConfig`'e ekleme |
| `src/components/dashboard/WidgetFiltersButton.tsx` | Tamamen yeniden yazilacak (dinamik filtre/parametre UI) |
| `src/hooks/useWidgetLocalFilters.tsx` | Jenerik filtre/parametre deger saklama |
| `src/components/pages/ContainerRenderer.tsx` | Yeni prop'lari `WidgetFiltersButton`'a gecir |
| `src/components/dashboard/BuilderWidgetRenderer.tsx` | `filters` prop icerigi guncelle |
| `src/components/admin/CustomCodeWidgetBuilder.tsx` | AI ciktisinden filtre/parametre parse etme |
| `supabase/functions/ai-code-generator/index.ts` | System prompt'a `Widget.filters` ve `Widget.parameters` kurallari ekle |

