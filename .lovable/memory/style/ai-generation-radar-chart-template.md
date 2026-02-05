 # Memory: style/ai-generation-radar-chart-template
 Updated: now
 
 AI-generated radar/spider charts MUST follow the "Cari Kaynak Dağılımı (Örümcek)" template for visual consistency across all dashboard widgets.
 
 ## ⚠️ ZORUNLU RADAR/SPIDER GRAFİK ŞABLONU
 
 Bu şablon tüm Radar/Örümcek grafik widget'ları için ZORUNLUDUR.
 
 ## 📐 YAPI:
 
 ### 1. HEADER (Üst Bilgi):
 ```javascript
 React.createElement("div", { className: "flex-shrink-0 flex items-center justify-between mb-2 px-1" },
   React.createElement("div", { className: "flex flex-col" },
     React.createElement("h3", { className: "text-base font-semibold text-foreground flex items-center gap-2" }, 
       React.createElement(LucideIcons.Radar, { className: "w-4 h-4 text-primary" }),
       "Başlık"
     ),
     React.createElement("span", { className: "text-xs text-muted-foreground" }, 
       chartData.length + " farklı kategori"
     )
   ),
   React.createElement("div", { className: "text-right" },
     React.createElement("span", { className: "text-lg font-bold text-foreground block leading-none" }, totalRecords),
     React.createElement("span", { className: "text-[10px] text-muted-foreground uppercase" }, "Toplam Kayıt")
   )
 )
 ```
 
 ### 2. RADAR GRAFİK CONTAINER:
 ```javascript
 React.createElement("div", { className: "flex-1 min-h-0 relative w-full" },
   React.createElement(Recharts.ResponsiveContainer, { width: "100%", height: "100%" },
     React.createElement(Recharts.RadarChart, { 
       cx: "50%", 
       cy: "50%", 
       outerRadius: "80%", // Tam genişlik
       data: chartData,
       margin: { top: 10, right: 30, left: 30, bottom: 10 }
     },
       React.createElement(Recharts.PolarGrid, { stroke: "hsl(var(--border))" }),
       React.createElement(Recharts.PolarAngleAxis, { 
         dataKey: "name",
         tick: { fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }
       }),
       React.createElement(Recharts.PolarRadiusAxis, { 
         angle: 30, 
         domain: [0, 'auto'],
         tick: { fill: "hsl(var(--muted-foreground))", fontSize: 9 },
         axisLine: false
       }),
       React.createElement(Recharts.Radar, {
         name: "Kayıt Sayısı",
         dataKey: "value",
         stroke: getColor(0),
         fill: getColor(0),
         fillOpacity: 0.4,
         isAnimationActive: true,
         onClick: handleSliceClick,
         cursor: "pointer"
       }),
       React.createElement(Recharts.Tooltip, { 
         content: React.createElement(CustomTooltip),
         wrapperStyle: { zIndex: 9999 }
       })
     )
   )
 )
 ```
 
 ### 3. DRILL-DOWN POPUP (UI.Dialog):
 ```javascript
 React.createElement(UI.Dialog, { open: isOpen, onOpenChange: setIsOpen },
   React.createElement(UI.DialogContent, { 
     className: "w-[50vw] max-w-[50vw] max-h-[80vh] flex flex-col p-0 gap-0 rounded border border-border" 
   },
     // Header (pr-12 kuralı - X butonu için)
     React.createElement("div", { 
       className: "flex items-center justify-between p-3 border-b border-border flex-shrink-0 gap-4 pr-12 bg-muted/10"
     },
       // Sol: İkon + Başlık + Alt bilgi
       React.createElement("div", { className: "flex items-center gap-2 min-w-0" },
         React.createElement("div", { className: "w-8 h-8 rounded flex items-center justify-center bg-primary/10" },
           React.createElement(LucideIcons.Users, { className: "w-4 h-4 text-primary" })
         ),
         React.createElement("div", { className: "flex flex-col min-w-0" },
           React.createElement(UI.DialogTitle, { className: "text-sm font-semibold truncate" }, 
             selectedItem ? selectedItem.name + " Detayları" : "Detaylar"
           ),
           React.createElement("span", { className: "text-xs text-muted-foreground" }, 
             selectedItem ? selectedItem.value + " kayıt" : ""
           )
         )
       ),
       // Sağ: Toplam değer
       React.createElement("div", { className: "text-right" },
         React.createElement("div", { className: "text-sm font-bold text-foreground" }, 
           selectedItem ? formatCurrency(selectedItem.totalBakiye) : ""
         ),
         React.createElement("div", { className: "text-[10px] text-muted-foreground" }, "Toplam")
       )
     ),
     
     React.createElement(UI.DialogDescription, { className: "sr-only" }, "Detay listesi"),
     
     // Scrollable Body
     React.createElement("div", { className: "flex-1 overflow-y-auto p-2" },
       // Liste items...
     ),
     
     // Footer
     React.createElement("div", { className: "p-2 border-t border-border bg-muted/10 flex justify-between items-center" },
       React.createElement("span", { className: "text-[10px] text-muted-foreground" }, "Liste sonu"),
       React.createElement("button", {
         className: "text-xs font-medium text-primary hover:underline",
         onClick: function() { setIsOpen(false); }
       }, "Kapat")
     )
   )
 )
 ```
 
 ## ✅ ZORUNLU STİLLER:
 
 | Element | Class/Style |
 |---------|-------------|
 | Ana container | `h-full flex flex-col` |
 | Grafik container | `flex-1 min-h-0 relative w-full` |
 | PolarGrid stroke | `hsl(var(--border))` |
 | PolarAngleAxis tick | `fill: "hsl(var(--foreground))", fontSize: 11` |
 | Radar fill | `getColor(0)`, `fillOpacity: 0.4` |
 | Tooltip wrapper | `wrapperStyle: { zIndex: 9999 }` |
 | DialogContent | `w-[50vw] max-w-[50vw] max-h-[80vh]` |
 | Header | `pr-12` (X butonu için) |
 
 ## ❌ YASAK STİLLER:
 
 | Yasak | Açıklama |
 |-------|----------|
 | Sabit renkler | `getColor()` helper kullan |
 | Legend (yan liste) | Radar grafiğinde legend YASAK, tüm alan grafik için |
 | Dış çerçeve | `border border-border` ana container'da YASAK |
 | `outerRadius: "60%"` | Minimum `80%` kullan |
 
 ## 📊 VERİ İŞLEME:
 
 ```javascript
 var processed = React.useMemo(function() {
   var groups = {};
   var totalCount = 0;
   
   data.forEach(function(item) {
     var sourceName = (item.fieldName || "").trim();
     if (!sourceName) return; // Boşları atla
     
     // Normalizasyon: İlk harf büyük
     sourceName = sourceName.charAt(0).toUpperCase() + sourceName.slice(1).toLowerCase();
 
     if (!groups[sourceName]) {
       groups[sourceName] = {
         count: 0,
         totalBakiye: 0,
         items: []
       };
     }
     
     groups[sourceName].count++;
     groups[sourceName].totalBakiye += (parseFloat(item.bakiye) || 0);
     groups[sourceName].items.push(item);
     totalCount++;
   });
 
   var result = Object.keys(groups).map(function(key) {
     return {
       name: key,
       value: groups[key].count,
       totalBakiye: groups[key].totalBakiye,
       items: groups[key].items,
       percent: totalCount > 0 ? (groups[key].count / totalCount) * 100 : 0,
       fullMark: 100 // Radar için gerekli
     };
   }).sort(function(a, b) { return b.value - a.value; });
 
   return { chartData: result, total: totalCount };
 }, [data]);
 ```
 
 ## 🎨 RENK KODLARI:
 
 | Element | Renk |
 |---------|------|
 | Radar fill/stroke | `getColor(0)` |
 | PolarGrid | `hsl(var(--border))` |
 | Axis tick | `hsl(var(--foreground))` |
 | Radius tick | `hsl(var(--muted-foreground))` |