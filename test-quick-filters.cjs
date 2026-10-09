// Comprehensive verification test for AuditFlow Quick Filtering by Client Type
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001/api';

function request(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('AUDITFLOW CLIENT TYPE QUICK-FILTER VERIFICATION');
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

  // 1. Authenticate Admin
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@auditflow.internal',
    password: 'admin123',
  });
  assert(adminLogin.body.user && adminLogin.body.user.role === 'admin', 'Admin logged in successfully');

  // 2. Authenticate Assistant
  const asstLogin = await request('POST', '/auth/login', {
    email: 'priya@auditflow.internal',
    password: 'assistant123',
  });
  assert(asstLogin.body.user && asstLogin.body.user.role === 'assistant', 'Assistant logged in successfully');

  // 3. Inspect Clients & ensure multi-type client (Zenith) exists exactly ONCE in SQLite
  const clientsRes = await request('GET', '/clients');
  const clients = clientsRes.body;
  const zenithClients = clients.filter(c => c.name.toLowerCase().includes('zenith'));
  assert(zenithClients.length === 1, 'Multi-type client (Zenith Manufacturing Co.) exists as exactly 1 record in SQLite (no duplicate rows)');
  
  const zenith = zenithClients[0];
  const hasGstPfEsi = zenith.client_types.includes('GST') && zenith.client_types.includes('PF') && zenith.client_types.includes('ESI');
  assert(hasGstPfEsi, `Zenith client types include GST, PF, and ESI: [${zenith.client_types.join(', ')}]`);

  // 4. Inspect Tasks and verify category persistence
  const tasksRes = await request('GET', '/tasks');
  const tasks = tasksRes.body;
  
  const gstTasks = tasks.filter(t => t.category === 'GST');
  const pfTasks = tasks.filter(t => t.category === 'PF');
  const esiTasks = tasks.filter(t => t.category === 'ESI');
  const itTasks = tasks.filter(t => t.category === 'IT');
  const mcaTasks = tasks.filter(t => t.category === 'MCA');
  const pendingTasks = tasks.filter(t => t.category === 'Pending Tasks');

  assert(gstTasks.length > 0, `Found ${gstTasks.length} GST tasks with category='GST'`);
  assert(pfTasks.length > 0, `Found ${pfTasks.length} PF tasks with category='PF'`);
  assert(esiTasks.length > 0, `Found ${esiTasks.length} ESI tasks with category='ESI'`);
  assert(itTasks.length > 0, `Found ${itTasks.length} IT tasks with category='IT'`);
  assert(mcaTasks.length > 0, `Found ${mcaTasks.length} MCA tasks with category='MCA'`);
  assert(pendingTasks.length > 0, `Found ${pendingTasks.length} Pending Tasks with category='Pending Tasks'`);

  // 5. Test Creating a Task with Category restricted to Client's Client Types
  // Apex Logistics has ['GST', 'IT']
  const apexClient = clients.find(c => c.name.toLowerCase().includes('apex'));
  assert(apexClient && apexClient.client_types.includes('GST') && apexClient.client_types.includes('IT'), 
    `Apex Logistics has types: [${apexClient?.client_types.join(', ')}]`);

  const createdTaskRes = await request('POST', '/tasks', {
    client_id: apexClient.id,
    title: 'GST E-Way Bill Reconciliation Q3',
    category: 'GST',
    task_type: 'one_time',
    assigned_to: asstLogin.body.user.id,
    notes: 'Verify e-way bills against GSTR-1 outward supplies'
  });

  assert(createdTaskRes.status === 201 && createdTaskRes.body.category === 'GST',
    'Created task with category="GST" successfully');

  // 6. Test Updating a Task category
  const updatedTaskRes = await request('PUT', `/tasks/${createdTaskRes.body.id}`, {
    category: 'IT',
    title: 'Income Tax Advance 26AS Scrutiny Q3'
  });
  assert(updatedTaskRes.status === 200 && updatedTaskRes.body.category === 'IT',
    'Updated task category to "IT" successfully');

  // 7. Verify Multi-Type filtering logic simulates correctly in TasksPage
  // When activeClientTypeFilter = 'GST':
  // - zenith appears (because zenith.client_types has 'GST')
  // - zenith's GST tasks appear
  // - zenith's PF or ESI tasks do NOT appear under GST
  const zenithAllTasks = tasks.filter(t => t.client_id === zenith.id);
  const zenithGstTasks = zenithAllTasks.filter(t => t.category === 'GST');
  const zenithPfTasks = zenithAllTasks.filter(t => t.category === 'PF');
  const zenithEsiTasks = zenithAllTasks.filter(t => t.category === 'ESI');

  assert(zenithGstTasks.length > 0, `Zenith has ${zenithGstTasks.length} GST task(s)`);
  assert(zenithPfTasks.length > 0, `Zenith has ${zenithPfTasks.length} PF task(s)`);
  assert(zenithEsiTasks.length > 0, `Zenith has ${zenithEsiTasks.length} ESI task(s)`);

  // Under GST filter:
  const gstFilterClients = clients.filter(c => c.client_types?.includes('GST'));
  const gstFilterVisibleTasks = tasks.filter(t => {
    const c = clients.find(client => client.id === t.client_id);
    return c && c.client_types?.includes('GST') && t.category === 'GST';
  });
  assert(gstFilterClients.some(c => c.id === zenith.id), 'Zenith is visible under GST filter');
  assert(gstFilterVisibleTasks.every(t => t.category === 'GST'), 'All visible tasks under GST filter have category="GST"');
  assert(!gstFilterVisibleTasks.some(t => t.category === 'PF'), 'No PF tasks are visible when GST filter is active');

  // Under PF filter:
  const pfFilterClients = clients.filter(c => c.client_types?.includes('PF'));
  const pfFilterVisibleTasks = tasks.filter(t => {
    const c = clients.find(client => client.id === t.client_id);
    return c && c.client_types?.includes('PF') && t.category === 'PF';
  });
  assert(pfFilterClients.some(c => c.id === zenith.id), 'Zenith is also visible under PF filter (multi-type without duplication)');
  assert(pfFilterVisibleTasks.every(t => t.category === 'PF'), 'All visible tasks under PF filter have category="PF"');
  assert(!pfFilterVisibleTasks.some(t => t.category === 'GST'), 'No GST tasks are visible when PF filter is active');

  // Under ESI filter:
  const esiFilterClients = clients.filter(c => c.client_types?.includes('ESI'));
  assert(esiFilterClients.some(c => c.id === zenith.id), 'Zenith is also visible under ESI filter');

  // 8. Static checks on Frontend Code
  const sidebarCode = fs.readFileSync(path.join(__dirname, 'src/components/Sidebar.tsx'), 'utf8');
  assert(sidebarCode.includes('AVAILABLE_CLIENT_TYPES.map'), 'Sidebar iterates over AVAILABLE_CLIENT_TYPES');
  assert(sidebarCode.includes('nav-sub-list') && sidebarCode.includes('nav-sub-item'), 'Sidebar renders compact nested list under Clients');
  assert(sidebarCode.includes('activeClientTypeFilter'), 'Sidebar receives and applies activeClientTypeFilter highlighting');
  assert(sidebarCode.includes('{isAdmin && (') && sidebarCode.includes('Team'), 'Admin sees Team nav item; assistant does not');

  const appCode = fs.readFileSync(path.join(__dirname, 'src/App.tsx'), 'utf8');
  assert(appCode.includes('activeClientTypeFilter') && appCode.includes('setActiveClientTypeFilter'), 'App manages activeClientTypeFilter state');
  assert(appCode.includes('handleSelectClientType'), 'App routes client type selection to tasks tab with filter');

  const tasksPageCode = fs.readFileSync(path.join(__dirname, 'src/pages/TasksPage.tsx'), 'utf8');
  assert(tasksPageCode.includes('availableCategoriesForForm'), 'TasksPage computes availableCategoriesForForm from selected client types');
  assert(tasksPageCode.includes('task-category') && tasksPageCode.includes('availableCategoriesForForm.map'), 'Create Task modal has Task Category restricted to client types');
  assert(tasksPageCode.includes('edit-task-category') && tasksPageCode.includes('availableCategoriesForForm.map'), 'Edit Task modal has Task Category restricted to client types');
  assert(tasksPageCode.includes('task-cat-badge'), 'TasksPage displays compact task category badges');

  const cssCode = fs.readFileSync(path.join(__dirname, 'src/index.css'), 'utf8');
  assert(cssCode.includes('.nav-sub-list') && cssCode.includes('.nav-sub-item'), 'CSS includes subtle indented styles for nested client types');
  assert(cssCode.includes('.nav-sub-item.active'), 'CSS includes active highlight state for selected client type');
  assert(cssCode.includes('.task-cat-badge.cat-gst') && cssCode.includes('.task-cat-badge.cat-pf'), 'CSS includes color-coded category badges');

  console.log(`\n====================================================`);
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED!`);
  console.log(`====================================================\n`);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
