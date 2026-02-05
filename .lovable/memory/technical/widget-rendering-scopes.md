 # Memory: technical/widget-rendering-scopes
 Updated: now
 
 Widget render motoru (BuilderWidgetRenderer ve CustomCodeWidgetBuilder); Recharts (ComposedChart, Treemap, Scatter, Radar, Funnel, ReferenceArea, ReferenceDot, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LabelList), Leaflet tabanlı 'MapScope' ve 'UIScope' bileşenlerini destekler. UIScope; Dialog, DialogContent, Button, Input, Select ve Checkbox gibi bileşenleri sunar. Nivo kütüphanesi (ResponsiveSankey, ResponsiveSunburst, ResponsiveChord, ResponsiveRadar, ResponsiveFunnel, ResponsiveChoropleth) lazy-load ile yüklenir.
 
 ## multiData Scope Değişkeni
 
 Multi-query (çoklu sorgu) widget'lar için `multiData` adında bir scope değişkeni mevcuttur. Bu değişken, `config.multiQuery.queries` dizisindeki her sorgunun ham sonuçlarını, **aynı sıraya** göre bir dizi olarak içerir:
 
 ```javascript
 // Örnek: 3 sorgu içeren bir multi-query widget
 // queries[0] = Cari Kart Listesi (dataSourceId: abc...)
 // queries[1] = Teklif Listesi (dataSourceId: def...)
 // queries[2] = Sipariş Listesi (dataSourceId: ghi...)
 
 var cariler   = toArray(multiData[0]); // Cari Kart sonuçları
 var teklifler = toArray(multiData[1]); // Teklif sonuçları
 var siparisler = toArray(multiData[2]); // Sipariş sonuçları
 ```
 
 ## Kritik: dataSources Yükleme Zamanlaması
 
 `CustomCodeWidgetBuilder` içinde multi-query verileri yüklenirken `useDataSources()` hook'unun `isLoading` durumu kontrol edilmelidir. React Query asenkron olduğu için, widget builder açıldığında `dataSources` henüz yüklenmemiş olabilir. Bu durumda `getDataSourceById()` fonksiyonu `undefined` döner ve veri boş kalır.
 
 **Çözüm:**
 - `isDataSourcesLoading` değeri `false` olana kadar `loadMultiQueryData` çağrılmamalıdır.
 - Cache miss durumunda (last_sample_data boş) DIA API'den doğrudan veri çekilmelidir.
 
 ## multiQueryData State vs Ref
 
 `useDynamicWidgetData` hook'unda `multiQueryData` bir `useRef` yerine `useState` olarak tutulmalıdır. Ref değişiklikleri React render döngüsünü tetiklemediği için, multi-query sonuçları geldiğinde widget güncellenemez. State kullanımı reaktif güncelleme sağlar.
 
 ```typescript
 // YANLIŞ (Reaktif değil):
 const multiQueryDataRef = useRef<any[][] | null>(null);
 multiQueryDataRef.current = [...];
 
 // DOĞRU (Reaktif):
 const [multiQueryData, setMultiQueryData] = useState<any[][] | null>(null);
 setMultiQueryData([...]);
 ```

 ## DataSourceLoader Başlatma Sırası

 `useDataSourceLoader` hook'u, veri kaynaklarını yüklemeden önce `useDataSources()` hook'unun React Query ile tam olarak yüklenmesini beklemelidir. Bu, `isDataSourcesLoading` state'i kontrol edilerek sağlanır:

 ```typescript
 // useDataSourceLoader.tsx
 const { dataSources, getDataSourceById, isLoading: isDataSourcesLoading } = useDataSources();

 // Veri yükleme öncesi kontrol
 if (!pageId || loadingRef.current || isDataSourcesLoading) {
   return; // dataSources henüz yüklenmedi, bekle
 }

 // useEffect dependency'leri
 useEffect(() => {
   const dataSourcesReady = dataSources.length > 0 && !isDataSourcesLoading;
   // ...
 }, [pageId, dataSources.length, hasInitialized, isDataSourcesLoading]);
 ```

 Bu pattern, multi-query widget'lardaki tüm veri kaynaklarının (örn: Cari Kart + Teklif + Sipariş) doğru şekilde tespit edilip yüklenmesini garanti eder.