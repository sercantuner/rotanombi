
<context>
Belirtiler:
- Banka hesapları, kasa/nakit akış yaşlandırması gibi grafikler “2-3 kat” şişiyor veya tutarsız görünüyor.
- Görev tabanlı “En Aktif Müşteriler” widget’ı bazı dönemlerde boş kalıyor (DB’de 4000+ kayıt varken).
- “Veri çok olduğu için bir yerde denemeyi durduruyor” hissi: aslında veri çekme/sayfalama veya cache karışması yüzünden kısmi/yanlış veri ekrana yansıyabiliyor.

Kod/DB bulguları (net):
- `useDataSourceLoader.tsx` içinde **dönem bağımsız** kaynaklar için DB okumasında `donem_kodu` filtresi kaldırılmış: bu, aynı kaynağın farklı dönemlerdeki kayıtlarını **tek listeye birleştirip** cache’e koyuyor.
- `DiaDataCacheContext` veri kaynağı cache anahtarı şu an sadece `datasource_${dataSourceId}` (dönem/sunucu/firma yok). Bu da “bir kere yanlış (ALL periods) doldurulmuş cache”in başka widget’ları zehirlemesine yol açıyor.
- Backend senkron motoru (`dia-data-sync`) dönem bağımsız kaynakları her sync’te yalnızca “aktif dönem”e yazıyor; aktif dönem zamanla değiştiği için aynı slug’ın farklı `donem_kodu`larda verisi birikmiş. Bu normal, ama frontend **tüm dönemleri birleştirerek okursa** grafikler şişer.
- Veritabanında örnek: `Banka_Hesap_listesi` ve `Görev Listesi` birden fazla dönemde var. “Tümü” okununca kopyalı gibi görünür.

Hedef:
1) Grafiklerdeki şişmeyi kesin olarak bitirmek (dönem karışmasını engellemek).
2) Dönem bağımsız kaynaklarda (Banka, Kasa, Görev vb.) “doğru tek dönem”den veri göstermek (gerekirse en güncel dönem fallback’ı).
3) Büyük veride kısmi/yanlış okuma hissini azaltmak (hata durumunu görünür kılmak; sessizce “yarım veri” dönmemek).
</context>

<root-cause>
1) Dönem bağımsız kaynakların DB’den okunurken “donem_kodu’suz” çekilmesi:
   - `useDataSourceLoader.loadDataSourceFromDatabase()` şu an period-independent kaynaklarda `donem_kodu` filtresini kaldırıyor.
   - Bu, DB’de farklı dönemlerde birikmiş kayıtları tek listeye katıyor.

2) Cache anahtarının dönem/sunucu/firma içermemesi:
   - `DiaDataCacheContext` dataSource cache key’i yalnızca `datasource_${id}`.
   - Aynı dataSource farklı dönemlerde istense bile cache çakışıyor.

3) Görev widget’larının bazen boş görünmesi:
   - Görev datası DB’de bazı dönemlerde çok, bazı dönemlerde çok az (ör: period 2’de 5 kayıt).
   - Widget efektif dönemi “az kayıt olan dönem”e denk gelince boş görünüyor.
   - Bu, dönem bağımsız kaynaklarda “her zaman en güncel dönem” yaklaşımıyla çözülmeli.
</root-cause>

<solution-design>
A) Dönem bağımsız kaynaklar için “tek dönem stratejisi”
- “Dönem bağımsız” = UI’da tüm dönemleri birleştirmek değil; “tek bir kanonik dönemden” okumak demek olmalı.
- Kural:
  1. Önce kullanıcının profilindeki `donem_kodu` (effectiveDonem) denenir.
  2. Eğer bu dönemde veri yoksa / aşırı düşükse: DB’de o kaynak için **en son güncellenen (max updated_at)** dönemi bulup onu kullan (fallback).
- Böylece:
  - Banka/Kasa/Görev gibi kaynaklar tek kopya görünür.
  - Görevlerde “doğru dönem” seçilerek boş kalma azalır.

B) Cache anahtarlarını dönem + şirket kapsamına göre ayırma
- DataSource cache anahtarına şu scope eklenecek:
  - `sunucuAdi`, `firmaKodu`, `effectiveDonem` (veya period-independent fallback ile seçilen donem)
- Böylece:
  - Aynı kaynak farklı dönemlerde birbirine karışmaz.
  - Daha önce yanlış doldurulmuş cache otomatik “boşa düşer” (yeni key’ler ile).

C) DB okuma sayfalamasında deterministiklik ve hata görünürlüğü
- DB’den sayfalı okuma sırasında:
  - “hata olursa break edip yarım veri dönme” yaklaşımı yerine hata durumunu widget’a yansıt (error state).
  - Sayfalama order/range kombinasyonu deterministik olmalı; mümkünse primary key/dia_key ile order ya da ordersız stabil yaklaşım.
- Amaç: “veri çok diye bir yerde durdu” hissi yerine “hata var/timeout var” netliği.

