import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  Loader2
} from 'lucide-react';

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('genel');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState({
    displayName: '',
    email: '',
    firmaKodu: '',
    donemKodu: '',
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
      await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: profile.displayName,
          email: profile.email,
          firma_kodu: profile.firmaKodu,
          donem_kodu: profile.donemKodu,
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

    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
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
                      <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-500">Aktif</span>
                    </div>
                    <p className="font-semibold">Bağlı</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <Database className="w-5 h-5 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Firma Kodu</p>
                      <input
                        type="text"
                        value={profile.firmaKodu}
                        onChange={(e) => setProfile({ ...profile, firmaKodu: e.target.value })}
                        className="input-field mt-2"
                        placeholder="Firma kodu"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <Globe className="w-5 h-5 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Dönem Kodu</p>
                      <input
                        type="text"
                        value={profile.donemKodu}
                        onChange={(e) => setProfile({ ...profile, donemKodu: e.target.value })}
                        className="input-field mt-2"
                        placeholder="Dönem kodu"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Kaydet
                  </button>
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

                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-500">İki Faktörlü Doğrulama</p>
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
