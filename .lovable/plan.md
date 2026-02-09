

## Filtre ve Parametre Yonetim Sistemi - Yeni Tasarim

### Ozet

Widget Builder'daki "Filtreler" sekmesini tamamen yeniden tasarliyoruz. Mevcut tek panel yerine uc bolumluk bir yapi olusturulacak:

1. **Parametreler (Koddan Okunan + Manuel)** - Kodda tanimli parametreleri otomatik gosterir, yeni ekleme imkani + kucuk AI yardimcisi
2. **Filtreler (Alan Secimli)** - Veri kaynaginin alanlarindan secilerek tanimlanan filtreler
3. **AI Parametre Asistani** - Widget kodunu bilen kucuk bir AI alani, parametre onerisi yapar

### Detayli Tasarim

**Parametreler Bolumu:**
- Koddan parse edilen parametreler (Widget.parameters) otomatik listelenir (ornegin: `gorunumModu: bin/milyon`, `periyot: aylik/haftalik`, `kdvDahil: toggle`)
- Her parametre duzenlenebilir (key, label, type, options, defaultValue)
- "Parametre Ekle" butonu ile yeni parametre eklenebilir
- Degisiklikler koda otomatik yansir (updateCodeMeta)
- Altinda kucuk bir AI alaninda "Kodda su parametreler olabilir..." seklinde AI onerisi gelir

**AI Parametre Asistani:**
- Kucuk bir input + buton ile "Widget kodumu analiz et, parametre oner" islevi
- Widget kodunu ve mevcut parametreleri AI'a gonderir
- AI, kodda kullanilabilecek ama henuz tanimlanmamis parametreleri oner (ornegin: formatCurrency fonksiyonundaki bin/milyon secimi, KDV dahil/haric hesaplama, periyot secimi)
- Onerilen parametreler tek tikla eklenebilir
- Mevcut `ai-code-generator` edge function'a yeni bir `suggest-params` modu eklenir

**Filtreler Bolumu:**
- Mevcut `WidgetFilterFieldsBuilder` mantigi kullanilir
- Sol panelde veri kaynagindan gelen tum alanlar listelenir
- Sag panelde secili filtre alanlari gosterilir
- Alan tiklaninca otomatik filtre tanimina donusur (key, label, type otomatik tespit)
- Bu filtreler `Widget.filters` dizisine otomatik yazilir

### Teknik Detaylar

**Degistirilecek Dosyalar:**

1. `src/components/admin/WidgetFiltersParamsEditor.tsx` - Tamamen yeniden yazilacak
   - Props'a `customCode` ve `availableFields` eklenecek
   - Uc bolumluk layout: Parametreler (ust) + AI Asistani (orta) + Filtreler (alt)
   - Parametreler: Mevcut koddan parse + manuel ekleme
   - Filtreler: Alan secim bazli (WidgetFilterFieldsBuilder mantigi entegre)
   - AI alani: Kucuk input, edge function cagrisi

2. `src/components/admin/CustomCodeWidgetBuilder.tsx`
   - `WidgetFiltersParamsEditor`'a `customCode` ve veri kaynaklarindan gelen `availableFields` prop'lari iletilecek
   - Filtre sekmesine gecildiginde mevcut alanlar hazir olacak

3. `supabase/functions/ai-code-generator/index.ts`
   - Yeni `suggest-params` modu eklenecek
   - Widget kodunu analiz ederek parametre onerisi uretecek (tool calling ile yapilandirilmis cikti)
   - Kodu ve mevcut parametreleri alip, eksik olabilecek parametreleri JSON olarak dondurecek

**Veri Akisi:**
```text
Widget Kodu (customCode)
    |
    +--> parseWidgetMetaFromCode('parameters') --> Mevcut Parametreler Listesi
    |                                                    |
    +--> AI Asistani --> suggest-params --> Onerilen Parametreler
    |                                           |
    |                                     [Tek Tikla Ekle]
    |                                           |
    +--> updateCodeMeta('parameters', [...]) --> Kod Guncellenir
    
Veri Kaynagi Alanlari (availableFields)
    |
    +--> Alan Secim Paneli --> Secilen Alanlar
    |                              |
    +--> Widget.filters dizisine donusturulur
    |
    +--> updateCodeMeta('filters', [...]) --> Kod Guncellenir
```

**AI Parametre Onerisi Cikti Formati (Tool Calling):**
```text
suggest_parameters fonksiyonu:
  - suggestions: array
    - key: string (ornek: "gorunumModu")
    - label: string (ornek: "Gosterim Birimi")
    - type: dropdown | toggle | number | text | range
    - options: array (ornek: [{value: 'bin', label: 'Bin'}, {value: 'milyon', label: 'Milyon'}])
    - defaultValue: any
    - reason: string (ornek: "Kodda formatCurrency fonksiyonunda birim donusumu var")
```

