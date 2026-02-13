

## Problem

Süper Admin panelindeki "Tüm Veri Kaynakları" listesinde, veri kaynağının yanında donem dağılımını gösteren chevron (ok) butonu hiç görünmüyor. Bunun sebebi bir **veritabanı erişim kısıtlaması (RLS)**:

- `company_data_cache` tablosunun okuma politikası, kullanıcının yalnızca **kendi sunucu/firma** verilerini görmesine izin veriyor
- Süper Admin farklı bir sunucu seçtiğinde, dönem dağılımı sorgusu boş dönüyor
- Boş dönünce `distribution.total > 0` koşulu sağlanmıyor ve chevron butonu hiç render edilmiyor

## Çözüm

### 1. RLS Politikası Güncellemesi (Migration)

`company_data_cache` tablosuna super_admin rolündeki kullanıcıların **tüm verileri okuyabilmesini** sağlayan yeni bir SELECT politikası eklenecek:

```sql
CREATE POLICY "super_admin_read_all_cache"
ON public.company_data_cache
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);
```

Aynı mantık DELETE ve UPDATE politikalarına da eklenecek, böylece super admin herhangi bir sunucunun verilerini silebilir ve yönetebilir.

### 2. Dönem Dağılımı Sorgusunda 1000 Satır Limiti Düzeltmesi

Mevcut kodda `company_data_cache` tablosundan `donem_kodu` çekilirken Supabase'in varsayılan 1000 satır limiti uygulanıyor. 73.000+ kayıtlı veri kaynaklarında dağılım eksik hesaplanıyor.

Çözüm: Supabase'de bir `SECURITY DEFINER` RPC fonksiyonu oluşturulacak — doğrudan SQL ile `GROUP BY` yaparak hem RLS sorununu hem de limit sorununu aşacak:

```sql
CREATE OR REPLACE FUNCTION get_period_distribution(
  p_sunucu_adi text,
  p_firma_kodu text,
  p_data_source_slug text
)
RETURNS TABLE(donem_kodu int, record_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT donem_kodu::int, count(*)::bigint
  FROM company_data_cache
  WHERE sunucu_adi = p_sunucu_adi
    AND firma_kodu = p_firma_kodu
    AND data_source_slug = p_data_source_slug
    AND is_deleted = false
  GROUP BY donem_kodu
$$;
```

### 3. Frontend Güncelleme (SuperAdminDataManagement.tsx)

`loadServerData` fonksiyonundaki dönem dağılımı hesaplama bölümü, yukarıdaki RPC fonksiyonunu çağıracak şekilde güncellenecek:

```typescript
// Eski: Binlerce satır çekip JS'de gruplama
const { data: distData } = await supabase
  .from('company_data_cache')
  .select('donem_kodu')
  .eq(...)

// Yeni: Veritabanında GROUP BY ile verimli hesaplama
const { data: distData } = await supabase
  .rpc('get_period_distribution', {
    p_sunucu_adi: sunucuAdi,
    p_firma_kodu: firmaKodu,
    p_data_source_slug: s.slug
  });
```

## Sonuç

- Süper Admin herhangi bir sunucuyu seçtiğinde dönem dağılımı doğru yüklenecek
- Chevron butonu görünür olacak ve tıklandığında dönem bazlı veri + per-period sync butonları açılacak
- 1000 satır limiti sorunu ortadan kalkacak (veritabanında GROUP BY)

