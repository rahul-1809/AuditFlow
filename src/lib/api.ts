import type { Client, ClientCredential, Task, UserProfile } from '../types';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP ${response.status}: Request failed`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ success: boolean; user: UserProfile }> {
    return request<{ success: boolean; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Users
  async getUsers(): Promise<UserProfile[]> {
    return request<UserProfile[]>('/users');
  },

  async createUser(name: string, email: string, password: string): Promise<UserProfile> {
    return request<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return request<UserProfile>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async resetPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Clients
  async getClients(): Promise<Client[]> {
    return request<Client[]>('/clients');
  },

  async createClient(
    clientData: Omit<Client, 'id' | 'created_at'> & {
      credentials?: Array<{
        portal_name: string;
        portal_url?: string;
        username: string;
        password: string;
        notes?: string;
      }>;
    }
  ): Promise<Client> {
    return request<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  },

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    return request<Client>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteClient(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/clients/${id}`, {
      method: 'DELETE',
    });
  },

  // Credentials
  async getCredentials(clientId?: string): Promise<ClientCredential[]> {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
    return request<ClientCredential[]>(`/credentials${query}`);
  },

  async createCredential(
    data: Omit<ClientCredential, 'id' | 'updated_at' | 'password_decrypted'> & { password: string }
  ): Promise<ClientCredential> {
    return request<ClientCredential>('/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCredential(
    id: string,
    updates: Partial<ClientCredential> & { password?: string }
  ): Promise<ClientCredential> {
    return request<ClientCredential>(`/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteCredential(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/credentials/${id}`, {
      method: 'DELETE',
    });
  },

  // Tasks
  async getTasks(): Promise<Task[]> {
    return request<Task[]>('/tasks');
  },

  async createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { due_date?: string; month?: string }): Promise<Task> {
    return request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteTask(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  async moveToOthers(taskId: string): Promise<Task> {
    return request<Task>(`/tasks/${taskId}/move-to-others`, {
      method: 'POST',
    });
  },

  async rolloverRecurring(targetMonth: string): Promise<{ success: boolean; createdCount: number }> {
    return request<{ success: boolean; createdCount: number }>('/tasks/rollover', {
      method: 'POST',
      body: JSON.stringify({ targetMonth }),
    });
  },
};
