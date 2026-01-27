
# KPI ve Kart Widget'larından Dış Çerçeve Kaldırma Planı

Bu plan, tüm KPI widget'larından ve Banka/Kasa kartlarından dış çerçeve (border) kaldırılmasını ve bu kuralın gelecekteki tüm AI üretimlerine uygulanmasını sağlayacaktır.

---

## Mevcut Durum

### Sorunlu Alanlar:
1. **Memory dosyasındaki KPI şablonu**: `border border-border` içeriyor
2. **glass-card CSS sınıfı**: `border: 1px solid var(--glass-border)` içeriyor
3. **Gecikmiş Siparişler widget**: Veritabanındaki customCode'da `border border-border` var
4. **BankaHesaplari.tsx**: `glass-card` kullanıyor (border içerir)

---

## Yapılacak Değişiklikler

### Adım 1: Memory Dosyası Güncelleme
**Dosya**: `.lovable/memory/style/ai-generation-kpi-fixed-template.md`

Değişiklik:
```diff
- className: 'h-full p-3 bg-card rounded border border-border cursor-pointer...'
+ className: 'h-full p-3 bg-card rounded cursor-pointer...'
```

Yasaklar listesine eklenecek:
- `border` ve `border-border` (dış çerçeve)

### Adım 2: CSS Glass-Card Güncelleme
**Dosya**: `src/index.css`

Değişiklik:
```diff
  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(8px);
-   border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-sm);
  }
```

### Adım 3: Gecikmiş Siparişler Widget Güncelleme
**Kaynak**: Veritabanı - widgets tablosu (ID: d9fc4ab4-ccfe-4a0f-9b08-789007d8265d)

customCode içindeki className güncelleme:
```diff
- 'h-full p-3 bg-card rounded border border-border cursor-pointer...'
+ 'h-full p-3 bg-card rounded cursor-pointer...'
```

### Adım 4: AI Kod Üretici Kuralları Güncelleme
**Dosya**: `supabase/functions/ai-code-generator/index.ts`

KPI kurallarına eklenecek:
- Dış çerçeve (border) kullanımı yasak
- Sadece iç öğelerde border kullanılabilir (liste satırları vb.)

---

## Teknik Detaylar

### Yeni KPI Container Şablonu (Çerçevesiz)
```javascript
React.createElement('div', {
  className: 'h-full p-3 bg-card rounded cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center gap-2',
  onClick: function() { setIsOpen(true); }
}, ...)
```

### Yeni Yasaklar Listesi
| Yasak Öğe | Açıklama |
|-----------|----------|
| `border` | Dış çerçeve |
| `border-border` | Border rengi |
| `border-l-4` vb. | Dekoratif çizgiler |
| `glass-border` | Glass efekt çerçevesi |

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik Türü |
|-------|-----------------|
| `.lovable/memory/style/ai-generation-kpi-fixed-template.md` | Border kaldırma |
| `src/index.css` | glass-card border kaldırma |
| `supabase/functions/ai-code-generator/index.ts` | Kural güncelleme |
| Veritabanı: widgets tablosu | customCode güncelleme |

---

## Beklenen Sonuç

Güncelleme sonrasında:
1. Tüm KPI widget'ları çerçevesiz görünecek
2. Banka ve Kasa kartları çerçevesiz olacak (glass-card)
3. AI ile üretilen yeni widget'lar otomatik olarak çerçevesiz tasarımla oluşturulacak
4. Dashboard daha temiz ve modern bir görünüm kazanacak
