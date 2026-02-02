# Memory: features/chart-drill-down-popup-logic
Updated: now

Finansal yaşlandırma grafikleri (Nakit/Çek Yaşlandırma), grafik dilimlerine veya çubuklarına tıklandığında detaylı verileri gösteren bir drill-down popup (UI.Dialog) yapısına sahiptir. Bu popup'lar; ilgili dilime ait işlem detaylarını (ünvan, evrak no, vade tarihi, gün farkı vb.) listeleyerek grafik ve veri arasındaki ilişkiyi güçlendirir. Seçili dilim grafik üzerinde vurgulanırken, mevcut filtreler ve görünümler (aylık/haftalık, döviz modu) korunur.

## Popup Yapısı (Standart)
- **Dialog boyutu:** `w-[50vw] max-w-[50vw] max-h-[80vh]`
- **Header:** 3 bölgeli düzen: sol (başlık+badge), orta (bilgiler), sağ (X butonu - shrink-0)
- **İçerik:** Scroll edilebilir detay listesi (`overflow-y-auto`)
- **Detay satırları:** Ünvan, evrak/seri no, vade tarihi, gün farkı ve tutar bilgileri

## Header Yapısı (KRİTİK!)
DialogContent bileşeni X kapatma butonunu sağ üst köşeye absolute pozisyonla otomatik ekler. Bu nedenle:

**ZORUNLU:** Header div'ine `pr-12` (padding-right: 3rem) eklenmeli!

```javascript
// ✅ DOĞRU Header yapısı
React.createElement('div', { 
  className: 'flex items-center justify-between p-3 border-b border-border gap-4 pr-12' 
},
  // Sol: Başlık ve badge
  React.createElement('div', { className: 'flex items-center gap-2 min-w-0' },
    React.createElement('div', { className: 'w-3 h-3 rounded-full shrink-0', style: { backgroundColor: color } }),
    React.createElement(UI.DialogTitle, { className: 'text-sm font-semibold truncate' }, 'Başlık'),
    React.createElement('span', { className: 'text-xs text-muted-foreground shrink-0' }, 'Kayıt sayısı')
  ),
  // Orta/Sağ: Tutar/Bilgi (flex-1 ile esnek, X butonuna çarpmaz)
  React.createElement('div', { className: 'flex-1 text-right' },
    React.createElement('span', { className: 'text-sm font-bold' }, formatMoney(tutar))
  )
  // NOT: X butonu DialogContent tarafından otomatik eklenir, header'a ekleme!
)
```

## UI.Dialog Kullanımı
Custom widget'larda popup göstermek için:
```javascript
React.createElement(UI.Dialog, { open: !!selectedItem, onOpenChange: function(open) { if (!open) setSelectedItem(null); } },
  React.createElement(UI.DialogContent, { className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border' },
    // Header (3 bölgeli yapı - yukarıdaki örneğe bak)
    React.createElement(UI.DialogDescription, { className: 'sr-only' }, 'Detay listesi'),
    // Scrollable content
    React.createElement('div', { className: 'flex-1 overflow-y-auto p-3' }, /* ... */)
  )
```
