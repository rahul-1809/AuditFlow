import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { TasksPage } from './pages/TasksPage';
import { ClientsPage } from './pages/ClientsPage';
import { TeamPage } from './pages/TeamPage';
import { Sidebar } from './components/Sidebar';

type ActiveTab = 'tasks' | 'clients' | 'team';

const MainApp: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<ActiveTab>('tasks');
  const [activeClientTypeFilter, setActiveClientTypeFilter] = useState<string | null>(null);

  // Ensure non-admins cannot stay on team tab
  useEffect(() => {
    if (!isAdmin && currentTab === 'team') {
      setCurrentTab('tasks');
    }
  }, [isAdmin, currentTab]);

  if (!currentUser) {
    return <LoginPage />;
  }

  const handleSelectTab = (tab: ActiveTab) => {
    if (tab === 'team' && !isAdmin) return;
    setCurrentTab(tab);
    setActiveClientTypeFilter(null);
  };

  const handleSelectClientType = (clientType: string | null) => {
    setActiveClientTypeFilter(clientType);
    setCurrentTab('tasks');
  };

  return (
    <div className="app-layout-root">
      <Sidebar
        currentTab={currentTab}
        activeClientTypeFilter={activeClientTypeFilter}
        onSelectTab={handleSelectTab}
        onSelectClientType={handleSelectClientType}
      />
      <main className="app-main-viewport">
        {currentTab === 'tasks' && (
          <TasksPage
            activeClientTypeFilter={activeClientTypeFilter}
            onClearClientTypeFilter={() => setActiveClientTypeFilter(null)}
          />
        )}
        {currentTab === 'clients' && <ClientsPage />}
        {currentTab === 'team' && isAdmin && <TeamPage />}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
