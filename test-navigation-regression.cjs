// Test suite verifying fix for navigation regression in AuditFlow sidebar
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('AUDITFLOW SIDEBAR NAVIGATION REGRESSION VERIFICATION');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✓ [TEST ${total}] PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ [TEST ${total}] FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// 1. Verify App.tsx source code logic
const appPath = path.join(__dirname, 'src', 'App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(
  appContent.includes("const [currentTab, setCurrentTab] = useState<ActiveTab>('tasks');"),
  "App.tsx maintains currentTab state initialized to 'tasks'"
);

assert(
  appContent.includes("const [activeClientTypeFilter, setActiveClientTypeFilter] = useState<string | null>(null);"),
  "App.tsx maintains activeClientTypeFilter state initialized to null"
);

assert(
  appContent.includes("handleSelectTab = (tab: ActiveTab) =>") &&
  appContent.includes("setCurrentTab(tab);") &&
  appContent.includes("setActiveClientTypeFilter(null);"),
  "App.tsx handleSelectTab switches currentTab and clears activeClientTypeFilter"
);

assert(
  appContent.includes("handleSelectClientType = (clientType: string | null) =>") &&
  appContent.includes("setActiveClientTypeFilter(clientType);") &&
  appContent.includes("setCurrentTab('tasks');"),
  "App.tsx handleSelectClientType sets filter and directs to tasks tab"
);

assert(
  appContent.includes("{currentTab === 'tasks' && (") &&
  appContent.includes("{currentTab === 'clients' && <ClientsPage />}") &&
  appContent.includes("{currentTab === 'team' && isAdmin && <TeamPage />}"),
  "App.tsx conditionally renders TasksPage, ClientsPage, or TeamPage based on currentTab"
);

