import React from 'react';
import { CheckSquare, Users, Building2, LogOut, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { AVAILABLE_CLIENT_TYPES } from '../types';

interface SidebarProps {
  currentTab: 'tasks' | 'clients' | 'team';
  activeClientTypeFilter: string | null;
  onSelectTab: (tab: 'tasks' | 'clients' | 'team') => void;
  onSelectClientType: (clientType: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeClientTypeFilter,
  onSelectTab,
  onSelectClientType,
}) => {
  const { currentUser, isAdmin, logout } = useAuth();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo-box">AJ</div>
        <div className="brand-info">
          <div className="brand-name">AJ Associates</div>
          <div className="brand-subtitle">Tax & Accounting Solutions</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item ${currentTab === 'tasks' && activeClientTypeFilter === null ? 'active' : ''}`}
          onClick={() => onSelectTab('tasks')}
        >
          <CheckSquare size={17} className="nav-icon" />
          <span>Tasks</span>
        </button>

        <div className="nav-group">
          <button
            type="button"
            className={`nav-item ${currentTab === 'clients' ? 'active' : ''}`}
            onClick={() => onSelectTab('clients')}
          >
            <Building2 size={17} className="nav-icon" />
            <span>Clients</span>
          </button>

          <div className="nav-sub-list">
            {AVAILABLE_CLIENT_TYPES.map((type) => {
              const isSelected = currentTab === 'tasks' && activeClientTypeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  className={`nav-sub-item ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectClientType(type)}
                  title={`Filter tasks by ${type}`}
                >
                  <span className="nav-sub-bullet" />
                  <span>{type}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            className={`nav-item ${currentTab === 'team' ? 'active' : ''}`}
            onClick={() => onSelectTab('team')}
          >
            <Users size={17} className="nav-icon" />
            <span>Team</span>
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-badge">
          <div className="user-avatar-circle">
            {isAdmin ? <Shield size={14} /> : <User size={14} />}
          </div>
          <div className="user-details-text">
            <div className="user-full-name">{currentUser?.name}</div>
            <div className="user-role-tag">
              {isAdmin ? 'Admin' : 'Assistant'}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={logout}
          title="Sign out of AJ Associates"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
