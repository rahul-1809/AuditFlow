export type UserRole = 'admin' | 'assistant';
export type UserStatus = 'active' | 'inactive';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export const AVAILABLE_CLIENT_TYPES = [
  'GST',
  'PF',
  'ESI',
  'IT',
  'MCA',
  'Pending Tasks',
] as const;
export type ClientType = typeof AVAILABLE_CLIENT_TYPES[number];

export const CREDENTIAL_TYPE_OPTIONS = [
  'GST',
  'IT',
  'MCA',
  'PF',
  'ESI',
  'Other',
] as const;
export type CredentialType = typeof CREDENTIAL_TYPE_OPTIONS[number];

export interface Client {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  gstin: string;
  pan: string;
  notes: string;
  client_types?: string[];
  created_at: string;
}

export interface ClientCredential {
  id: string;
  client_id: string;
  portal_name: string;
  portal_url?: string;
  username: string;
  password_decrypted: string;
  notes?: string;
  updated_at: string;
}

export type TaskType = 'one_time' | 'recurring_monthly' | 'recurring_quarterly';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'approved';

export interface Task {
  id: string;
  client_id: string;
  title: string;
  category?: string;
  task_type: TaskType;
  assigned_to: string; // user id
  due_date?: string;
  status: TaskStatus;
  month?: string; // YYYY-MM
  notes?: string;
  rework_comment?: string;
  in_others?: number;
  created_at: string;
  updated_at: string;
}

