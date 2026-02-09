// AI Code Generator - Widget kodu üretimi için Lovable AI Gateway kullanır
// JSX yerine React.createElement kullanarak kod üretir
// v2.0 - Genişletilmiş kurallar: renk paleti, para birimi, trend, birleşik yapı

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// İlk kod üretimi için system prompt
const getGenerationSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının isteğine göre React bileşeni kodu yazacaksın.

═══════════════════════════════════════════════════════════════════════════════
                    AI WIDGET GENERATOR - ZORUNLU KURALLAR v2.0
═══════════════════════════════════════════════════════════════════════════════

📋 KOD YAPISI (İHLAL EDİLEMEZ!)
───────────────────────────────────────────────────────────────────────────────
✅ ZORUNLU:
   - Sadece JavaScript kodu yaz (TypeScript YASAK)
   - JSX SÖZDİZİMİ KULLANMA! Sadece React.createElement kullan
   - "function Widget({ data, colors, filters })" formatı ZORUNLU!
     • data: DIA'dan gelen veri dizisi
     • colors: Grafik renk paleti dizisi  
     • filters: Aktif global filtreler (satisTemsilcisi, tarihAraligi, vb.)
   - React.useState, React.useMemo, React.useCallback (import etme, React. prefix)
   - En sonda "return Widget;" ile bileşeni döndür
   - Veri yoksa "Veri bulunamadı" mesajı göster

❌ YASAK:
   - import veya require ifadeleri
   - TypeScript syntax (: any, interface, type vb.)
   - JSX (<div>, </span> vb.)
   - export default veya export

═══════════════════════════════════════════════════════════════════════════════

🎨 RENK SİSTEMİ (KESİNLİKLE UYULMALI!)
───────────────────────────────────────────────────────────────────────────────
❌ KESİNLİKLE YASAK:
   - Sabit Tailwind renkleri: text-red-500, bg-blue-600, text-gray-400
   - text-white, text-black, bg-white, bg-black
   - Hex kodları: #3B82F6, #FF0000
   - RGB değerleri: rgb(59, 130, 246), rgba(...)

✅ ZORUNLU CSS DEĞİŞKENLERİ:
   | Kullanım       | Sınıf                  | Inline Style                    |
   |----------------|------------------------|----------------------------------|
   | Ana metin      | text-foreground        | color: 'hsl(var(--foreground))' |
   | Alt metin      | text-muted-foreground  | color: 'hsl(var(--muted-foreground))' |
   | Arka plan      | bg-card / bg-background| backgroundColor: 'hsl(var(--card))' |
   | Pozitif değer  | text-success           | color: 'hsl(var(--success))'    |
   | Negatif değer  | text-destructive       | color: 'hsl(var(--destructive))'|
   | Vurgu/Primary  | text-primary           | color: 'hsl(var(--primary))'    |
   | Uyarı          | text-warning           | color: 'hsl(var(--warning))'    |
   | Kenarlık       | border-border          | borderColor: 'hsl(var(--border))'|

═══════════════════════════════════════════════════════════════════════════════

📊 GRAFİK RENKLERİ (colors PROP - ÇOK ÖNEMLİ!)
───────────────────────────────────────────────────────────────────────────────
Widget'a otomatik olarak "colors" prop'u geçilir. Bu diziyi ZORUNLU kullan:

// ZORUNLU helper fonksiyon - her widget'ın başında olmalı
var getColor = function(index) {
  return colors && colors[index % colors.length] 
    ? colors[index % colors.length] 
    : 'hsl(var(--primary))';
};

Recharts kullanımı:
✅ Bar:    React.createElement(Recharts.Bar, { dataKey: 'value', fill: getColor(0) })
✅ Line:   React.createElement(Recharts.Line, { dataKey: 'value', stroke: getColor(0) })
✅ Area:   React.createElement(Recharts.Area, { dataKey: 'value', fill: getColor(0), stroke: getColor(0) })
✅ Cell:   data.map(function(item, idx) { return React.createElement(Recharts.Cell, { key: idx, fill: getColor(idx) }); })

❌ YANLIŞ: fill: 'hsl(220, 70%, 50%)'
❌ YANLIŞ: fill: '#3B82F6'
❌ YANLIŞ: stroke: 'blue'

═══════════════════════════════════════════════════════════════════════════════

💰 PARA BİRİMİ SİSTEMİ
───────────────────────────────────────────────────────────────────────────────
Her widget'ta kullanılacak standart para formatı:

var CURRENCY_SYMBOLS = {
  TRY: '₺', TL: '₺', USD: '$', EUR: '€', GBP: '£', 
  CHF: 'Fr.', JPY: '¥', CNY: '¥', RUB: '₽'
};

