
# Cari Sektör Dağılımı Widget İyileştirmesi ve AI Örnek Widget Seçici

## Bölüm 1: Widget Karşılaştırması ve Eksiklikler

### Cari Kaynak Dağılımı (Referans - Doğru Yapı) ✅
```javascript
// Responsive legend için state'ler
var containerRef = React.useRef(null);
var legendExpanded = React.useState(false);
var hasEnoughSpace = React.useState(true);
var contentHeight = React.useState(200);

// Alan hesaplama effect'i
React.useEffect(function() {
  if (containerRef.current) {
    var containerH = containerRef.current.offsetHeight;
    var legendH = chartData.length * 28;
    var threshold = containerH * 0.40; // %40 kuralı
    hasEnoughSpace[1](legendH <= threshold);
  }
}, [chartData]);

// Container: h-full flex flex-col (border yok!)
// Legend toggle butonu: hasEnoughSpace[0] kontrolü
// Responsive legend: hasEnoughSpace[0] || legendExpanded[0]
```

### Cari Sektör Dağılımı (Mevcut - Eksik Yapı) ❌
```javascript
// ❌ containerRef yok
// ❌ hasEnoughSpace kontrolü yok
// ❌ legendExpanded toggle yok
// ❌ Fazladan border ve padding var: 
//    'p-2 md:p-3 space-y-2 bg-card rounded border border-border'
```

---

## Bölüm 2: Cari Sektör Dağılımı Düzeltmeleri

Veritabanındaki `builder_config.customCode` aşağıdaki değişikliklerle güncellenecek:

### 2.1 Eklenecek State'ler (Satır 173 sonrası)
```javascript
var containerRef = React.useRef(null);
var legendExpanded = React.useState(false);
var hasEnoughSpace = React.useState(true);
var contentHeight = React.useState(200);
```

### 2.2 Eklenecek Effect (Satır 212 sonrası)
```javascript
React.useEffect(function() {
  if (containerRef.current) {
    var containerH = containerRef.current.offsetHeight;
    var headerH = 56;
    var computedContentHeight = Math.max(0, containerH - headerH);
    contentHeight[1](computedContentHeight);
    
    var legendH = chartData.length * 28;
    var threshold = computedContentHeight * 0.40;
    hasEnoughSpace[1](legendH <= threshold);
  }
}, [chartData]);
```

### 2.3 Ana Container Değişikliği
```javascript
// Eski:
'p-2 md:p-3 space-y-2 bg-card rounded border border-border h-full flex flex-col'

// Yeni (memory kurallarına uygun - border yok):
ref: containerRef,
className: 'h-full flex flex-col'
```

### 2.4 Legend Toggle Butonu Eklenmesi
```javascript
// Grafik alanından sonra, liste öncesinde
!hasEnoughSpace[0] && React.createElement('div', { 
  className: 'w-full flex items-center justify-center flex-shrink-0 mt-2' 
},
  React.createElement('button', {
    type: 'button',
    onClick: function() { legendExpanded[1](!legendExpanded[0]); },
    className: 'flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50'
  },
    legendExpanded[0] ? 'Gizle' : 'Detaylar',
    React.createElement('span', { 
      className: 'transform transition-transform ' + (legendExpanded[0] ? 'rotate-180' : '')
    }, '▼')
  )
)
```

### 2.5 Legend Görünürlük Kontrolü
```javascript
// Eski:
React.createElement('div', { className: 'h-[30%] min-h-[80px] overflow-y-auto...' }, ...)

// Yeni (koşullu render):
(hasEnoughSpace[0] || legendExpanded[0]) && React.createElement('div', { 
  className: 'w-full flex-shrink-0 ' + (!hasEnoughSpace[0] && legendExpanded[0] ? 'mt-2 pt-2 border-t border-border' : ''),
  style: !hasEnoughSpace[0] && legendExpanded[0] && contentHeight[0] > 0
    ? { maxHeight: Math.max(96, Math.floor(contentHeight[0] * 0.5)), overflowY: 'auto' }
    : undefined
},
  React.createElement('div', { className: 'grid grid-cols-2 gap-x-4 gap-y-1' }, ...)
)
```

---

## Bölüm 3: AI Örnek Widget Seçici

