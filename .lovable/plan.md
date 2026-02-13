

# Pre-Computed Widget Snapshots (Power BI Mimarisi)

## Mevcut Durum

Simdi her widget acildiginda su islemler yasar:
1. `company_data_cache` tablosundan ham veri cekilir (binlerce kayit)
2. Multi-query widget'larda birden fazla kaynak merge edilir
3. Custom JavaScript kodu istemcide (browser'da) calistirilip sonuc hesaplanir
4. Hesaplanan sonuc ekranda gosterilir

Bu islem her sayfa acilisinda tekrarlanir ve buyuk veri setlerinde 2-5 saniye surer.

## Hedef Mimari

```text
  DIA ERP
    |
    v
[dia-data-sync]  (4x/gun cron: 03:00, 09:00, 15:00, 21:00)
    |
    v
[company_data_cache]  (ham JSONB veri)
    |
    v
[widget-compute]  (sync sonrasi otomatik tetiklenir)
    |  - Her aktif widget icin ham veriyi okur
    |  - customCode'u Deno'da calistirir
    |  - Merge, filtre, agregasyon islemlerini yapar
    v
[widget_snapshots]  (onceden hesaplanmis sonuclar)
    |
    v
[Frontend]  (kullanici giris yapinca snapshot'tan aninda yukler)
```

## Uygulama Adimlari

### Adim 1: Veritabani - `widget_snapshots` Tablosu

Yeni tablo olusturulacak:

- **widget_snapshots**
  - `id` (UUID, PK)
  - `sunucu_adi` (TEXT) - sirket izolasyonu
  - `firma_kodu` (TEXT) - sirket izolasyonu
  - `widget_id` (UUID, FK -> widgets.id)
  - `snapshot_data` (JSONB) - onceden hesaplanmis veri (grafik/tablo/KPI icin hazir)
  - `raw_row_count` (INTEGER) - kaynak ham kayit sayisi
  - `computed_at` (TIMESTAMPTZ) - hesaplama zamani
  - `sync_trigger` (TEXT) - 'cron' / 'manual' / 'post_sync'
  - `status` (TEXT) - 'computing' / 'ready' / 'failed'
  - `error` (TEXT) - hata varsa
  - `computation_ms` (INTEGER) - hesaplama suresi (ms)
  - `created_at` / `updated_at`

- Unique constraint: `(sunucu_adi, firma_kodu, widget_id)` - her widget icin tek snapshot
- RLS: Kullanici sadece kendi sirketi icin okuyabilir
- Index: `(sunucu_adi, firma_kodu, status)` hizli erisim icin

### Adim 2: Edge Function - `widget-compute`

Yeni edge function: `supabase/functions/widget-compute/index.ts`

Gorevleri:
1. Belirtilen sirket icin tum aktif widget'lari widgets tablosundan cek
2. Her widget icin:
   - `builder_config.dataSourceId` ve `multiQuery.queries` ile gerekli kaynaklari belirle
   - `company_data_cache` tablosundan ham veriyi oku
   - Multi-query merge islemlerini uygula (left_join, union vb.)
   - `builder_config.customCode`'u Deno ortaminda calistir (guvenli sandbox)
   - Sonucu `widget_snapshots` tablosuna yaz
3. Hesaplama suresi ve durumu kaydet

Custom code calistirma stratejisi:
- Widget'larin customCode'u `new Function()` ile Deno'da calistirilir
- Recharts/Nivo gibi UI bilesenlerine ihtiyac duymaz - sadece veri donusumu hesaplanir
- `data`, `rawData`, `filters` gibi parametreler saglanir
- Timeout: Widget basina max 10 saniye

### Adim 3: Cron Zamanlama Guncelleme

Mevcut tek cron (03:00 UTC) yerine gunluk 4 cron:

- 03:00 TR (00:00 UTC) - Gece sync
- 09:00 TR (06:00 UTC) - Sabah sync
- 15:00 TR (12:00 UTC) - Ogleden sonra sync
- 21:00 TR (18:00 UTC) - Aksam sync

Her cron adimi:
1. `dia-data-sync` (incremental) calisir
2. Sync tamamlaninca `widget-compute` tetiklenir
3. Tum widget snapshot'lari guncellenir

### Adim 4: dia-data-sync Entegrasyonu

`cronSync` aksiyonunun sonuna post-sync tetikleyici eklenir:
- Sync basariyla tamamlaninca `widget-compute` edge function'ini cagirir
- Boylece sync -> compute -> snapshot otomatik zinciri olusur

### Adim 5: Frontend - Snapshot Oncelikli Veri Yukleme

`useDynamicWidgetData` hook'unda degisiklik:

```text
Mevcut akis:
  company_data_cache -> customCode eval -> render

Yeni akis:
  1. widget_snapshots tablosuna bak (status = 'ready')
  2. Snapshot varsa -> aninda render (< 100ms)
  3. Snapshot yoksa veya cok eskiyse -> mevcut akisa fallback
  4. Arka planda revalidation devam eder
```

Bu sayede:
- Ilk sayfa acilisi: Snapshot'tan aninda yukler (tek sorgu, kucuk veri)
- Gunduz guncelleme: Cron sonrasi snapshot otomatik yenilenir
- Manuel tetikleme: Kullanici "yenile" derse canli hesaplama yapilir

### Adim 6: Snapshot Durum Gostergesi

Widget header'ina snapshot bilgisi eklenir:
- "Son hesaplama: 2 saat once" (yesil)
- "Hesaplaniyor..." (sari, animasyonlu)
- "Hesaplama hatasi" (kirmizi)

## Teknik Detaylar

### Custom Code Sandbox (Deno)
Widget'larin `customCode`'u su sekilde calistirilir:

```text
Input:  { data: [...ham kayitlar], rawData: [...], filters: {} }
Output: { processedData: [...hesaplanmis sonuc] }
```

Guvenligi saglamak icin:
- Sadece veri donusumu yapan kod calistirilir
- React/DOM erisimi yok (sunucu tarafinda)
- 10 saniye timeout
- Hata yakalanir ve loglanir

### Boyut Optimizasyonu
- snapshot_data icinde sadece render icin gereken minimal veri saklanir
- Ham veri degil, islenmis/gruplanmis sonuclar (genelde 10-100 satir)
- Ortalama bir widget snapshot'i: ~5-50 KB (31 widget * 50 KB = ~1.5 MB toplam)

### Incremental + Reconcile
Cron tetiklemesinde:
1. Artimli sync: `_date >= son_sync_tarihi` filtreleri ile yeni/degisen kayitlar
2. `_key` sayimi eslesmesi: DIA'daki toplam _key sayisi ile DB karsilastirilir
3. Fark varsa reconcileKeys ile silinen kayitlar tespit edilir
4. Tum veri tutarli oldugunda widget hesaplamalari baslar

## Kisitlamalar ve Riskler

1. **Filtre farkliliklari**: Snapshot, filtre uygulanmadan onceki "varsayilan" gorunum icin hesaplanir. Kullanici ozel filtre uygularsa canli hesaplama devreye girer.
2. **Widget customCode uyumlulugu**: Bazi widget kodlari React bilesenlerine referans iceriyorsa sunucu tarafinda calismaz. Bu widget'lar icin snapshot atlanir ve canli hesaplama yapilir.
3. **Hesaplama suresi**: 31 widget x ortalama 2-5 saniye = toplam ~1-2.5 dakika. Edge function timeout'u (60 sn) icinde kalmak icin widget'lar gruplar halinde islenir.

## Ozet

| Ozellik | Mevcut | Yeni |
|---------|--------|------|
| Sync sikligi | Gunde 1 (03:00) | Gunde 4 (03, 09, 15, 21) |
| Veri yukleme | Ham veri + canli hesaplama | Onceden hesaplanmis snapshot |
| Ilk acilis suresi | 2-5 saniye | < 200ms |
| Filtreli gorunum | Canli | Snapshot + canli fallback |
| Depolama maliyeti | ~0 (sadece cache) | +1.5 MB (snapshot) |

