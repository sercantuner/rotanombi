import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { diaTestConnection, getDiaConnectionInfo } from '@/lib/diaClient';
import { toast } from 'sonner';
import { 
  User, 
  Server, 
  Bell, 
  Shield, 
  Database,
  Key,
  Globe,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Plug,
  FlaskConical
} from 'lucide-react';

export function SettingsPage() {
  const { user } = useAuth();
  const { useMockData, setUseMockData } = useUserSettings();
  const [activeTab, setActiveTab] = useState('genel');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState({
    displayName: '',
    email: '',
    firmaKodu: '',
    donemKodu: '',
  });

  // DIA Connection state
  const [diaConnection, setDiaConnection] = useState({
    sunucuAdi: '',
    apiKey: '',
    wsKullanici: '',
    wsSifre: '',
    connected: false,
    sessionExpires: '',
  });

  // Settings state
  const [settings, setSettings] = useState({
    language: 'tr',
    timezone: 'Europe/Istanbul',
    autoRefresh: true,
    refreshInterval: 5,
  });

  const tabs = [
    { id: 'genel', label: 'Genel', icon: User },
    { id: 'demo', label: 'Demo Modu', icon: FlaskConical },
    { id: 'dia', label: 'DIA Bağlantısı', icon: Plug },
    { id: 'sunucu', label: 'Bağlantı', icon: Server },
    { id: 'bildirimler', label: 'Bildirimler', icon: Bell },
    { id: 'guvenlik', label: 'Güvenlik', icon: Shield },
  ];

  // Load profile and settings
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setIsLoading(true);
      
      try {
        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profileData) {
          setProfile({
            displayName: profileData.display_name || '',
            email: profileData.email || user.email || '',
            firmaKodu: profileData.firma_kodu || '',
            donemKodu: profileData.donem_kodu || '',
          });

          // Load DIA connection info - TÜM bilgileri oku
          setDiaConnection(prev => ({
            ...prev,
            sunucuAdi: profileData.dia_sunucu_adi || '',
            apiKey: profileData.dia_api_key || '',
            wsKullanici: profileData.dia_ws_kullanici || '',
            wsSifre: profileData.dia_ws_sifre || '',
          }));
        }

        // Check DIA connection status
        const diaInfo = await getDiaConnectionInfo();
        if (diaInfo) {
          setDiaConnection(prev => ({
            ...prev,
            connected: diaInfo.connected,
            sessionExpires: diaInfo.sessionExpires || '',
          }));
        }

        // Load settings
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (settingsData) {
          setSettings({
            language: settingsData.language || 'tr',
            timezone: settingsData.timezone || 'Europe/Istanbul',
            autoRefresh: settingsData.auto_refresh ?? true,
            refreshInterval: settingsData.refresh_interval || 5,
          });
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Profil ve DIA bağlantı bilgilerini birlikte kaydet
      await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: profile.displayName,
          email: profile.email,
          firma_kodu: profile.firmaKodu,
          donem_kodu: profile.donemKodu,
          // DIA bağlantı bilgileri
          dia_sunucu_adi: diaConnection.sunucuAdi || null,
          dia_api_key: diaConnection.apiKey || null,
          dia_ws_kullanici: diaConnection.wsKullanici || null,
          dia_ws_sifre: diaConnection.wsSifre || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      await supabase
        .from('app_settings')
        .upsert({
          user_id: user.id,
          language: settings.language,
          timezone: settings.timezone,
          auto_refresh: settings.autoRefresh,
          refresh_interval: settings.refreshInterval,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      toast.success('Ayarlar kaydedildi');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestDiaConnection = async () => {
    if (!diaConnection.sunucuAdi || !diaConnection.apiKey || !diaConnection.wsKullanici || !diaConnection.wsSifre) {
      toast.error('Tüm DIA bağlantı bilgilerini doldurun');
      return;
    }

    setIsTesting(true);
    try {
      const result = await diaTestConnection({
        sunucuAdi: diaConnection.sunucuAdi,
        apiKey: diaConnection.apiKey,
        wsKullanici: diaConnection.wsKullanici,
        wsSifre: diaConnection.wsSifre,
        firmaKodu: parseInt(profile.firmaKodu) || 1,
        donemKodu: parseInt(profile.donemKodu) || 0,
      });

      if (result.success) {
        toast.success('DIA bağlantısı başarılı!');
        setDiaConnection(prev => ({ ...prev, connected: true }));
      } else {
        toast.error(`DIA bağlantı hatası: ${result.error}`);
        setDiaConnection(prev => ({ ...prev, connected: false }));
      }
    } catch (error) {
      toast.error('Bağlantı test edilemedi');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header 
        title="Ayarlar" 
        subtitle="Uygulama ve kullanıcı ayarları"
      />

      <main className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="glass-card rounded-xl p-4 h-fit animate-fade-in">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                    {tab.id === 'dia' && diaConnection.connected && (
                      <CheckCircle2 className="w-4 h-4 ml-auto text-success" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* General Settings */}
            {activeTab === 'genel' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Genel Ayarlar
                </h3>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Ad Soyad
                      </label>
                      <input
                        type="text"
                        value={profile.displayName}
                        onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                        className="input-field"
                        placeholder="Ad Soyad"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        E-posta
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        className="input-field"
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Dil
                    </label>
                    <select 
                      className="input-field"
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    >
                      <option value="tr">Türkçe</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Saat Dilimi
                    </label>
                    <select 
                      className="input-field"
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    >
                      <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>

                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Kaydet
                  </button>
                </div>
              </div>
            )}

            {/* Demo Mode Settings */}
            {activeTab === 'demo' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-amber-500" />
                  Demo Modu
                </h3>

                <div className="space-y-6">
                  {/* Demo Mode Toggle */}
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Demo Verileri Kullan</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Aktif olduğunda tüm raporlar gerçekçi demo verileri ile gösterilir.
                          Sunum ve demo amaçlı kullanın.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={useMockData}
                          onChange={(e) => setUseMockData(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-amber-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>

                  {/* Current Status */}
                  <div className={`p-4 rounded-lg ${useMockData ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-success/10 border border-success/30'}`}>
                    <div className="flex items-center gap-3">
                      {useMockData ? (
                        <FlaskConical className="w-6 h-6 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-success" />
                      )}
                      <div>
                        <p className="font-medium">
                          {useMockData ? 'Demo Modu Aktif' : 'Gerçek Veriler'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {useMockData 
                            ? 'Tüm dashboard ve raporlar demo verileri ile gösterilmektedir' 
                            : 'Veriler DIA ERP sisteminden çekilmektedir'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <h4 className="font-medium text-primary mb-2">Demo Modu Hakkında</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Demo modunda 500+ gerçekçi cari hesap verisi gösterilir</li>
                      <li>• Satış, finans ve cari raporları simüle edilir</li>
                      <li>• Ayarlarınız ve kişiselleştirmeleriniz korunur</li>
                      <li>• Demo modunu kapatarak gerçek verilere dönebilirsiniz</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* DIA Connection Settings */}
            {activeTab === 'dia' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Plug className="w-5 h-5 text-primary" />
                  DIA ERP Bağlantısı
                </h3>

                {/* Connection Status */}
                <div className={`p-4 rounded-lg mb-6 ${diaConnection.connected ? 'bg-success/10 border border-success/30' : 'bg-secondary/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {diaConnection.connected ? (
                        <CheckCircle2 className="w-6 h-6 text-success" />
                      ) : (
                        <XCircle className="w-6 h-6 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {diaConnection.connected ? 'Bağlı' : 'Bağlı Değil'}
                        </p>
                        {diaConnection.connected && diaConnection.sessionExpires && (
                          <p className="text-xs text-muted-foreground">
                            Oturum: {new Date(diaConnection.sessionExpires).toLocaleString('tr-TR')}
                          </p>
                        )}
                      </div>
                    </div>
                    {diaConnection.connected && (
                      <span className="px-3 py-1 text-xs rounded-full bg-success/20 text-success font-medium">
                        Aktif
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      DIA Sunucu Adı
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">https://</span>
                      <input
                        type="text"
                        value={diaConnection.sunucuAdi}
                        onChange={(e) => setDiaConnection({ ...diaConnection, sunucuAdi: e.target.value })}
                        className="input-field flex-1"
                        placeholder="rotayazilim"
                      />
                      <span className="text-muted-foreground">.ws.dia.com.tr</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Örnek: rotayazilim, demofirma
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={diaConnection.apiKey}
                        onChange={(e) => setDiaConnection({ ...diaConnection, apiKey: e.target.value })}
                        className="input-field pr-10"
                        placeholder="DIA API anahtarınız"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Web Servis Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={diaConnection.wsKullanici}
                        onChange={(e) => setDiaConnection({ ...diaConnection, wsKullanici: e.target.value })}
                        className="input-field"
                        placeholder="WS kullanıcı adı"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Web Servis Şifresi
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={diaConnection.wsSifre}
                          onChange={(e) => setDiaConnection({ ...diaConnection, wsSifre: e.target.value })}
                          className="input-field pr-10"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Firma Kodu
                      </label>
                      <input
                        type="text"
                        value={profile.firmaKodu}
                        onChange={(e) => setProfile({ ...profile, firmaKodu: e.target.value })}
                        className="input-field"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Dönem Kodu
                      </label>
                      <input
                        type="text"
                        value={profile.donemKodu}
                        onChange={(e) => setProfile({ ...profile, donemKodu: e.target.value })}
                        className="input-field"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleTestDiaConnection}
                      disabled={isTesting}
                      className="btn-secondary flex items-center gap-2"
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Bağlantıyı Test Et
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Kaydet ve Bağlan
                    </button>
                  </div>
                </div>

                {/* Help Section */}
                <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <h4 className="font-medium text-primary mb-2">DIA Bağlantı Bilgileri</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Sunucu adını DIA yöneticinizden öğrenebilirsiniz</li>
                    <li>• API Key, DIA panelinden alınır</li>
                    <li>• Web servis kullanıcısı DIA'da tanımlı olmalıdır</li>
                    <li>• Bağlantı 30 dakika aktif kalır, otomatik yenilenir</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Server/Connection Settings */}
            {activeTab === 'sunucu' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  Bağlantı Ayarları
                </h3>

                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Lovable Cloud</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-success/20 text-success">Aktif</span>
                    </div>
                    <p className="font-semibold">Bağlı</p>
                  </div>

                  <div className="p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">DIA ERP</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${diaConnection.connected ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {diaConnection.connected ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <p className="font-semibold">
                      {diaConnection.connected ? diaConnection.sunucuAdi : 'Bağlı değil'}
                    </p>
                    {!diaConnection.connected && (
                      <button 
                        onClick={() => setActiveTab('dia')}
                        className="mt-2 text-sm text-primary hover:underline"
                      >
                        DIA Bağlantısı Kur →
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <Database className="w-5 h-5 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Firma Kodu</p>
                      <p className="font-semibold">{profile.firmaKodu || '-'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <Globe className="w-5 h-5 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Dönem Kodu</p>
                      <p className="font-semibold">{profile.donemKodu || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'bildirimler' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Bildirim Ayarları
                </h3>

                <div className="space-y-4">
                  {[
                    { label: 'Yeni fatura bildirimleri', desc: 'Yeni fatura oluşturulduğunda bildir' },
                    { label: 'Vade uyarıları', desc: 'Vadesi yaklaşan alacaklar için uyar' },
                    { label: 'Sistem bildirimleri', desc: 'Sistem güncellemeleri ve bakım bildirimleri' },
                    { label: 'E-posta bildirimleri', desc: 'Önemli olayları e-posta ile gönder' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={index < 2} />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'guvenlik' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Güvenlik Ayarları
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Mevcut Şifre
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input-field"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Yeni Şifre
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Şifre Tekrar
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-warning mt-0.5" />
                      <div>
                        <p className="font-medium text-warning">İki Faktörlü Doğrulama</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Hesabınızın güvenliğini artırmak için iki faktörlü doğrulamayı etkinleştirin.
                        </p>
                        <button className="mt-3 text-sm text-primary hover:underline">
                          Etkinleştir →
                        </button>
                      </div>
                    </div>
                  </div>

                  <button className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Şifreyi Güncelle
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
