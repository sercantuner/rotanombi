
# Banka Hesapları Widget'ının Kasa Tasarımına Eşitlenmesi

## Tespit Edilen Farklar

Ekran görüntüsü analizi:

| Özellik | Banka (Mevcut) | Kasa (Hedef) |
|---------|----------------|--------------|
| Ana container padding | Yok | `p-2` |
| KPI değer renkleri | Renk paletten gelmiyor | `colors` array'inden dinamik |
| KPI etiket önü | Yalnız metin | Renkli nokta (●) + metin |
| Dış Card çerçevesi | Var (fazladan) | Yok |
| colors prop kullanımı | Tanımlı ama render'da geçirilmiyor | Aktif kullanılıyor |

---

## Yapılacak Değişiklikler

### 1. `DynamicWidgetRenderer.tsx` - colors prop geçirme

`BankaHesaplari` bileşenine `colors` prop'unun geçirilmesi gerekiyor:

```typescript
case 'liste_banka_hesaplari':
  return (
    <BankaHesaplari 
      bankaHesaplari={bankaHesaplari || []} 
      toplamBakiye={toplamBankaBakiye || 0}
      isLoading={isLoading}
      colors={colors} // EKLENMESİ GEREKEN
    />
  );
```

Bunun için `DynamicWidgetRenderer` bileşenine `colors` prop'u eklenmeli.

### 2. `BankaHesaplari.tsx` - Kasa ile aynı tasarım

**Değişiklik 2.1: Ana container'a padding ekleme**
```typescript
// Mevcut:
<div className="h-full flex flex-col gap-2">

// Hedef:
<div className="h-full flex flex-col gap-2 p-2">
```

**Değişiklik 2.2: KPI etiketlerinin önüne renkli nokta ekleme**
```typescript
// Mevcut:
<p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>

// Hedef (Kasa tasarımı):
<div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
  <span 
    className="w-2 h-2 rounded-full" 
    style={{ backgroundColor: getColor(kpi.colorIndex) }} 
  />
  {kpi.label}
</div>
```

**Değişiklik 2.3: KPI kartlarından shadow ekleme (tutarlılık)**
```typescript
// Mevcut:
className="p-2 bg-card rounded-none border border-border"

// Hedef:
className="p-2 bg-card rounded-none border border-border shadow-sm"
```

**Değişiklik 2.4: KPI etiket metinlerini güncelleme**
```typescript
// Mevcut:
{ label: 'TL Toplam', ... }

// Hedef (Kasa ile uyumlu):
{ label: 'Toplam TL Varlığı', ... }
```

---

## Etkilenecek Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/components/dashboard/BankaHesaplari.tsx` | KPI renkli nokta, padding, shadow ekleme |
| `src/components/dashboard/DynamicWidgetRenderer.tsx` | colors prop geçirme |

---

## Beklenen Görsel Sonuç

```
┌─────────────────────────────────────────────────────┐
│ (p-2 padding ile iç boşluk)                        │
│                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │ ● Toplam  │  │ ● Toplam  │  │ ● Toplam  │       │  ← Renkli nokta
│  │   TL      │  │   USD     │  │   EUR     │       │
│  │ ₺ 101.1K  │  │ $ 0,00    │  │ € 0,00    │       │  ← Palette renkleri
│  └───────────┘  └───────────┘  └───────────┘       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Banka Hesap Listesi             [5 Hesap]   │   │
│  ├─────────────────────────────────────────────┤   │
│  │ HESAP ADI        │ BANKA      │ BAKİYE     │   │
│  ├─────────────────────────────────────────────┤   │
│  │ [EN] Enpara TL   │ QNB        │ ₺ 101.1K   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Banka widget'ı artık Kasa widget'ı ile tam görsel uyum sağlayacak.
