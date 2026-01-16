import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  Server, 
  Bell, 
  Shield, 
  Palette, 
  Database,
  Key,
  Globe,
  Save,
  RefreshCw
} from 'lucide-react';

export function SettingsPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('genel');

  const tabs = [
    { id: 'genel', label: 'Genel', icon: User },
    { id: 'sunucu', label: 'Sunucu', icon: Server },
    { id: 'bildirimler', label: 'Bildirimler', icon: Bell },
    { id: 'guvenlik', label: 'Güvenlik', icon: Shield },
  ];

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
                        Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={session?.kullaniciAdi || ''}
                        className="input-field"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        E-posta
                      </label>
                      <input
                        type="email"
                        placeholder="email@example.com"
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Dil
                    </label>
                    <select className="input-field">
                      <option value="tr">Türkçe</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Saat Dilimi
                    </label>
                    <select className="input-field">
                      <option value="Europe/Istanbul">Europe/Istanbul (GMT+3)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>

                  <button className="btn-primary flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Kaydet
                  </button>
                </div>
              </div>
            )}

            {/* Server Settings */}
            {activeTab === 'sunucu' && (
              <div className="glass-card rounded-xl p-6 animate-slide-up">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  Sunucu Ayarları
                </h3>

                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Bağlı Sunucu</span>
                      <span className="badge badge-success">Aktif</span>
                    </div>
                    <p className="font-semibold">{session?.sunucuAdi || 'Bilinmiyor'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      API Endpoint
                    </label>
                    <input
                      type="text"
                      value={`https://${session?.sunucuAdi || 'sunucu'}.ws.dia.com.tr/api/v3/sis/json`}
                      className="input-field font-mono text-sm"
                      disabled
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <Database className="w-5 h-5 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Firma Kodu</p>
                      <p className="font-semibold">{session?.firmKodu || '—'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <Globe className="w-5 h-5 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Dönem Kodu</p>
                      <p className="font-semibold">{session?.donemKodu || '—'}</p>
                    </div>
                  </div>

                  <button className="btn-secondary flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Bağlantıyı Yenile
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
