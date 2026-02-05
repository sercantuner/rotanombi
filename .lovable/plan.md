

## Takvim (Date Table) Veri Kaynağı Oluşturma Planı

Power BI tarzı bir **Date/Calendar Table** veri kaynağı oluşturulacak. Bu, DIA'dan çekilen bir veri değil, sistemde otomatik üretilen bir tarih boyut tablosudur.

---

### Ne Oluşturulacak?

| Alan | Değer |
|------|-------|
| **Name** | Takvim |
| **Slug** | takvim |
| **Module** | _system |
| **Method** | calendar |
| **Description** | Power BI tarzı tarih boyut tablosu - zaman bazlı analizler için |

---

### Takvim Tablosu Alanları

```text
tarih              - Date (YYYY-MM-DD)
yil                - Number (2020, 2021, 2022...)
ay                 - Number (1-12)
ay_adi             - String (Ocak, Şubat...)
gun                - Number (1-31)
gun_adi            - String (Pazartesi, Salı...)
hafta_no           - Number (1-53)
ceyrek             - Number (1-4)
ceyrek_adi         - String (Q1, Q2, Q3, Q4)
yil_ay             - String (2024-01)
yil_ceyrek         - String (2024-Q1)
is_gunu            - Boolean (Hafta içi mi?)
hafta_sonu         - Boolean (Cumartesi/Pazar mı?)
```

---

### Teknik Uygulama

#### 1. Veritabanına Veri Kaynağı Ekleme

`data_sources` tablosuna kayıt:

```sql
INSERT INTO data_sources (
  user_id, name, slug, description,
  module, method, 
  filters, sorts, limit_count,
  cache_ttl, is_active, is_shared,
  last_fields, last_record_count
)
SELECT 
  p.user_id,
  'Takvim',
  'takvim',
  'Power BI tarzı tarih boyut tablosu - zaman bazlı analizler için',
  '_system',
  'calendar',
  '[]'::jsonb,
  '[{"field": "tarih", "sorttype": "ASC"}]'::jsonb,
  0,
  86400,
  true,
  true,
  '["tarih", "yil", "ay", "ay_adi", "gun", "gun_adi", "hafta_no", "ceyrek", "ceyrek_adi", "yil_ay", "yil_ceyrek", "is_gunu", "hafta_sonu"]'::jsonb,
  3650
FROM profiles p
WHERE p.user_id = auth.uid()
LIMIT 1;
```

#### 2. Frontend'de Takvim Verisi Üretimi

`useDataSourceLoader.tsx` dosyasına özel mantık:

```typescript
// _system modülü için özel işlem
if (dataSource.module === '_system' && dataSource.method === 'calendar') {
  const calendarData = generateCalendarData();
  return calendarData;
}
```

#### 3. Takvim Veri Üretim Fonksiyonu

```typescript
function generateCalendarData(startYear = 2020, endYear = 2030): any[] {
  const data = [];
  const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  
  for (let yil = startYear; yil <= endYear; yil++) {
    for (let ay = 0; ay < 12; ay++) {
      const gunSayisi = new Date(yil, ay + 1, 0).getDate();
      for (let gun = 1; gun <= gunSayisi; gun++) {
        const tarih = new Date(yil, ay, gun);
        const haftaGunu = tarih.getDay();
        
        data.push({
          tarih: format(tarih, 'yyyy-MM-dd'),
          yil,
          ay: ay + 1,
          ay_adi: aylar[ay],
          gun,
          gun_adi: gunler[haftaGunu],
          hafta_no: getWeek(tarih),
          ceyrek: Math.floor(ay / 3) + 1,
          ceyrek_adi: `Q${Math.floor(ay / 3) + 1}`,
          yil_ay: `${yil}-${String(ay + 1).padStart(2, '0')}`,
          yil_ceyrek: `${yil}-Q${Math.floor(ay / 3) + 1}`,
          is_gunu: haftaGunu >= 1 && haftaGunu <= 5,
          hafta_sonu: haftaGunu === 0 || haftaGunu === 6,
        });
      }
    }
  }
  return data;
}
```

---

### Kullanım Senaryoları

1. **Zaman Serisi Grafikleri**: Eksik tarihleri doldurmak için LEFT JOIN
2. **Dönemsel Karşılaştırma**: Yıl-yıl, çeyrek-çeyrek analizler
3. **Filtreleme**: Ay, çeyrek, hafta bazlı filtreler
4. **İş Günü Hesaplamaları**: Tatil günlerini hariç tutma

---

### Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `useDataSourceLoader.tsx` | `_system/calendar` için özel generate mantığı |
| `useDynamicWidgetData.tsx` | `_system` modülü kontrolü |
| Veritabanı | `data_sources` tablosuna yeni kayıt |

---

### İlişki Kurulumu (Opsiyonel)

Veri Modeli'nde diğer tablolarla ilişki:

| Kaynak | Hedef | Alan |
|--------|-------|------|
| Takvim.tarih | Fatura.tarih | 1:N |
| Takvim.tarih | Cari Hareket.tarih | 1:N |

