export * from './permissions';

export const DEMO_PASSWORD_HINT = 'Demo-Autocar-OS-2026!';

export const ACCOUNT_STATUSES = [
  'not_created',
  'invited',
  'invitation_expired',
  'active',
  'suspended',
  'disabled',
  'archived',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
