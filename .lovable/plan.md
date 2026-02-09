

## Widget Filtre ve Parametre Yonetim Sistemi

### Mevcut Durum

Sistem halihazirda Widget.filters ve Widget.parameters yapisini destekliyor: AI koddan bu tanimlari parse ediyor ve builder_config icine kaydediyor. Ancak su eksiklikler var:

- Widget Builder'da filtreleri/parametreleri gorsel olarak yonetmek icin bagimsiz bir sekme yok
- Filtreler sadece kod icinde tanimlanabiliyor (Widget.filters = [...])
- Dashboard'da WidgetFiltersButton hover'da gorunuyor ama filtre/parametre tanimlanmamis widget'larda gorunmuyor (bu dogru davranis)

### Yapilacak Degisiklikler

**1. Widget Builder'a "Filtreler ve Parametreler" Sekmesi Eklenmesi**

Wizard adimlarindan bagimsiz olarak, Kod Duzenle (Step 2) adiminda bir alt sekme (Tab) olarak "Filtreler & Parametreler" paneli eklenecek.

Bu panel iki bolumden olusacak:

**Filtreler Bolumu:**
- Mevcut filtre tanimlarini (Widget.filters) gorsel olarak listeler
- Yeni filtre ekleme formu: key, label, type (multi-select, dropdown, toggle, number, text, range), options, defaultValue, min, max
- Filtre silme ve siralama
- Degisiklikler kod icindeki Widget.filters dizisine otomatik yazilir

**Parametreler Bolumu:**
- Ayni yapiyla Widget.parameters icin gorsel yonetim
- Parametre ekleme/duzenleme/silme

**2. Kod-UI Senkronizasyonu**

- Panel acildiginda mevcut kod icindeki Widget.filters ve Widget.parameters parse edilerek form'a yuklenir (mevcut parseWidgetMetaFromCode fonksiyonu)
- Panelde degisiklik yapildiginda, kodun ilgili kismi (Widget.filters = [...]) otomatik guncellenir
- Bu iki yonlu senkronizasyon sayesinde hem gorsel hem kod duzenlemesi mumkun olur

**3. Dashboard Tarafinda Filtre Butonunun Her Zaman Gorunur Olmasi**

Mevcut durumda WidgetFiltersButton hover'da gorunuyor. widgetFilters veya widgetParameters tanimlanmis widget'larda bu butonun daha gorunur olmasi icin:
- ContainerRenderer'daki hover kontrolunun filtre tanimi olan widget'lar icin her zaman gorunur olacak sekilde guncellenmesi

### Teknik Detaylar

**Yeni Dosya:**
- `src/components/admin/WidgetFiltersParamsEditor.tsx` - Filtre ve parametre gorsel editoru

**Degistirilecek Dosyalar:**
- `src/components/admin/CustomCodeWidgetBuilder.tsx`
  - Kod Duzenle adimina (Step 2) alt sekme olarak filtre/parametre editoru eklenmesi
  - Kod ve UI arasinda senkronizasyon fonksiyonlari (serializeFiltersToCode, serializeParamsToCode)
- `src/components/pages/ContainerRenderer.tsx`
  - widgetFilters/widgetParameters tanimli widget'larda filtre butonunun her zaman gorunur olmasi

**Filtre/Parametre Senkronizasyon Mantigi:**
- `serializeToCode(filters, params)`: Verilen filtre ve parametre dizilerini `Widget.filters = [...];\nWidget.parameters = [...];` formatinda koda cevirir
- `updateCodeMeta(code, metaKey, newArray)`: Kodun icindeki `Widget.filters = [...]` veya `Widget.parameters = [...]` satirini bulup yeni dizi ile degistirir
- Eger kodda ilgili satir yoksa `return Widget;` satirindan hemen once ekler

