

# Corlugrup Eksik Veri Tamamlama ve CancelledError Cozumu

## Mevcut Durum Analizi

Veritabanindaki gercek kayit sayilari:

| Kaynak | D1 (2024) | D2 (2025) | D3 (2026) | Durum |
|--------|-----------|-----------|-----------|-------|
| Fatura_listele_ayrintili | 200 | 600 | 1000 | EKSIK - CancelledError |
| scf_fatura_listele | 3069 | 38022 | 3041 | D2 tamamlanmis olabilir |
| scf_kasaislemleri_listele | 582 | **0** | 600 | D2 HIC CEKILMEMIS |
| Cek Senet Listesi | 7 | 117 | 9 | Tamam |
| Gorev Listesi | - | 0 | - | LISANS YOK - atla |
| Siparis Listesi | - | - | - | YETKI YOK - atla |

## Temel Sorunlar

1. **CancelledError**: DIA sunucusu buyuk veri setlerinde (ozellikle fatura ayrintili) timeout yapiyor. PAGE_SIZE=200 bile buyuk kayitlar icin fazla olabiliyor cunku her kayit icinde kalemler (nested data) var.

2. **Kasa D2 eksik**: `period_sync_status` tablosunda D2 icin hic kayit yok - muhtemelen daha once hic denenmemis veya denenmis ama tamamen basarisiz olmus.

3. **Fatura Ayrintili**: Tum donemlerde eksik. 200/600/1000 gibi yuvarlak sayilar, tam olarak chunk sinirinda kesildigini gosteriyor.

## Cozum Plani

### Adim 1: Edge Function'a Tarih Bazli Parcalama Ekle

`dia-data-sync/index.ts` dosyasina yeni bir `syncByDateRange` stratejisi eklenecek:

- Yeni action: `syncChunkByDate` - belirli bir tarih araligindaki verileri cekmek icin
- `_cdate` filtresi ile gun gun veya ay ay veri ceker
- Her tarih dilimi icin bagimsiz olarak `streamChunk` calistirir
- Frontend orchestrator tarih araligini belirler

Alternatif olarak mevcut `syncChunk` action'i iyilestirilecek:
- `PAGE_SIZE` parametresini istek bazinda ayarlanabilir yapmak (ornegin 50 veya 100)
- CancelledError alindiginda otomatik olarak daha kucuk sayfa boyutuyla tekrar deneme

```text
Frontend Orchestrator
       |
       v
  syncChunk (action)
       |
       +-- pageSize: 50 (kucuk)
       +-- filters: [{ field: "_cdate", operator: ">=", value: "2025-01-01" },
       |             { field: "_cdate", operator: "<=", value: "2025-01-31" }]
       +-- chunkSize: 200
       |
       v
  DIA API (kucuk parcalar halinde)
       |
       v
  writeBatch (50'serlik upsert)
```

### Adim 2: PAGE_SIZE'i Istek Bazinda Ayarlanabilir Yap

Mevcut sabit `PAGE_SIZE = 200` yerine:
- `syncChunk` action'ina `pageSize` parametresi eklenir
- Varsayilan 200 kalir ama buyuk/agir veri kaynaklari icin 50-100 arasi gonderilebilir
- `fetchPageSimple` fonksiyonuna `pageSize` parametresi iletilir

### Adim 3: Gorev Listesi ve Siparis Listesi Icin Hata Toleransi

- Gorev Listesi: `gts` modulu olmayan sunucularda 404 veya session hatasi alininca kaynak otomatik olarak `skipped` isaretlenir
- Siparis Listesi: "donem yetkiniz" hatasi alininca `skipped` olarak kaydedilir, tekrar denenmez
- Bu hatalar `period_sync_status` tablosuna `skip_reason` olarak yazilir

### Adim 4: Frontend Orchestrator'a Tarih Bazli Chunking Eklenmesi

`useSyncOrchestrator.tsx` dosyasinda:
- Buyuk veri kaynaklari icin (fatura, kasa gibi) tarih aralikli sync stratejisi
- Her donem icin ay ay (veya gerekirse gun gun) tarih filtresi ile `syncChunk` cagirilir
- Ornek: D2 (2025) icin Ocak'tan Subat'a kadar 14 aylik parcalar

### Adim 5: Corlugrup Verilerini Tamamla

Degisiklikler deploy edildikten sonra eksik verileri cek:
1. `Fatura_listele_ayrintili` - D1, D2, D3 (kucuk pageSize + tarih filtresi ile)
2. `scf_kasaislemleri_listele` - D2 (eksik donem)
3. Sonuclari dogrula

## Teknik Detaylar

### Edge Function Degisiklikleri (`dia-data-sync/index.ts`)

1. **`fetchPageSimple` fonksiyonu**: `pageSize` parametresi eklenir (varsayilan `PAGE_SIZE`)
2. **`streamChunk` fonksiyonu**: `pageSize` parametresi eklenir ve `fetchPageSimple`'a iletilir
3. **`syncChunk` action handler**: Request body'den `pageSize` okunur, `Math.min(pageSize || PAGE_SIZE, PAGE_SIZE)` ile sinirlanir
4. **Hata yonetimi**: CancelledError alindiginda mevcut yazilan veriyi koruyup `hasMore: true` ile donus yapar (mevcut davranis zaten boyle)

### Frontend Degisiklikleri (`useSyncOrchestrator.tsx`)

1. **`syncFullChunked` fonksiyonu**: Buyuk kaynaklar icin `pageSize: 50` ve tarih filtresi gonderme yetisi
2. **Tarih araligi hesaplama**: Donem baslangic/bitis tarihlerinden aylik parcalar olusturma
3. **Hata durumunda fallback**: CancelledError alinirsa `pageSize`'i daha da kucultup tekrar deneme

### Atlanacak Kaynaklar

- `Gorev Listesi` (`gts` modulu): corlugrup icin devre disi birakilacak veya hata toleransi ile atlanacak
- `Siparis Listesi`: Yetki hatasi bildirilecek, sync denenmeyecek

