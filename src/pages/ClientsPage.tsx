import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Client, ClientCredential } from '../types';
import { AVAILABLE_CLIENT_TYPES, CREDENTIAL_TYPE_OPTIONS } from '../types';
import { Modal } from '../components/Modal';
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Edit2,
  Trash2,
  Building,
  Key,
  Check,
  Phone,
  Mail,
  User,
  FileText,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';

interface InlineCredential {
  id: string;
  portal_name: string;
  portal_url: string;
  username: string;
  password: string;
  notes: string;
}

export const ClientsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [credentials, setCredentials] = useState<ClientCredential[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Password visibility state per credential ID
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAddCredModalOpen, setIsAddCredModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<ClientCredential | null>(null);

  // Add Client validation state
  const [addClientError, setAddClientError] = useState<string | null>(null);
  const [validationField, setValidationField] = useState<string | null>(null);

  // Client form
  const [clientForm, setClientForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: '',
    pan: '',
    notes: '',
    client_types: [] as string[],
    credentials: [] as InlineCredential[],
  });

  // Credential form
  const [credForm, setCredForm] = useState({
    portal_name: '',
    username: '',
    password: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cList, crList] = await Promise.all([
        api.getClients(),
        api.getCredentials(),
      ]);
      setClients(cList);
      setCredentials(crList);
      if (cList.length > 0 && !selectedClientId) {
        setSelectedClientId(cList[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load clients data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || clients[0] || null;
  }, [clients, selectedClientId]);

  const clientCredentials = useMemo(() => {
    if (!selectedClient) return [];
    return credentials.filter((c) => c.client_id === selectedClient.id);
  }, [credentials, selectedClient]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.contact_person.toLowerCase().includes(query) ||
        c.gstin.toLowerCase().includes(query) ||
        c.pan.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const togglePasswordVisibility = (credId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [credId]: !prev[credId],
    }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle Client Type selection
  const handleToggleClientType = (type: string) => {
    if (type === 'Pending Tasks') {
      setClientForm((prev) => {
        const isSelected = prev.client_types.includes('Pending Tasks');
        return {
          ...prev,
          // If already selected, deselect; if selecting, clear other types and inline credentials
          client_types: isSelected ? [] : ['Pending Tasks'],
          credentials: isSelected ? prev.credentials : [],
        };
      });
    } else {
      setClientForm((prev) => {
        // If Pending Tasks was selected, remove it
        const cleaned = prev.client_types.filter((t) => t !== 'Pending Tasks');
        const isSelected = cleaned.includes(type);
        const nextTypes = isSelected
          ? cleaned.filter((t) => t !== type)
          : [...cleaned, type];
        return {
          ...prev,
          client_types: nextTypes,
        };
      });
    }
  };

  // Inline Credential handlers for client creation
  const handleAddInlineCred = () => {
    setClientForm((prev) => {
      // Determine intelligent default type from selected client_types
      const candidateTypes = prev.client_types.filter((t) =>
        CREDENTIAL_TYPE_OPTIONS.includes(t as any)
      );
      const existingTypes = prev.credentials.map((c) => c.portal_name);
      const unusedType = candidateTypes.find((t) => !existingTypes.includes(t));
      const defaultType = unusedType || candidateTypes[0] || 'GST';

      let defaultUrl = '';
      if (defaultType === 'GST') defaultUrl = 'https://services.gst.gov.in';
      else if (defaultType === 'IT') defaultUrl = 'https://eportal.incometax.gov.in';
      else if (defaultType === 'MCA') defaultUrl = 'https://www.mca.gov.in';
      else if (defaultType === 'PF') defaultUrl = 'https://unifiedportal-emp.epfindia.gov.in';
      else if (defaultType === 'ESI') defaultUrl = 'https://www.esic.gov.in';

      return {
        ...prev,
        credentials: [
          ...prev.credentials,
          {
            id: `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            portal_name: defaultType,
            portal_url: defaultUrl,
            username: '',
            password: '',
            notes: '',
          },
        ],
      };
    });
  };

  const handleRemoveInlineCred = (tempId: string) => {
    setClientForm((prev) => ({
      ...prev,
      credentials: prev.credentials.filter((c) => c.id !== tempId),
    }));
  };

  const handleUpdateInlineCred = (tempId: string, field: keyof InlineCredential, val: string) => {
    setClientForm((prev) => ({
      ...prev,
      credentials: prev.credentials.map((c) => {
        if (c.id !== tempId) return c;
        const updated = { ...c, [field]: val };
        if (field === 'portal_name') {
          if (val === 'GST') updated.portal_url = 'https://services.gst.gov.in';
          else if (val === 'IT') updated.portal_url = 'https://eportal.incometax.gov.in';
          else if (val === 'MCA') updated.portal_url = 'https://www.mca.gov.in';
          else if (val === 'PF') updated.portal_url = 'https://unifiedportal-emp.epfindia.gov.in';
          else if (val === 'ESI') updated.portal_url = 'https://www.esic.gov.in';
        }
        return updated;
      }),
    }));
  };

  // Add Client
  const handleOpenAddClient = () => {
    setAddClientError(null);
    setValidationField(null);
    setClientForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      gstin: '',
      pan: '',
      notes: '',
      client_types: ['GST'],
      credentials: [],
    });
    setIsAddClientModalOpen(true);
  };

  const handleSaveAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddClientError(null);
    setValidationField(null);

    // Validate required Client Name
    if (!clientForm.name.trim()) {
      setAddClientError('Client / Business Name is required.');
      setValidationField('client-name');
      const el = document.getElementById('client-name');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Validate credentials if any
    const isPending = clientForm.client_types.includes('Pending Tasks');
    if (!isPending && clientForm.credentials.length > 0) {
      for (let i = 0; i < clientForm.credentials.length; i++) {
        const cred = clientForm.credentials[i];
        if (!cred.username.trim()) {
          setAddClientError(`Username is required for Credential #${i + 1} (${cred.portal_name}).`);
          setValidationField(`cred-username-${cred.id}`);
          const el = document.getElementById(`cred-username-${cred.id}`);
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        if (!cred.password) {
          setAddClientError(`Password is required for Credential #${i + 1} (${cred.portal_name}).`);
          setValidationField(`cred-password-${cred.id}`);
          const el = document.getElementById(`cred-password-${cred.id}`);
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }
    }

    try {
      const validCreds = isPending
        ? []
        : clientForm.credentials.map((c) => ({
            portal_name: c.portal_name.trim(),
            portal_url: c.portal_url.trim() || undefined,
            username: c.username.trim(),
            password: c.password,
            notes: c.notes.trim() || undefined,
          }));

      const created = await api.createClient({
        name: clientForm.name.trim(),
        contact_person: clientForm.contact_person.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim(),
        gstin: clientForm.gstin.trim().toUpperCase(),
        pan: clientForm.pan.trim().toUpperCase(),
        notes: clientForm.notes.trim(),
        client_types: clientForm.client_types,
        credentials: validCreds,
      });

      const [updatedClients, updatedCreds] = await Promise.all([
        api.getClients(),
        api.getCredentials(),
      ]);
      setClients(updatedClients);
      setCredentials(updatedCreds);
      setSelectedClientId(created.id);
      setIsAddClientModalOpen(false);
      setAddClientError(null);
      setValidationField(null);
    } catch (err: any) {
      setAddClientError(`Error creating client: ${err.message}`);
    }
  };

  // Edit Client
  const handleOpenEditClient = (client: Client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      contact_person: client.contact_person,
      phone: client.phone,
      email: client.email,
      gstin: client.gstin,
      pan: client.pan,
      notes: client.notes,
      client_types: client.client_types || [],
      credentials: [],
    });
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      await api.updateClient(editingClient.id, {
        name: clientForm.name.trim(),
        contact_person: clientForm.contact_person.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim(),
        gstin: clientForm.gstin.trim().toUpperCase(),
        pan: clientForm.pan.trim().toUpperCase(),
        notes: clientForm.notes.trim(),
        client_types: clientForm.client_types,
      });

      const updated = await api.getClients();
      setClients(updated);
      setEditingClient(null);
    } catch (err: any) {
      alert(`Error updating client: ${err.message}`);
    }
  };

  // Add Credential
  const handleOpenAddCred = () => {
    const clientTypes = selectedClient?.client_types || [];
    const candidateTypes = clientTypes.filter((t) => CREDENTIAL_TYPE_OPTIONS.includes(t as any));
    const existingTypes = clientCredentials.map((c) => c.portal_name);
    const unusedType = candidateTypes.find((t) => !existingTypes.includes(t));
    const defaultType = unusedType || candidateTypes[0] || 'GST';

    setCredForm({
      portal_name: defaultType,
      username: '',
      password: '',
      notes: '',
    });
    setIsAddCredModalOpen(true);
  };

  const handleSaveAddCred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !credForm.portal_name.trim() || !credForm.username.trim() || !credForm.password) return;

    try {
      await api.createCredential({
        client_id: selectedClient.id,
        portal_name: credForm.portal_name.trim(),
        username: credForm.username.trim(),
        password: credForm.password,
        notes: credForm.notes.trim() || undefined,
      });

      const updated = await api.getCredentials();
      setCredentials(updated);
      setIsAddCredModalOpen(false);
    } catch (err: any) {
      alert(`Error creating credential: ${err.message}`);
    }
  };

  // Edit Credential
  const handleOpenEditCred = (cred: ClientCredential) => {
    setEditingCred(cred);
    setCredForm({
      portal_name: cred.portal_name,
      username: cred.username,
      password: cred.password_decrypted,
      notes: cred.notes || '',
    });
  };

  const handleSaveEditCred = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCred) return;

    try {
      await api.updateCredential(editingCred.id, {
        portal_name: credForm.portal_name.trim(),
        username: credForm.username.trim(),
        password: credForm.password,
        notes: credForm.notes.trim() || undefined,
      });

      const updated = await api.getCredentials();
      setCredentials(updated);
      setEditingCred(null);
    } catch (err: any) {
      alert(`Error updating credential: ${err.message}`);
    }
  };

  const handleDeleteCred = async (cred: ClientCredential) => {
    if (window.confirm(`Delete credential for ${cred.portal_name}?`)) {
      try {
        await api.deleteCredential(cred.id);
        const updated = await api.getCredentials();
        setCredentials(updated);
      } catch (err: any) {
        alert(`Error deleting credential: ${err.message}`);
      }
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Client Records & Portals</h2>
          <p className="page-subtitle">
            Client business profiles and compliance portal access credentials
          </p>
        </div>

        {isAdmin && (
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenAddClient}
            >
              <Plus size={14} className="mr-1" />
              Add Client
            </button>
          </div>
        )}
      </div>

      {/* Two-Column Master-Detail Layout */}
      <div className="clients-layout-grid">
        {/* Left Column: Client List */}
        <div className="clients-list-pane">
          <div className="clients-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search clients, GSTIN, PAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="clients-scroll-list">
            {loading ? (
              <div className="empty-clients-notice">Loading clients from SQLite database...</div>
            ) : filteredClients.length === 0 ? (
              <div className="empty-clients-notice">No clients found matching search.</div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = client.id === selectedClientId;
                return (
                  <div
                    key={client.id}
                    className={`client-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <div className="client-item-title-row">
                      <span className="client-item-name">{client.name}</span>
                    </div>
                    {client.client_types && client.client_types.length > 0 && (
                      <div className="client-item-types-row">
                        {client.client_types.map((t) => (
                          <span
                            key={t}
                            className={`client-type-badge ${t === 'Pending Tasks' ? 'badge-pending' : ''}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="client-item-meta">
                      <span>{client.contact_person}</span>
                      {client.gstin && <span className="font-mono">GST: {client.gstin}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Client Detail & Credentials */}
        <div className="client-detail-pane">
          {selectedClient ? (
            <div className="client-detail-card">
              {/* Client Info Header */}
              <div className="client-info-header">
                <div>
                  <h3 className="client-header-title">{selectedClient.name}</h3>
                  <div className="client-header-tags">
                    {selectedClient.client_types && selectedClient.client_types.length > 0 && (
                      <div className="client-header-types-list">
                        {selectedClient.client_types.map((t) => (
                          <span
                            key={t}
                            className={`client-type-badge ${t === 'Pending Tasks' ? 'badge-pending' : ''}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedClient.gstin && (
                      <span className="tax-id-tag">
                        <strong>GSTIN:</strong> {selectedClient.gstin}
                      </span>
                    )}
                    {selectedClient.pan && (
                      <span className="tax-id-tag">
                        <strong>PAN:</strong> {selectedClient.pan}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => handleOpenEditClient(selectedClient)}
                  >
                    <Edit2 size={12} className="mr-1" />
                    Edit Client
                  </button>
                )}
              </div>

              {/* Contact Details Grid */}
              <div className="client-meta-grid">
                <div className="meta-field">
                  <span className="meta-label">
                    <User size={12} className="inline mr-1 text-slate-400" />
                    Contact Person:
                  </span>
                  <span className="meta-value">{selectedClient.contact_person || '—'}</span>
                </div>
                <div className="meta-field">
                  <span className="meta-label">
                    <Phone size={12} className="inline mr-1 text-slate-400" />
                    Phone:
                  </span>
                  <span className="meta-value font-mono">{selectedClient.phone || '—'}</span>
                </div>
                <div className="meta-field">
                  <span className="meta-label">
                    <Mail size={12} className="inline mr-1 text-slate-400" />
                    Email:
                  </span>
                  <span className="meta-value">{selectedClient.email || '—'}</span>
                </div>
                <div className="meta-field">
                  <span className="meta-label">
                    <FileText size={12} className="inline mr-1 text-slate-400" />
                    Internal Notes:
                  </span>
                  <span className="meta-value text-slate-600">{selectedClient.notes || '—'}</span>
                </div>
              </div>

              <hr className="detail-divider" />

              {/* Credentials Section */}
              <div className="credentials-section">
                <div className="credentials-header">
                  <div className="credentials-title-group">
                    <Key size={15} className="text-slate-600" />
                    <h4 className="credentials-title">Portal Login Credentials</h4>
                    {!selectedClient.client_types?.includes('Pending Tasks') && (
                      <span className="credentials-count-badge">
                        {clientCredentials.length} Portals
                      </span>
                    )}
                  </div>

                  {isAdmin && !selectedClient.client_types?.includes('Pending Tasks') && (
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={handleOpenAddCred}
                    >
                      <Plus size={12} className="mr-1" />
                      Add Portal Credential
                    </button>
                  )}
                </div>

                <div className="credentials-list">
                  {selectedClient.client_types?.includes('Pending Tasks') ? (
                    <div className="empty-credentials-box">
                      <ShieldAlert size={14} className="inline mr-1 text-slate-400" />
                      Credentials are not applicable to Pending Tasks clients.
                    </div>
                  ) : clientCredentials.length === 0 ? (
                    <div className="empty-credentials-box">
                      No portal credentials configured for this client.
                      {isAdmin && ' Click "Add Portal Credential" to register one.'}
                    </div>
                  ) : (
                    clientCredentials.map((cred) => {
                      const isVisible = Boolean(visiblePasswords[cred.id]);

                      return (
                        <div key={cred.id} className="credential-row-item">
                          <div className="cred-portal-col">
                            <div className="cred-portal-name font-medium">
                              {cred.portal_name}
                            </div>
                          </div>

                          <div className="cred-fields-col">
                            <div className="cred-field-inline">
                              <span className="field-hint">Username:</span>
                              <span className="field-val font-mono">{cred.username}</span>
                              <button
                                type="button"
                                className="copy-action-btn"
                                onClick={() => copyToClipboard(cred.username, `u-${cred.id}`)}
                                title="Copy username"
                              >
                                {copiedId === `u-${cred.id}` ? (
                                  <Check size={12} className="text-emerald-700" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>

                            <div className="cred-field-inline">
                              <span className="field-hint">Password:</span>
                              <span className="field-val font-mono">
                                {isVisible ? cred.password_decrypted : '••••••••••••'}
                              </span>
                              <button
                                type="button"
                                className="visibility-toggle-btn"
                                onClick={() => togglePasswordVisibility(cred.id)}
                                title={isVisible ? 'Hide Password' : 'Show Password'}
                              >
                                {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                                <span>{isVisible ? 'Hide' : 'Show'}</span>
                              </button>
                              <button
                                type="button"
                                className="copy-action-btn"
                                onClick={() => copyToClipboard(cred.password_decrypted, `p-${cred.id}`)}
                                title="Copy password"
                              >
                                {copiedId === `p-${cred.id}` ? (
                                  <Check size={12} className="text-emerald-700" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>

                            {cred.notes && (
                              <div className="cred-notes-subtext">
                                <em>Note:</em> {cred.notes}
                              </div>
                            )}
                          </div>

                          {isAdmin && (
                            <div className="cred-actions-col">
                              <button
                                type="button"
                                className="icon-action-btn"
                                onClick={() => handleOpenEditCred(cred)}
                                title="Edit Credential"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                className="icon-action-btn delete-btn"
                                onClick={() => handleDeleteCred(cred)}
                                title="Delete Credential"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection-pane">
              <Building size={32} className="text-slate-300 mb-2" />
              <p>Select a client from the left pane to view details and portal credentials.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Client (Admin) */}
      <Modal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        title="Create New Client"
        maxWidth="modal-wide"
        bodyClassName="modal-body-flush"
      >
        <form onSubmit={handleSaveAddClient} className="modal-form-layout" noValidate>
          <div className="modal-form-scrollable">
            {addClientError && (
              <div className="form-error-banner" role="alert">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{addClientError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="client-name">
                Client / Business Name <span className="text-required">*</span>
              </label>
              <input
                id="client-name"
                type="text"
                className={`form-input ${validationField === 'client-name' ? 'input-error' : ''}`}
                placeholder="e.g. Apex Logistics Pvt Ltd"
                value={clientForm.name}
                onChange={(e) => {
                  setClientForm({ ...clientForm, name: e.target.value });
                  if (validationField === 'client-name') {
                    setValidationField(null);
                    setAddClientError(null);
                  }
                }}
                required
              />
            </div>

            {/* Client Type Field */}
            <div className="form-group">
              <label className="form-label">
                Client Type <span className="text-xs text-slate-500 font-normal">(Select all services required)</span>
              </label>
              <div className="client-types-selection-grid">
                {AVAILABLE_CLIENT_TYPES.map((type) => {
                  const isPending = type === 'Pending Tasks';
                  const isSelected = clientForm.client_types.includes(type);
                  const hasPendingSelected = clientForm.client_types.includes('Pending Tasks');
                  const isDisabled = hasPendingSelected ? !isPending : (isPending && clientForm.client_types.length > 0 && !isSelected);

                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={isDisabled}
                      className={`client-type-chip ${isSelected ? 'selected' : ''} ${isPending ? 'chip-pending' : ''} ${isDisabled ? 'disabled' : ''}`}
                      onClick={() => handleToggleClientType(type)}
                      title={isDisabled ? (isPending ? 'Cannot combine Pending Tasks with other client types' : 'Pending Tasks is selected exclusively') : ''}
                    >
                      {isSelected && <Check size={11} className="mr-1 inline text-blue-600" />}
                      {type}
                    </button>
                  );
                })}
              </div>
              {clientForm.client_types.length > 0 && (
                <div className="client-types-selected-row">
                  <span className="text-xs text-slate-500 mr-1">Selected:</span>
                  {clientForm.client_types.map((t) => (
                    <span
                      key={t}
                      className={`client-type-badge ${t === 'Pending Tasks' ? 'badge-pending' : ''}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="client-contact">
                  Contact Person
                </label>
                <input
                  id="client-contact"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Suresh Nair"
                  value={clientForm.contact_person}
                  onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="client-phone">
                  Phone Number
                </label>
                <input
                  id="client-phone"
                  type="text"
                  className="form-input"
                  placeholder="+91 98200 XXXXX"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="client-email">
                  Email Address
                </label>
                <input
                  id="client-email"
                  type="email"
                  className="form-input"
                  placeholder="accounts@client.com"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="client-pan">
                  PAN
                </label>
                <input
                  id="client-pan"
                  type="text"
                  className="form-input font-mono uppercase"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={clientForm.pan}
                  onChange={(e) => setClientForm({ ...clientForm, pan: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="client-gstin">
                GSTIN
              </label>
              <input
                id="client-gstin"
                type="text"
                className="form-input font-mono uppercase"
                placeholder="27ABCDE1234F1Z5"
                maxLength={15}
                value={clientForm.gstin}
                onChange={(e) => setClientForm({ ...clientForm, gstin: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="client-notes">
                Internal Notes
              </label>
              <textarea
                id="client-notes"
                className="form-input form-textarea"
                rows={2}
                placeholder="Important audit reminders, filing frequencies..."
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              />
            </div>

            {/* Inline Credentials Entry (Hidden if Pending Tasks is selected) */}
            {!clientForm.client_types.includes('Pending Tasks') && (
              <div className="modal-credentials-block">
                <div className="modal-credentials-header">
                  <div className="flex items-center gap-1.5">
                    <Key size={14} className="text-slate-600" />
                    <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
                      Credentials
                    </span>
                    {clientForm.credentials.length > 0 && (
                      <span className="credentials-count-badge">{clientForm.credentials.length}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs flex items-center gap-1"
                    onClick={handleAddInlineCred}
                  >
                    <Plus size={12} />
                    <span>Add Credential</span>
                  </button>
                </div>

                {clientForm.credentials.length === 0 ? (
                  <div className="empty-inline-creds-hint">
                    No credentials added yet. Click <strong>Add Credential</strong> to add portal login details for this client.
                  </div>
                ) : (
                  <div className="inline-credentials-stack">
                    {clientForm.credentials.map((cred, idx) => (
                      <div key={cred.id} className="compact-cred-card">
                        <div className="compact-cred-card-top">
                          <span className="inline-cred-title">
                            Credential #{idx + 1} ({cred.portal_name})
                          </span>
                          <button
                            type="button"
                            className="btn btn-subtle btn-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                            onClick={() => handleRemoveInlineCred(cred.id)}
                            title="Delete this credential"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>

                        {/* Single Horizontal Line: Type, Username, Password */}
                        <div className="cred-fields-horizontal-row">
                          <div className="form-group cred-field-type">
                            <label className="form-label text-xs">
                              Type <span className="text-required">*</span>
                            </label>
                            <select
                              className="form-input form-input-sm"
                              value={cred.portal_name}
                              onChange={(e) =>
                                handleUpdateInlineCred(cred.id, 'portal_name', e.target.value)
                              }
                            >
                              {CREDENTIAL_TYPE_OPTIONS.map((cType) => (
                                <option key={cType} value={cType}>
                                  {cType}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group cred-field-username">
                            <label className="form-label text-xs" htmlFor={`cred-username-${cred.id}`}>
                              Username <span className="text-required">*</span>
                            </label>
                            <input
                              id={`cred-username-${cred.id}`}
                              type="text"
                              className={`form-input form-input-sm font-mono ${
                                validationField === `cred-username-${cred.id}` ? 'input-error' : ''
                              }`}
                              placeholder="Username"
                              value={cred.username}
                              onChange={(e) => {
                                handleUpdateInlineCred(cred.id, 'username', e.target.value);
                                if (validationField === `cred-username-${cred.id}`) {
                                  setValidationField(null);
                                  setAddClientError(null);
                                }
                              }}
                              required
                            />
                          </div>

                          <div className="form-group cred-field-password">
                            <label className="form-label text-xs" htmlFor={`cred-password-${cred.id}`}>
                              Password <span className="text-required">*</span>
                            </label>
                            <div className="password-input-relative">
                              <input
                                id={`cred-password-${cred.id}`}
                                type={visiblePasswords[cred.id] ? 'text' : 'password'}
                                className={`form-input form-input-sm font-mono pr-16 ${
                                  validationField === `cred-password-${cred.id}` ? 'input-error' : ''
                                }`}
                                placeholder="Password"
                                value={cred.password}
                                onChange={(e) => {
                                  handleUpdateInlineCred(cred.id, 'password', e.target.value);
                                  if (validationField === `cred-password-${cred.id}`) {
                                    setValidationField(null);
                                    setAddClientError(null);
                                  }
                                }}
                                required
                              />
                              <button
                                type="button"
                                className="password-toggle-btn-inline"
                                onClick={() => togglePasswordVisibility(cred.id)}
                                title={visiblePasswords[cred.id] ? 'Hide password' : 'Show password'}
                              >
                                {visiblePasswords[cred.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                <span className="ml-1 text-xs">{visiblePasswords[cred.id] ? 'Hide' : 'Show'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label text-xs" htmlFor={`cred-notes-${cred.id}`}>
                            Notes (Optional)
                          </label>
                          <input
                            id={`cred-notes-${cred.id}`}
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="e.g. Registered DSC, OTP sent to primary mobile"
                            value={cred.notes}
                            onChange={(e) =>
                              handleUpdateInlineCred(cred.id, 'notes', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions-bar modal-actions-sticky">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddClientModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Create Client
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Client (Admin) */}
      <Modal
        isOpen={Boolean(editingClient)}
        onClose={() => setEditingClient(null)}
        title="Edit Client Information"
      >
        <form onSubmit={handleSaveEditClient} className="compact-form">
          <div className="form-group">
            <label className="form-label" htmlFor="edit-client-name">
              Client / Business Name
            </label>
            <input
              id="edit-client-name"
              type="text"
              className="form-input"
              value={clientForm.name}
              onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              required
            />
          </div>

          {/* Edit Client Type Field */}
          <div className="form-group">
            <label className="form-label">
              Client Type <span className="text-xs text-slate-500 font-normal">(Select all services required)</span>
            </label>
            <div className="client-types-selection-grid">
              {AVAILABLE_CLIENT_TYPES.map((type) => {
                const isPending = type === 'Pending Tasks';
                const isSelected = clientForm.client_types.includes(type);
                const hasPendingSelected = clientForm.client_types.includes('Pending Tasks');
                const isDisabled = hasPendingSelected ? !isPending : (isPending && clientForm.client_types.length > 0 && !isSelected);

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isDisabled}
                    className={`client-type-chip ${isSelected ? 'selected' : ''} ${isPending ? 'chip-pending' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => handleToggleClientType(type)}
                    title={isDisabled ? (isPending ? 'Cannot combine Pending Tasks with other client types' : 'Pending Tasks is selected exclusively') : ''}
                  >
                    {isSelected && <Check size={11} className="mr-1 inline text-blue-600" />}
                    {type}
                  </button>
                );
              })}
            </div>
            {clientForm.client_types.length > 0 && (
              <div className="client-types-selected-row">
                <span className="text-xs text-slate-500 mr-1">Selected:</span>
                {clientForm.client_types.map((t) => (
                  <span
                    key={t}
                    className={`client-type-badge ${t === 'Pending Tasks' ? 'badge-pending' : ''}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-client-contact">
                Contact Person
              </label>
              <input
                id="edit-client-contact"
                type="text"
                className="form-input"
                value={clientForm.contact_person}
                onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-client-phone">
                Phone Number
              </label>
              <input
                id="edit-client-phone"
                type="text"
                className="form-input"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-client-email">
                Email
              </label>
              <input
                id="edit-client-email"
                type="email"
                className="form-input"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-client-pan">
                PAN
              </label>
              <input
                id="edit-client-pan"
                type="text"
                className="form-input font-mono uppercase"
                value={clientForm.pan}
                onChange={(e) => setClientForm({ ...clientForm, pan: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-client-gstin">
              GSTIN
            </label>
            <input
              id="edit-client-gstin"
              type="text"
              className="form-input font-mono uppercase"
              value={clientForm.gstin}
              onChange={(e) => setClientForm({ ...clientForm, gstin: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-client-notes">
              Internal Notes
            </label>
            <textarea
              id="edit-client-notes"
              className="form-input form-textarea"
              rows={2}
              value={clientForm.notes}
              onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingClient(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Update Client
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Portal Credential (Admin) */}
      <Modal
        isOpen={isAddCredModalOpen}
        onClose={() => setIsAddCredModalOpen(false)}
        title={`Add Credential for ${selectedClient?.name}`}
      >
        <form onSubmit={handleSaveAddCred} className="compact-form">
          <div className="cred-fields-horizontal-row">
            <div className="form-group cred-field-type">
              <label className="form-label" htmlFor="cred-portal">
                Type <span className="text-required">*</span>
              </label>
              <select
                id="cred-portal"
                className="form-input"
                value={credForm.portal_name}
                onChange={(e) => setCredForm({ ...credForm, portal_name: e.target.value })}
                required
              >
                {CREDENTIAL_TYPE_OPTIONS.map((cType) => (
                  <option key={cType} value={cType}>
                    {cType}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group cred-field-username">
              <label className="form-label" htmlFor="cred-user">
                Username <span className="text-required">*</span>
              </label>
              <input
                id="cred-user"
                type="text"
                className="form-input font-mono"
                placeholder="Username"
                value={credForm.username}
                onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                required
              />
            </div>

            <div className="form-group cred-field-password">
              <label className="form-label" htmlFor="cred-pass">
                Password <span className="text-required">*</span>
              </label>
              <div className="password-input-relative">
                <input
                  id="cred-pass"
                  type={visiblePasswords['add_modal_pass'] ? 'text' : 'password'}
                  className="form-input font-mono pr-16"
                  placeholder="Password"
                  value={credForm.password}
                  onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn-inline"
                  onClick={() => togglePasswordVisibility('add_modal_pass')}
                  title={visiblePasswords['add_modal_pass'] ? 'Hide password' : 'Show password'}
                >
                  {visiblePasswords['add_modal_pass'] ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span className="ml-1 text-xs">{visiblePasswords['add_modal_pass'] ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="cred-notes">
              Notes (Optional)
            </label>
            <input
              id="cred-notes"
              type="text"
              className="form-input"
              placeholder="e.g. Registered DSC, OTP sent to primary mobile"
              value={credForm.notes}
              onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsAddCredModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Credential
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Portal Credential (Admin) */}
      <Modal
        isOpen={Boolean(editingCred)}
        onClose={() => setEditingCred(null)}
        title="Edit Credential"
      >
        <form onSubmit={handleSaveEditCred} className="compact-form">
          <div className="cred-fields-horizontal-row">
            <div className="form-group cred-field-type">
              <label className="form-label" htmlFor="edit-cred-portal">
                Type <span className="text-required">*</span>
              </label>
              <select
                id="edit-cred-portal"
                className="form-input"
                value={credForm.portal_name}
                onChange={(e) => setCredForm({ ...credForm, portal_name: e.target.value })}
                required
              >
                {CREDENTIAL_TYPE_OPTIONS.map((cType) => (
                  <option key={cType} value={cType}>
                    {cType}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group cred-field-username">
              <label className="form-label" htmlFor="edit-cred-user">
                Username <span className="text-required">*</span>
              </label>
              <input
                id="edit-cred-user"
                type="text"
                className="form-input font-mono"
                value={credForm.username}
                onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                required
              />
            </div>

            <div className="form-group cred-field-password">
              <label className="form-label" htmlFor="edit-cred-pass">
                Password <span className="text-required">*</span>
              </label>
              <div className="password-input-relative">
                <input
                  id="edit-cred-pass"
                  type={visiblePasswords['edit_modal_pass'] ? 'text' : 'password'}
                  className="form-input font-mono pr-16"
                  placeholder="Leave unchanged or enter new"
                  value={credForm.password}
                  onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle-btn-inline"
                  onClick={() => togglePasswordVisibility('edit_modal_pass')}
                  title={visiblePasswords['edit_modal_pass'] ? 'Hide password' : 'Show password'}
                >
                  {visiblePasswords['edit_modal_pass'] ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span className="ml-1 text-xs">{visiblePasswords['edit_modal_pass'] ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-cred-notes">
              Notes (Optional)
            </label>
            <input
              id="edit-cred-notes"
              type="text"
              className="form-input"
              value={credForm.notes}
              onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingCred(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Update Credential
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
