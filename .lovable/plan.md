
# Dinamik Sayfa Düzenleme Butonları ve Super Admin Kullanıcı Yönetimi

## Sorun Analizi

### Sorun 1: Dinamik Sayfalarda Düzenleme Butonları Eksik
**Mevcut Durum:**
- Dashboard sayfası `ContainerBasedDashboard` bileşenini kullanıyor
- Bu bileşen `FloatingActions` içeriyor (Container Ekle, Widget Düzenle, Container Sırala butonları)
- `DynamicPage` ise `ContainerRenderer`'ı doğrudan kullanıyor, `FloatingActions` yok

**Çözüm:**
- `DynamicPage` bileşenini `ContainerBasedDashboard` kullanacak şekilde güncellemek
- Veya `FloatingActions` bileşenini ayrı export edip `DynamicPage`'e eklemek

### Sorun 2: Super Admin Müşteri Sayfalarını Göremiyor
**Mevcut Durum:**
- `ImpersonatedDashboard` sadece `main-dashboard` slug'ını arıyor
- Kullanıcının diğer özel sayfaları (örn: `crm-cari-xxx`) gösterilmiyor

**Çözüm:**
- ImpersonatedDashboard'a sayfa seçici eklemek
- Impersonated kullanıcının tüm sayfalarını listelemek
- Sayfa değiştirme özelliği eklemek

### Sorun 3: Kullanıcı Listesi DataGrid Olarak Ayrı Sayfada
**Mevcut Durum:**
- Kullanıcılar SuperAdminPanel içinde sol panelde listeleniyor
- Filtreleme ve arama sınırlı

**Çözüm:**
- Yeni `/super-admin/users` route'u oluşturmak
- Full-page DataGrid ile kullanıcı listesi
- Gelişmiş filtreleme (rol, lisans durumu, DIA bağlantı durumu)
- Arama ve sıralama özellikleri

---

## Teknik Uygulama Planı

### Adım 1: DynamicPage Düzenleme Butonları

**Dosya:** `src/components/pages/DynamicPage.tsx`

Değişiklikler:
1. `ContainerBasedDashboard` bileşenini import et
2. Manuel container render yerine `ContainerBasedDashboard` kullan
3. Bu sayede `FloatingActions` otomatik olarak gelecek

```text
Önceki yapı:
DynamicPage
  └── ContainerRenderer (x N)
  └── ContainerPicker

Yeni yapı:
DynamicPage
  └── ContainerBasedDashboard (FloatingActions dahil)
```

### Adım 2: ImpersonatedDashboard Sayfa Seçici

**Dosya:** `src/components/admin/ImpersonatedDashboard.tsx`

Değişiklikler:
1. Kullanıcının tüm sayfalarını çekmek için sorgu ekle
2. Sayfa seçici dropdown/tab ekle
3. Seçilen sayfanın `pageId`'sini `ContainerBasedDashboard`'a geç

```text
Yeni yapı:
ImpersonatedDashboard
  ├── DIA Status Banner
  ├── Page Selector Tabs/Dropdown
  │     ├── main-dashboard
  │     └── [user custom pages...]
  └── ContainerBasedDashboard (seçili sayfa)
```

### Adım 3: Super Admin Kullanıcı Yönetimi Sayfası

**Yeni Dosya:** `src/pages/SuperAdminUsersPage.tsx`

Özellikler:
1. Full-width DataGrid tablo
2. Filtreleme paneli:
   - Rol filtresi (Super Admin, Admin, Şirket Yetkilisi, Kullanıcı)
   - Lisans durumu (Aktif, Süresi Yaklaşan, Süresi Dolmuş)
   - DIA bağlantı durumu (Bağlı, Bağlı Değil)
3. Arama: Email, isim, firma adı
4. Sıralama: Tüm kolonlarda
5. Aksiyonlar: Görüntüle, Lisans Düzenle, Sayfalara Git

**Dosya:** `src/App.tsx`
- Yeni route ekle: `/super-admin/users`

**Dosya:** `src/pages/SuperAdminPanel.tsx`
- Users tab'ını yeni sayfaya yönlendir
- Veya users tab içeriğini yeni sayfa component'ine taşı

---

## Veritabanı Değişiklikleri

Bu plan için veritabanı değişikliği **gerekmemektedir**. Mevcut tablolar yeterli:
- `profiles` - Kullanıcı bilgileri
- `user_roles` - Roller
- `user_pages` - Kullanıcı sayfaları

---

## Etkilenen Dosyalar

| Dosya | Değişiklik Türü |
|-------|-----------------|
| `src/components/pages/DynamicPage.tsx` | Güncelleme |
| `src/components/admin/ImpersonatedDashboard.tsx` | Güncelleme |
| `src/pages/SuperAdminUsersPage.tsx` | Yeni dosya |
| `src/App.tsx` | Route ekleme |
| `src/pages/SuperAdminPanel.tsx` | Tab yapısı güncelleme |
| `src/components/layout/Sidebar.tsx` | (Opsiyonel) Super admin menü linki |

---

## Uygulama Sırası

1. **DynamicPage Düzeltmesi** - En kritik, kullanıcılar sayfa düzenleyemiyor
2. **ImpersonatedDashboard Sayfa Seçici** - Super admin için gerekli
3. **Kullanıcı Yönetimi Sayfası** - Daha kapsamlı, son adım

---

## Test Senaryoları

1. ✅ Dinamik sayfada sağ altta FloatingActions görünüyor mu?
2. ✅ Container Ekle, Widget Düzenle, Container Sırala butonları çalışıyor mu?
3. ✅ Super Admin impersonation modunda kullanıcının tüm sayfalarını görebiliyor mu?
4. ✅ Sayfa seçici ile sayfalar arası geçiş yapılabiliyor mu?
5. ✅ Kullanıcı listesi sayfasında filtreleme çalışıyor mu?
6. ✅ Arama fonksiyonu doğru sonuçlar döndürüyor mu?
