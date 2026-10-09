import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { UserProfile } from '../types';
import { Modal } from '../components/Modal';
import { UserPlus, KeyRound, Edit2, CheckCircle2, UserCheck, UserX, Trash2 } from 'lucide-react';

export const TeamPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserProfile | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
  });

  const [newPassword, setNewPassword] = useState('');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const list = await api.getUsers();
      setUsers(list);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Add Assistant
  const handleOpenAdd = () => {
    setAddForm({ name: '', email: '', password: '' });
    setIsAddModalOpen(true);
  };

  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) return;

    try {
      await api.createUser(addForm.name.trim(), addForm.email.trim(), addForm.password);
      await loadUsers();
      setIsAddModalOpen(false);
      showNotification(`Assistant account created for ${addForm.name}.`);
    } catch (err: any) {
      alert(`Error creating assistant: ${err.message}`);
    }
  };

  // Edit Assistant
  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editForm.name.trim() || !editForm.email.trim()) return;

    try {
      await api.updateUser(editingUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
      });
      await loadUsers();
      setEditingUser(null);
      showNotification('Staff details updated successfully.');
    } catch (err: any) {
      alert(`Error updating staff: ${err.message}`);
    }
  };

  // Reset Password
  const handleOpenResetPwd = (user: UserProfile) => {
    setResetPwdUser(user);
    setNewPassword('');
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser || !newPassword) return;

    try {
      await api.resetPassword(resetPwdUser.id, newPassword);
      setResetPwdUser(null);
      showNotification(`Password updated for ${resetPwdUser.name}.`);
    } catch (err: any) {
      alert(`Error resetting password: ${err.message}`);
    }
  };

  // Delete Assistant Account
  const handleDeleteUser = async (user: UserProfile) => {
    if (user.role === 'admin') {
      alert('Primary Admin account cannot be deleted.');
      return;
    }

    if (window.confirm(`Delete assistant account for ${user.name} (${user.email})?`)) {
      try {
        await api.deleteUser(user.id);
        await loadUsers();
        showNotification(`Account deleted for ${user.name}.`);
      } catch (err: any) {
        alert(`Error deleting account: ${err.message}`);
      }
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h2 className="page-title">Team Management</h2>
          <p className="page-subtitle">
            Manage assistant credentials and system access
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenAdd}
          >
            <UserPlus size={14} className="mr-1" />
            Add Assistant
          </button>
        </div>
      </div>

      {notification && (
        <div className="notification-toast success">
          <CheckCircle2 size={15} />
          <span>{notification}</span>
        </div>
      )}

      {/* Team Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="business-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Name</th>
                <th style={{ width: '30%' }}>Username / Email</th>
                <th style={{ width: '15%' }}>Role</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-table-state">
                    Loading team accounts...
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isPrimaryAdmin = user.role === 'admin';

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="team-cell-name font-medium">{user.name}</div>
                        <div className="cell-subtext">
                          Member since {user.created_at?.slice(0, 10)}
                        </div>
                      </td>

                      <td>
                        <div className="font-mono text-slate-800 text-sm">{user.email}</div>
                      </td>

                      <td>
                        {user.role === 'admin' ? (
                          <span className="role-tag admin">Admin</span>
                        ) : (
                          <span className="role-tag assistant">Assistant</span>
                        )}
                      </td>

                      <td>
                        {user.status === 'active' ? (
                          <span className="user-status-badge active">
                            <UserCheck size={11} className="mr-1 inline" />
                            Active
                          </span>
                        ) : (
                          <span className="user-status-badge inactive">
                            <UserX size={11} className="mr-1 inline" />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="action-button-group justify-end">
                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() => handleOpenEdit(user)}
                            title="Edit Account Details"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() => handleOpenResetPwd(user)}
                            title="Change / Reset Password"
                          >
                            <KeyRound size={13} />
                          </button>

                          {!isPrimaryAdmin && (
                            <button
                              type="button"
                              className="icon-action-btn icon-danger"
                              onClick={() => handleDeleteUser(user)}
                              title="Delete Account"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer-summary">
          <span>
            Total Team Members: <strong>{users.length}</strong> (1 Admin,{' '}
            {users.filter((u) => u.role === 'assistant').length} Assistants)
          </span>
          <span className="text-slate-500 text-xs">
            Role-Based Access Control enforced
          </span>
        </div>
      </div>

      {/* Modal: Add Assistant */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Assistant Account"
      >
        <form onSubmit={handleCreateAssistant} className="compact-form">
          <div className="form-group">
            <label className="form-label" htmlFor="new-name">
              Full Name <span className="text-required">*</span>
            </label>
            <input
              id="new-name"
              type="text"
              className="form-input"
              placeholder="e.g. Ramesh Joshi"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-email">
              Username / Login Email <span className="text-required">*</span>
            </label>
            <input
              id="new-email"
              type="email"
              className="form-input"
              placeholder="ramesh@auditflow.internal"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-password">
              Initial Password <span className="text-required">*</span>
            </label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              placeholder="Enter temporary or permanent password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Assistant */}
      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={`Edit Details: ${editingUser?.name}`}
      >
        <form onSubmit={handleSaveEdit} className="compact-form">
          <div className="form-group">
            <label className="form-label" htmlFor="edit-name">
              Full Name
            </label>
            <input
              id="edit-name"
              type="text"
              className="form-input"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-email">
              Login Email
            </label>
            <input
              id="edit-email"
              type="email"
              className="form-input"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reset Password */}
      <Modal
        isOpen={Boolean(resetPwdUser)}
        onClose={() => setResetPwdUser(null)}
        title={`Reset Password: ${resetPwdUser?.name}`}
      >
        <form onSubmit={handleSavePassword} className="compact-form">
          <p className="modal-helper-text">
            Enter the new password for <strong>{resetPwdUser?.email}</strong>. The user will use
            this to sign in immediately.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="reset-pass">
              New Password <span className="text-required">*</span>
            </label>
            <input
              id="reset-pass"
              type="password"
              className="form-input font-mono"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setResetPwdUser(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Update Password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
