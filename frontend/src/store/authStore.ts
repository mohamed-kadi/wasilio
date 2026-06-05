import { create } from 'zustand';

interface AuthState {
  tenantId: string;
  user: {
    name: string;
    role: string;
  } | null;
  setTenantId: (tenantId: string) => void;
  setUser: (user: any) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  tenantId: '00000000-0000-0000-0000-000000000001', // Default for demonstration
  user: { name: 'Admin User', role: 'ADMIN' },
  setTenantId: (tenantId) => set({ tenantId }),
  setUser: (user) => set({ user }),
}));
