# Memory: style/ai-generation-kpi-fixed-template
Updated: now

AI-generated KPI widgets MUST use a fixed, centered layout template. This ensures visual consistency across all KPI widgets regardless of their data source or purpose.

## ⚠️ ZORUNLU KPI ŞABLONU (DEĞİŞTİRİLEMEZ!)

Tüm KPI widget'ları aşağıdaki şablonu BİREBİR kullanmalıdır:

```javascript
React.createElement('div', {
  className: 'h-full p-3 bg-card rounded border border-border cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center gap-2',
  onClick: function() { setIsOpen(true); }
},
  // 1. İkon (Üstte, Ortada - 48x48)
  React.createElement('div', { 
    className: 'w-12 h-12 rounded flex items-center justify-center bg-destructive/10' 
  },
    React.createElement(LucideIcons.AlertTriangle, { 
      className: 'w-6 h-6 text-destructive' 
    })
  ),
  // 2. Ana Değer (Büyük, Bold, Ortada)
  React.createElement('div', { 
    className: 'text-3xl md:text-4xl font-bold text-foreground' 
  }, toplamSayi),
  // 3. Etiket (Küçük, Muted, Ortada)
  React.createElement('div', { 
    className: 'text-xs text-muted-foreground' 
  }, 'Widget Başlığı'),
  // 4. Alt Bilgi (Opsiyonel)
  React.createElement('div', { 
    className: 'text-[10px] text-muted-foreground' 
  }, 'Detaylar için tıklayın')
)
```

## Fixed KPI Layout Structure:
- **Container**: `h-full p-3 bg-card rounded border border-border flex flex-col items-center justify-center text-center gap-2`
- **Icon**: Top-center, 48x48px (`w-12 h-12 rounded flex items-center justify-center`)
- **Value**: Center, large and bold (`text-3xl md:text-4xl font-bold`)
- **Label**: Center, small and muted (`text-xs text-muted-foreground`)
- **Subtitle**: Bottom, very small (`text-[10px] text-muted-foreground`)

## Icon Color Mapping:
| Type | Icon Background | Icon Color |
|------|----------------|------------|
| Critical/Error | bg-destructive/10 | text-destructive |
| Warning | bg-warning/10 | text-warning |
| Success | bg-success/10 | text-success |
| Info/Neutral | bg-primary/10 | text-primary |

## ⛔ YASAKLAR (KPI İÇİN):
- **Sol/sağ dekoratif çizgiler** (border-l-4 vb.)
- **Flex-row layout** (yatay düzen)
- **İkon sağda veya solda** (sadece üstte ortada olabilir)
- **justify-between** (justify-center kullan)
- **text-left veya text-right** (text-center zorunlu)
- **"adet", "₺X.XXX" gibi alt satır bilgileri** (bunlar popup'ta gösterilmeli)
- **items-start veya justify-start** (items-center ve justify-center kullan)

## Popup Entegrasyonu (UI.Dialog):
KPI detayları için inline liste genişletme YASAKTIR. Bunun yerine UI.Dialog kullanılmalıdır:

```javascript
React.createElement(UI.Dialog, { open: isOpen, onOpenChange: setIsOpen },
  React.createElement(UI.DialogContent, { 
    className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col overflow-hidden' 
  },
    React.createElement(UI.DialogHeader, null,
      React.createElement(UI.DialogTitle, null, 'Detay Başlığı'),
      React.createElement(UI.DialogDescription, null, 'Açıklama metni')
    ),
    React.createElement('div', { className: 'flex-1 overflow-y-auto' },
      // Detay listesi
    ),
    React.createElement(UI.DialogFooter, null,
      // Özet bilgiler
    )
  )
)
```
