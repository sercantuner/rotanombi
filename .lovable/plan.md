
# Banka Hesapları Tasarımını Kasa Tasarımına Eşitleme Planı

Ekran görüntüsüne göre Banka listesinde fazladan dış çerçeve var ve KPI renkleri renk paletinden gelmiyor. Bu planla Banka tasarımı Kasa tasarımına tam olarak eşitlenecek.

---

## Mevcut Durum Karşılaştırması

| Özellik | Banka (Şu An) | Kasa (Hedef) |
|---------|---------------|--------------|
| Dış Container | `gap-2` (çerçevesiz) ✅ | `gap-2 p-2` |
| KPI Kartları | `text-primary/success/warning` (sabit) ❌ | `colors[index]` (dinamik palet) ✅ |
| KPI Border | `border border-border` ✅ | `border border-border` ✅ |
| Liste Container | `border border-border` ✅ | `border border-border` ✅ |

**Tespit Edilen Farklar:**
1. Banka KPI değerleri sabit Tailwind renkleri kullanıyor → `colors` prop'undan dinamik renk almalı
2. Kasa'da formatCurrency fonksiyonu sembol ile değer arasında boşluk koyuyor → Banka'da yok

---

## Yapılacak Değişiklikler

### Dosya: `src/components/dashboard/BankaHesaplari.tsx`

**Değişiklik 1: colors prop'u ekleme**
```typescript
interface Props {
  bankaHesaplari: DiaBankaHesabi[];
  toplamBakiye: number;
  isLoading?: boolean;
  colors?: string[]; // Renk paleti desteği
}
```

**Değişiklik 2: Dinamik renk fonksiyonu ekleme**
```typescript
const getColor = (index: number) => {
  return colors && colors[index % colors.length] 
    ? colors[index % colors.length] 
    : ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))'][index];
};
```

**Değişiklik 3: KPI kartlarında dinamik renk kullanımı**
```typescript
const kpiCards = [
  { label: 'Toplam TL', value: kpiTotals.TRY, currency: 'TRY', colorIndex: 0 },
  { label: 'Toplam USD', value: kpiTotals.USD, currency: 'USD', colorIndex: 1 },
  { label: 'Toplam EUR', value: kpiTotals.EUR, currency: 'EUR', colorIndex: 2 },
];

// Render içinde:
<p style={{ color: getColor(kpi.colorIndex) }} className="text-xl font-bold">
  {formatCurrency(kpi.value, kpi.currency)}
</p>
```

**Değişiklik 4: formatCurrency'de sembol-değer arası boşluk**
```typescript
const formatCurrency = (value: number, doviz: string = 'TRY') => {
  const symbol = doviz === 'USD' ? '$' : doviz === 'EUR' ? '€' : '₺';
  const formatted = Math.abs(value).toLocaleString('tr-TR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  return `${symbol} ${value < 0 ? '-' : ''}${formatted}`; // Sembol + boşluk
};
```

---

## Güncelleme Sonrası Kod Yapısı

```text
┌─────────────────────────────────────────────────────┐
│ (p-2 ile padding, dış çerçeve YOK)                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │ Toplam TL │  │ Toplam USD│  │ Toplam EUR│       │  
│  │ ₺ 101.1K  │  │ $ 0,00    │  │ € 0,00    │       │  ← colors[0], colors[1], colors[2]
│  │ (primary) │  │ (success) │  │ (warning) │       │
│  └───────────┘  └───────────┘  └───────────┘       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Banka Hesap Listesi             [5 Hesap]   │   │  ← Köşeli çerçeve
│  ├─────────────────────────────────────────────┤   │
│  │ HESAP ADI      │ IBAN         │ BAKİYE     │   │
│  ├─────────────────────────────────────────────┤   │
│  │ [EN] Enpara TL │ TR24 0015... │ ₺ 101.1K   │   │
│  │ ...                                          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Etkilenecek Dosya

| Dosya | Değişiklik |
|-------|------------|
| `src/components/dashboard/BankaHesaplari.tsx` | colors prop, dinamik renk, format düzeltmesi |

---

## Beklenen Sonuç

1. KPI kartlarındaki değerler renk paletinden dinamik renk alacak
2. Sembol ve değer arasında boşluk olacak (₺ 101.1K)
3. Banka ve Kasa widget'ları görsel olarak tam eşitlenecek
4. Tutarlı, kurumsal görünüm sağlanacak
