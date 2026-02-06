// Widget Builder Page - Tam Sayfa AI Widget Oluşturma
// CustomCodeWidgetBuilder bileşenini tam sayfa olarak sarar

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomCodeWidgetBuilder } from '@/components/admin/CustomCodeWidgetBuilder';

export function WidgetBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editWidgetId = searchParams.get('edit');
  const fromParam = searchParams.get('from');
  
  // Akıllı navigasyon: from parametresine göre dön
  const getReturnPath = () => {
    if (fromParam === 'super-admin') {
      // Super admin içinde widget sekmesine dön
      return '/super-admin-panel?tab=widgets';
    }
    // containerId veya pageId varsa o sayfaya dön
    const containerId = searchParams.get('container');
    const pageId = searchParams.get('pageId');
    if (containerId || pageId) {
      return `/page/${pageId || 'dashboard'}`;
    }
    return '/dashboard';
  };
  
  const handleClose = () => {
    navigate(getReturnPath());
  };

  const handleSave = () => {
    navigate(getReturnPath());
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Builder Content - Full Page */}
      <CustomCodeWidgetBuilder
        onClose={handleClose}
        onSave={handleSave}
        editWidgetId={editWidgetId || undefined}
        isFullPage={true}
      />
    </div>
  );
}

export default WidgetBuilderPage;
