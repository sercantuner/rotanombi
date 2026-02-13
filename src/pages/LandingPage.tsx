import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import StatsSection from '@/components/landing/StatsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import BusinessSection from '@/components/landing/BusinessSection';
import PricingSection from '@/components/landing/PricingSection';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Check if super_admin -> redirect to super admin panel
      supabase.rpc('is_super_admin', { _user_id: user.id }).then(({ data }) => {
        if (data) {
          navigate('/super-admin-panel', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      });
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <BusinessSection />
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}
