import React, { useState } from 'react';
import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SalesPage } from '@/pages/SalesPage';
import { FinancePage } from '@/pages/FinancePage';
import { CustomersPage } from '@/pages/CustomersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Sidebar } from '@/components/layout/Sidebar';
import type { NavigationPage } from '@/lib/types';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated - show app
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'satis':
        return <SalesPage />;
      case 'finans':
        return <FinancePage />;
      case 'cari':
        return <CustomersPage />;
      case 'ayarlar':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="flex-1 ml-64 flex flex-col">
        {renderPage()}
      </div>
    </div>
  );
}

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
