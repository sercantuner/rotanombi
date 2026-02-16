
# RotanomBI - Proje Tam Dokumantasyonu Olusturma Plani

## Amac
Projenin tamamini anlatan, sifirdan ayaga kaldirmak icin gereken tek bir Markdown dokumantasyon dosyasi olusturulacak. Bu dosya, harici bir Supabase projesine baglanarak sistemi yeniden kurma rehberi olacak.

## Olusturulacak Dosya
`PROJECT_DOCUMENTATION.md` - Tek dosya, asagidaki tum bolumleri icerir.

## Dokumantasyon Icerigi

### 1. Proje Ozeti
- RotanomBI: DIA ERP sistemiyle entegre calisan bir Business Intelligence (BI) dashboarding platformu
- React + Vite + TypeScript + Tailwind CSS + shadcn-ui
- Supabase backend (Auth, DB, Edge Functions, Realtime)
- DIA ERP Web Service API ile veri senkronizasyonu

### 2. Mimari Genel Bakis
- Katmanli mimari diyagrami (Frontend -> Supabase -> DIA ERP)
- Provider/Context hiyerarsisi (AuthProvider > UserSettingsProvider > DiaDataCacheProvider > SyncOrchestratorProvider > ImpersonationProvider)
- Veri akisi: DB-First stratejisi (Memory Cache -> Supabase DB -> DIA API)

### 3. Veritabani Semasi (Tum Tablolar)
Her tablo icin: kolon adlari, veri tipleri, varsayilan degerler, constraint'ler, RLS politikalari

**Ana Tablolar:**
- `profiles` - Kullanici profilleri ve DIA baglanti bilgileri
- `app_settings` - Kullanici ayarlari
- `user_roles` - Rol tabanlı erisim kontrolu (app_role enum: super_admin, admin, user, viewer)
- `user_permissions` - Modul bazli izinler
- `user_teams` - Takim yonetimi (admin-member iliskisi)
- `data_sources` - Merkezi veri kaynaklari tanimi (DIA API endpoint konfigurasyon)
- `company_data_cache` - Ana veri deposu (JSONB, tekil unique constraint: sunucu_adi + firma_kodu + donem_kodu + data_source_slug + dia_key)
- `firma_periods` - Mali donem bilgileri
- `firma_branches` - Sube bilgileri
- `firma_warehouses` - Depo bilgileri
- `widgets` - Widget tanimlari ve builder_config (JSONB)
- `widget_categories` - Dinamik kategori/etiket sistemi
- `widget_tags` - Widget-kategori iliskileri (many-to-many)
- `widget_changelog` - Widget degisiklik gecmisi
- `widget_snapshots` - Onceden hesaplanmis widget verileri
- `widget_feedback` - Kullanici geri bildirimleri
- `widget_permissions` - Widget bazli erisim kontrolu
- `user_pages` - Kullanici sayfalari
- `page_containers` - Sayfa konteyner yapisi (container_type enum)
- `container_widgets` - Konteynerdeki widget'lar
- `sync_locks` - Senkronizasyon kilitleri
- `sync_jobs` - Arkaplan senkronizasyon isleri
- `sync_queue_tasks` - Sirali gorev kuyrugu
- `sync_history` - Senkronizasyon gecmisi
- `period_sync_status` - Donem bazli sync durumu
- `cron_schedules` - Zamanlanmis gorevler
- `excluded_periods` - Haric tutulan donemler
- `data_source_relationships` - Veri kaynaklari arasi iliskiler
- `notifications` - Bildirimler

**Veritabani Fonksiyonlari:**
- `has_role()` - RLS icin rol kontrolu (SECURITY DEFINER)
- `is_admin()` - Admin + Super Admin kontrolu
- `is_super_admin()` - Super Admin kontrolu
- `get_user_company_scope()` - Sirket bazli veri izolasyonu
- `get_projected_cache_data()` - JSONB alan projeksiyonu (performans)
- `get_used_widget_ids_for_company()` - Sirket icin kullanilan widget'lar
- `update_updated_at_column()` - Trigger fonksiyonu
- `handle_new_user()` - Yeni kullanici profil olusturma

**Trigger'lar:**
- `on_auth_user_created` - Kayit sonrasi otomatik profil
- `update_*_updated_at` - Tum tablolarda updated_at guncelleme

### 4. Edge Function'lar (Backend Fonksiyonlari)
Her fonksiyon icin: amac, endpoint, istek/yanit formati, is mantigi