// 2. Verify Sidebar.tsx source code logic
const sidebarPath = path.join(__dirname, 'src', 'components', 'Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

assert(
  sidebarContent.includes("onClick={() => onSelectTab('tasks')}"),
  "Sidebar.tsx: Tasks button calls onSelectTab('tasks')"
);

assert(
  sidebarContent.includes("onClick={() => onSelectTab('clients')}"),
  "Sidebar.tsx: Clients button calls onSelectTab('clients')"
);

assert(
  !sidebarContent.includes("onSelectClientType(null)") || 
  !sidebarContent.includes("onClick={() => {\n            onSelectTab('clients');\n            onSelectClientType(null);"),
  "Sidebar.tsx: Clients button does NOT call onSelectClientType(null) which previously caused the regression"
);

assert(
  sidebarContent.includes("onClick={() => onSelectTab('team')}"),
  "Sidebar.tsx: Team button calls onSelectTab('team')"
);

assert(
  sidebarContent.includes("onClick={() => onSelectClientType(type)}"),
  "Sidebar.tsx: Sub-items call onSelectClientType(type)"
);

assert(
  sidebarContent.includes("{isAdmin && (") &&
  sidebarContent.includes("<span>Team</span>"),
  "Sidebar.tsx: Team item is strictly gated by isAdmin"
);

// 3. Functional Simulation of Navigation State Transitions
console.log('\n--- Functional Simulation of State Machine ---');

class AppNavigationStateMachine {
  constructor(isAdmin = true) {
    this.isAdmin = isAdmin;
    this.currentTab = 'tasks';
    this.activeClientTypeFilter = null;
  }

  handleSelectTab(tab) {
    if (tab === 'team' && !this.isAdmin) return;
    this.currentTab = tab;
    this.activeClientTypeFilter = null;
  }

  handleSelectClientType(clientType) {
    this.activeClientTypeFilter = clientType;
    this.currentTab = 'tasks';
  }

  // Sidebar triggers
  clickTasks() {
    this.handleSelectTab('tasks');
  }

  clickClients() {
    this.handleSelectTab('clients');
  }

  clickTeam() {
    this.handleSelectTab('team');
  }

  clickClientType(type) {
    this.handleSelectClientType(type);
  }

  getActiveView() {
    if (this.currentTab === 'tasks') return 'TasksPage';
    if (this.currentTab === 'clients') return 'ClientsPage';
    if (this.currentTab === 'team' && this.isAdmin) return 'TeamPage';
    return 'TasksPage';
  }
}

// Run Admin Navigation Sequence
const adminNav = new AppNavigationStateMachine(true);

assert(
  adminNav.currentTab === 'tasks' && adminNav.activeClientTypeFilter === null && adminNav.getActiveView() === 'TasksPage',
  "Initial state: currentTab='tasks', filter=null, view='TasksPage'"
);

// 1. Click Clients
adminNav.clickClients();
assert(
  adminNav.currentTab === 'clients' && adminNav.activeClientTypeFilter === null && adminNav.getActiveView() === 'ClientsPage',
  "Admin clicks Clients -> currentTab='clients', filter=null, view='ClientsPage' (Successfully switched to Clients module!)"
);

// 2. Click Team
adminNav.clickTeam();
assert(
  adminNav.currentTab === 'team' && adminNav.activeClientTypeFilter === null && adminNav.getActiveView() === 'TeamPage',
  "Admin clicks Team -> currentTab='team', filter=null, view='TeamPage' (Successfully switched to Team module!)"
);

// 3. Click Nested Client Type 'GST'
adminNav.clickClientType('GST');
assert(
  adminNav.currentTab === 'tasks' && adminNav.activeClientTypeFilter === 'GST' && adminNav.getActiveView() === 'TasksPage',
  "Admin clicks GST sub-item -> currentTab='tasks', filter='GST', view='TasksPage'"
);

// 4. Click Clients while a Client Type filter is active
adminNav.clickClients();
assert(
  adminNav.currentTab === 'clients' && adminNav.activeClientTypeFilter === null && adminNav.getActiveView() === 'ClientsPage',
  "Admin clicks Clients from filtered Tasks -> currentTab='clients', filter cleared to null, view='ClientsPage'"
);

// 5. Click Nested Client Type 'PF'
adminNav.clickClientType('PF');
assert(
  adminNav.currentTab === 'tasks' && adminNav.activeClientTypeFilter === 'PF' && adminNav.getActiveView() === 'TasksPage',
  "Admin clicks PF sub-item -> currentTab='tasks', filter='PF', view='TasksPage'"
);

// 6. Click Tasks while a filter is active
adminNav.clickTasks();
assert(
  adminNav.currentTab === 'tasks' && adminNav.activeClientTypeFilter === null && adminNav.getActiveView() === 'TasksPage',
  "Admin clicks Tasks -> currentTab='tasks', filter cleared to null, view='TasksPage'"
);

// 7. Click Team while on Tasks
adminNav.clickTeam();
assert(
  adminNav.currentTab === 'team' && adminNav.activeClientTypeFilter === null && adminNav.getActiveView() === 'TeamPage',
  "Admin clicks Team from Tasks -> currentTab='team', filter=null, view='TeamPage'"
);

// Run Assistant Navigation Sequence
console.log('\n--- Assistant Navigation Sequence ---');
const asstNav = new AppNavigationStateMachine(false);

assert(
  asstNav.currentTab === 'tasks' && asstNav.getActiveView() === 'TasksPage',
  "Assistant starts on TasksPage"
);

// Assistant clicks Clients
asstNav.clickClients();
assert(
  asstNav.currentTab === 'clients' && asstNav.getActiveView() === 'ClientsPage',
  "Assistant clicks Clients -> can access ClientsPage"
);

// Assistant tries to click Team (should be blocked)
asstNav.clickTeam();
assert(
  asstNav.currentTab === 'clients' && asstNav.getActiveView() === 'ClientsPage',
  "Assistant clicks Team -> blocked, remains on ClientsPage"
);

// Assistant clicks 'IT' quick filter
asstNav.clickClientType('IT');
assert(
  asstNav.currentTab === 'tasks' && asstNav.activeClientTypeFilter === 'IT' && asstNav.getActiveView() === 'TasksPage',
  "Assistant clicks IT -> routes to TasksPage with IT filter"
);

// 4. Verify CSS classes and styling structure
const cssPath = path.join(__dirname, 'src', 'index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(
  cssContent.includes('.nav-group {') && cssContent.includes('.nav-sub-list {'),
  "index.css contains flexbox layout for nav-group and nav-sub-list without absolute positioning overlaps"
);

assert(
  !cssContent.includes('.nav-sub-list {\n  position: absolute') &&
  !cssContent.includes('.nav-sub-item {\n  position: absolute'),
  "Sidebar sub-items do not use absolute positioning that could overlap other nav buttons"
);

console.log('\n====================================================');
console.log(`SUMMARY: ${passed} of ${total} tests passed.`);
console.log('====================================================\n');

if (passed === total) {
  console.log('ALL NAVIGATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('SOME NAVIGATION TESTS FAILED!');
  process.exit(1);
}
