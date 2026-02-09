
## Filtre Seceneklerinin Otomatik Doldurulmasi

### Sorun

Widget filtreleri (ornegin "Kullanici", "Satis Elemani", "Sube") `multi-select` tipinde tanimlanmis ancak `options` dizisi bos veya tanimlanmamis. `WidgetFiltersButton` bilesenindeki `DynamicField`, `def.options || []` uzerinde dongu kuruyor ve bos dizi oldugu icin sadece filtre etiketi gorunuyor, secim yapilacak oge yok.

Veritabanindaki ornek veriler:
- "Personel Performans Radari" -> `kullaniciadi` filtresi: options YOK
- "Aylik Acik Teklif Analizi" -> `satisElemani` filtresi: options `[]` (bos)
- "Kasa Varlik Ozeti" -> `sube` filtresi: options YOK

### Cozum

Widget'in **gercek verisinden** benzersiz degerleri cikararak bos `options` dizilerini otomatik doldurmak.

### Teknik Detaylar

**1. `ContainerRenderer.tsx` - Veri Prop'u Gecisi**

Su anda `WidgetFiltersButton`'a widget verisi gecilmiyor. Widget'in `useDynamicWidgetData` hook'u tarafindan cekilen ham veriyi filtre butonuna ulastirmak gerekiyor. Ancak veri `BuilderWidgetRenderer` icinde cekildigi icin, `ContainerRenderer` seviyesinde dogrudan erisim yok.

En temiz yaklasim: `WidgetFiltersButton` bilesenine opsiyonel `widgetData` prop'u ekleyerek, bos options'lari bu veriden doldurmak.

**2. `WidgetFiltersButton.tsx` - Dinamik Opsiyon Uretimi**

- Yeni prop: `widgetData?: any[]` (widget'in ham veri dizisi)
- `DynamicField` bilesenine `resolvedOptions` hesaplamasi eklenecek:
  - Eger `def.options` dolu ise: mevcut options'lari kullan (degisiklik yok)
  - Eger `def.options` bos veya undefined ise VE `widgetData` mevcutsa: `widgetData` icerisinden `def.key` alanindaki benzersiz (unique) degerleri cikar ve `{ value, label }` formatina donustur
  - Degerler alfabetik siralanacak, null/undefined/bos degerler filtrelenecek

**3. `ContainerRenderer.tsx` - WidgetFiltersButton'a Veri Aktarimi**

`BuilderWidgetRenderer` icinde veri zaten cekiliyor. Iki yaklasim var:

- **Yaklasim A (Tercih edilen):** `BuilderWidgetRenderer` icerisine filtre butonunu tasimak yerine, `ContainerRenderer`'da widget verisini ayri bir hook ile cekerek `WidgetFiltersButton`'a gecmek.

- **Yaklasim B (Basit):** `BuilderWidgetRenderer` icinde zaten `useDynamicWidgetData` ile cekilen `rawData`'yi bir callback veya ref ile ust bilesene bildirmek.

**Yaklasim B uygulanacak:** `BuilderWidgetRenderer`'a opsiyonel `onDataLoaded?: (data: any[]) => void` callback prop'u eklenecek. Veri yuklendikten sonra bu callback cagirilacak. `ContainerRenderer` bu veriyi state'te tutarak `WidgetFiltersButton`'a iletecek.

**4. Degisecek Dosyalar**

1. **`src/components/dashboard/WidgetFiltersButton.tsx`**
   - `widgetData?: any[]` prop'u eklenmesi
   - `DynamicField` icerisinde `resolvedOptions` hesaplamasi: bos options + widgetData varsa veriden benzersiz degerler cikarilmasi
   - Seceneklerin fazla olmasi durumunda arama (search) destegi eklenmesi

2. **`src/components/dashboard/BuilderWidgetRenderer.tsx`**
   - `onDataLoaded?: (data: any[]) => void` prop'u eklenmesi
   - Veri yuklendikten sonra callback'in cagirilmasi

3. **`src/components/pages/ContainerRenderer.tsx`**
   - Her slot icin `widgetRawData` state'i tutulmasi
   - `BuilderWidgetRenderer`'in `onDataLoaded` callback'i ile bu state'in guncellenmesi
   - `WidgetFiltersButton`'a `widgetData` prop'unun gecilmesi

### Beklenen Sonuc

- Filtre popover'i acildiginda, widget verisinden cikartilan gercek degerler (ornegin sube adlari, kullanici adlari, satis elemanlari) secim listesi olarak gorunecek
- Kullanici filtreleri secebilecek ve widget verisi buna gore daraltilacak
- Statik options tanimlanmis filtreler icin davranis degismeyecek
