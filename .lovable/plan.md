
Amaç: (1) AI üretilen / custom code grafiklerde “çerçeve” (border) oluşmasını kalıcı olarak engellemek, (2) Recharts tooltip’lerinin her zaman en önde görünmesini garanti etmek.

## 1) Teşhis (neden hâlâ çerçeve görüyorum?)
Bu durumun aynı anda iki kaynağı var:

1) **Cari Sektör Dağılımı widget’ının customCode’u hâlâ root container’da border çiziyor**
- DB’deki mevcut customCode’da şu satır var:
  - `className: 'h-full flex flex-col p-2 md:p-3 bg-card rounded border border-border'`
- Yani AI kurallarına “çerçeve çizme” demiş olsan da, kaydedilen kod bunu bizzat yapıyor.

2) **Dashboard’daki sistem-level Card bileşeni de varsayılan border ekliyor**
- `src/components/ui/card.tsx` içinde:
  - `className="rounded border bg-card text-card-foreground"`
- Bu da widget’ın etrafında ayrıca ikinci bir çerçeve oluşturabiliyor (double-frame hissi).

## 2) Teşhis (tooltip neden ortadaki yazının altında kalıyor?)
Cari Sektör Dağılımı customCode’unda:
- `Recharts.Tooltip` şu an `wrapperStyle` verm **emiyor** — Cari Kaynak Dağılımı'nda yeni eklediğimiz `wrapperStyle: { zIndex: 9999 }` burada yok.
- Sadece CustomTooltip içinde inline `style: { zIndex: 9999 }` var ama Recharts tooltip wrapper'ının kendisi bu z-index'i görmüyor, bu yüzden ortadaki overlay (pointer-events-none) daha yüksek z-index'de kalabilir.

## 3) Önerilen Çözümler

### A) Edge Function: AI Kod Üreticiye Ek Satır Ekle
`supabase/functions/ai-code-generator/index.ts` dosyasındaki kuralların **iki** yerinde güncelleştirme:

1) **Ana Kart Stili (Satır ~225-226)**
   - Mevcut:
     ```
     Ana kart:       'p-2 md:p-3 space-y-2 bg-card rounded'  (DIŞ ÇERÇEVE YASAK!)
     ```
   - Kural metni zaten **Satır 237** üzerinde: `- border, border-border (DIŞ ÇERÇEVE - KESİNLİKLE YASAK! ...)`  
   Bu anlık açıktır. Ancak birleşik (composite) yapılar için örnek kodda (Satır 200) **yanlışlıkla** şu gösterilmiş:  
     ```javascript
     React.createElement('div', { className: 'p-2 md:p-3 space-y-2 bg-card rounded border border-border' }, ...
     ```
   **Satır 200'de bu çizgiyi tamamen kaldırmak gerekiyor**:
     ```javascript
     React.createElement('div', { className: 'p-2 md:p-3 space-y-2 bg-card rounded' }, ...
     ```

2) **Tooltip Z-Index - ZORUNLU (Yeni Kural)**
   Recharts ile çalışan tüm widgetlar için "wrapperStyle: { zIndex: 9999 }" zorunlu hale getirilmeli. Şu an var olan Tooltip örneklerinde (örneğin Satır ~507) inline style { zIndex: 9999 } yazılmış ama wrapperStyle yok. **Örnek bloklara wrapperStyle eklenmelidir**:

   - Satır ~507 civarındaki örnekte:
     ```javascript
     React.createElement('div', {
       className: 'bg-popover border border-border rounded-lg shadow-lg p-3',
       style: { zIndex: 9999 }  // ← içerik z-index
     }, ...)
     ```
     üzerine ayrı bir **ZORUNLU** kural bloğu açılmalı:
     ```
     📊 RECHARTS TOOLTIP Z-INDEX (ZORUNLU - HER GRAFİK İÇİN!)
     ─────────────────────────────────────────────────────────────────────────
     ⚠️ Tooltip'in grafiğin merkez overlay'inin (pointer-events-none) altında kalmaması için
        wrapperStyle: { zIndex: 9999 } eklemek ZORUNLUDUR!
     
     ✅ DOĞRU KULLANIM:
     React.createElement(Recharts.Tooltip, {
       content: CustomTooltip,
       wrapperStyle: { zIndex: 9999 }
     })
     
     ❌ YANLIŞ: wrapperStyle vermemek
     React.createElement(Recharts.Tooltip, { content: CustomTooltip })
     ```

### B) Veritabanı: Mevcut Widget'ı Düzelt (Cari Sektör Dağılımı)
**Widget ID:** 553ea3b7-6312-482c-9e40-8661882eceaa

Kod içinde iki değişiklik:
1) **Satır 117-118** (Ana container):
   - Mevcut: `className: 'h-full flex flex-col p-2 md:p-3 bg-card rounded border border-border'`
   - Yeni: `className: 'h-full flex flex-col'`  (border, padding kaldırıldı)

