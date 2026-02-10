

# backgroundRevalidate: Chunk-Based Sync + reconcileKeys

## Kullanici Senaryosu

Sabah uygulamaya girildiginde:
1. **Aninda**: Gece 03:00 cron'unun veritabanina yazdigi veriler ile grafikler olusur (< 1 saniye)
2. **Arka planda**: Her widget icin DIA ile senkronizasyon baslar (chunk-based)
3. **Birkaç saniye icinde**: Yeni/guncellenen kayitlar yazilir, silinen kayitlar isaretlenir, widget sessizce yenilenir
4. **Sonuc**: Yesil ucgen = "DIA ile birebir ayni"

Gun icinde tekrar girildiginde ayni dongü tekrar eder: once DB'deki veri (birkaç saat onceki sync), sonra arka planda taze cekme.

## Problem

`backgroundRevalidate` fonksiyonu `syncSingleSource` action'ini cagiriyor. Bu action tek bir Edge Function cagrisinda **tum** veriyi cekmeye calisiyor. Buyuk tablolarda (Gorev Listesi: 8504 kayit, Cari Vade Bakiye: 1891 kayit) 150 saniye timeout limitine takiliyor.

Sonuc:
- Gorev Listesi: 504 timeout, widget guncellenemiyor
- Cari Vade Bakiye: Kismi sync, 4 gun onceki veri kaliyor
- Sozlesmeli Musteri ve Nakit Akis Yaslandirmasi: Bagimli oldugu kaynak (Cari Vade Bakiye) eksik oldugu icin yanlis/eski veri gosteriyor

## Cozum

`syncSingleSource` yerine `syncChunk` action'ini kullanarak veriyi 300'erli parcalar halinde cekmek. Bu action zaten Edge Function'da mevcut ve frontend orkestratorde sorunsuz calisiyor.

## Teknik Degisiklik

### Degisecek Dosya: `src/hooks/useDynamicWidgetData.tsx`

`backgroundRevalidate` fonksiyonundaki ~1029-1048 satirlari arasindaki `syncSingleSource` cagrisi asagidaki chunk-based dongu ile degistirilir:

```text
ESKI (tek cagri, timeout riski):
  fetch({ action: 'syncSingleSource', dataSourceSlug, periodNo })
  --> 8504 kayit = 170 sayfa = timeout

YENI (parcali, her biri < 30sn):
  while (hasMore) {
    fetch({ action: 'syncChunk', dataSourceSlug, periodNo, offset, chunkSize: 300 })
    offset += 300
  }
  --> 8504 kayit = 29 chunk x ~5-10sn = basarili
```

Detayli adimlar:

**Adim 1 - Chunk-based sync dongusu:**
- `offset = 0`, `chunkSize = 300` ile basla
- Her chunk sonucunda `hasMore` kontrol et
- `hasMore === false` olana kadar devam et
- Herhangi bir chunk'ta hata olursa donguden cik ama o ana kadar yazilan veriyi koru

**Adim 2 - reconcileKeys (mevcut, degisiklik yok):**
- Sync tamamlandiktan sonra DIA'daki key listesi ile DB karsilastirilir
- Eksik kayitlar `is_deleted: true` olarak isaretlenir
- Hata olursa catch blogu yakalar, sync'i engellemez

**Adim 3 - DB'den temiz veri cek (mevcut, degisiklik yok):**
- `is_deleted = false` kayitlar cekilir
- Widget UI sessizce guncellenir
- DataStatus "Guncel" olarak isaretlenir

### Beklenen Sonuc

| Widget | Onceki | Sonrasi |
|--------|--------|---------|
| Gorev Listesi (8504) | 504 timeout | 29 chunk, basarili |
| Cari Vade Bakiye (1891) | Kismi sync | 7 chunk, tam sync |
| Nakit Akis Yaslandirma | "Eski veri" | Guncel |
| Sozlesmeli Musteri | Bos | Dogru veri |

### Performans

- Her chunk ~5-10 saniye surer (300 kayit = 6 sayfa x 50)
- `backgroundRevalidate` zaten arka planda calisiyor, kullanici bunu fark etmez
- Kuyruk sistemi (DiaRequestQueue, maxConcurrent: 2) asiri yuku dengeler

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|------------|
| `src/hooks/useDynamicWidgetData.tsx` | `backgroundRevalidate` icindeki `syncSingleSource` cagrisi `syncChunk` dongusune donusturulur |

