// Protected Module - Modül bazlı yetki koruması
import React from 'react';
import { Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ProtectedModuleProps {
  module: string;
  permission?: 'view' | 'edit';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedModule({ 
  module, 
  permission = 'view', 
  children, 
  fallback 
}: ProtectedModuleProps) {
  const { hasPermission, loading } = usePermissions();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission(module, permission)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Erişim Kısıtlı</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          Bu modüle erişim yetkiniz bulunmamaktadır. 
          Yetki almak için yöneticinizle iletişime geçin.
        </p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Dashboard'a Dön
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

// HOC version for route protection
export function withModuleProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  module: string,
  permission: 'view' | 'edit' = 'view'
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedModule module={module} permission={permission}>
        <WrappedComponent {...props} />
      </ProtectedModule>
    );
  };
}
