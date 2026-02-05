
# DIA API'de Seçili Sütunları Optimize Etme Planı

## Özet
Transform Editör'de devre dışı bırakılan sütunların DIA API sorgularına doğru formatta eklenmesi ve böylece veri transferinin optimize edilmesi.

## Mevcut Durum Analizi

### Veritabanı
- `data_sources.selected_columns`: Seçili sütunları array olarak saklanıyor ✅
- Örnek: `["_key", "turu", "tarih", "toplam", ...]`

### Transform Editör 
- Sütun seçimi yapılabiliyor ve `selected_columns` olarak kaydediliyor ✅

### useDataSourceLoader
- `selectedColumns: dataSource.selected_columns` olarak edge function'a gönderiliyor ✅

### Sorun: Edge Function
Mevcut kod (`dia-api-test/index.ts` satır 556-559):
```typescript
if (selectedColumns.length > 0) {
  payload[methodKey].selectedcolumns = selectedColumns.join(',');
}
```

Bu, DIA API'ye şu şekilde gönderiyor:
```json
{
  "scf_carikart_listele": {
    "selectedcolumns": "_key,turu,tarih,toplam"
  }
}
```

### DIA API Beklentisi (Custom Knowledge'dan)
```json
{
  "scf_carikart_listele": {
    "params": {
      "selectedcolumns": ["_key", "turu", "tarih", "toplam"]
    }
  }
}
```

## Yapılacak Değişiklikler

### 1. Edge Function Güncelleme (`dia-api-test/index.ts`)

`selectedcolumns` parametresini `params` objesi içine taşı ve array formatında gönder:

```text
// Mevcut (satır 556-559)
if (selectedColumns.length > 0) {
  payload[methodKey].selectedcolumns = selectedColumns.join(',');
}

// Yeni
if (selectedColumns.length > 0) {
  // DIA API: selectedcolumns params objesi içinde array olarak gönderilmeli
  if (!payload[methodKey].params) {
    payload[methodKey].params = {};
  }
  payload[methodKey].params.selectedcolumns = selectedColumns;
}
```

### 2. Dönem Loop İçin Aynı Düzeltme

Period loop mekanizmasında da `selectedcolumns` doğru formatta olmalı (satır 650-700 civarı).

---

## Teknik Detaylar

### Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/dia-api-test/index.ts` | `selectedcolumns` formatını `params` objesi içine al, array olarak gönder |

### Geriye Dönük Uyumluluk

- Bu değişiklik tüm veri kaynakları için geçerli olacak
- Eğer `selected_columns` boşsa (`null` veya `[]`), `params.selectedcolumns` eklenmeyecek ve DIA tüm sütunları döndürecek (mevcut davranış)

### Test Senaryoları

1. Transform Editör'de birkaç sütun seç, kaydet
2. Dashboard'da ilgili widget'ın verilerini kontrol et
3. Edge function loglarında `selectedcolumns` parametresinin doğru gönderildiğini doğrula

### Beklenen Faydalar

- **Veri Tasarrufu**: Sadece seçili sütunlar çekilecek
- **Hız**: Daha az veri = daha hızlı yanıt
- **Kontör Tasarrufu**: DIA API'den daha az veri çekilmesi
