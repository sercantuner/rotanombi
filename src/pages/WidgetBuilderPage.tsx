// Widget Builder Page - Tam Sayfa AI Widget Oluşturma
// CustomCodeWidgetBuilder bileşenini tam sayfa olarak sarar

import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomCodeWidgetBuilder } from '@/components/admin/CustomCodeWidgetBuilder';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wand2 } from 'lucide-react';

export function WidgetBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editWidgetId = searchParams.get('edit');
  
  const handleClose = () => {
    navigate(-1);
  };

  const handleSave = () => {
    navigate('/dashboard');
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wand2 className="h-6 w-6 text-primary" />
              AI Widget Builder
            </h1>
            <p className="text-sm text-muted-foreground">
              {editWidgetId ? 'Widget düzenle' : 'AI ile yeni widget oluştur'}
            </p>
          </div>
        </div>
      </div>

      {/* Builder Content */}
      <div className="flex-1 overflow-hidden">
        <CustomCodeWidgetBuilder
          onClose={handleClose}
          onSave={handleSave}
          editWidgetId={editWidgetId || undefined}
          isFullPage={true}
        />
      </div>
    </div>
  );
}

export default WidgetBuilderPage;
