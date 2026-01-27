# Memory: style/ai-generation-financial-list-template
Updated: now

AI-generated financial list widgets (Bank Accounts, Cash Balances, etc.) MUST use the KPI + Table composite structure. This ensures visual consistency across all financial dashboard widgets.

## ⚠️ ZORUNLU FİNANSAL LİSTE ŞABLONU (BANKA/KASA TİPİ)

Bu şablon Banka Hesapları, Kasa Bakiyeleri gibi finansal liste widget'ları için ZORUNLUDUR.

## 📐 YAPI:

### 1. ÜST BÖLÜM - KPI KARTLARI:
```javascript
React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-2' },
  kpiCards.map(function(kpi) {
    return React.createElement('div', {
      key: kpi.label,
      className: 'p-2 bg-card rounded-none border border-border'
    },
      React.createElement('p', { className: 'text-xs font-medium text-muted-foreground' }, kpi.label),
      React.createElement('p', { className: 'text-xl font-bold ' + kpi.color }, formatCurrency(kpi.value, kpi.currency))
    );
  })
)
```

### 2. ALT BÖLÜM - TABLO LİSTESİ:
```javascript
React.createElement('div', { 
  className: 'flex flex-col flex-1 min-h-0 bg-card rounded-none border border-border' 
},
  // Header bar
  React.createElement('div', { 
    className: 'flex items-center justify-between p-2 border-b border-border bg-muted/20' 
  },
    React.createElement('span', { className: 'text-sm font-medium text-foreground' }, 'Liste Başlığı'),
    React.createElement('span', { className: 'px-1.5 py-0.5 text-xs bg-secondary rounded-none' }, kayitSayisi + ' Kayıt')
  ),
  // Table
  React.createElement('div', { className: 'flex-1 overflow-y-auto' },
    React.createElement('table', { className: 'w-full text-sm text-left' },
      React.createElement('thead', { className: 'sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground' },
        React.createElement('tr', null,
          React.createElement('th', { className: 'p-2' }, 'Kolon 1'),
          React.createElement('th', { className: 'p-2' }, 'Kolon 2'),
          React.createElement('th', { className: 'p-2 text-right' }, 'Değer')
        )
      ),
      React.createElement('tbody', { className: 'divide-y divide-border' },
        data.map(function(item, idx) {
          return React.createElement('tr', {
            key: idx,
            className: 'hover:bg-muted/50 transition-colors'
          },
            // Row cells...
          );
        })
      )
    )
  )
)
```

### 3. AVATAR (Köşeli):
```javascript
React.createElement('div', { 
  className: 'w-6 h-6 rounded-none flex items-center justify-center bg-secondary text-[10px] font-bold text-foreground' 
}, item.ad?.substring(0, 2).toUpperCase() || 'XX')
```

## ✅ ZORUNLU STİLLER:

| Element | Class |
|---------|-------|
| Tüm containerlar | `rounded-none` (köşeli görünüm) |
| İç containerlar | `border border-border` |
| Thead | `sticky top-0 bg-muted/50` |
| Tbody | `divide-y divide-border` |
| Row | `hover:bg-muted/50 transition-colors` |
| Avatar | `rounded-none` (köşeli) |

## ❌ YASAK STİLLER:

| Yasak | Açıklama |
|-------|----------|
| `rounded`, `rounded-md`, `rounded-lg` | Köşeli olmalı, yuvarlatılmış YASAK |
| Kart bazlı liste | Tablo formatı zorunlu |
| `glass-card` | `bg-card` kullan |

## 📊 DÖVİZ BAZLI KPI GRUPLAMA:

```javascript
var kpiTotals = { TRY: 0, USD: 0, EUR: 0 };
data.forEach(function(item) {
  var currency = (item.dovizCinsi || 'TRY').toUpperCase();
  if (currency === 'TL') currency = 'TRY';
  if (kpiTotals[currency] !== undefined) {
    kpiTotals[currency] += parseFloat(item.bakiye) || 0;
  }
});

var kpiCards = [
  { label: 'TL Toplam', value: kpiTotals.TRY, currency: 'TRY', color: 'text-primary' },
  { label: 'USD Toplam', value: kpiTotals.USD, currency: 'USD', color: 'text-success' },
  { label: 'EUR Toplam', value: kpiTotals.EUR, currency: 'EUR', color: 'text-warning' }
];
```

## 🎨 RENK KODLARI:

| Döviz | KPI Renk | Kullanım |
|-------|----------|----------|
| TRY | `text-primary` | Ana para birimi |
| USD | `text-success` | Dolar |
| EUR | `text-warning` | Euro |
| Pozitif bakiye | `text-success` | Artı değer |
| Negatif bakiye | `text-destructive` | Eksi değer |
