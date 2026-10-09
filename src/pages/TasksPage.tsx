import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Task, TaskStatus, TaskType, Client, UserProfile } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { 
  Plus, 
  Search, 
  RotateCw, 
  Check, 
  CornerDownLeft, 
  Edit2, 
  Trash2, 
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Archive,
} from 'lucide-react';

interface ClientTaskGroup {
  id: string; // client id or '__others__'
  name: string;
  clientTypes?: string[];
  isPendingTasks?: boolean;
  isOthers?: boolean;
  tasks: Task[];
}

interface TasksPageProps {
  activeClientTypeFilter?: string | null;
  onClearClientTypeFilter?: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  activeClientTypeFilter,
  onClearClientTypeFilter,
}) => {
  const { currentUser, isAdmin, isAssistant } = useAuth();

  // Data states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Expand / collapse state for company/client groups
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sendBackTask, setSendBackTask] = useState<Task | null>(null);
  const [sendBackComment, setSendBackComment] = useState('');
  const [moveOthersTask, setMoveOthersTask] = useState<Task | null>(null);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [rolloverTargetMonth, setRolloverTargetMonth] = useState('2026-11');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Form state for Add/Edit
  const [taskForm, setTaskForm] = useState({
    clientId: '',
    title: '',
    category: 'GST',
    taskType: 'one_time' as TaskType,
    assignedTo: '',
    notes: '',
  });

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [tList, cList, uList] = await Promise.all([
        api.getTasks(),
        api.getClients(),
        api.getUsers(),
      ]);
      setTasks(tList);
      setClients(cList);
      setUsers(uList);
    } catch (err: any) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Expand / Collapse helper
  const isGroupExpanded = (groupId: string): boolean => {
    // Default to true (expanded) so client rows are open on view
    return expandedGroupIds[groupId] !== undefined ? expandedGroupIds[groupId] : true;
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => ({
      ...prev,
      [groupId]: !isGroupExpanded(groupId),
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    taskGroups.forEach((g) => {
      next[g.id] = true;
    });
    setExpandedGroupIds(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    taskGroups.forEach((g) => {
      next[g.id] = false;
    });
    setExpandedGroupIds(next);
  };

  // Candidate clients based on active client type filter (if any)
  const candidateClients = useMemo(() => {
    if (!activeClientTypeFilter) return clients;
    return clients.filter((c) => c.client_types?.includes(activeClientTypeFilter));
  }, [clients, activeClientTypeFilter]);

  // Available task categories for selected client in form (restricted to client's assigned types)
  const availableCategoriesForForm = useMemo(() => {
    const client = clients.find((c) => c.id === taskForm.clientId);
    if (!client) return ['GST'];
    if (client.client_types?.includes('Pending Tasks')) {
      return ['Pending Tasks'];
    }
    const types = client.client_types || [];
    return types.length > 0 ? types : ['GST'];
  }, [clients, taskForm.clientId]);

  // Unique available years for the filter dropdown
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    const currentYr = new Date().getFullYear();
    set.add(String(currentYr));
    set.add(String(currentYr - 1));
    set.add(String(currentYr + 1));
    tasks.forEach((t) => {
      if (t.month && t.month.length >= 4) {
        set.add(t.month.slice(0, 4));
      } else if (t.due_date && t.due_date.length >= 4) {
        set.add(t.due_date.slice(0, 4));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [tasks]);

  const MONTH_OPTIONS = useMemo(
    () => [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ],
    []
  );

  // Group tasks by Client / Company & special Others grouping
  const taskGroups = useMemo(() => {
    const matchingTasks = tasks.filter((task) => {
      const client = clients.find((c) => c.id === task.client_id);
      const assignee = users.find((u) => u.id === task.assigned_to);

      // Active client type quick filter
      if (activeClientTypeFilter) {
        if (!client) return false;
        // Client must have the active client type assigned
        if (!client.client_types?.includes(activeClientTypeFilter)) return false;

        // And task must match the active category
        if (task.category) {
          if (task.category !== activeClientTypeFilter) return false;
        } else {
          // Fallback for tasks without category
          if (activeClientTypeFilter === 'Pending Tasks') {
            if (!client.client_types?.includes('Pending Tasks')) return false;
          }
        }
      }

      const matchesSearch =
        !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client && client.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (assignee && assignee.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesAssignee = selectedAssignee === 'all' || task.assigned_to === selectedAssignee;
      const matchesStatus = selectedStatus === 'all' || task.status === selectedStatus;

      // Year & Month matching
      const taskYear = task.month ? task.month.slice(0, 4) : task.due_date ? task.due_date.slice(0, 4) : '';
      const taskMonthNum = task.month && task.month.length >= 7 ? task.month.slice(5, 7) : task.due_date && task.due_date.length >= 7 ? task.due_date.slice(5, 7) : '';

      const cleanYear = selectedYear.trim();
      const matchesYear = !cleanYear || cleanYear === 'all' || taskYear.includes(cleanYear);
      const matchesMonth = selectedMonth === 'all' || taskMonthNum === selectedMonth;

      return matchesSearch && matchesAssignee && matchesStatus && matchesYear && matchesMonth;
    });

    const groups: ClientTaskGroup[] = [];

    // 1. Process candidate clients (matching activeClientTypeFilter if active)
    for (const client of candidateClients) {
      if (selectedClient !== 'all' && selectedClient !== client.id) {
        continue;
      }

      // Exclude tasks that have been moved to Others
      const clientTasks = matchingTasks.filter(
        (t) => t.client_id === client.id && !t.in_others
      );

      // Show group if tasks exist or if explicitly filtered by this client
      if (clientTasks.length > 0 || (selectedClient === client.id && !searchQuery)) {
        const isPending =
          client.client_types?.includes('Pending Tasks') ||
          client.name.toLowerCase().includes('pending');

        groups.push({
          id: client.id,
          name: client.name,
          clientTypes: client.client_types,
          isPendingTasks: isPending,
          isOthers: false,
          tasks: clientTasks,
        });
      }
    }

    // 2. Process special 'Others' grouping
    // Show Others if viewing all or if viewing Pending Tasks
    if (
      (!activeClientTypeFilter || activeClientTypeFilter === 'Pending Tasks') &&
      (selectedClient === 'all' || selectedClient === '__others__')
    ) {
      const othersTasks = matchingTasks.filter((t) => Boolean(t.in_others));
      if (othersTasks.length > 0 || selectedClient === '__others__') {
        groups.push({
          id: '__others__',
          name: 'Others',
          clientTypes: ['Archive'],
          isPendingTasks: false,
          isOthers: true,
          tasks: othersTasks,
        });
      }
    }

    return groups;
  }, [tasks, clients, users, searchQuery, selectedClient, selectedAssignee, selectedStatus, selectedYear, selectedMonth, activeClientTypeFilter, candidateClients]);

  // Total visible task count across groups
  const totalVisibleTasks = useMemo(() => {
    return taskGroups.reduce((acc, g) => acc + g.tasks.length, 0);
  }, [taskGroups]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    let defaultClient = clients[0]?.id || '';
    if (activeClientTypeFilter) {
      const match = clients.find((c) => c.client_types?.includes(activeClientTypeFilter));
      if (match) defaultClient = match.id;
    }
    const clientObj = clients.find((c) => c.id === defaultClient);
    const clientTypes = clientObj?.client_types || [];
    const defaultCat = (activeClientTypeFilter && clientTypes.includes(activeClientTypeFilter))
      ? activeClientTypeFilter
      : clientTypes[0] || 'GST';

    const defaultAssignee = users.find((u) => u.role === 'assistant')?.id || users[0]?.id || '';
    setTaskForm({
      clientId: defaultClient,
      title: '',
      category: defaultCat,
      taskType: 'one_time',
      assignedTo: defaultAssignee,
      notes: '',
    });
    setIsAddModalOpen(true);
  };

  // Save Add Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !taskForm.clientId || !taskForm.assignedTo) return;

    try {
      await api.createTask({
        client_id: taskForm.clientId,
        title: taskForm.title.trim(),
        category: taskForm.category,
        task_type: taskForm.taskType,
        assigned_to: taskForm.assignedTo,
        status: 'todo',
        notes: taskForm.notes.trim() || undefined,
      });

      const updated = await api.getTasks();
      setTasks(updated);
      setIsAddModalOpen(false);
      showNotification('Task successfully created.');
    } catch (err: any) {
      alert(`Error creating task: ${err.message}`);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (task: Task) => {
    const clientObj = clients.find((c) => c.id === task.client_id);
    const clientTypes = clientObj?.client_types || [];
    const cat = task.category || clientTypes[0] || 'GST';

    setEditingTask(task);
    setTaskForm({
      clientId: task.client_id,
      title: task.title,
      category: cat,
      taskType: task.task_type,
      assignedTo: task.assigned_to,
      notes: task.notes || '',
    });
  };

  // Save Edit Task
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !taskForm.title.trim()) return;

    try {
      await api.updateTask(editingTask.id, {
        client_id: taskForm.clientId,
        title: taskForm.title.trim(),
        category: taskForm.category,
        task_type: taskForm.taskType,
        assigned_to: taskForm.assignedTo,
        notes: taskForm.notes.trim() || undefined,
      });

      const updated = await api.getTasks();
      setTasks(updated);
      setEditingTask(null);
      showNotification('Task successfully updated.');
    } catch (err: any) {
    }
  };

  // Delete Task
  const handleDeleteTask = async (task: Task) => {
    if (window.confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      try {
        await api.deleteTask(task.id);
        const updated = await api.getTasks();
        setTasks(updated);
        showNotification('Task deleted.', 'info');
      } catch (err: any) {
        alert(`Error deleting task: ${err.message}`);
      }
    }
  };

  // Assistant status updates
  const handleUpdateStatus = async (task: Task, newStatus: TaskStatus) => {
    try {
      await api.updateTask(task.id, {
        status: newStatus,
        rework_comment: newStatus === 'in_progress' ? task.rework_comment : undefined,
      });
      const updated = await api.getTasks();
      setTasks(updated);
      showNotification(`Task status updated to ${newStatus.replace('_', ' ')}.`);
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Admin approval
  const handleApprove = async (task: Task) => {
    try {
      await api.updateTask(task.id, {
        status: 'approved',
        rework_comment: undefined,
      });
      const updated = await api.getTasks();
      setTasks(updated);
      showNotification(`Task "${task.title}" approved.`);
    } catch (err: any) {
      alert(`Error approving task: ${err.message}`);
    }
  };

  // Admin send back
  const handleOpenSendBack = (task: Task) => {
    setSendBackTask(task);
    setSendBackComment('');
  };

  const handleConfirmSendBack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendBackTask) return;

    try {
      await api.updateTask(sendBackTask.id, {
        status: 'in_progress',
        rework_comment: sendBackComment.trim() || 'Admin requested revisions.',
      });

      const updated = await api.getTasks();
      setTasks(updated);
      setSendBackTask(null);
      showNotification(`Task sent back to assistant with revision comments.`);
    } catch (err: any) {
      alert(`Error sending back task: ${err.message}`);
    }
  };

  // Move to Others Action (Section 7)
  const handleOpenMoveToOthers = (task: Task) => {
    setMoveOthersTask(task);
  };

  const handleConfirmMoveToOthers = async () => {
    if (!moveOthersTask) return;

    try {
      await api.moveToOthers(moveOthersTask.id);
      const updated = await api.getTasks();
      setTasks(updated);
      setMoveOthersTask(null);
      showNotification(`Task "${moveOthersTask.title}" moved to Others.`);
    } catch (err: any) {
      alert(`Error moving task to Others: ${err.message}`);
    }
  };

  // Rollover recurring tasks
  const handleRollover = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.rolloverRecurring(rolloverTargetMonth);
      const updated = await api.getTasks();
      setTasks(updated);
      setIsRolloverModalOpen(false);
      showNotification(
        result.createdCount > 0
          ? `Rolled over ${result.createdCount} recurring tasks to ${rolloverTargetMonth}.`
          : `All recurring tasks for ${rolloverTargetMonth} already exist.`
      );
    } catch (err: any) {
      alert(`Error during rollover: ${err.message}`);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Top Page Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="page-title">
              {activeClientTypeFilter ? `Tasks — ${activeClientTypeFilter}` : 'Tasks Management'}
            </h2>
            {activeClientTypeFilter && (
              <span className="active-filter-pill">{activeClientTypeFilter}</span>
            )}
          </div>
          <p className="page-subtitle">
            {activeClientTypeFilter
              ? `Filtered by ${activeClientTypeFilter} service compliance & assigned companies`
              : 'Centralized tracking, company grouping, and compliance approvals'}
          </p>
        </div>

        <div className="header-actions">
          {isAdmin && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsRolloverModalOpen(true)}
                title="Automatically generate recurring compliance tasks"
              >
                <RotateCw size={14} className="mr-1" />
                Rollover Recurring
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenAddModal}
              >
                <Plus size={14} className="mr-1" />
                Add Task
              </button>
            </>
          )}
        </div>
      </div>

      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <CheckCircle2 size={15} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Filter Toolbar (Due Date & Target Month filters removed per Section 8) */}
      <div className="filter-toolbar">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search task, client, assignee, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters-row">
          <div className="filter-select-group">
            <label className="filter-label" htmlFor="filter-client">
              Client
            </label>
            <select
              id="filter-client"
              className="filter-select"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="all">
                {activeClientTypeFilter
                  ? `All ${activeClientTypeFilter} Clients (${candidateClients.length})`
                  : `All Clients (${clients.length})`}
              </option>
              {candidateClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.client_types?.includes('Pending Tasks') ? '(Pending Tasks)' : ''}
                </option>
              ))}
              {(!activeClientTypeFilter || activeClientTypeFilter === 'Pending Tasks') && (
                <option value="__others__">Others (Moved Archive)</option>
              )}
            </select>
          </div>

          <div className="filter-select-group">
            <label className="filter-label" htmlFor="filter-assignee">
              Assigned To
            </label>
            <select
              id="filter-assignee"
              className="filter-select"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
            >
              <option value="all">All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-select-group">
            <label className="filter-label" htmlFor="filter-status">
              Status
            </label>
            <select
              id="filter-status"
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed (Needs Review)</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div className="filter-select-group" style={{ minWidth: '100px', maxWidth: '120px' }}>
            <label className="filter-label" htmlFor="filter-year">
              Year
            </label>
            <input
              id="filter-year"
              type="text"
              className="filter-select"
              style={{ height: '36px', padding: '0.4rem 0.6rem' }}
              placeholder="All Years"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              maxLength={4}
              list="year-suggestions"
            />
            <datalist id="year-suggestions">
              {availableYears.map((y) => (
                <option key={y} value={y} />
              ))}
            </datalist>
          </div>

          <div className="filter-select-group">
            <label className="filter-label" htmlFor="filter-month">
              Month
            </label>
            <select
              id="filter-month"
              className="filter-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">All Months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {(selectedClient !== 'all' ||
            selectedAssignee !== 'all' ||
            selectedStatus !== 'all' ||
            selectedYear !== '' ||
            selectedMonth !== 'all' ||
            searchQuery ||
            Boolean(activeClientTypeFilter)) && (
            <button
              type="button"
              className="btn btn-subtle btn-xs align-self-end mb-1"
              onClick={() => {
                setSearchQuery('');
                setSelectedClient('all');
                setSelectedAssignee('all');
                setSelectedStatus('all');
                setSelectedYear('');
                setSelectedMonth('all');
                if (onClearClientTypeFilter) onClearClientTypeFilter();
              }}
            >
              Reset Filters
            </button>
          )}

          <div className="expand-collapse-actions ml-auto">
            <button
              type="button"
              className="btn btn-subtle btn-xs"
              onClick={expandAll}
              title="Expand all client groups"
            >
              Expand All
            </button>
            <button
              type="button"
              className="btn btn-subtle btn-xs ml-1"
              onClick={collapseAll}
              title="Collapse all client groups"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Main Tasks Table (Grouped by Company/Client per Section 2) */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="business-table">
            <thead>
              <tr>
                <th style={{ width: '42%' }}>Task Name & Description</th>
                <th style={{ width: '15%' }}>Recurrence</th>
                <th style={{ width: '15%' }}>Assigned To</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-table-state">
                    Loading tasks and client groups from local SQLite database...
                  </td>
                </tr>
              ) : taskGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-table-state">
                    No tasks found matching the selected filters.
                  </td>
                </tr>
              ) : (
                taskGroups.map((group) => {
                  const isExpanded = isGroupExpanded(group.id);

                  return (
                    <React.Fragment key={`group-fragment-${group.id}`}>
                      {/* Top-Level Group Row (Company / Client / Others) */}
                      <tr
                        className={`client-group-row ${group.isOthers ? 'group-row-others' : ''} ${group.isPendingTasks ? 'group-row-pending' : ''}`}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <td colSpan={5} className="client-group-cell">
                          <div className="client-group-header-flex">
                            <div className="client-group-title-group">
                              <span className="client-group-chevron">
                                {isExpanded ? (
                                  <ChevronDown size={14} className="text-slate-700" />
                                ) : (
                                  <ChevronRight size={14} className="text-slate-700" />
                                )}
                              </span>
                              <span className="client-group-name font-semibold text-slate-800">
                                {group.name}
                              </span>

                              {/* Client type badges */}
                              {group.clientTypes && group.clientTypes.length > 0 && (
                                <div className="client-group-tags">
                                  {group.clientTypes.map((t) => (
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

                            <div className="client-group-meta-right">
                              <span className="client-group-count-pill font-mono">
                                {group.tasks.length} {group.tasks.length === 1 ? 'Task' : 'Tasks'}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Task Rows */}
                      {isExpanded && group.tasks.length === 0 && (
                        <tr className="empty-subgroup-row">
                          <td colSpan={5} className="empty-subgroup-cell text-slate-500">
                            No tasks in this group matching active filters.
                          </td>
                        </tr>
                      )}

                      {isExpanded &&
                        group.tasks.map((task) => {
                          const assignee = users.find((u) => u.id === task.assigned_to);
                          const isAssignedToCurrent = currentUser?.id === task.assigned_to;
                          const hasReworkComment = Boolean(task.rework_comment);

                          // Check if task belongs to a Pending Tasks client
                          const isPendingTaskClient = group.isPendingTasks;

                          return (
                            <tr
                              key={task.id}
                              className={`task-sub-row ${hasReworkComment ? 'row-has-feedback' : ''}`}
                            >
                              {/* Task Details */}
                              <td className="task-sub-cell-name">
                                <div className="task-title-group">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="task-cell-title font-medium">
                                      {task.title}
                                    </span>
                                    {task.category && (
                                      <span className={`task-cat-badge cat-${task.category.toLowerCase().replace(/\s+/g, '-')}`}>
                                        {task.category}
                                      </span>
                                    )}
                                  </div>
                                  {task.notes && (
                                    <div className="cell-subtext">{task.notes}</div>
                                  )}
                                  {hasReworkComment && (
                                    <div className="task-rework-banner">
                                      <CornerDownLeft size={11} className="flex-shrink-0" />
                                      <span>
                                        <strong>Revision comment:</strong> {task.rework_comment}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Task Type / Recurrence */}
                              <td>
                                {task.task_type === 'recurring_monthly' && (
                                  <span className="type-badge recurring" title="Monthly recurring task">
                                    Monthly {task.month && <span className="opacity-75 font-mono">({task.month})</span>}
                                  </span>
                                )}
                                {task.task_type === 'recurring_quarterly' && (
                                  <span className="type-badge recurring quarterly" title="Quarterly recurring task (every 3 months)">
                                    Quarterly {task.month && <span className="opacity-75 font-mono">({task.month})</span>}
                                  </span>
                                )}
                                {task.task_type === 'one_time' && (
                                  <span className="type-badge one-time">One-Time</span>
                                )}
                              </td>

                              {/* Assigned To */}
                              <td>
                                <div className="assignee-cell-name">
                                  {assignee ? assignee.name : 'Unassigned'}
                                </div>
                                {isAssignedToCurrent && (
                                  <span className="self-tag">(You)</span>
                                )}
                              </td>

                              {/* Status */}
                              <td>
                                <StatusBadge status={task.status} />
                              </td>

                              {/* Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="action-button-group">
                                  {/* Assistant progression: To Do -> In Progress -> Completed */}
                                  {isAssistant && isAssignedToCurrent && (
                                    <>
                                      {task.status === 'todo' && (
                                        <button
                                          type="button"
                                          className="btn btn-action-start"
                                          onClick={() => handleUpdateStatus(task, 'in_progress')}
                                          title="Begin work on this task"
                                        >
                                          Start
                                        </button>
                                      )}

                                      {task.status === 'in_progress' && (
                                        <button
                                          type="button"
                                          className="btn btn-action-complete"
                                          onClick={() => handleUpdateStatus(task, 'completed')}
                                          title="Mark task as completed for Admin review"
                                        >
                                          Mark Done
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {/* Admin Review: Approve / Send Back */}
                                  {isAdmin && task.status === 'completed' && (
                                    <div className="admin-review-actions">
                                      <button
                                        type="button"
                                        className="btn btn-action-approve"
                                        onClick={() => handleApprove(task)}
                                        title="Approve completed task"
                                      >
                                        <Check size={12} className="mr-0.5" />
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-action-sendback"
                                        onClick={() => handleOpenSendBack(task)}
                                        title="Send task back for revisions"
                                      >
                                        <CornerDownLeft size={12} className="mr-0.5" />
                                        Send Back
                                      </button>
                                    </div>
                                  )}

                                  {/* Section 6 & 7: Admin-Only "Move to Others" button for Approved Pending Tasks */}
                                  {isAdmin && isPendingTaskClient && task.status === 'approved' && !task.in_others && (
                                    <button
                                      type="button"
                                      className="btn btn-action-move-others"
                                      onClick={() => handleOpenMoveToOthers(task)}
                                      title="Move this approved task to Others"
                                    >
                                      <Archive size={12} className="mr-1" />
                                      Move to Others
                                    </button>
                                  )}

                                  {/* Admin management actions (Quick status select, Edit & Delete) */}
                                  {isAdmin && (
                                    <div className="admin-crud-actions">
                                      {task.status !== 'completed' && !group.isOthers && (
                                        <select
                                          className="table-mini-status-select"
                                          value={task.status}
                                          onChange={(e) =>
                                            handleUpdateStatus(task, e.target.value as TaskStatus)
                                          }
                                          title="Quick status update"
                                        >
                                          <option value="todo">To Do</option>
                                          <option value="in_progress">In Progress</option>
                                          <option value="completed">Completed</option>
                                          <option value="approved">Approved</option>
                                        </select>
                                      )}

                                      <button
                                        type="button"
                                        className="icon-action-btn"
                                        onClick={() => handleOpenEdit(task)}
                                        title="Edit Task"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-action-btn delete-btn"
                                        onClick={() => handleDeleteTask(task)}
                                        title="Delete Task"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Bar */}
        <div className="table-footer-summary">
          <span>
            Showing <strong>{taskGroups.length}</strong> client groups (<strong>{totalVisibleTasks}</strong> total tasks)
          </span>
          <div className="summary-status-counts">
            <span className="summary-pill todo">
              To Do: {tasks.filter((t) => t.status === 'todo').length}
            </span>
            <span className="summary-pill in_progress">
              In Progress: {tasks.filter((t) => t.status === 'in_progress').length}
            </span>
            <span className="summary-pill completed">
              Review: {tasks.filter((t) => t.status === 'completed').length}
            </span>
            <span className="summary-pill approved">
              Approved: {tasks.filter((t) => t.status === 'approved').length}
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Add Task (Admin) - Due Date and Target Month completely removed per Section 1 */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Task"
      >
        <form onSubmit={handleCreateTask} className="compact-form">
          <div className="form-group">
            <label className="form-label" htmlFor="task-client">
              Client / Company <span className="text-required">*</span>
            </label>
            <select
              id="task-client"
              className="form-input"
              value={taskForm.clientId}
              onChange={(e) => {
                const newClientId = e.target.value;
                const clientObj = clients.find((c) => c.id === newClientId);
                const clientCats = clientObj?.client_types?.length ? clientObj.client_types : ['GST'];
                const newCat = clientCats.includes(taskForm.category) ? taskForm.category : clientCats[0];
                setTaskForm({ ...taskForm, clientId: newClientId, category: newCat });
              }}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.client_types?.includes('Pending Tasks') ? '(Pending Tasks)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-category">
              Task Category <span className="text-required">*</span>
            </label>
            <select
              id="task-category"
              className="form-input"
              value={taskForm.category}
              onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
              required
            >
              {availableCategoriesForForm.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-title">
              Task Name <span className="text-required">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              className="form-input"
              placeholder="e.g. Monthly GST Filing or Statutory Scrutiny"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="task-type">
                Task Type
              </label>
              <select
                id="task-type"
                className="form-input"
                value={taskForm.taskType}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, taskType: e.target.value as TaskType })
                }
              >
                <option value="one_time">One-Time</option>
                <option value="recurring_monthly">Recurring (Monthly)</option>
                <option value="recurring_quarterly">Recurring (Quarterly)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-assigned">
                Assigned To <span className="text-required">*</span>
              </label>
              <select
                id="task-assigned"
                className="form-input"
                value={taskForm.assignedTo}
                onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                required
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-notes">
              Notes / Instructions
            </label>
            <textarea
              id="task-notes"
              className="form-input form-textarea"
              rows={3}
              placeholder="Add relevant instructions, sections, or compliance checklist..."
              value={taskForm.notes}
              onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
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
              Create Task
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Task (Admin) */}
      <Modal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        title="Edit Task Details"
      >
        <form onSubmit={handleUpdateTask} className="compact-form">
          <div className="form-group">
            <label className="form-label" htmlFor="edit-task-client">
              Client / Company
            </label>
            <select
              id="edit-task-client"
              className="form-input"
              value={taskForm.clientId}
              onChange={(e) => {
                const newClientId = e.target.value;
                const clientObj = clients.find((c) => c.id === newClientId);
                const clientCats = clientObj?.client_types?.length ? clientObj.client_types : ['GST'];
                const newCat = clientCats.includes(taskForm.category) ? taskForm.category : clientCats[0];
                setTaskForm({ ...taskForm, clientId: newClientId, category: newCat });
              }}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-task-category">
              Task Category <span className="text-required">*</span>
            </label>
            <select
              id="edit-task-category"
              className="form-input"
              value={taskForm.category}
              onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
              required
            >
              {availableCategoriesForForm.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-task-title">
              Task Name
            </label>
            <input
              id="edit-task-title"
              type="text"
              className="form-input"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-task-type">
                Task Type
              </label>
              <select
                id="edit-task-type"
                className="form-input"
                value={taskForm.taskType}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, taskType: e.target.value as TaskType })
                }
              >
                <option value="one_time">One-Time</option>
                <option value="recurring_monthly">Recurring (Monthly)</option>
                <option value="recurring_quarterly">Recurring (Quarterly)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-task-assigned">
                Assigned To
              </label>
              <select
                id="edit-task-assigned"
                className="form-input"
                value={taskForm.assignedTo}
                onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                required
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-task-notes">
              Notes
            </label>
            <textarea
              id="edit-task-notes"
              className="form-input form-textarea"
              rows={3}
              value={taskForm.notes}
              onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditingTask(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Move to Others Confirmation (Section 7) */}
      <Modal
        isOpen={Boolean(moveOthersTask)}
        onClose={() => setMoveOthersTask(null)}
        title="Move to Others"
      >
        <div className="compact-form">
          <p className="confirm-question-title font-semibold text-slate-800 mb-2">
            Move this approved task to Others?
          </p>
          <p className="modal-helper-text mb-3">
            This will archive the task under the <strong>Others</strong> category and keep the active Pending Tasks section clean. All details and approved status will be preserved.
          </p>

          {moveOthersTask && (
            <div className="task-preview-box mb-4">
              <div className="font-semibold text-slate-800 text-sm">{moveOthersTask.title}</div>
              <div className="text-xs text-slate-500 mt-1">
                Status: <span className="text-emerald-700 font-medium">Approved</span>
              </div>
            </div>
          )}

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setMoveOthersTask(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleConfirmMoveToOthers}
            >
              Move
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Send Back for Rework (Admin) */}
      <Modal
        isOpen={Boolean(sendBackTask)}
        onClose={() => setSendBackTask(null)}
        title="Send Task Back for Rework"
      >
        <form onSubmit={handleConfirmSendBack} className="compact-form">
          <p className="modal-helper-text">
            Task <strong>"{sendBackTask?.title}"</strong> will be reverted to{' '}
            <span className="text-amber-800 font-medium">In Progress</span>. Please specify the
            modifications or missing details needed.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="sendback-comment">
              Feedback / Rework Notes <span className="text-required">*</span>
            </label>
            <textarea
              id="sendback-comment"
              className="form-input form-textarea"
              rows={3}
              placeholder="e.g. Please verify Challan 280 BSR code against Bank statement before approval."
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSendBackTask(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-warning btn-sm">
              Send Back Task
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Rollover Recurring Tasks */}
      <Modal
        isOpen={isRolloverModalOpen}
        onClose={() => setIsRolloverModalOpen(false)}
        title="Rollover Recurring Tasks"
      >
        <form onSubmit={handleRollover} className="compact-form">
          <p className="modal-helper-text">
            This will ensure that all recurring compliance tasks exist up to the specified target
            month with independent statuses.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="rollover-month">
              Target Month (YYYY-MM) <span className="text-required">*</span>
            </label>
            <input
              id="rollover-month"
              type="text"
              className="form-input font-mono"
              placeholder="2026-11"
              value={rolloverTargetMonth}
              onChange={(e) => setRolloverTargetMonth(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsRolloverModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Generate Tasks
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