- **dia-login** - DIA ERP'ye ilk giris, session_id alma ve profiles tablosuna kaydetme
- **dia-api-test** - Widget Builder icin API test araci, alan analizi, raw mode, donem loop, impersonation destegi
- **dia-data-sync** - Ana senkronizasyon motoru (acquireLock, releaseLock, getSyncStatus, getRecordCounts, syncChunk, incrementalSync, reconcileKeys)
- **dia-sync-periods** - DIA'dan donem/sube/depo bilgilerini cekme ve kaydetme
- **widget-compute** - Widget snapshot hesaplama (KPI, chart, table), self-chaining, batch isleme
- **ai-code-generator** - AI tabanli widget kodu uretimi
- **widget-csv-import** - CSV dosyasindan veri yukleme
- **dia-finans-rapor** / **dia-satis-rapor** / **dia-genel-rapor** - Eski rapor endpoint'leri

**Paylasilan Moduller (_shared/):**
- `diaAutoLogin.ts` - Otomatik oturum yenileme, team member yetki devralma, withSessionRetry
- `diaDataFetch.ts` - DIA API veri cekme ve upsert islemleri
- `turkeyTime.ts` - Turkiye saat dilimi yardimcisi
- `widgetFieldPool.ts` - Widget alan havuzu yonetimi

### 5. Frontend Mimarisi

**Context'ler:**
- `AuthContext` - Kimlik dogrulama (login, register, logout, resetPassword)
- `UserSettingsContext` - Kullanici tercihleri
- `DiaDataCacheContext` - Bellek ici veri onbellekleme (TTL: 10dk)
- `SyncOrchestratorContext` - Merkezi senkronizasyon durumu
- `ImpersonationContext` - Super Admin kullanici taklit etme

**Onemli Hook'lar:**
- `useDiaProfile` - DIA baglanti bilgileri (team member devralma dahil)
- `useCompanyData` - DB'den veri okuma (sayfalama, donem destegi)
- `useDynamicWidgetData` - Widget icin veri hazirlama (snapshot-first, DB fallback, agregasyon, merge, filtre)
- `useSyncOrchestrator` - Senkronizasyon orkestrasyonu (chunk bazli, kilit mekanizmasi, resume-from-offset)
- `useDataSources` - Veri kaynaklari CRUD
- `useWidgets` / `useWidgetAdmin` - Widget yonetimi
- `useUserPages` - Dinamik sayfa yonetimi
- `usePermissions` - Rol ve izin yonetimi
- `useFirmaPeriods` - Mali donem yonetimi

**Sayfalar:**
- `/` - Landing page
- `/login` - Giris
- `/reset-password` - Sifre sifirlama
- `/dashboard` - Ana dashboard
- `/page/:pageSlug` - Dinamik kullanici sayfalari
- `/ayarlar` - Ayarlar (DIA baglanti, profil)
- `/takim` - Takim yonetimi
- `/admin` - Kullanici yonetimi
- `/marketplace` - Widget marketi
- `/widget-builder` - Widget olusturma araci
- `/datasource-editor` - Veri kaynagi duzenleyici
- `/super-admin-panel` - Super Admin paneli

### 6. Veri Akis Senaryolari

**Senkronizasyon:**
1. Kullanici "Senkronize Et" butonuna tiklar
2. Frontend acquireLock ile kilit alir
3. Her veri kaynagi icin DIA'dan kayit sayisi sorgulanir (getRecordCounts)
4. DB'deki mevcut kayitlarla karsilastirilir
5. Eksik veriler syncChunk ile chunk bazli cekilir (500 kayit/chunk)
6. Upsert ile DB'ye yazilir
7. reconcileKeys ile silinen kayitlar tespit edilir
8. widget-compute ile snapshot'lar guncellenir
9. Kilit serbest birakilir

**Widget Rendering:**
1. Widget snapshot varsa aninda goster (snapshot-first)
2. Yoksa DB'den ham veri cek (useCompanyData)
3. Hesaplama alanlari uygula
4. Post-fetch filtreler uygula
5. Widget filtreleri uygula
6. Gorsellestime verisini hazirla (KPI/chart/table)

### 7. Harici Supabase Kurulumu Rehberi
- Yeni Supabase projesi olusturma
- Tum migration'lari sirayla calistirma
- Edge Function'lari deploy etme
- .env dosyasini guncelleme (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
- Gerekli secret'lari ayarlama (SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, LOVABLE_API_KEY)
- pg_cron ve pg_net extension'larini etkinlestirme
- Realtime yapilandirmasi
- Ilk super_admin kullanicisini olusturma

### 8. Onemli Konfigurasyonlar
- Supabase config.toml'daki verify_jwt ayarlari
- Rate limiting (istek kuyrugu: max 2 es zamanli)
- Cache TTL degerleri
- DIA API endpoint formati
- Container type enum degerleri ve grid sinflari

## Teknik Uygulama
- Tek bir `PROJECT_DOCUMENTATION.md` dosyasi olusturulacak
- Tum migration SQL'leri birlestirilerek final sema olarak sunulacak
- Her Edge Function'in amaci, input/output formati ve kritik is mantigi aciklanacak
- RLS politikalari tablo bazinda detaylandirilacak
- Kurulum adim adim rehber olarak verilecek
