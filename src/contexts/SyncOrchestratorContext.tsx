// SyncOrchestratorContext - Shared sync state across all components
import React, { createContext, useContext } from 'react';
import { useSyncOrchestrator, SyncProgress } from '@/hooks/useSyncOrchestrator';

interface SyncOrchestratorContextType {
  progress: SyncProgress;
  startFullOrchestration: (forceIncremental?: boolean, targetUserId?: string) => Promise<void>;
  startIncrementalAll: () => Promise<void>;
  quickSync: (slug: string, periodNo: number, targetUserId?: string) => Promise<void>;
  abort: () => void;
}

const SyncOrchestratorContext = createContext<SyncOrchestratorContextType | null>(null);

export function SyncOrchestratorProvider({ children }: { children: React.ReactNode }) {
  const orchestrator = useSyncOrchestrator();
  return (
    <SyncOrchestratorContext.Provider value={orchestrator}>
      {children}
    </SyncOrchestratorContext.Provider>
  );
}

export function useSyncOrchestratorContext() {
  const ctx = useContext(SyncOrchestratorContext);
  if (!ctx) {
    throw new Error('useSyncOrchestratorContext must be used within SyncOrchestratorProvider');
  }
  return ctx;
}
