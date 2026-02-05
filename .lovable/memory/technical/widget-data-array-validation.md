 # Memory: technical/widget-data-array-validation
 Updated: now
 
 Custom code widgets must implement robust data validation using 'Array.isArray()' for all incoming data sources. Since data might be undefined, an empty object, or follow a nested structure (e.g., '{ data: [] }') during loading or in the preview environment, direct calls to array methods like '.filter()', '.map()', or '.forEach()' must be guarded to prevent runtime 'not a function' errors. This standard ensures widget stability across different execution contexts.
 
 ## Single-Query Widgets
 ```js
 var toArray = function(v) {
   if (Array.isArray(v)) return v;
   if (v && Array.isArray(v.data)) return v.data;
   return [];
 };
 var cariler = toArray(data);
 ```
 
 ## Multi-Query Widgets
 Multi-query widget'lar veriyi iki yoldan alabilir:
 1. **multiData prop** (tercih edilen): `BuilderWidgetRenderer` tarafından sağlanan `multiData` (veya scope'taki `multiData` değişkeni) – config.multiQuery.queries sırası ile dizi içinde dizi.
 2. **data prop (legacy)**: Eğer `multiData` yoksa ve `data` dizisinin ilk elemanı yine bir diziyse (`Array.isArray(data[0])`) bu yapı eski format olabilir.
 
 ```js
 var toArray = function(v) {
   if (Array.isArray(v)) return v;
   if (v && Array.isArray(v.data)) return v.data;
   return [];
 };
 
 // multiData yoksa legacy kontrolü
 var effectiveMulti = null;
 try { if (typeof multiData !== 'undefined' && Array.isArray(multiData)) effectiveMulti = multiData; } catch(e){}
 if (!effectiveMulti && Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) effectiveMulti = data;
 
 var cariler   = effectiveMulti ? toArray(effectiveMulti[0]) : toArray(data);
 var teklifler = effectiveMulti ? toArray(effectiveMulti[1]) : [];
 var siparisler = effectiveMulti ? toArray(effectiveMulti[2]) : [];
 ```