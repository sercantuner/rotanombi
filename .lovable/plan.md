
# Widget Bazli Parametre ve Filtre Sistemi

## Ozet
Mevcut global filtre sistemi (GlobalFilterContext, FilterSidePanel, GlobalFilterBar, cross-filtering) tamamen kaldirilacak. Yerine her widget'in kendi icinde standart bir "Parametreler & Filtreler" butonu olacak. Kullanicinin sectigi filtreler widget + kullanici bazinda veritabaninda saklanacak ve bir sonraki giriste otomatik yuklenecek.

## Kaldirilacak Sistemler
- **GlobalFilterContext** (tum cross-filter, global filtre state'i)
- **GlobalFilterBar** bilesenini
- **FilterSidePanel** (sag yan panel)
- **FilterSidebar** bilesenini
- **FilterManagerModal** (filtre yonetim modali)
- `useDynamicWidgetData` icindeki `applyGlobalFilters()` fonksiyonu
- `BuilderWidgetRenderer` icindeki `useGlobalFilters()` kullanimi
- `LiveWidgetPreview` icindeki `applyGlobalFiltersToPreviewData()` mantigi
- `page_filter_presets` ve `user_filter_preferences` tablolarina yapilan yazma/okuma islemleri (tablolar kalabilir ama artik kullanilmayacak)
- Cross-filter ile ilgili tum kodlar (CrossFilter tipi, setCrossFilter, clearCrossFilter)

## Yeni Sistem Tasarimi

### 1. Veritabani: `user_widget_filters` tablosu (Mevcut)
Zaten mevcut olan `user_widget_filters` tablosu kullanilacak:
- `user_id` (uuid) - Kullanici
- `widget_id` (varchar) - Widget'in container_widget ID'si veya widget_key'i  
- `filters` (jsonb) - Secilen filtre/parametre degerleri
- Bu tabloda her kullanici + widget cifti icin tek satir olacak (upsert)

### 2. Filtre Tipleri (Widget Bazli)
Her widget'in `builder_config` icinde veya `available_filters` alaninda tanimli olan filtreler kullanilacak. Standart filtre turleri:
- **Tarih Araligi** (DatePeriod secimi)
- **Cari Kart Tipi** (AL/AS/ST checkbox)
- **Gorunum Modu** (Hepsi/Cari/Potansiyel)
- **Durum** (Hepsi/Aktif/Pasif)
- **Satis Temsilcisi** (coklu secim)
- **Sube** (coklu secim)
- **Depo** (coklu secim)
- **Ozel Kodlar** (1-3)

### 3. UI: Widget Filtre Butonu
Her widget'in sag ust kosesinde (hover'da gorunen kontrol alaninda) standart bir **Filter** ikonu eklenecek. Tiklandiginda bir **popover veya modal** acilacak ve o widget icin gecerli filtre secenekleri gosterilecek.

### 4. Filtre Uygulama Mantigi
- `useDynamicWidgetData` hook'u artik global filtre almayacak
- Bunun yerine widget'in kendi `widgetFilters` prop'u (veritabanindan yuklenen) kullanilacak
- Ham veri cekilecek, sonra widget-spesifik filtreler post-fetch olarak uygulanacak
- AI tarafindan uretilen custom code widget'larina `filters` prop'u widget-bazli filtrelerle gonderilecek

## Teknik Uygulama Adimlari

### Adim 1: Yeni `WidgetFiltersButton` Bileseni Olustur
- Standart bir buton + popover/dialog yapisi
- Widget'in `available_filters` veya `builder_config`'deki filtre tanimlarina gore dinamik filtre alanlari gosterir
- Kaydet butonuna basildiginda `user_widget_filters` tablosuna upsert yapar
- Container widget ID'si (`containerWidgetId`) kullanarak widget bazinda filtre saklar

### Adim 2: Filtre Yukleme Hook'u (`useWidgetLocalFilters`)
- Widget mount oldugunda `user_widget_filters` tablosundan o widget + kullanici icin kayitli filtreleri yukler
- Filtre degistiginde otomatik kayit yapar (debounced)
- Mevcut `KpiFilterModal` mantigi bu hook ile birlestirilebilir

### Adim 3: `useDynamicWidgetData` Refactor
- `globalFilters` parametresini kaldir
- Yerine opsiyonel `widgetFilters` parametresi ekle (widget'in kendi filtreleri)
- `applyGlobalFilters()` fonksiyonunu `applyWidgetFilters()` olarak yeniden adlandir
- Sadece o widget'a ait filtre degerlerini uygula

### Adim 4: `BuilderWidgetRenderer` Guncelle
- `useGlobalFilters()` hook'unu kaldir
- `widgetFilters` prop'unu al ve `useDynamicWidgetData`'ya ilet
- Custom code widget'lara giden `filters` prop'unu widget-bazli filtrelerle doldur

### Adim 5: `ContainerRenderer` Guncelle
- Mevcut `KpiFilterModal` entegrasyonunu yeni sisteme gecir
- Her widget icin `WidgetFiltersButton` render et
- `container_widgets.settings.filters` ile `user_widget_filters` tablosunu birlestir

### Adim 6: Global Filtre Altyapisini Temizle
- `GlobalFilterProvider`'i App.tsx'ten kaldir (veya bosalt)
- `FilterSidePanel`'i DashboardPage ve DynamicPage'den kaldir
- `GlobalFilterBar` bilesenini kullanilmaz hale getir (veya sil)
- Ancak **DIA zorunlu filtreler** (_diaAutoFilters) korunacak - bunlar profil bazli ve degistirilemez, widget filtreleriyle birlikte uygulanacak

### Adim 7: AI Kod Ureticisini Guncelle
- `ai-code-generator` edge function'indaki system prompt'ta `filters` prop'unun artik "global" degil "widget-bazli" oldugunu belirt
- `Widget({ data, colors, filters })` imzasi ayni kalacak, sadece `filters` icerigi degisecek

### Adim 8: LiveWidgetPreview Guncelle
- Global filtre senkronizasyonunu kaldir
- Preview'da widget'in kendi filtrelerini kullan

## Korunan Yapilar
- **DIA Zorunlu Filtreler** (_diaAutoFilters): Kullanicinin DIA yetkisine bagli kilitli filtreler korunacak. Bunlar widget filtreleriyle birlikte uygulanir
- **Widget tarih filtresi** (WidgetDateFilter): Builder'da tanimlanan tarih filtresi zaten widget bazli, korunacak
- **PostFetchFilter**: Builder'da tanimlanan sabit filtreler korunacak

## Goc Stratejisi
- `container_widgets.settings.filters` icinde zaten widget-bazli filtre vardi (KpiFilter). Bu yapi genisletilecek
- `user_widget_filters` tablosu zaten mevcut, dogrudan kullanilacak
- Eski `page_filter_presets` ve `user_filter_preferences` tablolarina dokunulmayacak (eski veri kalabilir)

## Risk Notu
- `useGlobalFilters()` 10 dosyada kullaniliyor; hepsinin guncellenmesi gerekecek
- Gecis sirasinda bazi widget'lar gecici olarak filtresiz gorunebilir (eski preset'ler gecersiz olacak)
- DIA zorunlu filtreler profil bazli kalacagi icin bu mantik ayri bir hook'a tasinabilir (ornegin `useDiaAutoFilters`)
