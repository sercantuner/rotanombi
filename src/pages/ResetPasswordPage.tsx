import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { Lock, Loader2, CheckCircle, KeyRound } from 'lucide-react';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotanombiLogoDark from '@/assets/rotanombi-logo-dark.svg';
import rotaLogoDark from '@/assets/rota-logo-dark.svg';
import rotaLogoLight from '@/assets/rota-logo-light.svg';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const appLogo = isDark ? rotanombiLogoDark : rotanombiLogo;
  const rotaLogo = isDark ? rotaLogoLight : rotaLogoDark;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message === 'New password should be different from the old password.'
          ? 'Yeni şifre eski şifrenizden farklı olmalıdır.'
          : 'Şifre güncellenemedi. Lütfen tekrar deneyin.');
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    } catch {
      setError('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Şifreniz Güncellendi</h1>
          <p className="text-muted-foreground">Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz...</p>
          <button onClick={() => navigate('/login', { replace: true })} className="text-primary hover:underline text-sm">
            Hemen giriş yap →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={appLogo} alt="RotanomBI" className="h-10 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Yeni Şifre Belirleyin</h1>
          <p className="text-muted-foreground text-sm">Hesabınız için yeni bir şifre oluşturun.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Yeni Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Şifre Tekrar</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>}

          <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
            {loading ? 'Güncelleniyor...' : 'Şifremi Güncelle'}
          </button>
        </form>

        <div className="flex flex-col items-center gap-3 mt-12 pt-8 border-t border-border">
          <a href="https://www.rotayazilim.net" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
            <img src={rotaLogo} alt="Rota Yazılım" className="h-5 w-auto" />
          </a>
          <p className="text-center text-xs text-muted-foreground">© 2026 Rota Yazılım • RotanomBI v3.0</p>
        </div>
      </div>
    </div>
  );
}
