import { User, UserRole, ViewTab } from '../types.js';

export const SECRETARIA_ALLOWED_TABS: readonly ViewTab[] = [
  'secretariat',
  'attendance',
  'finances',
  'registrations',
  'schedule',
];

export function isSecretariaRole(role?: UserRole | string | null): boolean {
  return role === 'secretaria';
}

export function getDefaultTabForUser(user?: User | null): ViewTab {
  return isSecretariaRole(user?.role) ? 'secretariat' : 'dashboard';
}

export function isTabAllowedForUser(tab: ViewTab, user?: User | null): boolean {
  if (!user) return true;
  if (isSecretariaRole(user.role)) {
    return SECRETARIA_ALLOWED_TABS.includes(tab);
  }
  if (tab === 'users' || tab === 'admin' || tab === 'history' || tab === 'settings') {
    return user.role === 'super_admin';
  }
  if (tab === 'church') {
    return user.role === 'super_admin' || user.canManageChurchPage === true;
  }
  return true;
}

export function sanitizeTabForUser(tab: ViewTab, user?: User | null): ViewTab {
  if (!user) return tab;
  return isTabAllowedForUser(tab, user) ? tab : getDefaultTabForUser(user);
}
