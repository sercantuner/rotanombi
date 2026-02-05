 # Memory: technical/widget-data-array-validation
 Updated: now
 
 Custom widget kodlarında `data` prop'undan gelen veriler her zaman array olmayabilir. Güvenli veri erişimi için `Array.isArray()` kontrolü zorunludur:
 
 ```javascript
 // YANLIŞ - Hata verebilir
 var cariler = (data && data[0]) || [];
 
 // DOĞRU - Array kontrolü ile
 var rawData = data && data[0];
 var cariler = Array.isArray(rawData) ? rawData : (rawData && rawData.data ? rawData.data : []);
 ```
 
 Bu kural özellikle multi-query widget'larda kritiktir çünkü her veri kaynağı farklı yapıda dönebilir.