D) Görev widget filtresinin veriyle uyumu (ikincil iyileştirme)
- DB örneğinde görevlerde `durum: K` (Kapalı) gibi değerler var.
- Widget’larda “Açık” arayan filtreler varsa ve DIA bazen farklı değer döndürüyorsa (örn. `durum_txt` beklenmedik), fallback kontrolü genişletilebilir.
- Öncelik: önce doğru dönem seçimi + cache izolasyonu. Sonra gerekiyorsa widget’ın “açık/kapalı” eşlemesini sağlamlaştırma.
</solution-design>

<implementation-steps>
1) `DiaDataCacheContext` cache key kapsamını genişlet
   - `getDataSourceData / setDataSourceData / getDataSourceDataWithStale` fonksiyonlarını “scope” alacak şekilde güncelle:
     - Örn: `getDataSourceData(dataSourceId, scopeKey)`
     - `scopeKey = ${sunucuAdi}:${firmaKodu}:${resolvedDonem}`
   - Bu değişiklikle birlikte çağıran tüm yerleri güncelle:
     - `useDataSourceLoader`
     - `useDynamicWidgetData`
     - `DiaQueryStats` (preview)
   - Bu adım tek başına bile döneme bağlı karışmaları azaltır.

2) `useDataSourceLoader.loadDataSourceFromDatabase` içindeki period-independent davranışı düzelt
   - Şu anki “donem_kodu filtresi uygulanmaz” davranışını kaldır.
   - Period-independent için:
     - Önce `effectiveDonem` ile DB’den oku.
     - Eğer sonuç yok/çok az ise: en güncel `donem_kodu`yu bul (group by donem_kodu, max(updated_at) desc limit 1) ve o dönemden tekrar oku.
   - Cache’e yazarken mutlaka `resolvedDonem` ile scope’lanmış key kullan.

3) `useDynamicWidgetData.fetchFromDatabase` tarafını da aynı prensiple hizala
   - Period-independent kaynaklar asla “ALL periods” olarak çekilmemeli.
   - Aynı “resolvedDonem” helper’ı burada da kullanılmalı (tek yerde tanımlanıp iki hook’ta ortak kullanılabilir).
   - DB fetch hata olursa “sessizce partial data” yerine:
     - `throw` ile yukarıya taşı
     - `dataStatus.error` ve widget hata UI’sı üzerinden kullanıcıya göster.

4) Senaryo doğrulama (DB gerçekleriyle)
   - Banka/Kasa/Görev kaynakları için:
     - Aynı slug’ın farklı dönemlerde kayıtları var; artık UI’da tek dönem seçildiği için grafikler şişmeyecek.
   - Görev widget’ı:
     - “Profil dönemi”nde az kayıt varsa, en güncel döneme fallback ile 4000+ kayıt görünmesi beklenir.

5) Opsiyonel ama önerilen: “Cache temizle” deneyimini güçlendirme
   - Zaten `DiaQueryStats` içinde “Cache Temizle & Sıfırla” var.
   - Yeni scope-key’ler geldikten sonra eski cache otomatik kullanılmayacağı için çoğu durumda manuel temizliğe gerek kalmayacak, ama buton yine faydalı.

6) Büyük veri için “durdu” hissini azaltma (gerekirse)
   - Eğer DB’den 20k+ veri çekerken zaman zaman hata oluyorsa:
     - sayfalama stratejisini stabil order’a çek
     - hata loglarını belirginleştir
     - gerekiyorsa sayfa sayısı/timeout koruması ekle
</implementation-steps>

<testing-plan>
1) Dashboard’u hard refresh yapıp (tarayıcı yenileme) aşağıdakileri kontrol et:
   - Banka Hesapları: hesap sayısı ve para toplamları “şişmeden” stabil mi?
   - Nakit akış yaşlandırması / vade grafikleri: önceki “2-3 kat” artış bitti mi?
2) `DiaQueryStats` panelinden:
   - “Banka Hesap Listesi”, “Kasa Kart Listesi”, “Görev Listesi” önizleme kayıt sayıları dönem bazlı mantıklı mı?
3) Görev widget’ları:
   - “Açık Görev Takibi” ve “En Aktif Müşteriler (Görev)” gibi görev bazlı widget’lar artık boş kalıyor mu?
   - Boşsa: efektif dönem / fallback dönemi log’larıyla hangi dönemin seçildiğini doğrula.
4) Uçtan uca: Dashboard → yenile → widget’lar → drilldown/modal aç/kapa (UI etkileşimleri) hata var mı?
</testing-plan>

<risk-notes>
- Cache API imzası değişeceği için birkaç dosyada derleme hatası çıkması normal; hepsi aynı committe toparlanacak.
- Period-independent fallback (en güncel dönem) bazı kullanıcıların “eski döneme bakıyorum ama banka listem aynı kalsın” beklentisine uygundur; çünkü kaynak zaten dönem bağımsız işaretli.
- Eğer bir kaynak aslında dönem bağımlı olduğu halde yanlışlıkla `is_period_independent=true` işaretlendiyse, bu değişiklik o kaynağın davranışını “tek dönem”e sabitleyebilir; böyle bir durumda data_sources ayarını düzeltmek gerekir.
</risk-notes>