`CustomCodeWidgetBuilder.tsx` dosyasında AI Kod Üret (Step 2) bölümüne yeni bir alan eklenecek.

### 3.1 Yeni State (Satır 246 civarına)
```typescript
const [selectedExampleWidget, setSelectedExampleWidget] = useState<string | null>(null);
```

### 3.2 Yeni Collapsible Bölümü (DIA Model Referansları'ndan önce, satır 1366 civarı)
```typescript
{/* Örnek Widget Seç */}
<Collapsible open={showExampleWidgets} onOpenChange={setShowExampleWidgets} className="mb-3">
  <CollapsibleTrigger asChild>
    <Button variant="outline" size="sm" className="w-full justify-between h-8">
      <span className="flex items-center gap-2 text-xs">
        <LucideIcons.Layers className="h-3.5 w-3.5" />
        Örnek Widget Seç
        {selectedExampleWidget && (
          <Badge variant="secondary" className="text-[10px] h-4">1</Badge>
        )}
      </span>
      <LucideIcons.ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showExampleWidgets && "rotate-180")} />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-2 p-3 border rounded-lg bg-muted/30 space-y-2">
    <p className="text-xs text-muted-foreground">
      Mevcut widget'lardan birini seçerek AI'ye örnek olarak gönderin
    </p>
    <ScrollArea className="max-h-[150px]">
      <div className="space-y-1">
        {customWidgetTemplates.map(widget => (
          <div
            key={widget.id}
            onClick={() => setSelectedExampleWidget(
              selectedExampleWidget === widget.widget_key ? null : widget.widget_key
            )}
            className={cn(
              "flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors",
              selectedExampleWidget === widget.widget_key 
                ? "bg-primary/10 border border-primary/30" 
                : "hover:bg-muted"
            )}
          >
            <DynamicIcon iconName={widget.icon || 'Code'} className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{widget.name}</span>
            {selectedExampleWidget === widget.widget_key && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
    {selectedExampleWidget && (
      <div className="pt-2 border-t">
        <Badge variant="outline" className="text-xs gap-1">
          <Check className="h-3 w-3" />
          {customWidgetTemplates.find(w => w.widget_key === selectedExampleWidget)?.name}
        </Badge>
      </div>
    )}
  </CollapsibleContent>
</Collapsible>
```

### 3.3 buildEnhancedPrompt Güncelleme (Satır 1214 civarı)
```typescript
const buildEnhancedPrompt = useCallback(() => {
  let prompt = aiPrompt;
  
  // Seçili örnek widget kodu
  if (selectedExampleWidget) {
    const exampleWidget = customWidgetTemplates.find(w => w.widget_key === selectedExampleWidget);
    if (exampleWidget?.builder_config?.customCode) {
      prompt += '\n\n📋 ÖRNEK REFERANS WIDGET:\n';
      prompt += 'Aşağıdaki widget kodunu yapı ve stil açısından örnek al:\n';
      prompt += '```javascript\n' + exampleWidget.builder_config.customCode + '\n```\n';
      prompt += 'Bu widget\'ın responsive legend, renk paleti kullanımı ve container yapısını benzer şekilde uygula.';
    }
  }
  
  // ... mevcut DIA Model linkleri ve kurallar kodu ...
}, [aiPrompt, selectedExampleWidget, customWidgetTemplates, diaModelLinks, aiRequirements, customRules]);
```

---

## Teknik Özet

| Dosya | Değişiklik |
|-------|------------|
| `widgets` tablosu (SQL UPDATE) | Cari Sektör Dağılımı customCode güncelleme |
| `CustomCodeWidgetBuilder.tsx` | Örnek Widget Seçici UI ve prompt entegrasyonu |

---

## Beklenen Sonuç

1. **Cari Sektör Dağılımı** widget'ı artık:
   - Responsive legend toggle'a sahip olacak
   - Fazladan border/padding olmayacak (memory kurallarına uygun)
   - Alan yetersizse "Detaylar" butonu gösterecek

2. **AI Kod Üret** bölümünde:
   - Mevcut widget'lar listeden seçilebilecek
   - Seçilen widget'ın kodu AI'ye örnek olarak gönderilecek
   - AI, seçilen widget'ın yapısını referans alarak yeni widget üretecek
