
# Takım Üyesi Ekleme Problemi - Çözüm Planı

## Problem Analizi

### Tespit Edilen Sorunlar

1. **Yetkilendirme Tutarsızlığı**
   - `sercantuner@rotayazilim.net` kullanıcısının `profiles.is_team_admin = true` ama `user_roles` tablosunda sadece `user` rolü var
   - RLS politikası `is_admin()` fonksiyonunu kullanıyor ve bu fonksiyon `admin` veya `super_admin` rolü arıyor
   - Sonuç: Insert işlemi RLS tarafından engelleniyor

2. **UI Eksikliği**
   - `TeamManagementPage.tsx` sadece yeni kullanıcı oluşturma (`signUp`) özelliği sunuyor
   - Mevcut kullanıcıları e-posta ile ekleme seçeneği yok
   - `usePermissions.tsx`'deki `addTeamMember` fonksiyonu mevcut ama UI'da kullanılmıyor

3. **"Kullanıcı zaten var" Hatası**
   - Auth logs'ta `user_repeated_signup` hatası görünüyor
   - Sistem `signUp` yapmaya çalışıyor ama kullanıcı zaten kayıtlı

### Mevcut Veritabanı Durumu

| Tablo | Durum |
|-------|-------|
| `user_teams` | BOŞ - hiçbir kayıt yok |
| `profiles (serdartuner@rotayazilim.net)` | ✅ Mevcut |
| `user_roles (sercantuner@rotayazilim.net)` | `user` rolü (admin değil!) |
| `profiles (sercantuner@rotayazilim.net)` | `is_team_admin: true` |

## Çözüm Adımları

### Adım 1: RLS Politikasını Düzelt

`user_teams` tablosundaki INSERT politikası `is_team_admin()` fonksiyonunu kullanmalı:

```sql
-- Mevcut politikayı güncelle
DROP POLICY IF EXISTS "Admins can manage their team" ON user_teams;

CREATE POLICY "Team admins can manage their team" ON user_teams
FOR ALL
TO authenticated
USING (
  admin_id = auth.uid() 
  OR is_admin(auth.uid())
  OR is_team_admin(auth.uid())  -- ← YENİ EKLENEN
)
WITH CHECK (
  admin_id = auth.uid()
  OR is_admin(auth.uid())
  OR is_team_admin(auth.uid())  -- ← YENİ EKLENEN
);
```

**Açıklama**: `is_team_admin()` fonksiyonu zaten var ve `profiles.is_team_admin = true` olan kullanıcıları kontrol ediyor. Bu şekilde bir kullanıcı hem `admin` rolüne sahip olarak hem de `is_team_admin` alanıyla takım yönetebilir.

### Adım 2: TeamManagementPage'e "Mevcut Kullanıcı Ekle" Özelliği

`TeamManagementPage.tsx` dosyasına mevcut kullanıcıyı e-posta ile ekleme özelliği eklenecek:

```text
┌──────────────────────────────────────────────┐
│ Dialog: Kullanıcı Ekle                       │
├──────────────────────────────────────────────┤
│ [Tab: Yeni Kullanıcı] [Tab: Mevcut Kullanıcı]│
│                                              │
│ ┌─ Mevcut Kullanıcı ───────────────────────┐ │
│ │ Email: [________________] 🔍             │ │
│ │                                          │ │
│ │ Kullanıcı Bilgisi:                       │ │
│ │ ✓ Serdar Tuner - serdartuner@...         │ │
│ │                                          │ │
│ │ [İptal]              [Takıma Ekle]       │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Yeni Akış:**
1. Kullanıcı e-posta girer
2. Sistem `profiles` tablosunda arar
3. Bulursa bilgileri gösterir
4. "Takıma Ekle" butonuyla `user_teams` tablosuna insert yapar

### Adım 3: Sercantuner'a Admin Rolü Ver (İsteğe Bağlı)

Alternatif olarak, `sercantuner@rotayazilim.net` kullanıcısına `admin` rolü verilebilir:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('8e5108c0-8150-44bf-ba09-81688e0181e7', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

**Not:** Bu kısa vadeli bir çözümdür. Uzun vadede RLS politikasının düzeltilmesi gerekir.

---

## Teknik Detaylar

### Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `src/pages/TeamManagementPage.tsx` | Mevcut kullanıcı ekleme sekmesi ve formu |
| SQL Migration | `user_teams` RLS politikası güncellemesi |

### Yeni UI Bileşenleri

1. **Tab Yapısı**
   - "Yeni Kullanıcı Oluştur" sekmesi (mevcut)
   - "Mevcut Kullanıcı Ekle" sekmesi (yeni)

2. **Mevcut Kullanıcı Arama**
   - E-posta input alanı
   - Arama butonu veya debounced arama
   - Bulunan kullanıcı kartı
   - "Takıma Ekle" butonu

### usePermissions Hook Kullanımı

`addTeamMember` fonksiyonu zaten mevcut ve çalışır durumda:

```typescript
const addTeamMember = useCallback(async (memberEmail: string) => {
  // 1. profiles tablosunda e-posta ile ara
  // 2. Bulursa user_teams tablosuna ekle
  // 3. user_roles tablosuna 'user' rolü ekle
});
```

Bu fonksiyon UI'a bağlanacak.

---

## Uygulama Sırası

1. **Önce**: SQL migration ile RLS politikasını düzelt
2. **Sonra**: TeamManagementPage'e mevcut kullanıcı ekleme özelliğini ekle
3. **Test**: Serdar Tuner'ı takıma ekle ve doğrula

## Beklenen Sonuç

- `sercantuner@rotayazilim.net` (is_team_admin: true) kullanıcısı mevcut kullanıcıları takımına ekleyebilecek
- RLS hatası olmayacak
- "Kullanıcı zaten var" hatası yerine mevcut kullanıcıyı direkt ekleyebilecek