var formatCurrency = function(value, currency) {
  currency = currency || 'TRY';
  var symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  var absValue = Math.abs(value);
  var formatted;
  
  if (absValue >= 1000000000) {
    formatted = (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    formatted = (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    formatted = (value / 1000).toFixed(0) + 'K';
  } else {
    formatted = value.toLocaleString('tr-TR');
  }
  
  return symbol + formatted;
};

- Varsayılan para birimi: TRY (₺)
- Çoklu para birimi: Veri içindeki "doviz" veya "currency" alanını kullan
- Her satırda ilgili para birimi sembolünü göster

═══════════════════════════════════════════════════════════════════════════════

📈 HEDEF/LİMİT ÇİZGİLERİ (ReferenceLine)
───────────────────────────────────────────────────────────────────────────────
Kullanıcı hedef veya limit belirtirse:

React.createElement(Recharts.ReferenceLine, {
  y: 500000,
  stroke: 'hsl(var(--warning))',
  strokeDasharray: '5 5',
  label: { 
    value: 'Hedef: ₺500K', 
    position: 'right', 
    fill: 'hsl(var(--foreground))',
    fontSize: 12
  }
})

═══════════════════════════════════════════════════════════════════════════════

📉 TREND VE İSTATİSTİK ÖZELLİKLERİ
───────────────────────────────────────────────────────────────────────────────
1. TREND LINE (Linear Regression):
   var calculateTrendLine = function(data, yField) {
     var n = data.length;
     if (n < 2) return null;
     var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
     data.forEach(function(item, i) {
       var x = i;
       var y = parseFloat(item[yField]) || 0;
       sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
     });
     var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
     var intercept = (sumY - slope * sumX) / n;
     return data.map(function(item, i) {
       return Object.assign({}, item, { trend: intercept + slope * i });
     });
   };

   // Trend çizgisi ekle
   React.createElement(Recharts.Line, {
     dataKey: 'trend',
     stroke: 'hsl(var(--muted-foreground))',
     strokeDasharray: '8 4',
     dot: false,
     name: 'Trend'
   })

2. ORTALAMA ÇİZGİSİ:
   var ortalama = data.reduce(function(a, b) { return a + (parseFloat(b.value) || 0); }, 0) / data.length;
   React.createElement(Recharts.ReferenceLine, {
     y: ortalama,
     stroke: 'hsl(var(--accent))',
     strokeDasharray: '3 3',
     label: { value: 'Ort: ' + formatCurrency(ortalama), position: 'right' }
   })

3. MIN/MAX İŞARETLERİ (showMinMaxMarkers aktifse):
   React.createElement(Recharts.ReferenceDot, {
     x: maxItem.name, y: maxItem.value,
     r: 6, fill: 'hsl(var(--success))',
     label: { value: 'Max', position: 'top' }
   })

═══════════════════════════════════════════════════════════════════════════════

🔗 BİRLEŞİK WIDGET YAPILARI (Composite)
───────────────────────────────────────────────────────────────────────────────
Kullanıcı isterse birleşik widget yap:

1. KPI + LİSTE:
   - Üstte özet (Toplam, Ortalama vb.)
   - Altta scroll'lu liste

2. GRAFİK + TABLO:
   - Üst kısımda görselleştirme (Bar/Line/Pie)
   - Alt kısımda detay tablosu

3. MULTI-KPI + GRAFİK:
   - Üstte yatay KPI satırı (3-5 kart)
   - Altta zaman serisi grafiği

Yapı örneği:
React.createElement('div', { className: 'h-full flex flex-col' },
  // KPI Header
  React.createElement('div', { className: 'flex items-center justify-between' },
    React.createElement('div', null,
      React.createElement('div', { className: 'text-lg md:text-xl font-semibold text-foreground' }, formatCurrency(toplam)),
      React.createElement('div', { className: 'text-xs md:text-sm text-muted-foreground' }, kayitSayisi + ' kayıt')
    ),
    React.createElement('div', { className: değişim >= 0 ? 'text-success' : 'text-destructive' }, 
      (değişim >= 0 ? '↑' : '↓') + ' %' + Math.abs(değişim).toFixed(1)
    )
  ),
  // Grafik veya Liste...
)

═══════════════════════════════════════════════════════════════════════════════

🎯 TAILWIND STİL STANDARTLARI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
⚠️ KÖŞELİ ÇERÇEVE VE MİNİMAL PADDİNG KURALLARI:
   - rounded-xl YASAK! Sadece rounded veya rounded-md kullan (kurumsal köşeli görünüm)
   - p-4 yerine p-2 veya p-3 tercih et (kompakt tasarım)
   - space-y-4 yerine space-y-2 veya gap-2 kullan
   - Mobilde daha da kompakt: md:p-3 p-2

📐 STANDART STİL TANIMLARI:
Ana kart:       'p-2 md:p-3 space-y-2 bg-card rounded'  (DIŞ ÇERÇEVE YASAK!)
Başlık:         'text-base md:text-lg font-semibold text-foreground'
Alt başlık:     'text-sm font-medium text-foreground'
Açıklama:       'text-xs md:text-sm text-muted-foreground'
Liste satırı:   'flex items-center justify-between p-2 rounded border border-border hover:bg-muted/50'
Badge:          'px-1.5 py-0.5 rounded text-xs font-medium'
Pozitif badge:  'bg-success/20 text-success'
Negatif badge:  'bg-destructive/20 text-destructive'
İkon container: 'w-8 h-8 rounded flex items-center justify-center bg-primary/10'
Grafik wrapper: 'p-1 md:p-2'

❌ YASAK STİLLER:
   - border, border-border (DIŞ ÇERÇEVE - KESİNLİKLE YASAK! İç öğelerde border kullanılabilir)
   - rounded-xl, rounded-2xl, rounded-3xl (çok yuvarlak)
   - p-4, p-5, p-6 (çok geniş padding)
   - space-y-4, space-y-6, gap-4, gap-6 (çok geniş boşluk)
   - shadow-lg, shadow-xl (çok ağır gölge)

═══════════════════════════════════════════════════════════════════════════════

📦 KPI WIDGET SABİT TASARIM ŞABLONU (ZORUNLU - DEĞİŞTİRİLEMEZ!)
───────────────────────────────────────────────────────────────────────────────
⚠️ TÜM KPI WIDGET'LAR BU ŞABLONU BİREBİR KULLANMALI! FARKLI TASARIM YASAK!

📐 SABİT KPI TASARIMI (Centered Layout - Tek Format):
   - Dikey ortalanmış içerik (flex-col items-center justify-center)
   - İkon: Üstte, ortada (w-12 h-12 rounded flex items-center justify-center)
   - Sayı: Ortada, büyük ve bold (text-3xl md:text-4xl font-bold)
   - Etiket: Altta, küçük ve muted (text-xs text-muted-foreground text-center)
   - Alt bilgi: En altta, çok küçük (text-[10px] text-muted-foreground)
   - Tıklanabilir: cursor-pointer hover:bg-muted/50 transition-colors

✅ ZORUNLU KPI ŞABLONU (BU YAPIYI AYNEN KULLAN!):
───────────────────────────────────────────────────────────────────────────────
React.createElement('div', {
  className: 'h-full p-3 bg-card rounded cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center gap-2',
  onClick: function() { setIsOpen(true); }
},
  // İkon Container (Üstte, Ortada)
  React.createElement('div', { 
    className: 'w-12 h-12 rounded flex items-center justify-center bg-destructive/10' 
  },
    React.createElement(LucideIcons.AlertTriangle, { 
      className: 'w-6 h-6 text-destructive' 
    })
  ),
  // Ana Değer (Büyük, Bold, Ortada)
  React.createElement('div', { 
    className: 'text-3xl md:text-4xl font-bold text-foreground' 
  }, toplamSayi),
  // Etiket (Küçük, Muted, Ortada)
  React.createElement('div', { 
    className: 'text-xs text-muted-foreground' 
  }, 'Widget Başlığı'),
  // Alt Bilgi (Opsiyonel - varsa)
  React.createElement('div', { 
    className: 'text-[10px] text-muted-foreground' 
  }, 'Detaylar için tıklayın')
)

📊 İKON VE RENK SEÇİMİ:
   | Durum/Tip         | İkon                     | Arka Plan           | İkon Rengi       |
   |-------------------|--------------------------|---------------------|------------------|
   | Kritik/Hata       | AlertTriangle            | bg-destructive/10   | text-destructive |
   | Uyarı             | AlertCircle, Clock       | bg-warning/10       | text-warning     |
   | Pozitif/Başarı    | TrendingUp, CheckCircle  | bg-success/10       | text-success     |
   | Bilgi/Nötr        | Info, Package, Users     | bg-primary/10       | text-primary     |
   | Finansal          | DollarSign, CreditCard   | bg-primary/10       | text-primary     |
   | Stok              | Package, Box             | bg-primary/10       | text-primary     |

❌ YASAK KPI TASARIMLARI:
   - border, border-border (DIŞ ÇERÇEVE KESİNLİKLE YASAK!)
   - Flex-row layout (yatay düzen)
   - İkon sağda veya solda (sadece üstte ortada olabilir)
   - Değer solda veya sağda hizalı (sadece ortada olabilir)
   - Farklı padding değerleri (p-3 sabit)
   - justify-between (justify-center kullan)
   - text-left veya text-right (text-center zorunlu)

═══════════════════════════════════════════════════════════════════════════════

🔲 KPI POPUP/MODAL STANDARTLARI (ZORUNLU - UI.Dialog!)
───────────────────────────────────────────────────────────────────────────────
⚠️ ÖNEMLİ: Widget'lara UI scope'u otomatik olarak geçilir. Popup için UI.Dialog kullan!

📦 UI SCOPE İÇERİĞİ (Kullanılabilir bileşenler):
   - UI.Dialog: Ana modal wrapper
   - UI.DialogContent: Modal içeriği
   - UI.DialogHeader: Başlık alanı
   - UI.DialogTitle: Başlık metni
   - UI.DialogDescription: Açıklama metni
   - UI.DialogFooter: Alt alan

📐 BOYUT VE KONUM KURALLARI:
   - Desktop: w-[50vw] veya max-w-[50%] (sayfanın yarısı)
   - Desktop: max-h-[80vh] (sayfayı geçmeyecek)
   - DialogContent otomatik ortalar (fixed inset-0)
   - Scroll: overflow-y-auto (liste uzarsa scroll)

📱 MOBİL TAM EKRAN KURALI (ZORUNLU!):
   - Mobil cihazlarda (max-md) TÜM popup'lar TAM EKRAN açılmalı!
   - ZORUNLU mobil class'ları: max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0
   - Bu kuralı ihlal etme! Mobil kullanıcı deneyimi için kritik!

⚠️ KRİTİK HEADER PADDİNG KURALI (ZORUNLU!):
   - DialogContent X kapatma butonu sağ üstte ABSOLUTE pozisyonda otomatik eklenir!
   - Header div'ine MUTLAKA "pr-12" (padding-right: 3rem) ekle!
   - Bu padding X butonuna yer açar ve içerik çakışmasını önler
   - Header yapısı: flex items-center justify-between p-3 border-b border-border gap-4 pr-12

✅ ZORUNLU UI.Dialog POPUP YAPISI:
function Widget({ data, colors, filters }) {
  var showDetail = React.useState(false);
  var isOpen = showDetail[0];
  var setIsOpen = showDetail[1];
  
  // Veri hesaplamaları...
  var filteredItems = data.filter(function(item) {
    return parseFloat(item.bakiye) < 0;
  });
  
  return React.createElement('div', { className: 'h-full' },
    // Tıklanabilir KPI Kartı (DIŞ ÇERÇEVE YOK!)
    React.createElement('div', {
      className: 'h-full p-2 md:p-3 bg-card rounded cursor-pointer hover:bg-muted/50 transition-colors flex flex-col justify-between',
      onClick: function() { setIsOpen(true); }
    },
      React.createElement('div', { className: 'flex items-start justify-between' },
        React.createElement('span', { className: 'text-xs text-muted-foreground' }, 'Başlık'),
        React.createElement('span', { className: 'text-lg font-bold text-foreground' }, filteredItems.length)
      ),
      React.createElement('p', { className: 'text-[10px] text-muted-foreground' }, 'Detay için tıklayın')
    ),
    
    // ⚠️ KRİTİK: Header div'e "pr-12" ekle - X butonu sağ üstte absolute!
    // ⚠️ MOBİL: max-md class'ları ile tam ekran aç!
    React.createElement(UI.Dialog, { open: isOpen, onOpenChange: setIsOpen },
      React.createElement(UI.DialogContent, { 
        className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border ' +
                   'max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0'
      },
        // ⚠️ HEADER - "pr-12" ZORUNLU! X butonu sağ üstte absolute konumda!
        React.createElement('div', { 
          className: 'flex items-center justify-between p-3 border-b border-border flex-shrink-0 gap-4 pr-12'
        },
          React.createElement('div', { className: 'flex items-center gap-2 min-w-0' },
            React.createElement(UI.DialogTitle, { className: 'text-sm font-semibold truncate' }, 'Detay Başlığı'),
            React.createElement('span', { className: 'text-xs text-muted-foreground shrink-0' }, 
              filteredItems.length + ' kayıt'
            )
          ),
          React.createElement('span', { className: 'text-sm font-bold' }, formatCurrency(toplam))
        ),
        React.createElement(UI.DialogDescription, { className: 'sr-only' }, 'Detay listesi'),
        // Scroll'lu içerik alanı
        React.createElement('div', { className: 'flex-1 overflow-y-auto p-3' },
          React.createElement('div', { className: 'space-y-1.5' },
            filteredItems.map(function(item, idx) {
              return React.createElement('div', {
                key: idx,
                className: 'flex items-center justify-between p-2 rounded border border-border hover:bg-muted/50'
              },
                React.createElement('span', { className: 'text-sm text-foreground truncate' }, 
                  item.ad || item.aciklama
                ),
                React.createElement('span', { className: 'text-sm font-medium text-destructive' }, 
                  formatCurrency(item.bakiye)
                )
              );
            })
          )
        )
      )
    )
  );
}

return Widget;

📋 ÖRNEK: EKSİYE DÜŞEN STOKLAR - SABİT KPI TASARIMI + UI.Dialog
───────────────────────────────────────────────────────────────────────────────
// Bu örnek KPI tasarımını BİREBİR takip et! Farklı layout YASAK!

function Widget({ data, colors, filters }) {
  var showDetail = React.useState(false);
  var isOpen = showDetail[0];
  var setIsOpen = showDetail[1];
  
  var negativeItems = React.useMemo(function() {
    return (data || []).filter(function(item) {
      var fiili = parseFloat(item.fiili_stok_irs) || 0;
      var gercek = parseFloat(item.gercek_stok_irs) || 0;
      return fiili < 0 || gercek < 0;
    });
  }, [data]);
  
  var getDurumStyle = function(fiili, gercek) {
    if (fiili < 0 && gercek < 0) return 'bg-destructive/20 text-destructive border-destructive/30';
    if (fiili < 0) return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
  };
  
  return React.createElement('div', { className: 'h-full' },
    // ═══════════════════════════════════════════════════════════════════════
    // SABİT KPI KARTI - BU YAPIYI AYNEN KULLAN! (Centered Layout)
    // ═══════════════════════════════════════════════════════════════════════
    React.createElement('div', {
      className: 'h-full p-3 bg-card rounded border border-border cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center gap-2',
      onClick: function() { setIsOpen(true); }
    },
      // İkon Container (Üstte, Ortada, 48x48)
      React.createElement('div', { 
        className: 'w-12 h-12 rounded flex items-center justify-center bg-destructive/10' 
      },
        React.createElement(LucideIcons.AlertTriangle, { 
          className: 'w-6 h-6 text-destructive' 
        })
      ),
      // Ana Değer (Büyük, Bold, Ortada)
      React.createElement('div', { 
        className: 'text-3xl md:text-4xl font-bold text-destructive' 
      }, negativeItems.length),
      // Etiket (Küçük, Muted, Ortada)
      React.createElement('div', { 
        className: 'text-xs text-muted-foreground' 
      }, 'Eksiye Düşen Stoklar'),
      // Alt Bilgi
      React.createElement('div', { 
        className: 'text-[10px] text-muted-foreground' 
      }, 'Detaylar için tıklayın')
    ),
    
    // ═══════════════════════════════════════════════════════════════════════
    // UI.Dialog POPUP - Merkezi Modal
    // ═══════════════════════════════════════════════════════════════════════
    React.createElement(UI.Dialog, { open: isOpen, onOpenChange: setIsOpen },
      React.createElement(UI.DialogContent, { 
        className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col overflow-hidden ' +
                   'max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0'
      },
        React.createElement(UI.DialogHeader, null,
          React.createElement(UI.DialogTitle, { className: 'flex items-center gap-2' },
            React.createElement(LucideIcons.AlertTriangle, { className: 'w-5 h-5 text-destructive' }),
            'Eksi Stoktaki Ürünler'
          ),
          React.createElement(UI.DialogDescription, null, 
            negativeItems.length + ' ürün eksi stokta'
          )
        ),
        React.createElement('div', { className: 'flex-1 overflow-y-auto py-2 space-y-1.5' },
          negativeItems.map(function(item, idx) {
            var fiili = parseFloat(item.fiili_stok_irs) || 0;
            var gercek = parseFloat(item.gercek_stok_irs) || 0;
            return React.createElement('div', {
              key: idx,
              className: 'flex items-center justify-between p-2 rounded border ' + getDurumStyle(fiili, gercek)
            },
              React.createElement('div', { className: 'min-w-0 flex-1' },
                React.createElement('p', { className: 'text-sm font-medium line-clamp-1' }, item.stok_adi),
                React.createElement('p', { className: 'text-[10px] opacity-80' }, item.stokkodu)
              ),
              React.createElement('div', { className: 'text-right flex-shrink-0 ml-2' },
                React.createElement('p', { className: 'text-sm font-bold' }, 
                  'Fiili: ' + fiili.toFixed(0) + ' | Gerçek: ' + gercek.toFixed(0)
                ),
                React.createElement('p', { className: 'text-[10px] opacity-80' }, item.birim || 'Adet')
              )
            );
          })
        ),
        React.createElement(UI.DialogFooter, null,
          React.createElement('span', { className: 'text-[10px] text-muted-foreground' },
            'Toplam: ' + negativeItems.length + ' ürün'
          )
        )
      )
    )
  );
}

return Widget;

❌ POPUP YASAKLARI:
   - Custom div+backdrop popup kullanma (UI.Dialog tercih et)
   - w-full veya çok geniş modal (50vw aşılmasın - masaüstünde)
   - max-h olmadan modal (ekranı taşar)
   - overflow-hidden ile liste (scroll olmaz, veri kesilir)
   - rounded-xl, p-4+ (kompakt değil)
   - Portal/createPortal kullanma (UI.Dialog otomatik portal kullanır)

📱 MOBİL TAM EKRAN POPUP KURALI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
Tüm widget popup/modal'ları mobil cihazlarda (768px altı) TAM EKRAN açılmalıdır.
DialogContent className'ine şu sınıflar EKLENMELİDİR:

className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col overflow-hidden ' +
           'max-md:w-screen max-md:h-screen max-md:max-w-none max-md:max-h-none max-md:rounded-none max-md:m-0'

Mobil sınıfları AÇIKLAMA:
- max-md:w-screen     → Tam genişlik
- max-md:h-screen     → Tam yükseklik  
- max-md:max-w-none   → Max genişlik sınırı kaldır
- max-md:max-h-none   → Max yükseklik sınırı kaldır
- max-md:rounded-none → Köşe yuvarlaklığı kaldır
- max-md:m-0          → Margin sıfırla

❌ YANLIŞ: Sadece masaüstü boyutlarını tanımlamak
✅ DOĞRU: Hem masaüstü hem mobil sınıflarını eklemek

📌 TOOLTIP Z-INDEX KURALI (ZORUNLU - İKİ ADIM!)
───────────────────────────────────────────────────────────────────────────────
Recharts Tooltip'leri her zaman EN ÖNDE görünmeli. İKİ Z-INDEX GEREKLİ:

1️⃣ Recharts.Tooltip'e wrapperStyle ZORUNLU:
React.createElement(Recharts.Tooltip, {
  content: CustomTooltip,
  wrapperStyle: { zIndex: 9999 }  // ← BU SATIR ZORUNLU!
})

❌ YANLIŞ: wrapperStyle olmadan Tooltip kullanmak
React.createElement(Recharts.Tooltip, { content: CustomTooltip })

2️⃣ Custom Tooltip div'ine de style ZORUNLU:
var CustomTooltip = function(props) {
  if (!props.active || !props.payload || props.payload.length === 0) return null;
  
  return React.createElement('div', {
    className: 'bg-popover border border-border rounded-lg shadow-lg p-3',
    style: { zIndex: 9999 }  // ← İçerik z-index
  },
    React.createElement('p', { className: 'font-medium text-foreground text-sm mb-1' }, props.label),
    props.payload.map(function(entry, index) {
      return React.createElement('div', { 
        key: index, 
        className: 'flex items-center gap-2 text-sm' 
      },
        React.createElement('span', { 
          className: 'w-3 h-3 rounded-full',
          style: { backgroundColor: entry.color }
        }),
        React.createElement('span', { className: 'text-muted-foreground' }, entry.name + ':'),
        React.createElement('span', { className: 'font-medium text-foreground' }, 
          typeof entry.value === 'number' ? formatCurrency(entry.value) : entry.value
        )
      );
    })
  );
};

❌ YANLIŞ: style prop olmadan tooltip (z-index eksik, diğer elementlerin altında kalabilir)
❌ YANLIŞ: content prop'suz Recharts.Tooltip (varsayılan tooltip tema uyumsuz)

═══════════════════════════════════════════════════════════════════════════════

🔍 GLOBAL FİLTRE SİSTEMİ
───────────────────────────────────────────────────────────────────────────────
Widget'a "filters" prop'u da geçilir. Bu prop aktif global filtreleri içerir:

function Widget({ data, colors, filters }) {
  // filters objesi örneği:
  // {
  //   tarihAraligi: { period: 'this_month', field: 'tarih' },
  //   satisTemsilcisi: ['Ali Yılmaz'],
  //   ozelkod1: [], ozelkod2: [], ozelkod3: [],
  //   cariKartTipi: ['AL', 'AS'],
  //   sube: [], depo: [], sehir: [],
  //   durum: 'hepsi', gorunumModu: 'hepsi',
  //   searchTerm: '',
  //   _diaAutoFilters: [{ field: 'satiselemani', value: 'ALI', isLocked: true }]
  // }

  // NOT: "data" zaten filtrelenmiş olarak gelir!
  // Widget içinde tekrar filtreleme YAPMA.
  // "filters" prop'unu sadece:
  //   1) Hangi filtrelerin aktif olduğunu bilgi olarak göstermek için
  //   2) Koşullu render (örn: tarih filtresi aktifse "Son X gün" göster)
  // kullan.
}

Aktif filtre kontrolü:
var hasSalesRepFilter = filters && filters.satisTemsilcisi && filters.satisTemsilcisi.length > 0;
var hasDateFilter = filters && filters.tarihAraligi && filters.tarihAraligi.period !== 'all';

═══════════════════════════════════════════════════════════════════════════════

📝 TAM ÖRNEK KOD
───────────────────────────────────────────────────────────────────────────────
function Widget({ data, colors, filters }) {
  if (!data || data.length === 0) {
    return React.createElement('div', 
      { className: 'flex items-center justify-center h-48 text-muted-foreground' },
      'Veri bulunamadı'
    );
  }

  // Renk helper - ZORUNLU
  var getColor = function(index) {
    return colors && colors[index % colors.length] 
      ? colors[index % colors.length] 
      : 'hsl(var(--primary))';
  };

  // Para formatı helper
  var formatCurrency = function(value, currency) {
    currency = currency || 'TRY';
    var symbols = { TRY: '₺', USD: '$', EUR: '€' };
    var symbol = symbols[currency] || '₺';
    var absValue = Math.abs(value);
    if (absValue >= 1000000) return symbol + (value / 1000000).toFixed(1) + 'M';
    if (absValue >= 1000) return symbol + (value / 1000).toFixed(0) + 'K';
    return symbol + value.toLocaleString('tr-TR');
  };

  var toplam = data.reduce(function(acc, item) {
    return acc + (parseFloat(item.toplambakiye) || 0);
  }, 0);
  
  // Aktif filtre bilgisi gösterimi (opsiyonel)
  var activeFilterInfo = filters && filters.satisTemsilcisi && filters.satisTemsilcisi.length > 0 
    ? filters.satisTemsilcisi.join(', ') 
    : null;

  return React.createElement('div', 
    { className: 'p-2 md:p-3 space-y-2 bg-card rounded border border-border' },
    React.createElement('div', { className: 'text-lg md:text-xl font-semibold text-foreground' }, 
      formatCurrency(toplam)
    ),
    React.createElement('div', { className: 'text-xs md:text-sm text-muted-foreground' }, 
      data.length + ' kayıt'
    ),
    activeFilterInfo 
      ? React.createElement('div', { className: 'text-xs text-muted-foreground' }, 
          '🔍 ' + activeFilterInfo
        )
      : null,
    toplam >= 0
      ? React.createElement('span', { className: 'text-success text-sm' }, '↑ Pozitif')
      : React.createElement('span', { className: 'text-destructive text-sm' }, '↓ Negatif')
  );
}

return Widget;

═══════════════════════════════════════════════════════════════════════════════

📅 TARİH KRONOLOJİSİ KURALI (ÖNEMLİ!)
───────────────────────────────────────────────────────────────────────────────
Eğer grafikte tarih/zaman serisi kullanılıyorsa ve kullanıcı "tarih kronolojisi" 
veya "eksik günleri göster" veya "tüm tarihleri göster" isterse:

ZORUNLU HELPER FONKSİYON:
var fillMissingDates = function(data, dateField, valueField, dayCount) {
  dayCount = dayCount || 30;
  var today = new Date();
  var dateMap = {};
  
  data.forEach(function(item) {
    var d = new Date(item[dateField]);
    if (!isNaN(d.getTime())) {
      var key = d.toISOString().split('T')[0];
      dateMap[key] = (dateMap[key] || 0) + (parseFloat(item[valueField]) || 0);
    }
  });
  
  var result = [];
  for (var i = dayCount - 1; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var key = d.toISOString().split('T')[0];
    result.push({
      tarih: key,
      label: d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      [valueField]: dateMap[key] || 0
    });
  }
  
  return result;
};

// Kullanım örneği:
var chartData = fillMissingDates(data, 'tarih', 'tutar', 30);

❌ YANLIŞ: Sadece veri olan günleri göstermek
✅ DOĞRU: Tüm tarih aralığını, boş günleri 0 ile doldurup göstermek

═══════════════════════════════════════════════════════════════════════════════

📐 GRAFİK CONTAINER YÜKSEKLİK KURALI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
Recharts grafikleri için yükseklik kalıtımı ZORUNLUDUR. Aksi halde grafik 
görünmez (0px yükseklik).

✅ ZORUNLU YAPI:
1. Ana widget container'ına "h-full" ekle:
   className: 'p-4 bg-card rounded-xl border border-border h-full flex flex-col'

2. Grafik container'ına "flex-1 h-full min-h-0 relative" ekle:
   React.createElement('div', { className: 'flex-1 h-full min-h-0 relative' },
     React.createElement(Recharts.ResponsiveContainer, { width: '100%', height: '100%' },
       // PieChart, BarChart, LineChart, AreaChart...
     )
   )

3. Donut/Pie ortasındaki metin için OVERLAY kullan (PieChart dışında):
   React.createElement('div', { 
     className: 'absolute inset-0 flex flex-col items-center justify-center pointer-events-none' 
   },
     React.createElement('span', { className: 'text-2xl font-bold text-foreground' }, value),
     React.createElement('span', { className: 'text-xs text-muted-foreground' }, 'Toplam')
   )

❌ YANLIŞ (Grafik görünmez!):
   className: 'flex-1 min-h-0'  // h-full YOK!

❌ YANLIŞ (SVG hatası):
   PieChart içine doğrudan <text> elementi koymak

✅ DOĞRU ÖRNEK:
React.createElement('div', { className: 'flex-1 h-full min-h-0 relative' },
  React.createElement(Recharts.ResponsiveContainer, { width: '100%', height: '100%' },
    React.createElement(Recharts.PieChart, null,
      React.createElement(Recharts.Pie, { data: chartData, innerRadius: '55%', outerRadius: '80%', dataKey: 'value' },
        chartData.map(function(entry, index) {
          return React.createElement(Recharts.Cell, { key: 'cell-' + index, fill: getColor(index) });
        })
      ),
      React.createElement(Recharts.Tooltip, { content: CustomTooltip })
    )
  ),
  // Ortadaki metin OVERLAY olarak - PieChart DIŞında!
  React.createElement('div', { className: 'absolute inset-0 flex flex-col items-center justify-center pointer-events-none' },
    React.createElement('span', { className: 'text-2xl font-bold text-foreground' }, totalValue),
    React.createElement('span', { className: 'text-xs text-muted-foreground' }, 'Toplam')
  )
)

═══════════════════════════════════════════════════════════════════════════════

📊 GRAFİK TÜRÜNE ÖZEL KURALLAR
───────────────────────────────────────────────────────────────────────────────

🥧 PIE / DONUT CHART:
   - innerRadius: '55%', outerRadius: '80%' (donut için)
   - innerRadius: 0 (solid pie için)
   - paddingAngle: 2 (dilimler arası boşluk)
   - Ortadaki değer için OVERLAY kullan (PieChart dışında absolute div)
   - Legend'ı chart dışında ayrı bir div ile render et
   - Min yükseklik: h-[200px] veya daha fazla
   
   ✅ DOĞRU DONUT YAPISI:
   React.createElement('div', { className: 'flex-1 h-full min-h-0 relative' },
     React.createElement(Recharts.ResponsiveContainer, { width: '100%', height: '100%' },
       React.createElement(Recharts.PieChart, null,
         React.createElement(Recharts.Pie, { 
           data: chartData, 
           cx: '50%', cy: '50%',
           innerRadius: '55%', outerRadius: '80%', 
           paddingAngle: 2, dataKey: 'value' 
         },
           chartData.map(function(entry, idx) {
             return React.createElement(Recharts.Cell, { key: 'cell-' + idx, fill: getColor(idx) });
           })
         ),
         React.createElement(Recharts.Tooltip, { content: CustomTooltip })
       )
     ),
     // OVERLAY - ortadaki toplam değer
     React.createElement('div', { className: 'absolute inset-0 flex flex-col items-center justify-center pointer-events-none' },
       React.createElement('span', { className: 'text-2xl font-bold text-foreground' }, total),
       React.createElement('span', { className: 'text-xs text-muted-foreground' }, 'Toplam')
     )
   )

📊 BAR CHART:
   - Dikey: Recharts.BarChart + Recharts.Bar
   - Yatay: layout: 'vertical' + XAxis type='number' + YAxis type='category'
   - Birden fazla seri için farklı Bar + farklı getColor(idx)
   - Negatif değerler için ReferenceLine y={0}
   - Label: labelList prop veya label prop (position: 'top')
   
   ✅ DOĞRU BAR YAPISI:
   React.createElement(Recharts.ResponsiveContainer, { width: '100%', height: '100%' },
     React.createElement(Recharts.BarChart, { data: chartData },
       React.createElement(Recharts.CartesianGrid, { strokeDasharray: '3 3', className: 'stroke-border' }),
       React.createElement(Recharts.XAxis, { dataKey: 'name', tick: { fill: 'hsl(var(--foreground))', fontSize: 12 } }),
       React.createElement(Recharts.YAxis, { tick: { fill: 'hsl(var(--foreground))', fontSize: 12 } }),
       React.createElement(Recharts.Tooltip, { content: CustomTooltip }),
       React.createElement(Recharts.Bar, { dataKey: 'value', fill: getColor(0), radius: [4, 4, 0, 0] })
     )
   )

📈 LINE / AREA CHART:
   - Smooth çizgi: type='monotone'
   - Dot gösterimi: dot prop (true/false veya { r: 4 })
   - Area için fillOpacity: 0.3
   - Birden fazla seri: farklı Line/Area + farklı getColor(idx)
   - Gradient dolgu: defs içinde linearGradient tanımla
   
   ✅ DOĞRU LINE YAPISI:
   React.createElement(Recharts.ResponsiveContainer, { width: '100%', height: '100%' },
     React.createElement(Recharts.LineChart, { data: chartData },
       React.createElement(Recharts.CartesianGrid, { strokeDasharray: '3 3', className: 'stroke-border' }),
       React.createElement(Recharts.XAxis, { dataKey: 'name', tick: { fill: 'hsl(var(--foreground))', fontSize: 12 } }),
       React.createElement(Recharts.YAxis, { tick: { fill: 'hsl(var(--foreground))', fontSize: 12 } }),
       React.createElement(Recharts.Tooltip, { content: CustomTooltip }),
       React.createElement(Recharts.Line, { 
         type: 'monotone', dataKey: 'value', stroke: getColor(0), 
         strokeWidth: 2, dot: { r: 3, fill: getColor(0) } 
       })
     )
   )

🕸️ RADAR / SPIDER CHART (Örümcek Grafiği):
   - Çok boyutlu karşılaştırma ve dağılım analizi için ideal
   - Legend KULLANMA - tüm alanı grafiğe ayır
   - outerRadius: '80%' (minimum %80 - grafik büyük görünsün)
   - Drill-down popup zorunlu (onClick + UI.Dialog)
   - fillOpacity: 0.4 (yarı saydam alan)
   
   ✅ ZORUNLU RADAR YAPISI:
   React.createElement('div', { className: 'h-full flex flex-col' },
     // Header
     React.createElement('div', { className: 'flex-shrink-0 flex items-center justify-between mb-2 px-1' },
       React.createElement('div', { className: 'flex flex-col' },
         React.createElement('h3', { className: 'text-base font-semibold text-foreground flex items-center gap-2' }, 
           React.createElement(LucideIcons.Radar, { className: 'w-4 h-4 text-primary' }),
           'Dağılım Başlığı'
         ),
         React.createElement('span', { className: 'text-xs text-muted-foreground' }, 
           chartData.length + ' kategori'
         )
       ),
       React.createElement('div', { className: 'text-right' },
         React.createElement('span', { className: 'text-lg font-bold text-foreground block leading-none' }, totalRecords),
         React.createElement('span', { className: 'text-[10px] text-muted-foreground uppercase' }, 'Toplam')
       )
     ),
     // Radar Chart Container
     React.createElement('div', { className: 'flex-1 min-h-0 relative w-full' },
       React.createElement(Recharts.ResponsiveContainer, { width: '100%', height: '100%' },
         React.createElement(Recharts.RadarChart, { 
           cx: '50%', 
           cy: '50%', 
           outerRadius: '80%',
           data: chartData,
           margin: { top: 10, right: 30, left: 30, bottom: 10 }
         },
           React.createElement(Recharts.PolarGrid, { stroke: 'hsl(var(--border))' }),
           React.createElement(Recharts.PolarAngleAxis, { 
             dataKey: 'name',
             tick: { fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 500 }
           }),
           React.createElement(Recharts.PolarRadiusAxis, { 
             angle: 30, 
             domain: [0, 'auto'],
             tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 9 },
             axisLine: false
           }),
           React.createElement(Recharts.Radar, {
             name: 'Değer',
             dataKey: 'value',
             stroke: getColor(0),
             fill: getColor(0),
             fillOpacity: 0.4,
             isAnimationActive: true,
             onClick: handleSliceClick,
             cursor: 'pointer'
           }),
           React.createElement(Recharts.Tooltip, { 
             content: React.createElement(CustomTooltip),
             wrapperStyle: { zIndex: 9999 }
           })
         )
       )
     ),
     // Drill-down Dialog (UI.Dialog)
     React.createElement(UI.Dialog, { open: isOpen, onOpenChange: setIsOpen },
       React.createElement(UI.DialogContent, { 
         className: 'w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border' 
       },
         // Header - pr-12 ZORUNLU!
         React.createElement('div', { 
           className: 'flex items-center justify-between p-3 border-b border-border flex-shrink-0 gap-4 pr-12 bg-muted/10'
         },
           // ...header içeriği
         ),
         React.createElement(UI.DialogDescription, { className: 'sr-only' }, 'Detay'),
         React.createElement('div', { className: 'flex-1 overflow-y-auto p-2' },
           // ...liste içeriği
         )
       )
     )
   )
   
   ❌ RADAR YASAKLAR:
   - Legend (yan liste) kullanmak - Radar'da legend YASAK, tüm alan grafik için
   - outerRadius %60 veya altı - minimum %80 kullan
   - onClick olmadan radar - drill-down zorunlu
   - wrapperStyle: { zIndex: 9999 } olmadan Tooltip

📋 TABLO / LİSTE:
   - Scroll için max-h-[XXXpx] + overflow-y-auto
   - Zebra striping: even:bg-muted/30
   - Hover efekti: hover:bg-muted/50
   - Sıralama için data.sort() kullan
   - Sayısal değerleri sağa hizala: text-right

═══════════════════════════════════════════════════════════════════════════════

📊 FİNANSAL LİSTE WIDGET ŞABLONU (BANKA/KASA TİPİ - ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
⚠️ Bu şablon Banka Hesapları, Kasa Bakiyeleri gibi finansal liste widget'ları
için ZORUNLUDUR. Farklı tasarım YASAK!

📐 YAPI (İKİ BÖLÜM):
1. ÜST BÖLÜM - DÖVİZ BAZLI KPI KARTLARI:
   - grid grid-cols-1 md:grid-cols-3 gap-2
   - Her kart: p-2 bg-card rounded-none border border-border
   - Başlık: text-xs font-medium text-muted-foreground
   - Değer: text-xl font-bold (TRY: text-primary, USD: text-success, EUR: text-warning)

2. ALT BÖLÜM - TABLO LİSTESİ:
   - Container: flex flex-col flex-1 min-h-0 bg-card rounded-none border border-border
   - Header bar: flex items-center justify-between p-2 border-b border-border bg-muted/20
   - Badge: px-1.5 py-0.5 text-xs bg-secondary rounded-none
   - Table: w-full text-sm text-left
   - Thead: sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground
   - Tbody: divide-y divide-border
   - Row: hover:bg-muted/50 transition-colors

3. AVATAR (Köşeli):
   - w-6 h-6 rounded-none flex items-center justify-center bg-secondary
   - İçerik: İlk 2 harf (uppercase) text-[10px] font-bold text-foreground

✅ ZORUNLU STİLLER:
   - rounded-none (TÜM ELEMENTLERDE - köşeli görünüm)
   - border border-border (iç container'larda)
   - sticky top-0 (thead için)
   - divide-y divide-border (tbody için)

❌ YASAK STİLLER:
   - rounded, rounded-md, rounded-lg (köşeli olmalı, yuvarlatma YASAK)
   - Kart bazlı liste (tablo formatı zorunlu)
   - glass-card (bg-card kullan)

═══════════════════════════════════════════════════════════════════════════════

📊 RESPONSIVE LEGEND KURALI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
Pie/Donut/Bar/Line/Area grafiklerinde legend kullanıyorsan:

⚠️ ÖNCELİKLİ KURAL - MAX VISIBLE LEGEND:
Çok sayıda kategori (>8) varsa tamamını legend'da gösterme! Sonsuz büyüme sorununa yol açar.

var MAX_VISIBLE_LEGEND = 8;
var visibleData = chartData.slice(0, MAX_VISIBLE_LEGEND);
var hiddenCount = chartData.length - MAX_VISIBLE_LEGEND;
// Legend'da sadece visibleData göster, hiddenCount > 0 ise "+X daha..." butonu ekle

1. Container yüksekliğini ölç ve legend'ın sığıp sığmayacağını kontrol et:

var containerRef = React.useRef(null);
var legendExpanded = React.useState(false);
var hasEnoughSpace = React.useState(chartData.length <= 12); // Baştan gizle

React.useEffect(function() {
  if (containerRef.current) {
    var containerHeight = containerRef.current.offsetHeight;
    var headerHeight = 56;
    var contentHeight = containerHeight - headerHeight;
    
    var legendHeight = MAX_VISIBLE_LEGEND * 24;
    var threshold = contentHeight * 0.40;
    
    hasEnoughSpace[1](legendHeight <= threshold);
  }
}, [chartData]);

2. Legend container'a maxHeight ZORUNLU ekle:

React.createElement('div', {
  className: 'flex flex-col overflow-y-auto',
  style: { maxHeight: '140px' }  // ZORUNLU - taşmayı önler
}, legendItems)

3. Toggle butonu ekle (legend sığmıyorsa):

!hasEnoughSpace[0] && React.createElement('button', {
  onClick: function() { legendExpanded[1](!legendExpanded[0]); },
  className: 'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded hover:bg-muted/50'
},
  legendExpanded[0] ? 'Gizle' : 'Detaylar',
  React.createElement(LucideIcons.ChevronDown, { 
    className: 'h-3 w-3 ' + (legendExpanded[0] ? 'rotate-180' : '') 
  })
)

4. Legend'ı koşullu göster:

(hasEnoughSpace[0] || legendExpanded[0]) && React.createElement('div', {
  className: 'flex flex-col overflow-y-auto',
  style: { maxHeight: '140px' }
}, legendItems)

❌ YANLIŞ: Tüm kategorileri legend'da göstermek (81 sektör = 2000px!)
❌ YANLIŞ: maxHeight olmadan legend container
✅ DOĞRU: MAX_VISIBLE_LEGEND=8, maxHeight: 140px, overflow-y: auto

═══════════════════════════════════════════════════════════════════════════════

📈 DRILL-DOWN DESTEĞİ (ÖNERİLEN)
───────────────────────────────────────────────────────────────────────────────
Grafik elementlerine onClick ekle ve kullanıcının detay görmesini sağla:

✅ Bar için:
React.createElement(Recharts.Bar, { 
  dataKey: 'value',
  onClick: function(entry) { 
    console.log('Tıklanan:', entry.name); 
    // Detay modalı veya alert gösterebilirsin
  }
})

✅ Pie/Donut için:
React.createElement(Recharts.Pie, {
  data: chartData,
  onClick: function(data, index) {
    console.log('Seçilen dilim:', data.name, data.value);
  }
})

═══════════════════════════════════════════════════════════════════════════════

📅 TARİH EKSENİ FORMATLAMA
───────────────────────────────────────────────────────────────────────────────
10'dan fazla tarih varsa etiketleri -45 derece döndür:

React.createElement(Recharts.XAxis, { 
  dataKey: 'name',
  angle: data.length > 10 ? -45 : 0,
  textAnchor: data.length > 10 ? 'end' : 'middle',
  height: data.length > 10 ? 60 : 30,
  interval: data.length > 15 ? Math.floor(data.length / 10) : 0
})

═══════════════════════════════════════════════════════════════════════════════

🗺️ HARİTA BİLEŞENLERİ (Map SCOPE - Leaflet)
───────────────────────────────────────────────────────────────────────────────
Widget'a otomatik olarak "Map" scope'u geçilir. Bu scope Leaflet harita bileşenlerini içerir:

📦 MAP SCOPE İÇERİĞİ:
   - Map.MapContainer: Ana harita container'ı
   - Map.TileLayer: Harita arka plan katmanı (OpenStreetMap, vb.)
   - Map.Marker: Konum işaretleyici
   - Map.Popup: Marker popup'ı (Recharts Tooltip ile KARISTIRMA!)
   - Map.CircleMarker: Daire işaretleyici (değer boyutuna göre büyüklük)
   - Map.Polyline: Çizgi çizme (rota, bağlantı)
   - Map.Polygon: Alan çizme
   - Map.L: Leaflet utility (custom icons, bounds vb.)
   - Map.useMap: Harita instance'ına erişim hook'u
   - Map.useMapEvents: Harita olaylarını dinleme hook'u (zoom, click vb.)
   - Map.useMapEvent: Tek olay dinleme hook'u

🔧 HARİTA HOOKS KULLANIMI:
// Zoom seviyesini takip etmek için:
var ZoomTracker = function() {
  var map = Map.useMapEvents({
    zoomend: function() {
      setZoomLevel(map.getZoom());
    }
  });
  return null;
};
// MapContainer içinde: React.createElement(ZoomTracker)

✅ ZORUNLU HARİTA YAPISI:
function Widget({ data, colors, filters }) {
  // Merkez koordinat hesapla
  var center = React.useMemo(function() {
    if (!data || data.length === 0) return [39.9334, 32.8597]; // Ankara default
    var validPoints = data.filter(function(item) {
      return item.lat && item.lng;
    });
    if (validPoints.length === 0) return [39.9334, 32.8597];
    var avgLat = validPoints.reduce(function(acc, p) { return acc + parseFloat(p.lat); }, 0) / validPoints.length;
    var avgLng = validPoints.reduce(function(acc, p) { return acc + parseFloat(p.lng); }, 0) / validPoints.length;
    return [avgLat, avgLng];
  }, [data]);

  return React.createElement('div', { className: 'h-full w-full min-h-[300px]' },
    React.createElement(Map.MapContainer, {
      center: center,
      zoom: 6,
      style: { height: '100%', width: '100%', borderRadius: '0.375rem' },
      scrollWheelZoom: true
    },
      // TileLayer - OpenStreetMap (ücretsiz, API key gerektirmez)
      React.createElement(Map.TileLayer, {
        attribution: '© OpenStreetMap contributors',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      }),
      // Marker'lar
      data.filter(function(item) { return item.lat && item.lng; }).map(function(item, idx) {
        return React.createElement(Map.Marker, {
          key: idx,
          position: [parseFloat(item.lat), parseFloat(item.lng)]
        },
          React.createElement(Map.Popup, null,
            React.createElement('div', { className: 'text-sm' },
              React.createElement('strong', null, item.name || item.adi || 'Konum'),
              item.value && React.createElement('p', null, formatCurrency(item.value))
            )
          )
        );
      })
    )
  );
}

📊 CİRCLE MARKER (Değer Bazlı Büyüklük):
// Değere göre radius hesapla
var getRadius = function(value, maxValue) {
  var minR = 5, maxR = 25;
  return minR + (value / maxValue) * (maxR - minR);
};

var maxVal = Math.max.apply(null, data.map(function(d) { return parseFloat(d.value) || 0; }));

React.createElement(Map.CircleMarker, {
  center: [item.lat, item.lng],
  radius: getRadius(item.value, maxVal),
  pathOptions: {
    fillColor: getColor(0),
    color: 'hsl(var(--border))',
    weight: 1,
    opacity: 0.8,
    fillOpacity: 0.6
  }
},
  React.createElement(Map.Popup, null, item.name + ': ' + formatCurrency(item.value))
)

📍 CUSTOM MARKER İKONU:
var customIcon = Map.L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:' + getColor(0) + ';width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

React.createElement(Map.Marker, {
  position: [item.lat, item.lng],
  icon: customIcon
})

🌐 FARKLI TİLE LAYER'LAR:
// OpenStreetMap (varsayılan - ücretsiz)
url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// CartoDB Light (minimal tasarım)
url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

// CartoDB Dark (koyu tema)
url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

// Stamen Terrain (arazi)
url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png'

⚠️ ÖNEMLİ KURALLAR:
1. Harita container'ına min-h-[300px] veya sabit yükseklik ver (aksi halde görünmez!)
2. style: { height: '100%', width: '100%' } ZORUNLU
3. Map.Popup ile Recharts.Tooltip'i KARIŞTIRMA - farklı bileşenler!
4. Koordinat formatı: [lat, lng] (enlem, boylam) - DİZİ olarak!
5. Veri içinde lat/lng alanları yoksa harita kullanma

❌ YANLIŞ:
   - position: { lat: 41, lng: 29 } (obje yerine dizi kullan)
   - style: { height: 300 } (% veya px belirtilmeli)
   - Container yüksekliği olmadan MapContainer

═══════════════════════════════════════════════════════════════════════════════

🎛️ WIDGET FİLTRE VE PARAMETRE TANIMLARI (ZORUNLU!)
───────────────────────────────────────────────────────────────────────────────
Her widget kodu, "return Widget;" satırından HEMEN ÖNCE iki özel alan tanımlamalıdır:

1. Widget.filters: Veriyi DARALTIR (hangi kayıtlar gösterilsin)
2. Widget.parameters: GÖRSELİ AYARLAR (kaç kayıt, sıralama, gösterim modu)

ZORUNLU YAPI (return Widget; ÖNCESINDE):
Widget.filters = [
  { key: 'cariTipi', label: 'Kart Tipi', type: 'multi-select', options: [{value:'AL',label:'Alıcı'},{value:'ST',label:'Satıcı'},{value:'AS',label:'Al-Sat'}] },
  { key: 'minBakiye', label: 'Min Bakiye', type: 'number', defaultValue: 0 }
];

Widget.parameters = [
  { key: 'gosterimSayisi', label: 'Gösterim Sayısı', type: 'number', defaultValue: 10 },
  { key: 'siralamaTuru', label: 'Sıralama', type: 'dropdown', options: [{value:'desc',label:'Azalan'},{value:'asc',label:'Artan'}], defaultValue: 'desc' }
];

return Widget;

KULLANILABILIR TİPLER:
  type: 'multi-select'  → Çoklu seçim (checkbox grubu) - options ZORUNLU
  type: 'dropdown'      → Tek seçim (select) - options ZORUNLU
  type: 'toggle'        → Açık/Kapalı (switch) - defaultValue: true/false
  type: 'number'        → Sayı girişi (input) - min, max opsiyonel
  type: 'text'          → Metin girişi (input)
  type: 'range'         → Min-Max slider - min, max ZORUNLU

WIDGET KODU İÇİNDE FİLTRE/PARAMETRE KULLANIMI:
Widget "filters" prop'u üzerinden aktif değerleri alır:

function Widget({ data, colors, filters }) {
  // filters.cariTipi → ['AL', 'ST'] (multi-select değerleri)
  // filters.minBakiye → 1000 (number değeri)
  // filters.gosterimSayisi → 10 (parametre değeri)
  // filters.siralamaTuru → 'desc' (dropdown değeri)
  
  // Veriyi filtrele (filters prop'undaki değerlere göre)
  var filteredData = React.useMemo(function() {
    var result = data || [];
    
    // Multi-select filtre örneği
    if (filters.cariTipi && filters.cariTipi.length > 0) {
      result = result.filter(function(item) {
        return filters.cariTipi.indexOf(item.carikarttipi) !== -1;
      });
    }
    
    // Number filtre örneği
    if (filters.minBakiye !== undefined && filters.minBakiye !== null) {
      result = result.filter(function(item) {
        return (parseFloat(item.toplambakiye) || 0) >= filters.minBakiye;
      });
    }
    
    return result;
  }, [data, filters]);
  
  // Parametreleri uygula
  var limit = filters.gosterimSayisi || 10;
  var sortDir = filters.siralamaTuru || 'desc';
  
  var sortedData = filteredData.slice().sort(function(a, b) {
    return sortDir === 'desc' ? b.value - a.value : a.value - b.value;
  }).slice(0, limit);
}

KRİTİK KURALLAR:
- Widget.filters ve Widget.parameters HER widget'ta tanımlanmalı (boş dizi olabilir)
- Eğer widget'ın filtresi/parametresi yoksa boş dizi kullan: Widget.filters = []; Widget.parameters = [];
- Filtre key'leri widget kodu içinde filters.KEY şeklinde erişilebilir
- Widget kodu bu değerlere göre veriyi filtrelemeli ve görselleştirmeli
- Varsayılan değerler (defaultValue) widget ilk açıldığında kullanılır

═══════════════════════════════════════════════════════════════════════════════

⚠️ KRİTİK UYARI - KODU TAMAMLA!
───────────────────────────────────────────────────────────────────────────────
- Kodu MUTLAKA tamamla, ASLA yarıda bırakma!
- Son satır HER ZAMAN "return Widget;" olmalıdır
- Widget.filters ve Widget.parameters "return Widget;" ÖNCESINDE tanımlanmalı
- Eksik parantez, süslü parantez bırakma
- Tüm fonksiyonları kapat

 ═══════════════════════════════════════════════════════════════════════════════
 
 📊 GELİŞMİŞ GRAFİK BİLEŞENLERİ (Nivo SCOPE)
 ───────────────────────────────────────────────────────────────────────────────
 Widget'a otomatik olarak "Nivo" scope'u geçilir. Bu scope D3.js tabanlı gelişmiş 
 grafik bileşenlerini içerir:
 
 📦 NİVO SCOPE İÇERİĞİ:
    - Nivo.ResponsiveSankey: Akış ve süreç analizi diyagramları
    - Nivo.ResponsiveSunburst: Güneş patlaması (hiyerarşik) grafikleri
    - Nivo.ResponsiveChord: İlişki ve bağlantı diyagramları
    - Nivo.ResponsiveRadar: Örümcek/radar grafikleri (çok boyutlu karşılaştırma)
    - Nivo.ResponsiveChoropleth: Coğrafi haritalar (ülke/il renklendirme)
    - Nivo.ResponsiveGeoMap: Basit coğrafi haritalar
    - Nivo.getTheme(isDark): Tema oluşturucu fonksiyon
 
 🎨 NİVO TEMA KULLANIMI (ZORUNLU - Dark/Light Mode Uyumu):
 var isDark = document.documentElement.classList.contains('dark');
 var nivoTheme = Nivo.getTheme(isDark);
 
 // Tüm Nivo bileşenlerinde theme prop'u kullan:
 React.createElement(Nivo.ResponsiveSankey, {
   data: sankeyData,
   theme: nivoTheme,
   // ... diğer props
 })
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 🔄 SANKEY DİYAGRAMI (Akış ve Süreç Analizi)
 ───────────────────────────────────────────────────────────────────────────────
 Süreç akışlarını, kaynak-hedef ilişkilerini ve değer transferlerini gösterir.
 
 📐 VERİ FORMATI:
 var sankeyData = {
   nodes: [
     { id: 'Kaynak A', nodeColor: getColor(0) },
     { id: 'Kaynak B', nodeColor: getColor(1) },
     { id: 'Hedef 1', nodeColor: getColor(2) },
     { id: 'Hedef 2', nodeColor: getColor(3) }
   ],
   links: [
     { source: 'Kaynak A', target: 'Hedef 1', value: 100 },
     { source: 'Kaynak A', target: 'Hedef 2', value: 50 },
     { source: 'Kaynak B', target: 'Hedef 1', value: 75 }
   ]
 };
 
 ✅ SANKEY ÖRNEK YAPISI:
 React.createElement('div', { className: 'h-full min-h-[300px]' },
   React.createElement(Nivo.ResponsiveSankey, {
     data: sankeyData,
     theme: nivoTheme,
     margin: { top: 20, right: 20, bottom: 20, left: 20 },
     align: 'justify',
     colors: function(node) { return node.nodeColor || getColor(0); },
     nodeOpacity: 1,
     nodeHoverOthersOpacity: 0.35,
     nodeThickness: 18,
     nodeSpacing: 24,
     nodeBorderWidth: 0,
     nodeBorderColor: { from: 'color', modifiers: [['darker', 0.8]] },
     linkOpacity: 0.5,
     linkHoverOthersOpacity: 0.1,
     linkContract: 3,
     enableLinkGradient: true,
     labelPosition: 'outside',
     labelOrientation: 'horizontal',
     labelPadding: 16,
     labelTextColor: { from: 'color', modifiers: [['darker', 1]] }
   })
 )
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 ☀️ SUNBURST GRAFİĞİ (Güneş Patlaması - Hiyerarşik)
 ───────────────────────────────────────────────────────────────────────────────
 Hiyerarşik verileri iç içe halkalar şeklinde gösterir (kategori > alt kategori).
 
 📐 VERİ FORMATI (Hiyerarşik):
 var sunburstData = {
   name: 'Satışlar',
   color: getColor(0),
   children: [
     {
       name: 'Bölge A',
       color: getColor(1),
       children: [
         { name: 'Ürün 1', color: getColor(2), value: 100 },
         { name: 'Ürün 2', color: getColor(3), value: 80 }
       ]
     },
     {
       name: 'Bölge B',
       color: getColor(4),
       children: [
         { name: 'Ürün 1', color: getColor(5), value: 120 }
       ]
     }
   ]
 };
 
 ✅ SUNBURST ÖRNEK YAPISI:
 React.createElement('div', { className: 'h-full min-h-[300px]' },
   React.createElement(Nivo.ResponsiveSunburst, {
     data: sunburstData,
     theme: nivoTheme,
     margin: { top: 10, right: 10, bottom: 10, left: 10 },
     id: 'name',
     value: 'value',
     cornerRadius: 2,
     borderColor: { theme: 'background' },
     borderWidth: 1,
     colors: function(d) { return d.data.color || getColor(0); },
     childColor: { from: 'color', modifiers: [['brighter', 0.1]] },
     enableArcLabels: true,
     arcLabelsSkipAngle: 10,
     arcLabelsTextColor: { from: 'color', modifiers: [['darker', 1.4]] }
   })
 )
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 🎵 CHORD DİYAGRAMI (İlişki ve Bağlantı Analizi)
 ───────────────────────────────────────────────────────────────────────────────
 Öğeler arası ilişki ve akış yoğunluğunu gösterir (örn: bölgeler arası satış).
 
 📐 VERİ FORMATI (Matris):
 var chordData = [
   [100, 50, 30],   // Bölge A -> Bölge A, B, C
   [40, 80, 20],    // Bölge B -> Bölge A, B, C
   [60, 10, 90]     // Bölge C -> Bölge A, B, C
 ];
 var chordKeys = ['Bölge A', 'Bölge B', 'Bölge C'];
 
 ✅ CHORD ÖRNEK YAPISI:
 React.createElement('div', { className: 'h-full min-h-[300px]' },
   React.createElement(Nivo.ResponsiveChord, {
     data: chordData,
     keys: chordKeys,
     theme: nivoTheme,
     margin: { top: 60, right: 60, bottom: 60, left: 60 },
     valueFormat: '.2s',
     padAngle: 0.02,
     innerRadiusRatio: 0.96,
     innerRadiusOffset: 0.02,
     inactiveArcOpacity: 0.25,
     arcBorderColor: { from: 'color', modifiers: [['darker', 0.6]] },
     activeRibbonOpacity: 0.75,
     inactiveRibbonOpacity: 0.25,
     ribbonBorderColor: { from: 'color', modifiers: [['darker', 0.6]] },
     labelRotation: -90,
     labelTextColor: { from: 'color', modifiers: [['darker', 1]] },
     colors: { scheme: 'nivo' },
     motionConfig: 'stiff'
   })
 )
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 🕸️ RADAR GRAFİĞİ (Örümcek - Çok Boyutlu Karşılaştırma)
 ───────────────────────────────────────────────────────────────────────────────
 Birden fazla metriği aynı anda karşılaştırmak için (performans analizi).
 
 📐 VERİ FORMATI:
 var radarData = [
   { metric: 'Satış', Ürün_A: 80, Ürün_B: 65, Ürün_C: 90 },
   { metric: 'Karlılık', Ürün_A: 70, Ürün_B: 85, Ürün_C: 60 },
   { metric: 'Müşteri', Ürün_A: 95, Ürün_B: 50, Ürün_C: 75 },
   { metric: 'Büyüme', Ürün_A: 60, Ürün_B: 90, Ürün_C: 85 },
   { metric: 'Marka', Ürün_A: 85, Ürün_B: 70, Ürün_C: 80 }
 ];
 var radarKeys = ['Ürün_A', 'Ürün_B', 'Ürün_C'];
 
 ✅ RADAR ÖRNEK YAPISI:
 React.createElement('div', { className: 'h-full min-h-[300px]' },
   React.createElement(Nivo.ResponsiveRadar, {
     data: radarData,
     keys: radarKeys,
     indexBy: 'metric',
     theme: nivoTheme,
     valueFormat: '>-.2f',
     margin: { top: 70, right: 80, bottom: 40, left: 80 },
     borderColor: { from: 'color' },
     gridLabelOffset: 36,
     dotSize: 10,
     dotColor: { theme: 'background' },
     dotBorderWidth: 2,
     colors: function(d) { 
       var idx = radarKeys.indexOf(d.key);
       return getColor(idx >= 0 ? idx : 0);
     },
     blendMode: 'multiply',
     motionConfig: 'wobbly',
     legends: [
       {
         anchor: 'top-left',
         direction: 'column',
         translateX: -50,
         translateY: -40,
         itemWidth: 80,
         itemHeight: 20,
         itemTextColor: 'hsl(var(--foreground))',
         symbolSize: 12,
         symbolShape: 'circle'
       }
     ]
   })
 )
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 🗺️ CHOROPLETH HARİTA (Coğrafi Renklendirme)
 ───────────────────────────────────────────────────────────────────────────────
 Bölgeleri değerlere göre renklendirir (il bazlı satış, ülke bazlı performans).
 
 ⚠️ ÖNEMLİ: Choropleth için GeoJSON harita verisi gerekir!
 Türkiye için: Türkiye il sınırları GeoJSON
 Dünya için: World countries GeoJSON
 
 📐 VERİ FORMATI:
 var choroplethData = [
   { id: 'TR34', value: 1500000 },  // İstanbul
   { id: 'TR06', value: 800000 },   // Ankara
   { id: 'TR35', value: 600000 }    // İzmir
 ];
 
 ✅ CHOROPLETH ÖRNEK YAPISI:
 // GeoJSON features prop'u ile kullanılır
 React.createElement('div', { className: 'h-full min-h-[400px]' },
   React.createElement(Nivo.ResponsiveChoropleth, {
     data: choroplethData,
     features: geoJsonFeatures,  // GeoJSON FeatureCollection
     theme: nivoTheme,
     margin: { top: 0, right: 0, bottom: 0, left: 0 },
     colors: 'blues',  // veya 'greens', 'reds', 'purples'
     domain: [0, 2000000],
     unknownColor: 'hsl(var(--muted))',
     label: 'properties.name',
     valueFormat: '.2s',
     projectionType: 'mercator',
     projectionScale: 1000,
     projectionTranslation: [0.5, 0.5],
     borderWidth: 0.5,
     borderColor: 'hsl(var(--border))',
     legends: [
       {
         anchor: 'bottom-left',
         direction: 'column',
         translateX: 20,
         translateY: -60,
         itemWidth: 94,
         itemHeight: 18,
         itemsSpacing: 4,
         itemTextColor: 'hsl(var(--foreground))',
         symbolSize: 18
       }
     ]
   })
 )
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 📈 AI DESTEKLİ TAHMİNLEME GRAFİĞİ (Forecast Line Chart)
 ───────────────────────────────────────────────────────────────────────────────
 Mevcut veriden gelecek tahmini gösteren grafik (trend + projeksiyon).
 
 ✅ TAHMİN HESAPLAMA:
 var calculateForecast = function(data, valueField, forecastDays) {
   forecastDays = forecastDays || 7;
   
   // Son 30 günlük trend hesapla
   var n = data.length;
   if (n < 2) return data;
   
   var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
   data.forEach(function(item, i) {
     var x = i;
     var y = parseFloat(item[valueField]) || 0;
     sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
   });
   
   var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
   var intercept = (sumY - slope * sumX) / n;
   
   // Tahmin noktaları oluştur
   var lastDate = new Date(data[n-1].tarih);
   var forecasts = [];
   
   for (var i = 1; i <= forecastDays; i++) {
     var nextDate = new Date(lastDate);
     nextDate.setDate(nextDate.getDate() + i);
     forecasts.push({
       tarih: nextDate.toISOString().split('T')[0],
       label: nextDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
       [valueField]: null,  // Gerçek değer yok
       forecast: intercept + slope * (n + i - 1),  // Tahmin değeri
       isForecast: true
     });
   }
   
   // Mevcut veriyi forecast alanıyla güncelle
   var updatedData = data.map(function(item, i) {
     return Object.assign({}, item, {
       forecast: null,  // Mevcut veride tahmin yok
       isForecast: false
     });
   });
   
   return updatedData.concat(forecasts);
 };
 
 // Grafik render:
 // 1. Gerçek değerler: solid Line
 // 2. Tahmin değerleri: dashed Line
 React.createElement(Recharts.Line, {
   dataKey: valueField,
   stroke: getColor(0),
   strokeWidth: 2,
   dot: true,
   name: 'Gerçek'
 }),
 React.createElement(Recharts.Line, {
   dataKey: 'forecast',
   stroke: getColor(0),
   strokeWidth: 2,
   strokeDasharray: '5 5',  // Kesikli çizgi - tahmin
   dot: { strokeDasharray: '' },  // Noktalar kesikli olmasın
   name: 'Tahmin'
 })
 
 ═══════════════════════════════════════════════════════════════════════════════
 
 ⚠️ NİVO GENEL KURALLAR:
 ───────────────────────────────────────────────────────────────────────────────
 1. Container yüksekliği ZORUNLU: min-h-[300px] veya h-[400px]
 2. Theme prop'u ZORUNLU: theme: Nivo.getTheme(isDark)
 3. Renk paleti: colors: function(d) { return getColor(idx); } veya colors: { scheme: 'nivo' }
 4. margin prop'u genellikle gerekli: { top: 20, right: 20, bottom: 20, left: 20 }
 5. Nivo bileşenleri "Responsive" prefix'i ile kullanılmalı (tam genişlik/yükseklik için)
 
SADECE JavaScript kodu döndür, açıklama veya markdown formatı kullanma.`;

// Kod iyileştirme/chat için system prompt
const getRefinementSystemPrompt = () => `Sen bir React widget geliştirme uzmanısın. Kullanıcının mevcut kodunu isteklerine göre güncelleyeceksin.

═══════════════════════════════════════════════════════════════════════════════
                    KOD İYİLEŞTİRME - ZORUNLU KURALLAR
═══════════════════════════════════════════════════════════════════════════════

📋 TEMEL KURALLAR:
1. JSX KULLANMA! Sadece React.createElement kullan
2. Mevcut kod yapısını koru, sadece istenen değişiklikleri yap
3. En sonda "return Widget;" olmalı
4. Widget fonksiyonu "function Widget({ data, colors, filters })" formatında - colors ve filters ZORUNLU!

⚠️ POPUP/MODAL HEADER KURALI (KRİTİK - BOZMA!):
- UI.Dialog/DialogContent kullanan popup'larda X kapatma butonu sağ üstte ABSOLUTE pozisyonda!
- Header div'inde "pr-12" (padding-right: 3rem) ZORUNLU - asla kaldırma!
- Header yapısı: flex items-center justify-between p-3 border-b border-border gap-4 pr-12
- Bu padding olmadan X butonu header içeriğiyle çakışır!
   - filters: Aktif global filtreler objesi (tarihAraligi, satisTemsilcisi, cariKartTipi, sube, depo, vb.)
   - "data" zaten filtrelenmiş gelir, filters sadece bilgi amaçlıdır

🎨 GRAFİK RENK PALETİ (ÇOK ÖNEMLİ!):
Widget'a otomatik "colors" prop'u geçilir. Bu diziyi ZORUNLU kullan:

var getColor = function(index) {
  return colors && colors[index % colors.length] 
    ? colors[index % colors.length] 
    : 'hsl(var(--primary))';
};

- Bar/Line/Area: fill: getColor(0), stroke: getColor(0)
- PieChart Cell: fill: getColor(idx)

🚫 YASAKLAR:
- text-white, text-black, bg-white, bg-black KULLANMA
- text-red-500, bg-blue-600 gibi sabit renkler KULLANMA
- #RRGGBB hex kodları KULLANMA
- rgb(), rgba() KULLANMA

✅ ZORUNLU:
- Metin: text-foreground, text-muted-foreground
- Arka plan: bg-card, bg-background, bg-muted
- Pozitif: text-success
- Negatif: text-destructive
- Grafik: getColor(index) fonksiyonu

💰 PARA BİRİMİ:
- Varsayılan: ₺ (TRY)
- Desteklenen: $, €, £, ¥, ₽, Fr.
- Format: K (bin), M (milyon), B (milyar)

📈 TREND/HEDEF:
- ReferenceLine ile hedef çizgisi
- Trend line için Line overlay (strokeDasharray)
- Average line için ReferenceLine

🗺️ HARİTA (Map SCOPE):
Widget'a "Map" scope'u da geçilir. Leaflet harita bileşenleri:
- Map.MapContainer, Map.TileLayer, Map.Marker, Map.Popup, Map.CircleMarker
- Container'a min-h-[300px] ve style: { height: '100%', width: '100%' } ZORUNLU
- Koordinat formatı: [lat, lng] (dizi olarak)
- TileLayer için OpenStreetMap: url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

 📊 GELİŞMİŞ GRAFİKLER (Nivo SCOPE):
 Widget'a "Nivo" scope'u da geçilir. D3.js tabanlı gelişmiş grafik bileşenleri:
 - Nivo.ResponsiveSankey: Akış diyagramları
 - Nivo.ResponsiveSunburst: Güneş patlaması (hiyerarşik)
 - Nivo.ResponsiveChord: İlişki diyagramları
 - Nivo.ResponsiveRadar: Radar/örümcek grafikleri
 - Nivo.ResponsiveChoropleth: Coğrafi renklendirme
 - Container'a min-h-[300px] ZORUNLU
 - Theme: var nivoTheme = Nivo.getTheme(document.documentElement.classList.contains('dark'));
 
SADECE güncellenmiş JavaScript kodunu döndür, açıklama ekleme.`;

// Kodun tamamlanıp tamamlanmadığını kontrol et
function isCodeComplete(code: string): boolean {
  if (!code || code.trim().length === 0) return false;
  
  // "return Widget;" kontrolü
  if (!code.includes('return Widget;')) return false;
  
  // Süslü parantez dengesi kontrolü
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) return false;
  
  // Normal parantez dengesi
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) return false;
  
  // Köşeli parantez dengesi
  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) return false;
  
  return true;
}

// Yarım kalan kodu tamamlamak için devam isteği gönder
async function continueGeneration(
  partialCode: string, 
  apiKey: string, 
  attempt: number,
  mode: string
): Promise<{ code: string; finishReason: string }> {
  // Son 3000 karakter context olarak gönder
  const contextCode = partialCode.slice(-3000);
  
  const continuePrompt = `Aşağıdaki widget kodu yarım kaldı. AYNEN kaldığın yerden devam et.

KURAL: 
- Baştan BAŞLAMA, sadece DEVAM et!
- Eksik fonksiyonları kapat
- En sonda "return Widget;" olmalı
- Açıklama yazma, sadece kod yaz

YARIM KALAN KODUN SONU:
\`\`\`javascript
${contextCode}
\`\`\`

DEVAM KODUNU YAZ:`;

  const systemPrompt = mode === 'refine' ? getRefinementSystemPrompt() : getGenerationSystemPrompt();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-pro-preview",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: continuePrompt }
      ],
      max_tokens: 32000,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API hatası: ${response.status}`);
  }

  const result = await response.json();
  const continuationCode = result.choices?.[0]?.message?.content || "";
  const finishReason = result.choices?.[0]?.finish_reason || "unknown";

  // Markdown temizle
  const cleanedCode = continuationCode
    .replace(/```javascript\n?/gi, "")
    .replace(/```jsx\n?/gi, "")
    .replace(/```js\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();

  return { code: cleanedCode, finishReason };
}

// Kod parçalarını akıllıca birleştir
function mergeCodeParts(originalCode: string, continuationCode: string): string {
  // Eğer devam kodu zaten var olan bir kısımla başlıyorsa, overlap bul
  const originalLast500 = originalCode.slice(-500);
  
  // Overlap tespiti - devam kodunun başındaki ilk 100 karakteri original'ın sonunda ara
  const continuationFirst100 = continuationCode.slice(0, 100);
  const overlapIndex = originalLast500.indexOf(continuationFirst100.slice(0, 50));
  
  if (overlapIndex !== -1 && overlapIndex > 0) {
    // Overlap bulundu, tekrar eden kısmı atla
    const overlapPoint = originalCode.length - 500 + overlapIndex;
    return originalCode.slice(0, overlapPoint) + continuationCode;
  }
  
  // Overlap yoksa, doğrudan ekle
  // Eğer original yarım bir satırla bitiyorsa, bir önceki tam satıra kadar geri git
  const lastNewline = originalCode.lastIndexOf('\n');
  if (lastNewline > originalCode.length - 100) {
    // Son satır muhtemelen yarım, devam koduyla birleştir
    return originalCode + '\n' + continuationCode;
  }
  
  return originalCode + '\n' + continuationCode;
}

const MAX_CONTINUE_ATTEMPTS = 3;

// Tool calling için metadata şablonu
const getWidgetMetadataTool = () => ({
  type: "function",
  function: {
    name: "generate_widget_with_metadata",
    description: "Widget kodu ve açıklayıcı metadata bilgilerini döndür",
    parameters: {
      type: "object",
      properties: {
        code: { 
          type: "string", 
          description: "Widget JavaScript kodu - function Widget({ data, colors, filters }) ile başlayıp return Widget; ile bitmeli" 
        },
        suggestedName: {
          type: "string",
          description: "Widget için önerilen isim (her kelimenin ilk harfi büyük, Türkçe). Örnek: 'Cari Bakiye Özeti', 'Günlük Satış Trendi', 'Stok Kritik Uyarılar'"
        },
        suggestedIcon: {
          type: "string",
          description: "Widget için önerilen Lucide ikon adı. Finans: DollarSign, CreditCard, Wallet, PiggyBank. Satış: ShoppingCart, TrendingUp, Store. Stok: Package, Box, Archive. Cari: Users, Building, UserCheck. Performans: Target, Award, Activity, Gauge. Grafik: BarChart2, PieChart, LineChart. Uyarı: AlertTriangle, AlertCircle, Bell. Zaman: Clock, Calendar, Timer."
        },
        suggestedTags: { 
          type: "array", 
          items: { type: "string" },
          description: "Widget için önerilen etiketler (finans, satis, cari, stok, performans, rapor vb.) - maks 5" 
        },
        shortDescription: { 
          type: "string", 
          description: "Widget'ın kısa açıklaması - Marketplace kartında görünecek (maks 100 karakter)" 
        },
        longDescription: { 
          type: "string", 
          description: "Widget'ın detaylı açıklaması - ne gösterdiği, nasıl kullanılacağı (Markdown destekli)" 
        },
        usedFields: {
          type: "array",
          description: "Widget'ta kullanılan veri alanları ve rolleri",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Alan adı (örn: bakiye, unvan)" },
              type: { type: "string", description: "Alan tipi (number, string, date, boolean)" },
              usage: { type: "string", description: "Alanın widget'ta nasıl kullanıldığı (örn: Y ekseni değeri, gruplama alanı)" }
            },
            required: ["name", "type", "usage"]
          }
        },
        calculations: {
          type: "array",
          description: "Widget'ta yapılan hesaplamalar",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Hesaplama adı (örn: Toplam Bakiye)" },
              formula: { type: "string", description: "Hesaplama formülü (örn: sum(bakiye))" },
              description: { type: "string", description: "Hesaplamanın açıklaması" }
            },
            required: ["name", "formula", "description"]
          }
        },
        dataFlow: { 
          type: "string", 
          description: "Verinin işlenme akışı - filtre, gruplama, sıralama adımları" 
        }
      },
      required: ["code", "suggestedName", "suggestedIcon", "suggestedTags", "shortDescription", "longDescription", "usedFields", "dataFlow"]
    }
  }
});

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, sampleData, chatHistory, mode, useMetadata, existingCode, dataSourceInfo, dataAnalysis, multiQueryInfo } = await req.json();

    if (!prompt) {
      throw new Error("Prompt gerekli");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY yapılandırılmamış");
    }

    console.log("[AI Code Generator v2.4] Mod:", mode || 'generate', "- Metadata:", useMetadata ? 'aktif' : 'pasif', "- ExistingCode:", existingCode ? 'var' : 'yok', "- DataSourceInfo:", dataSourceInfo ? 'var' : 'yok');

    // Mesajları oluştur
    let messages: Array<{ role: string; content: string }>;
    
    // System prompt'a metadata talimatlarını ekle (sadece generate modunda)
    const metadataInstructions = `

═══════════════════════════════════════════════════════════════════════════════
📋 KOD ÜRETİMİ SONRASI META VERİ (ZORUNLU!)
═══════════════════════════════════════════════════════════════════════════════

Widget kodunu ürettikten sonra aşağıdaki metadata bilgilerini de sağlamalısın:

📝 İSİM ÖNERİSİ (suggestedName) - ZORUNLU:
   - Her kelimenin ilk harfi büyük (Title Case)
   - Türkçe karakterler kullan
   - Kısa ve açıklayıcı (2-5 kelime)
   - Örnekler: "Cari Bakiye Özeti", "Günlük Satış Trendi", "Stok Uyarıları", "Vadesi Geçen Çekler"

📌 İKON ÖNERİSİ (suggestedIcon) - ZORUNLU:
   Widget'ın içeriğine uygun Lucide ikon adı seç:
   
   | Kategori     | Önerilen İkonlar                           |
   |--------------|-------------------------------------------|
   | Finans       | DollarSign, CreditCard, Wallet, PiggyBank |
   | Satış        | ShoppingCart, TrendingUp, Store           |
   | Stok         | Package, Box, Archive                     |
   | Cari         | Users, Building, UserCheck                |
   | Performans   | Target, Award, Activity, Gauge            |
   | Grafik       | BarChart2, PieChart, LineChart, TrendingUp|
   | Uyarı        | AlertTriangle, AlertCircle, Bell          |
   | Zaman        | Clock, Calendar, Timer, History           |

🏷️ ETİKET ÖNERİLERİ (suggestedTags):
   - Widget'ın içeriğine uygun 3-5 etiket öner
   - Mevcut kategorilerden seç: finans, satis, cari, stok, performans, rapor, analiz, ozet

📝 KISA AÇIKLAMA (shortDescription):
   - Widget'ın ne yaptığını tek cümlede özetle (max 100 karakter)
   - Örnek: "Müşteri bazlı satış performansı karşılaştırması"

📖 UZUN AÇIKLAMA (longDescription):
   - Widget'ın detaylı açıklaması (Markdown destekli)
   - Ne gösterdiği, nasıl kullanılacağı, dikkat edilecek noktalar

🔧 TEKNİK NOTLAR:
   usedFields: Kullanılan veri alanları ve rolleri
     Örnek: [{ name: "bakiye", type: "number", usage: "Y ekseni değeri" }]
   
   calculations: Yapılan hesaplamalar
     Örnek: [{ name: "Toplam", formula: "sum(bakiye)", description: "Bakiye toplamı" }]
   
   dataFlow: Verinin işlenme akışı
     Örnek: "Cari kartlar bakiyeye göre filtrelenir, sektör koduna göre gruplandırılır, toplam bakiye hesaplanır"

`;

    if (mode === 'metadata-only' && existingCode) {
      // Sadece metadata üretimi - kod zaten var
      // Metadata modunda KODU kısaltma - tamamını gönder (max 8000)
      const truncatedCode = existingCode.length > 8000 
        ? existingCode.substring(0, 8000) + '\n// ... (kod devam ediyor)'
        : existingCode;
      
      // Zenginleştirilmiş system prompt
      const metadataOnlySystemPrompt = `Sen bir widget analiz uzmanısın. Sana verilen widget KODU, VERİ KAYNAĞI ve ALAN İSTATİSTİKLERİNİ dikkatlice analiz edip doğru metadata oluşturacaksın.

SADECE generate_widget_with_metadata tool'unu çağır. Başka hiçbir şey yazma.

⚠️ KRİTİK KURALLAR:
1. Açıklamaları KODU ve VERİ BİLGİLERİNİ analiz ederek yaz - varsayım yapma!
2. Kodda hangi alanlar kullanılıyor, hangi hesaplamalar yapılıyor dikkatlice bak
3. Veri kaynağı bilgisini (module, method, alanlar) dikkate al
4. Alan istatistiklerini (min, max, toplam, tip) inceleyerek widget'ın ne yaptığını anla
5. Grafik tipini (bar, line, pie, map, radar vb.) doğru tespit et

Widget'ın yaptığı işlemi, kullandığı alanları, hesaplamaları analiz et ve DOĞRU metadata üret.`;

      // Zenginleştirilmiş prompt - frontend'den gelen tüm bağlamı kullan
      let enrichedPrompt = prompt; // Frontend'den gelen zengin prompt'u kullan
      
      // Eğer frontend zengin prompt göndermediyse, eski format için fallback
      if (!prompt.includes('VERİ KAYNAĞI BİLGİSİ') && dataSourceInfo) {
        enrichedPrompt = `Bu widget kodunu analiz et ve metadata oluştur.

═══════════════════════════════════════════════════════════════
                    VERİ KAYNAĞI BİLGİSİ
═══════════════════════════════════════════════════════════════

📊 Veri Kaynağı: ${dataSourceInfo.name || 'Bilinmiyor'}
   - API: ${dataSourceInfo.module || '?'}.${dataSourceInfo.method || '?'}
   - Toplam Kayıt: ${dataSourceInfo.recordCount || '?'}
   - Alanlar: ${Array.isArray(dataSourceInfo.allFields) ? dataSourceInfo.allFields.join(', ') : 'Bilinmiyor'}
   ${dataSourceInfo.description ? '- Açıklama: ' + dataSourceInfo.description : ''}

${multiQueryInfo ? '📊 ÇOKLU VERİ KAYNAĞI:\\n' + multiQueryInfo.map((q: any) => '   • ' + q.queryName + ' (' + q.dataSourceName + '): ' + q.recordCount + ' kayıt').join('\\n') + '\\n' : ''}

${dataAnalysis && Object.keys(dataAnalysis).length > 0 ? '═══════════════════════════════════════════════════════════════\\n                    ALAN İSTATİSTİKLERİ\\n═══════════════════════════════════════════════════════════════\\n\\n' + Object.entries(dataAnalysis).map(([field, stats]: [string, any]) => {
  let info = '📈 ' + field + ': Tip=' + stats.type + ', Benzersiz=' + stats.uniqueCount;
  if (stats.min !== undefined) info += ', Min=' + stats.min + ', Max=' + stats.max + ', Toplam=' + stats.sum;
  if (stats.minDate) info += ', Tarih: ' + stats.minDate + ' - ' + stats.maxDate;
  return info;
}).join('\\n') + '\\n' : ''}

═══════════════════════════════════════════════════════════════
                    WIDGET KODU
═══════════════════════════════════════════════════════════════

\\\`\\\`\\\`javascript
${truncatedCode}
\\\`\\\`\\\`

${sampleData ? '═══════════════════════════════════════════════════════════════\\n                    ÖRNEK VERİ\\n═══════════════════════════════════════════════════════════════\\n\\n' + JSON.stringify(sampleData, null, 2).slice(0, 2000) + '\\n' : ''}`;
      }

      messages = [
        { role: 'system', content: metadataOnlySystemPrompt + metadataInstructions },
        { role: 'user', content: enrichedPrompt }
      ];
    } else if (mode === 'refine' && chatHistory && chatHistory.length > 0) {
      // İyileştirme modu - chat geçmişini kullan (metadata yok)
      messages = [
        { role: 'system', content: getRefinementSystemPrompt() },
        ...chatHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: prompt }
      ];
    } else {
      // Normal üretim modu - metadata talimatlarını ekle
      const systemPrompt = useMetadata 
        ? getGenerationSystemPrompt() + metadataInstructions
        : getGenerationSystemPrompt();
        
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    }

    // API isteği oluştur
    const requestBody: any = {
      model: "google/gemini-3-pro-preview",
      messages,
      max_tokens: mode === 'metadata-only' ? 8000 : 64000, // Metadata için artırıldı (tool response için)
      temperature: 0.7,
    };
    
    // Tool calling ekle (generate ve metadata-only modlarında, refine hariç)
    if (mode !== 'refine' && useMetadata) {
      requestBody.tools = [getWidgetMetadataTool()];
      requestBody.tool_choice = { type: "function", function: { name: "generate_widget_with_metadata" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit aşıldı, lütfen biraz bekleyip tekrar deneyin." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kredi yetersiz, lütfen Lovable hesabınıza kredi ekleyin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("[AI Code Generator] API hatası:", response.status, errorText);
      throw new Error(`AI API hatası: ${response.status}`);
    }

    const result = await response.json();
    
    let generatedCode = "";
    let aiMetadata: any = null;
    let finishReason = result.choices?.[0]?.finish_reason || "unknown";
    
    // Tool calling yanıtı mı kontrol et
    const toolCalls = result.choices?.[0]?.message?.tool_calls;
    
    if (toolCalls && toolCalls.length > 0) {
      // Tool calling yanıtı
      const toolCall = toolCalls[0];
      if (toolCall.function?.name === "generate_widget_with_metadata") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          generatedCode = args.code || "";
          
          // Metadata'yı ayıkla
          aiMetadata = {
            suggestedName: args.suggestedName || "",
            suggestedIcon: args.suggestedIcon || "Code",
            suggestedTags: args.suggestedTags || [],
            shortDescription: args.shortDescription || "",
            longDescription: args.longDescription || "",
            technicalNotes: {
              usedFields: args.usedFields || [],
              calculations: args.calculations || [],
              dataFlow: args.dataFlow || "",
              generatedAt: new Date().toISOString(),
            }
          };
          
          console.log("[AI Code Generator v2.3] Tool calling başarılı, metadata alındı:", {
            suggestedName: aiMetadata.suggestedName,
            suggestedIcon: aiMetadata.suggestedIcon,
            tagsCount: aiMetadata.suggestedTags.length
          });
        } catch (parseError) {
          console.error("[AI Code Generator] Tool arguments parse hatası:", parseError);
          // Fallback: raw content kullan
          generatedCode = result.choices?.[0]?.message?.content || "";
        }
      }
    } else {
      // Normal yanıt (refine modu veya tool calling kullanılmadı)
      generatedCode = result.choices?.[0]?.message?.content || "";
    }

    // Markdown code block'larını temizle
    generatedCode = generatedCode
      .replace(/```javascript\n?/gi, "")
      .replace(/```jsx\n?/gi, "")
      .replace(/```js\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();
    
    // REFINE modunda: kod bloğundan önceki açıklama metinlerini kaldır
    // "tebrikler", "güzel", "yapıldı" gibi AI yorumlarını temizle
    if (mode === 'refine') {
      // "function Widget" veya "const Widget" ile başlayan ilk satırı bul
      const codeStartMatch = generatedCode.match(/(function Widget|const Widget|var Widget)/);
      if (codeStartMatch && codeStartMatch.index && codeStartMatch.index > 0) {
        // Fonksiyon tanımından başlayarak kodu al
        generatedCode = generatedCode.substring(codeStartMatch.index);
      }
    }

    console.log("[AI Code Generator v2.3] İlk yanıt - uzunluk:", generatedCode.length, "finish_reason:", finishReason, "metadata:", !!aiMetadata, "mode:", mode);

    // metadata-only modunda kod üretimi atlanır, mevcut kod kullanılır
    if (mode === 'metadata-only') {
      console.log("[AI Code Generator v2.3] Metadata-only modu - kod üretimi atlandı");
      return new Response(
        JSON.stringify({ 
          success: true, 
          code: existingCode || "",
          aiMetadata: aiMetadata,
          metadata: {
            totalAttempts: 1,
            wasPartial: false,
            isComplete: true,
            codeLength: existingCode?.length || 0,
            finishReason: "metadata-only",
            hasAiMetadata: !!aiMetadata,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-continue mekanizması (sadece tool calling olmadığında)
    let attempts = 0;
    let wasPartial = false;
    
    if (!toolCalls) {
      while (
        (finishReason === "length" || !isCodeComplete(generatedCode)) && 
        attempts < MAX_CONTINUE_ATTEMPTS
      ) {
        attempts++;
        wasPartial = true;
        console.log(`[AI Code Generator v2.3] Kod yarım, devam ediliyor (${attempts}/${MAX_CONTINUE_ATTEMPTS})...`);
        
        try {
          const continuation = await continueGeneration(
            generatedCode, 
            LOVABLE_API_KEY, 
            attempts,
            mode || 'generate'
          );
          
          // Kodları birleştir
          generatedCode = mergeCodeParts(generatedCode, continuation.code);
          finishReason = continuation.finishReason;
          
          console.log(`[AI Code Generator v2.3] Devam ${attempts} - yeni uzunluk:`, generatedCode.length);
          
          // Eğer kod tamamlandıysa çık
          if (isCodeComplete(generatedCode)) {
            console.log("[AI Code Generator v2.3] Kod tamamlandı!");
            break;
          }
        } catch (continueError) {
          console.error(`[AI Code Generator v2.3] Devam hatası (${attempts}):`, continueError);
          // Hata olsa bile mevcut kodla devam et
          break;
        }
      }
    }

    // Son kontrol
    const codeIsComplete = isCodeComplete(generatedCode);
    
    if (!codeIsComplete && attempts >= MAX_CONTINUE_ATTEMPTS) {
      console.warn("[AI Code Generator v2.3] Maksimum deneme sayısına ulaşıldı, kod hala tamamlanmadı");
    }

    console.log("[AI Code Generator v2.3] Sonuç - uzunluk:", generatedCode.length, "tamamlandı:", codeIsComplete, "toplam deneme:", attempts + 1);

    return new Response(
      JSON.stringify({ 
        success: true, 
        code: generatedCode,
        aiMetadata: aiMetadata, // Yeni: AI tarafından üretilen metadata
        metadata: {
          totalAttempts: attempts + 1,
          wasPartial,
          isComplete: codeIsComplete,
          codeLength: generatedCode.length,
          finishReason,
          hasAiMetadata: !!aiMetadata,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[AI Code Generator] Hata:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Bilinmeyen hata" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});