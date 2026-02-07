
# Arka Plan Veri Güncelleme (Background Revalidate) Implementasyonu

## ✅ TAMAMLANDI

### Implementasyon Özeti

Widget açıldığında Stale-While-Revalidate stratejisi uygulandı:
1. ✅ Önce DB'den veri gösterilir (anında)
2. ✅ Veri 1 saatten eskiyse → arka planda DIA API çağrısı başlar
3. ✅ DIA'dan veri gelince → DB'ye yaz → UI sessizce güncellenir → badge "Güncel" olur
4. ✅ Aynı veri kaynağı (A widget'ı için çekildiyse) B widget'ı için tekrar çekilmez

### Yapılan Değişiklikler

| Dosya | Değişiklik |
|-------|-----------|
| `src/contexts/DiaDataCacheContext.tsx` | Global `revalidatingSourcesRef` eklendi, `isSourceRevalidating` ve `markSourceRevalidating` fonksiyonları |
| `src/hooks/useDynamicWidgetData.tsx` | `backgroundRevalidate` fonksiyonu, stale kontrolü sonrası otomatik tetikleme |
| `src/components/dashboard/DataStatusBadge.tsx` | Zaten mevcut - `isRevalidating` durumu gösteriliyor |

### Akış

```text
Widget Açılır
     │
     ▼
┌─────────────────────────┐
│ DB'den veri göster      │ Badge: "Önbellek" veya "Eski"
└───────────┬─────────────┘
            │ (lastSyncedAt > 1 saat)
            ▼
┌─────────────────────────┐
│ Arka planda DIA API     │ Badge: "Güncelleniyor..."
│ (dia-data-sync edge fn) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ DB güncellendi          │ Badge: "Güncel ✓"
│ UI sessizce yenilendi   │
└─────────────────────────┘
```

### Güvenlik Kuralları

- ✅ Periyodik polling YOK - sadece sayfa açıldığında tetiklenir
- ✅ Rate limit koruması: Aynı kaynak için eş zamanlı çoklu sync engellenir (global tracker)
- ✅ DIA kontör tasarrufu: Sadece stale (> 1 saat) veriler için sync yapılır

