# Memory: features/chart-drill-down-popup-logic
Updated: now

Finansal yaşlandırma grafikleri (Nakit/Çek Yaşlandırma), grafik dilimlerine veya çubuklarına tıklandığında detaylı verileri gösteren bir drill-down popup (UI.Dialog) yapısına sahiptir. Bu popup'lar; ilgili dilime ait işlem detaylarını (ünvan, evrak no, vade tarihi, gün farkı vb.) listeleyerek grafik ve veri arasındaki ilişkiyi güçlendirir. Seçili dilim grafik üzerinde vurgulanırken, mevcut filtreler ve görünümler (aylık/haftalık, döviz modu) korunur.

## Popup Yapısı (Standart)
- **Dialog boyutu:** `w-[50vw] max-w-[50vw] max-h-[80vh]`
- **Header:** 3 bölgeli düzen: sol (başlık+badge), orta (bilgiler), sağ (X butonu - shrink-0)
- **İçerik:** Scroll edilebilir detay listesi (`overflow-y-auto`)
- **Detay satırları:** Ünvan, evrak/seri no, vade tarihi, gün farkı ve tutar bilgileri

## Header Yapısı (ÖNEMLİ!)
Popup header'da bilgi ve kapatma butonu üst üste binmemeli:
```javascript
// Header - 3 bölgeli düzen
React.createElement('div', { className: 'flex items-center justify-between p-4 border-b border-border' },
  // Sol: Başlık ve badge
  React.createElement('div', { className: 'flex items-center gap-3' },
    React.createElement('div', { className: 'w-4 h-4 rounded-full', style: { backgroundColor: color } }),
    React.createElement('div', null,
      React.createElement('h3', { className: 'text-lg font-bold text-foreground' }, 'Başlık'),
      React.createElement('span', { className: 'text-xs text-muted-foreground' }, 'Kayıt sayısı')
    )
  ),
  // Orta: Tutar/Bilgi (flex-1 ile esnek)
  React.createElement('div', { className: 'flex-1 text-right px-4' },
    React.createElement('span', { className: 'text-lg font-bold text-foreground' }, formatMoney(tutar))
  ),
  // Sağ: Kapatma butonu (shrink-0 ile sabit genişlik)
  React.createElement('button', { 
    onClick: function() { setSelectedItem(null); },
    className: 'p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0'
  }, /* X ikonu */)
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
)
```
```