2) **Satır 146-149** (Tooltip):
   - Mevcut:
     ```javascript
     React.createElement(Recharts.Tooltip, { 
       content: CustomTooltip,
       cursor: { fill: 'transparent' }
     })
     ```
   - Yeni:
     ```javascript
     React.createElement(Recharts.Tooltip, { 
       content: CustomTooltip,
       cursor: { fill: 'transparent' },
       wrapperStyle: { zIndex: 9999 }
     })
     ```

SQL (Çözüm B):
```sql
UPDATE public.widgets
SET builder_config = builder_config || jsonb_set(
  builder_config::jsonb,
  '{customCode}',
  to_jsonb(
    regexp_replace(
      regexp_replace(
        builder_config->>'customCode',
        'className: ''h-full flex flex-col p-2 md:p-3 bg-card rounded border border-border''',
        'className: ''h-full flex flex-col''',
        'g'
      ),
      'cursor: \{ fill: ''transparent'' \}\n\s*\}\)',
      'cursor: { fill: ''transparent'' },\n            wrapperStyle: { zIndex: 9999 }\n          })',
      'g'
    )
  ),
  TRUE
)
WHERE id = '553ea3b7-6312-482c-9e40-8661882eceaa'::uuid;
```

> **Dikkat:** Regex güvenli değilse manual veya tool-based güncelleme gerekebilir.

### C) UI Tarafında: BuilderWidgetRenderer "border" sınıfını zorla kaldır
`src/components/dashboard/BuilderWidgetRenderer.tsx` Satır 347-362:
```typescript
return (
  <Card className={cn(isolatedClassName, 'h-full flex flex-col')}>
    <ChartHeader />
    <CardContent className="flex-1 flex flex-col min-h-0 p-4 pt-3">
      ...
    </CardContent>
  </Card>
);
```

Burada `<Card>` bileşeni `src/components/ui/card.tsx` varsayılan olarak `border bg-card` sınıfı ekliyor. Custom widget'larda **border istemediğimizden** `Card` yerine düz `div` kullanmalıyız — ya da Card'ın border'ını override etmeliyiz:

```typescript
<Card className={cn(isolatedClassName, 'h-full flex flex-col !border-0')}>
```

> **Not:** Bu yaklaşım tüm custom widget'lar için global bir çözüm olup, KPI widget'ları için soruna neden olmaz (onlar zaten `StatCard` kullanıyor).

### D) CustomCodeWidgetBuilder: buildEnhancedPrompt'ta Hatırlatıcı Cümle
`src/components/admin/CustomCodeWidgetBuilder.tsx` Satır ~1218'de:
```typescript
const buildEnhancedPrompt = useCallback(() => {
  let prompt = aiPrompt;
  // ...
  if (activeRules.length > 0 || customRules.length > 0) {
    prompt += '\n\n⚙️ EK ZORUNLU KURALLAR:\n';
    activeRules.forEach(rule => {
      prompt += `- ${rule.promptAddition}\n`;
    });
    customRules.forEach(rule => {
      prompt += `- ${rule}\n`;
    });
  }
  
  // Tooltip ve border hatırlatıcı
  prompt += '\n\n🔴 HATIRLATMA:\n';
  prompt += '- Ana container\'da "border border-border" kullanma. Sadece "bg-card rounded" yeterli.\n';
  prompt += '- Recharts.Tooltip her zaman wrapperStyle: { zIndex: 9999 } ile kullanılmalı.\n';
  
  return prompt;
}, [aiPrompt, ...]);
```

Bu yolla hem prompt içinde açıkça yasaklanmış olur, hem de AI kurallarına uyum sağlanır.

---

## 4) Adım Adım Uygulanacak Değişiklikler
1. **Edge Function**: `ai-code-generator/index.ts`
   - Satır 200'deki örnek koddan `border border-border` kaldır.
   - Tooltip z-index kuralını ekle.
2. **Veritabanı Widget**: SQL ile `cari_sektor_dagilimi` customCode'unu güncelle veya builder UI'da manuel düzenle.
3. **BuilderWidgetRenderer**: Card'ı `!border-0` ile override et.
4. **CustomCodeWidgetBuilder**: buildEnhancedPrompt'a hatırlatıcı ekle.

---

## 5) Beklenen Sonuç
- Custom widget'larda **çift çerçeve** (double border) kaybolacak.
- Grafiğin **ortadaki label** (pointer-events-none) tooltip'lerin z-index'inden **düşük** kalacak, tooltip her zaman üstte görünecek.
- Yeni üretilen widget kodlarında **AI tarafından border/border-border kullanılmayacak** ve **wrapperStyle: { zIndex: 9999 }** varsayılan hale gelecek.
