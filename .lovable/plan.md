
# DIA Senkronizasyon Düzeltme Planı

## ✅ TAMAMLANDI

Dönem bağımsız veri kaynakları artık sadece aktif dönem için senkronize ediliyor.

### Yapılan Değişiklikler

1. **DataSource interface güncellendi** - `is_period_independent` ve `is_non_dia` alanları eklendi
2. **fetchDataSources()** - Veritabanından bu flag'leri çekiyor ve DIA dışı kaynakları filtreliyor
3. **Progress Map** - Dönem bağımsız kaynaklar için sadece aktif dönem gösteriliyor
4. **Sync döngüsü** - `is_period_independent` flag'ine göre dönem listesi belirleniyor
5. **UI Badge** - Dönem bağımsız kaynaklar için "Dönem Bağımsız" badge'i gösteriliyor
6. **Hata mesajları** - Kullanıcı dostu hata mesajları (INSUFFICIENT_PRIVILEGES, Timeout vb.)

### Beklenen Davranış

| Kaynak | Tip | Dönem Sayısı |
|--------|-----|--------------|
| cari_kart_listesi | Dönem Bağımsız | 1 |
| Stok_listesi | Dönem Bağımsız | 1 |
| Banka_Hesap_listesi | Dönem Bağımsız | 1 |
| Kasa Kart Listesi | Dönem Bağımsız | 1 |
| scf_fatura_listele | Dönem Bağımlı | Tüm dönemler |
| Çek Senet Listesi | Dönem Bağımlı | Tüm dönemler |
