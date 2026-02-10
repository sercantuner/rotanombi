

## Tum Parametrelere "Mobilde Goster" Ayari Ekleme

### Ozet
Her widget filtre ve parametresine `showOnMobile` (boolean) alani eklenecek. Mobil cihazlarda sadece `showOnMobile: true` olan filtre/parametreler gorunecek. Varsayilan olarak KPI widget'larinin parametreleri mobilde gorunur, diger widget turlerinde gizli olacak.

### Degisiklikler

#### 1. Tip Tanimlari (widgetBuilderTypes.ts)
- `WidgetFilterDef` ve `WidgetParamDef` interface'lerine `showOnMobile?: boolean` alani eklenecek.

#### 2. WidgetFiltersButton Bileseninde Mobil Filtreleme (WidgetFiltersButton.tsx)
- `useIsMobile()` hook'u import edilecek.
- Mobil cihazda iken `widgetFilters` ve `widgetParameters` dizileri `showOnMobile === true` olanlara gore filtrelenecek.
- Desktop'ta tum filtre/parametreler eskisi gibi gorunmeye devam edecek.

#### 3. ContainerRenderer'da Mobil Gorunurluk (ContainerRenderer.tsx)
- Filtre/parametre butonunun gorunurluk mantigi (satir 316) mobil durumda `showOnMobile: true` olan tanimlara gore kontrol edilecek. Eger mobilde gosterilecek hicbir filtre/parametre yoksa buton gizlenecek.

#### 4. Widget Builder UI (Opsiyonel Iyilestirme)
- `WidgetFiltersParamsEditor.tsx` icerisinde her filtre/parametre satirina bir "Mobilde Goster" toggle'i eklenecek, boylece super admin bu ayari gorsel olarak yonetebilecek.

#### 5. Veritabani Guncelleme (SQL Migration)
Mevcut tum widget'larin `builder_config` icindeki `widgetFilters` ve `widgetParameters` dizilerine `showOnMobile` alani eklenecek:

- **KPI turundeki widget'lar**: Tum filtre ve parametrelere `showOnMobile: true`
- **Diger turler (chart, table, list, summary)**: Tum filtre ve parametrelere `showOnMobile: false`

Bu islem, parametre/filtre tanimli tum aktif widget'lar icin SQL ile toplu guncelleme yapilarak gerceklestirilecek. Etkilenen widget'lar:
- Banka Varliklari Ozeti (chart) - false
- Gelecek Vadeli Cek Analizi (chart) - false  
- Haftalik Kendi Ceklerimiz (chart) - false
- Kasa Varlik Ozeti (chart) - false
- Nakit Akis Yaslandirma Analizi (chart) - false
- Nakit Akisi ve Yaslandirma (chart) - false
- Personel Mesai Analizi (chart) - false
- Personel Performans Radari (chart) - false
- Aylik Acik Teklif Analizi (chart) - false

### Teknik Detaylar

```text
WidgetFilterDef / WidgetParamDef
+---------------------+
| key: string         |
| label: string       |
| type: ...           |
| showOnMobile?: bool | <-- YENi ALAN
| options?: ...       |
+---------------------+

WidgetFiltersButton (render mantigi)
+----------------------------------+
| isMobile?                        |
|   -> filtre listesini filtrele   |
|      showOnMobile === true       |
| Desktop?                         |
|   -> tum filtreler gorunur       |
+----------------------------------+
```

Degistirilecek dosyalar:
- `src/lib/widgetBuilderTypes.ts` - Tip tanimlari
- `src/components/dashboard/WidgetFiltersButton.tsx` - Mobil filtreleme mantigi
- `src/components/pages/ContainerRenderer.tsx` - Buton gorunurluk mantigi
- `src/components/admin/WidgetFiltersParamsEditor.tsx` - Builder UI toggle
- Veritabani: `widgets` tablosunda toplu `builder_config` guncellemesi

