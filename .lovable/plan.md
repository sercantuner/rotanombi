

# KPI Widget Tasarım Standardizasyonu Planı

Bu plan, tüm KPI widget'larının "Eksiye Düşen Stoklar" şablonuyla aynı görsel tasarıma sahip olmasını sağlayacak ve gelecekteki AI üretimlerinde bu standardın otomatik uygulanmasını garanti altına alacaktır.

---

## Mevcut Durum Analizi

### "Eksiye Düşen Stoklar" (Doğru Tasarım ✅)
```
┌─────────────────────────┐
│                         │
│     🔺 (48x48 ikon)     │  ← Üstte, ortada ikon
│                         │
│         5               │  ← Büyük, bold sayı (ortada)
│                         │
│   Eksiye Düşen Stoklar  │  ← Küçük etiket (ortada)
│                         │
│  Detaylar için tıklayın │  ← Alt bilgi (ortada)
│                         │
└─────────────────────────┘
```
**Özellikler**: Centered layout, dikey hizalama, gap-2, tıklanabilir

### "Gecikmiş Siparişler" (Eski Tasarım ❌)
```
┌──────────────────────────────┐
│█ Gecikmiş Siparişler   🕐   │  ← Yatay düzen
│█                              │  ← Sol tarafta kırmızı çizgi
│█   5 adet                    │
│█   ₺125.000                  │
│█                              │
│█   Detaylar için tıklayın →  │
└──────────────────────────────┘
```
**Sorunlar**: Yatay düzen, sol hizalı içerik, dekoratif sol çizgi

---

## Yapılacak Değişiklikler

### Adım 1: "Gecikmiş Siparişler" Widget Güncellemesi
**Dosya**: Veritabanı - widgets tablosu (ID: d9fc4ab4-ccfe-4a0f-9b08-789007d8265d)

Mevcut customCode tamamen yeniden yazılacak:
- Yatay layout → Dikey centered layout
- Sol çizgi dekorasyonu kaldırılacak
- İkon üste alınacak (48x48, centered)
- Sayı büyük ve ortada olacak
- Etiket ve alt bilgi ortaya hizalanacak
- UI.Dialog popup sistemi korunacak

### Adım 2: AI Kod Üretici Kurallarının Güçlendirilmesi
**Dosya**: `supabase/functions/ai-code-generator/index.ts`

Mevcut kurallarda KPI şablonu tanımlı ancak daha vurgulu yapılacak:
- Sadece bir örnek yerine "ZORUNLU" ifadesi ile net kural
- Alternatif tasarımların yasak olduğu açıkça belirtilecek
- İkon pozisyon kuralları güçlendirilecek

### Adım 3: Memory Dosyası Güncelleme
**Dosya**: `.lovable/memory/style/ai-generation-kpi-fixed-template.md`

Memory dosyası genişletilecek:
- Tam kod örneği eklenecek
- Popup entegrasyonu kuralları eklenecek
- Yasak tasarımlar listesi detaylandırılacak

---

## Teknik Detaylar

### Yeni "Gecikmiş Siparişler" Widget Yapısı

```javascript
// Ana KPI Container (Centered Layout)
React.createElement('div', {
  className: 'h-full flex flex-col items-center justify-center text-center gap-2 p-3 cursor-pointer hover:bg-muted/10 transition-all',
  onClick: function() { setOpen(true); }
},
  // İkon (Üstte, ortada - 48x48)
  React.createElement('div', { 
    className: 'w-12 h-12 rounded-full flex items-center justify-center ' + 
               (count > 0 ? 'bg-destructive/10' : 'bg-success/10') 
  },
    React.createElement(LucideIcons.Clock, { 
      className: 'w-6 h-6 ' + (count > 0 ? 'text-destructive' : 'text-success') 
    })
  ),
  
  // Ana Değer (Ortada, büyük)
  React.createElement('div', { 
    className: 'text-3xl md:text-4xl font-bold ' + 
               (count > 0 ? 'text-destructive' : 'text-success') 
  }, count),
  
  // Etiket
  React.createElement('div', { 
    className: 'text-xs font-medium text-muted-foreground' 
  }, 'Geciken Siparişler'),
  
  // Alt bilgi
  React.createElement('div', { 
    className: 'text-[10px] text-muted-foreground' 
  }, 'Detaylar için tıklayın')
)
```

### AI Generator'a Eklenecek Kural Vurgusu

```text
⛔ YASAKLAR (KPI İÇİN):
- Sol/sağ dekoratif çizgiler
- flex-row ve justify-between
- İkon sağda veya solda
- text-left veya justify-start
- "adet", "₺X.XXX" gibi alt satır bilgileri (popup'ta gösterilmeli)
```

---

## Etkilenecek Alanlar

| Dosya/Kaynak | Değişiklik Türü |
|--------------|-----------------|
| `widgets` tablosu (d9fc4ab4...) | customCode güncelleme |
| `ai-code-generator/index.ts` | Kural güçlendirme |
| `ai-generation-kpi-fixed-template.md` | Doküman genişletme |

---

## Beklenen Sonuç

Güncelleme sonrasında:
1. "Gecikmiş Siparişler" widget'ı "Eksiye Düşen Stoklar" ile birebir aynı görünecek
2. Gelecekte AI ile üretilen tüm KPI widget'ları otomatik olarak bu şablonu kullanacak
3. Dashboard'daki tüm KPI'lar tutarlı görünüm sunacak

