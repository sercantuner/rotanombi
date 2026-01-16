// This file is now deprecated - routing is handled in App.tsx
// Keeping for backwards compatibility - redirects to dashboard

import { Navigate } from 'react-router-dom';

const Index = () => {
  return <Navigate to="/dashboard" replace />;
};

export default Index;
