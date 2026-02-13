
# Senkronizasyon Zamanı Güncellenmeme Sorunu - Düzeltme Planı

## Sorunun Kökü

Arayüzde her veri kaynağının yanında gösterilen "yaklaşık X saat önce" bilgisi `data_sources.last_fetched_at` alanından okunuyor. Ancak arka plan senkronizasyon motoru (dia-data-sync edge fonksiyonu) bu alanı **hiç güncellemiyor**. Motor sadece `period_sync_status.last_incremental_sync` tablosuna yazıyor -- bu tamamen farklı bir tablo.

Dolayısıyla senkronizasyon başarıyla tamamlansa bile arayüz eski zamandan okumaya devam ediyor.

## Çözüm

`dia-data-sync` edge fonksiyonunda, bir veri kaynağının senkronizasyonu tamamlandığında `data_sources.last_fetched_at` alanını da güncellemek.

### Yapılacak Değişiklikler

**1. `supabase/functions/dia-data-sync/index.ts`**

- `syncChunk` aksiyonunda, chunk tamamlandığında (tüm veriler yazıldıktan sonra) ilgili data source'un `last_fetched_at` ve `last_record_count` alanlarını güncelle.
- `reconcileKeys` aksiyonunda da aynı güncellemeyi yap.
- `fullSyncDirect` aksiyonunda da sync bittiğinde güncelle.
- Güncelleme mantığı basit bir SQL:
```sql
UPDATE data_sources 
SET last_fetched_at = NOW(), 
    last_record_count = <toplam_kayit>
WHERE slug = <slug>
```

**2. `src/hooks/useSyncOrchestrator.tsx`**

- Senkronizasyon tamamlandığında (`progress.isRunning` false olduğunda) `data-sources` query cache'ini invalidate ederek arayüzün yeni zamanları okumasını sağla.

### Teknik Detay

Edge fonksiyondaki 3 kritik noktada `data_sources` tablosu güncellenecek:

1. **syncChunk** - Son chunk tamamlandığında
2. **reconcileKeys** - Uzlaştırma bittiğinde  
3. **fullSyncDirect** (cron modu) - Her kaynak tamamlandığında

Her durumda `company_data_cache` tablosundan güncel kayıt sayısı da hesaplanarak `last_record_count` alanı da güncellenecek.
