
# Veri Yükleme Sorunları - Analiz ve Düzeltme Planı

## Tespit Edilen Sorunlar

### Sorun 1: Net Satış Cirosu ve Fatura Sayısı - "pending" durumunda kalıyor
**Kök Neden:** `invoice_summary_mv` materialized view var ama **populate edilmemiş** (REFRESH yapılmamış). `get_invoice_summary` RPC bu MV'den veri çekiyor, boş dönünce fallback olarak 9 dönemden 52.000+ ham JSONB kaydı çekmeye çalışıyor ve timeout oluyor.

Ek olarak, `useDynamicWidgetData.tsx` icerisindeki `fetchFromDatabase` fonksiyonu `period_read_mode` parametresini **hiç kontrol etmiyor**. `isPeriodIndependent=true` olan kaynaklar için donem filtresi kaldırılıyor ve tüm dönemler çekilmeye çalışılıyor.

### Sorun 2: Nakit Akış Yaşlandırması - veri var ama göstermiyor
Konsol logları widget'ın 2088 kayıt aldığını gösteriyor (`hasData: true, rawDataLength: 2088`). Veri yüklenmiş durumda. Bu widget `Cari_vade_bakiye_listele` + `cari_kart_listesi` kullanıyor ve her ikisi de artık `current_only` modunda. 

Muhtemel sorun: `useDynamicWidgetData` icindeki `fetchFromDatabase` fonksiyonu `period_read_mode`'u tanımadığı için `isPeriodIndependent=true` kaynaklarda dönem filtresi yok ve bu da multi-query `forceNoFallback` mantığıyla çelişiyor. Veriler yükleniyor ama left_join sonrası dönem uyumsuzluğu nedeniyle eşleşmeler başarısız olabiliyor.

---

## Düzeltme Planı

### Adim 1: Materialized View'i Populate Et (SQL)
```sql
REFRESH MATERIALIZED VIEW public.invoice_summary_mv;
```
Bu tek komutla `get_invoice_summary` RPC çalışır hale gelecek ve 52K ham JSONB sorgusu yerine optimize edilmiş MV'den okunacak.

### Adim 2: useDynamicWidgetData.tsx - period_read_mode Desteği
`fetchFromDatabase` fonksiyonuna `periodReadMode` parametresi eklenecek:
- `current_only` modunda: `isPeriodIndependent` olsa bile `donem_kodu` filtresi uygulanacak
- `all_periods` modunda (veya tanımsız): Mevcut davranış korunacak

Ek olarak `isPeriodIndependent` helper fonksiyonuna (satır ~1220) `period_read_mode` kontrolü eklenecek:
```
const isPeriodIndependent = (dataSourceId) => {
  const ds = dataSources.find(d => d.id === dataSourceId);
  if (!ds) return false;
  if (ds.period_read_mode === 'current_only') return false;
  return ds.is_period_independent === true;
};
```

### Adim 3: fetchFromDatabase - scf_fatura_listele PAGE_SIZE Optimizasyonu
`useDynamicWidgetData` icindeki `fetchFromDatabase` fonksiyonunda da fatura sorguları için PAGE_SIZE küçültülecek (1000 -> 200).

---

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| SQL (REFRESH MV) | Materialized view populate |
| `src/hooks/useDynamicWidgetData.tsx` | `fetchFromDatabase`'e `periodReadMode` parametre ekleme, `isPeriodIndependent` helper güncelleme, PAGE_SIZE optimizasyonu |

## Beklenen Sonuc
- Net Satış KPI'ları MV'den hızlıca yüklenecek (timeout yok)
- `current_only` modundaki kaynaklar `useDynamicWidgetData` üzerinden de sadece aktif dönemden okunacak
- Nakit Akış widget'ı dönem tutarlılığı sağlanarak düzgün render edilecek
