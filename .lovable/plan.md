

# Fatura Performans Optimizasyonu: Period-Batched Fetching + Invoice Summary MV

## Sorun

`scf_fatura_listele` veri kaynagi `is_period_independent` olarak yapilandirilmis. 9 donemdeki **52,412 kayit (~162 MB JSONB)** `p_donem_kodu = NULL` ile tek sorguda cekilmeye calisiliyor ve statement timeout oluyor.

| Donem | Kayit | Tahmini Boyut |
|-------|-------|---------------|
| 1 | 5,194 | ~17 MB |
| 2 | 40,447 | ~126 MB |
| 3 | 4,154 | ~13 MB |
| 4-9 | 2,617 | ~9 MB |

## Cozum Ozeti

### Katman 1: Period-Batched Fetching (Frontend)

`is_period_independent` kaynaklarda `p_donem_kodu = null` gondermek yerine, once mevcut donemleri ogrenip her donemi ayri ayri sorgulayarak sonuclari birlestirmek.

**Degisecek dosyalar:**
- `src/hooks/useDataSourceLoader.tsx` - `loadDataSourceFromDatabase` fonksiyonu
- `src/hooks/useCompanyData.tsx` - Ana veri cekme sorgusu

**Mantik:**
1. `SELECT DISTINCT donem_kodu FROM company_data_cache WHERE slug = X` ile mevcut donemleri cek (hafif sorgu)
2. Her donem icin ayri `get_projected_cache_data(p_donem_kodu = N)` cagrisi yap
3. Sonuclari birlestirip dondur

Bu yaklasim en buyuk donemi (D2: 40K kayit) bile izole eder cunku tek basina timeout sinirinin altindadir.

### Katman 2: Invoice Summary Materialized View (Veritabani)

Widget'larin kullandigi alanlar analiz edildi. Tum fatura widget'lari su alanlarin alt kumelerini kullaniyor:

```text
tarih, fisno, toplam, toplamara, net, netdvz, toplamkdvdvz, 
dovizkuru, dovizturu, iptal, turu_kisa, turuack, satiselemani, 
firmaadi, cari_unvan, __carifirma, __sourcesubeadi, 
amount, rawAmount, isReturn, vatMode, belgeno
```

Toplam ~22 alan - orijinal JSONB'deki ~200+ alana karsilik.

**Yeni SQL nesneleri:**
- `invoice_summary_mv` Materialized View - JSONB'den sadece gerekli alanlari cikarir
- Unique index (CONCURRENTLY refresh icin zorunlu)
- `get_invoice_summary` SECURITY DEFINER RPC fonksiyonu

```text
company_data_cache (162 MB JSONB, ~200 alan)
         |
         v
invoice_summary_mv (~15 MB, ~22 alan + scope)
         |
         v
get_invoice_summary() RPC -> Widget'lar
```

### Katman 3: Sync Sonrasi MV Yenileme

`dia-data-sync` edge function'da basarili fatura senkronizasyonu sonrasi `REFRESH MATERIALIZED VIEW CONCURRENTLY invoice_summary_mv` calistirilacak.

## Uygulama Adimlari

### Adim 1: SQL Migration

- `invoice_summary_mv` materialized view olustur
- `(sunucu_adi, firma_kodu, donem_kodu, dia_key)` uzerinde UNIQUE index (concurrent refresh icin)
- `(sunucu_adi, firma_kodu, donem_kodu)` uzerinde arama indeksi
- `get_invoice_summary(p_sunucu_adi, p_firma_kodu, p_donem_kodu, p_limit, p_offset)` SECURITY DEFINER fonksiyon
- Ilk veri icin `REFRESH MATERIALIZED VIEW`

### Adim 2: useDataSourceLoader.tsx - Period Batching

`loadDataSourceFromDatabase` fonksiyonuna `isPeriodIndependent` kontrolu eklenir:
- Once `DISTINCT donem_kodu` sorgusu ile mevcut donemleri tespit et
- Her donem icin paralel degil seri olarak (DB yuku icin) ayri `get_projected_cache_data` cagrisi yap
- Sonuclari birlestir

### Adim 3: useCompanyData.tsx - Period Batching

Ayni period-batching mantigi `useCompanyData` hook'una da eklenir (bazi widget'lar bu hook'u dogrudan kullaniyor olabilir).

### Adim 4: useDataSourceLoader.tsx - Invoice MV Optimizasyonu

Fatura kaynagi icin ozel dal:
- Kaynak `scf_fatura_listele` ise `get_invoice_summary` RPC'sini kullan
- JSONB parsing olmadan dogrudan sutun okumasi

### Adim 5: dia-data-sync Edge Function - MV Refresh

`syncOne` ve `incrementalSync` fonksiyonlarinda fatura sync'i tamamlandiginda:
```
REFRESH MATERIALIZED VIEW CONCURRENTLY invoice_summary_mv
```

## Beklenen Sonuc

| Metrik | Oncesi | Sonrasi |
|--------|--------|---------|
| Sorgu boyutu | 162 MB tek sorgu | MV: ~15 MB toplam |
| En buyuk tek sorgu | 126 MB (D2) | ~12 MB (D2, sadece 22 alan) |
| Timeout riski | Yuksek | Dusuk (batch) / Sifir (MV) |
| JSONB parsing | Her istekte | Sadece MV refresh'te |

