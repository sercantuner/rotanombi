# Memory: features/chart-drill-down-popup-logic
Updated: now

Finansal yaşlandırma grafikleri (Nakit/Çek Yaşlandırma), grafik dilimlerine veya çubuklarına tıklandığında detaylı verileri gösteren bir drill-down popup (UI.Dialog) yapısına sahiptir. Bu popup'lar; ilgili dilime ait işlem detaylarını (ünvan, evrak no, vade tarihi, gün farkı vb.) listeleyerek grafik ve veri arasındaki ilişkiyi güçlendirir. Seçili dilim grafik üzerinde vurgulanırken, mevcut filtreler ve görünümler (aylık/haftalık, döviz modu) korunur.

## Popup Yapısı (Standart)
- **Dialog boyutu:** `w-[50vw] max-w-[50vw] max-h-[80vh]`
- **Header:** Dilim rengi, başlık, kayıt sayısı badge'i ve toplam tutar
- **İçerik:** Scroll edilebilir detay listesi (`overflow-y-auto`)
- **Detay satırları:** Ünvan, evrak/seri no, vade tarihi, gün farkı ve tutar bilgileri

## UI.Dialog Kullanımı
Custom widget'larda popup göstermek için:
```javascript
React.createElement(UI.Dialog, { open: !!selectedItem, onOpenChange: function(open) { if (!open) setSelectedItem(null); } },
  React.createElement(UI.DialogContent, { className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border' },
    // Header
    // ...
    React.createElement(UI.DialogDescription, { className: 'sr-only' }, 'Detay listesi'),
    // Scrollable content
    React.createElement('div', { className: 'flex-1 overflow-y-auto p-3' }, /* ... */)
  )
)
```
