import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useScrolled } from '@/hooks/useScrolled';
import rotanombiLogo from '@/assets/rotanombi-logo.png';
import rotanombiLogoDark from '@/assets/rotanombi-logo-dark.svg';
import { Button } from '@/components/ui/button';

export default function LandingHeader() {
  const scrolled = useScrolled();
  const { theme } = useTheme();
  const headerLogo = theme === 'dark' ? rotanombiLogoDark : rotanombiLogo;

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <Link to="/" className="flex items-center gap-2">
          <img src={headerLogo} alt="RotanomBI" className="h-8" />
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <a href="#features">Özellikler</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="#pricing">Fiyatlandırma</a>
          </Button>
          <Button size="sm" asChild>
            <Link to="/login">Giriş Yap</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
