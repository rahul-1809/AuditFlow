import React from 'react';
import type { TaskStatus } from '../types';

interface StatusBadgeProps {
  status: TaskStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'todo':
      return (
        <span className="status-badge status-badge-todo">
          <span className="status-badge-dot" />
          <span>To Do</span>
        </span>
      );
    case 'in_progress':
      return (
        <span className="status-badge status-badge-in-progress">
          <span className="status-badge-dot" />
          <span>In Progress</span>
        </span>
      );
    case 'completed':
      return (
        <span className="status-badge status-badge-completed">
          <span className="status-badge-dot" />
          <span>Completed</span>
        </span>
      );
    case 'approved':
      return (
        <span className="status-badge status-badge-approved">
          <span className="status-badge-dot" />
          <span>Approved</span>
        </span>
      );
    default:
      return null;
  }
};
