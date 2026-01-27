
# Banka Listesi ve Finansal Liste Widget Tasarım Standardizasyonu

Bu plan, Kasa listesi tasarımını Banka listesine uygulayacak ve bu tasarım standardını AI üretici kurallarına ekleyecektir.

---

## Mevcut Durum Analizi

### Kasa Listesi Tasarımı (Hedef Şablon) ✅
```
┌─────────────────────────────────────────────────────┐
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │ TL Toplam │  │ USD Toplam│  │ EUR Toplam│       │  ← 3 KPI Kartı
│  │ ₺125.000  │  │ $5.000    │  │ €3.000    │       │
│  └───────────┘  └───────────┘  └───────────┘       │
├─────────────────────────────────────────────────────┤
│ Banka Hesap Listesi                    [12 Hesap]  │  ← Başlık + Badge
├─────────────────────────────────────────────────────┤
│ HESAP ADI        │ BANKA        │ BAKİYE          │  ← Sticky Thead
├─────────────────────────────────────────────────────┤
│ [GA] Garanti TL  │ Garanti      │ ₺ 50.000,00     │  ← Scrollable
│ [IS] İş Bank USD │ İşbank       │ $ 2.500,00      │
│ [AK] Akbank EUR  │ Akbank       │ € 1.200,00      │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

### Mevcut Banka Listesi (Eski Tasarım) ❌
- Kart bazlı liste (her hesap ayrı kart)
- Toplam KPI'lar yok
- glass-card kullanımı
- Köşeli değil, rounded

---

## Yapılacak Değişiklikler

### Adım 1: BankaHesaplari.tsx Güncellemesi
Mevcut bileşen Kasa listesi şablonuyla yeniden yazılacak:
- Üst bölüm: 3 KPI kartı (TL, USD, EUR toplamları)
- Alt bölüm: Tablo formatında hesap listesi
- Köşeli tasarım (rounded-none)
- Sticky header
- Scrollable body

### Adım 2: AI Code Generator'a Finansal Liste Şablonu Ekleme
`supabase/functions/ai-code-generator/index.ts` dosyasına yeni bir bölüm eklenecek:

Eklenecek bölüm: `📊 FİNANSAL LİSTE WIDGET ŞABLONU`

İçerik:
- KPI + Liste birleşik yapısı
- Tablo formatı kuralları
- Köşeli tasarım zorunluluğu
- Döviz bazlı gruplama

### Adım 3: Memory Dosyası Oluşturma
Yeni memory dosyası: `.lovable/memory/style/ai-generation-financial-list-template.md`

---

## Teknik Detaylar

### Yeni BankaHesaplari.tsx Yapısı

```typescript
// Döviz bazlı toplamları hesapla
const kpiTotals = { TRY: 0, USD: 0, EUR: 0 };
bankaHesaplari.forEach(item => {
  const currency = item.dovizCinsi?.toUpperCase() || 'TRY';
  if (kpiTotals[currency] !== undefined) {
    kpiTotals[currency] += item.bakiye;
  }
});

// Yapı:
// 1. Üst: 3 KPI Kartı (grid-cols-3)
// 2. Alt: Tablo (sticky thead + scrollable tbody)
```

### Yeni Finansal Liste Şablonu (AI Rules)

```text
📊 FİNANSAL LİSTE WIDGET ŞABLONU (BANKA/KASA TİPİ)
───────────────────────────────────────────────────────
Bu şablon Banka Hesapları, Kasa Bakiyeleri gibi finansal 
liste widget'ları için ZORUNLUDUR.

📐 YAPI:
1. ÜST BÖLÜM - KPI KARTLARI:
   - grid grid-cols-1 md:grid-cols-3 gap-2
   - Her kart: p-2 bg-card rounded-none border border-border
   - Başlık: text-xs font-medium text-muted-foreground
   - Değer: text-xl font-bold (renk: colors prop'dan)

2. ALT BÖLÜM - TABLO LİSTESİ:
   - Container: flex flex-col flex-1 min-h-0 bg-card rounded-none border border-border
   - Header bar: flex items-center justify-between p-2 border-b bg-muted/20
   - Table: w-full text-sm text-left
   - Thead: sticky top-0 bg-muted/50 text-xs uppercase
   - Tbody: divide-y divide-border
   - Row: hover:bg-muted/50 transition-colors

3. AVATAR (Köşeli):
   - w-6 h-6 rounded-none flex items-center justify-center bg-secondary
   - İçerik: İlk 2 harf (uppercase)

✅ ZORUNLU STİLLER:
   - rounded-none (TÜM ELEMENTLERDE - köşeli görünüm)
   - border border-border (iç container'larda)
   - sticky top-0 (thead için)
   - divide-y divide-border (tbody için)

❌ YASAK STİLLER:
   - rounded, rounded-md, rounded-lg (köşeli olmalı)
   - Kart bazlı liste (tablo formatı zorunlu)
   - glass-card (bg-card kullan)
```

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/dashboard/BankaHesaplari.tsx` | Kasa şablonuna dönüştürme |
| `supabase/functions/ai-code-generator/index.ts` | Finansal liste şablonu ekleme |
| `.lovable/memory/style/ai-generation-financial-list-template.md` | Yeni memory dosyası |

---

## Beklenen Sonuç

1. Banka Hesapları widget'ı Kasa Bakiyeleri ile aynı görünüme kavuşacak
2. Üstte döviz bazlı toplamlar (TL, USD, EUR)
3. Altta köşeli tablo formatında hesap listesi
4. AI ile üretilen tüm finansal liste widget'ları bu şablonu kullanacak
5. Tutarlı, kurumsal görünüm sağlanacak
