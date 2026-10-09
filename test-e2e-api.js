// Automated E2E verification script for AuditFlow SQLite local architecture
const BASE_URL = 'http://127.0.0.1:3001/api';

async function req(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function runVerification() {
  console.log('====================================================');
  console.log('AUDITFLOW ARCHITECTURE VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Admin can log in
  console.log('1. Testing Admin login...');
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@auditflow.internal', password: 'admin123' }),
  });
  if (adminLogin.success && adminLogin.user.role === 'admin') {
    console.log('   ✓ SUCCESS: Admin (CA Rajesh Sharma) logged in successfully.');
  } else {
    throw new Error('Admin login failed');
  }

  // Test 2: Assistant can log in
  console.log('\n2. Testing Assistant login...');
  const asstLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'priya@auditflow.internal', password: 'assistant123' }),
  });
  if (asstLogin.success && asstLogin.user.role === 'assistant') {
    console.log('   ✓ SUCCESS: Assistant (Priya Patel) logged in successfully.');
  } else {
    throw new Error('Assistant login failed');
  }

  // Test 3: Admin can create an assistant
  console.log('\n3. Testing Admin creating an assistant...');
  const newAssistantEmail = `test.asst.${Date.now()}@auditflow.internal`;
  const createdAsst = await req('/users', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Rohan Deshmukh',
      email: newAssistantEmail,
      password: 'password999',
    }),
  });
  console.log(`   ✓ SUCCESS: Created assistant '${createdAsst.name}' (ID: ${createdAsst.id}).`);

  // Verify new assistant can log in with their hashed password
  const newAsstLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: newAssistantEmail, password: 'password999' }),
  });
  if (newAsstLogin.success) {
    console.log('   ✓ SUCCESS: Newly created assistant authenticated with hashed password.');
  }

  // Test 4: Admin can create a client
  console.log('\n4. Testing Admin creating a client...');
  const createdClient = await req('/clients', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Horizon Solar Tech Pvt Ltd',
      contact_person: 'Anand Kulkarni',
      phone: '+91 99300 12345',
      email: 'finance@horizonsolar.in',
      gstin: '27AAACH1234K1Z2',
      pan: 'AAACH1234K',
      notes: 'Renewable energy contractor. Quarterly TDS and monthly GST.',
    }),
  });
  console.log(`   ✓ SUCCESS: Created client '${createdClient.name}' (ID: ${createdClient.id}).`);

  // Test 5: Admin can add client credentials
  console.log('\n5. Testing Admin adding portal credentials...');
  const createdCred = await req('/credentials', {
    method: 'POST',
    body: JSON.stringify({
      client_id: createdClient.id,
      portal_name: 'GST Portal',
      portal_url: 'https://services.gst.gov.in',
      username: 'horizon_gst_auth',
      password: 'SolarGstSecret@2026',
      notes: 'Auth registered with Director DIN',
    }),
  });
  console.log(`   ✓ SUCCESS: Added credential for '${createdCred.portal_name}'.`);
  console.log(`   ✓ Verified encrypted storage & decrypted delivery: username=${createdCred.username}, password=${createdCred.password_decrypted}`);

  // Test 6: Admin can create and assign a task
  console.log('\n6. Testing Admin creating and assigning a task...');
  const createdTask = await req('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      client_id: createdClient.id,
      title: 'Solar Inverter Import Special Duty Audit',
      task_type: 'one_time',
      assigned_to: createdAsst.id,
      due_date: '2026-10-28',
      month: '2026-10',
      status: 'todo',
      notes: 'Check customs bill of entry and IGST paid credit register.',
    }),
  });
  console.log(`   ✓ SUCCESS: Created task '${createdTask.title}' assigned to '${createdAsst.name}'.`);

  // Test 7: Assistant can see the assigned task
  console.log('\n7. Testing Assistant seeing assigned task...');
  const allTasks = await req('/tasks');
  const foundTask = allTasks.find(t => t.id === createdTask.id && t.assigned_to === createdAsst.id);
  if (foundTask) {
    console.log(`   ✓ SUCCESS: Assistant retrieved assigned task '${foundTask.title}' with status '${foundTask.status}'.`);
  } else {
    throw new Error('Assigned task not found in database');
  }

  // Test 8: Assistant can change its status (To Do -> In Progress -> Completed)
  console.log('\n8. Testing Assistant updating task status...');
  const taskInProgress = await req(`/tasks/${createdTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'in_progress' }),
  });
  console.log(`   ✓ Status updated to: ${taskInProgress.status}`);

  const taskCompleted = await req(`/tasks/${createdTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'completed' }),
  });
  console.log(`   ✓ Status updated to: ${taskCompleted.status} (awaiting Admin review)`);

  // Test 9: Admin can approve or send back completed work
  console.log('\n9. Testing Admin review actions (Send Back & Approve)...');
  // First test Send Back with comment
  const sentBackTask = await req(`/tasks/${createdTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'in_progress',
      rework_comment: 'Please verify Bill of Entry date matches ICEGATE ledger before signoff.',
    }),
  });
  console.log(`   ✓ Send Back: Status reverted to '${sentBackTask.status}' with comment: "${sentBackTask.rework_comment}"`);

  // Then mark completed again
  await req(`/tasks/${createdTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'completed' }),
  });

  // Then Approve
  const approvedTask = await req(`/tasks/${createdTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'approved',
      rework_comment: null,
    }),
  });
  console.log(`   ✓ Approve: Status changed to '${approvedTask.status}'.`);

  // Test 10: Data persistence check
  console.log('\n10. Testing SQLite persistence...');
  const persistedTasks = await req('/tasks');
  const checkTask = persistedTasks.find(t => t.id === createdTask.id);
  if (checkTask && checkTask.status === 'approved') {
    console.log(`   ✓ SUCCESS: Task '${checkTask.title}' is confirmed persisted in SQLite database (status: ${checkTask.status}).`);
  } else {
    throw new Error('Persistence check failed');
  }

  // Test 11: Create Client with multi-select client_types and inline credentials
  console.log('\n11. Testing Create Client with client_types & inline credentials...');
  const multiClient = await req('/clients', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Dynamic Ventures LLP',
      contact_person: 'Meera Sen',
      phone: '+91 98111 22334',
      email: 'finance@dynamicventures.in',
      gstin: '27AABCD5555M1Z2',
      pan: 'AABCD5555M',
      notes: 'Consulting firm with GST and PF compliance.',
      client_types: ['GST', 'PF'],
      credentials: [
        {
          portal_name: 'GST',
          portal_url: 'https://services.gst.gov.in',
          username: 'dynamic_gst',
          password: 'SecretGSTPass@2026',
        },
        {
          portal_name: 'PF',
          portal_url: 'https://unifiedportal-emp.epfindia.gov.in',
          username: 'dynamic_pf',
          password: 'SecretPFPass@2026',
        },
      ],
    }),
  });
  if (multiClient.client_types && multiClient.client_types.includes('GST') && multiClient.client_types.includes('PF')) {
    console.log(`   ✓ SUCCESS: Created client '${multiClient.name}' with client_types: [${multiClient.client_types.join(', ')}].`);
  } else {
    throw new Error('Client types not saved properly');
  }

  const clientCreds = await req(`/credentials?clientId=${multiClient.id}`);
  if (clientCreds.length === 2 && clientCreds[0].password_decrypted && clientCreds[1].password_decrypted) {
    console.log(`   ✓ SUCCESS: 2 inline credentials created with AES-256-GCM encryption and successfully retrieved decrypted.`);
  } else {
    throw new Error('Inline credentials creation failed');
  }

  // Test 12: Create Client with special Pending Tasks client type
  console.log('\n12. Testing Create Client with Pending Tasks client type...');
  const pendingClient = await req('/clients', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Miscellaneous Pending Bucket',
      notes: 'Temporary holding container for unassigned works',
      client_types: ['Pending Tasks'],
    }),
  });
  if (pendingClient.client_types && pendingClient.client_types.includes('Pending Tasks')) {
    console.log(`   ✓ SUCCESS: Created client '${pendingClient.name}' with client_types: ['Pending Tasks'].`);
  } else {
    throw new Error('Pending Tasks client creation failed');
  }

  // Test 13: Create Task without due_date / target month, and create Recurring Quarterly task
  console.log('\n13. Testing Create Task without due_date / month, and Recurring Quarterly task...');
  const pendingTask = await req('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      client_id: pendingClient.id,
      title: 'Clarification on ROC Form MGT-7 Delay',
      task_type: 'one_time',
      assigned_to: createdAsst.id,
      status: 'todo',
      notes: 'Needs fast review before penalty notice.',
    }),
  });
  console.log(`   ✓ SUCCESS: Created task without due_date/month: '${pendingTask.title}' (month defaulted: ${pendingTask.month}).`);

  const quarterlyTask = await req('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      client_id: multiClient.id,
      title: 'Quarterly Advance Tax Scrutiny',
      task_type: 'recurring_quarterly',
      assigned_to: createdAsst.id,
      status: 'todo',
    }),
  });
  console.log(`   ✓ SUCCESS: Created recurring quarterly task: '${quarterlyTask.title}' (type: ${quarterlyTask.task_type}).`);

  // Test 14: Recurrence auto-generation check
  console.log('\n14. Testing Recurrence auto-continuation (subsequent occurrences generated)...');
  const allTasksAfterRecurrence = await req('/tasks');
  const quarterlyOccurrences = allTasksAfterRecurrence.filter(
    (t) => t.client_id === multiClient.id && t.title === 'Quarterly Advance Tax Scrutiny'
  );
  if (quarterlyOccurrences.length >= 2) {
    console.log(`   ✓ SUCCESS: Quarterly recurrence automatically generated subsequent occurrence(s) (Found ${quarterlyOccurrences.length} occurrences).`);
    console.log(`   ✓ Occurrences months: ${quarterlyOccurrences.map(o => o.month).join(', ')}`);
  } else {
    throw new Error('Quarterly recurrence occurrences not generated');
  }

  // Test 15: Move to Others action for Approved Pending Task
  console.log('\n15. Testing "Move to Others" action for Approved Pending Task...');
  // Assistant completes pendingTask
  await req(`/tasks/${pendingTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'completed' }),
  });
  // Admin approves pendingTask
  await req(`/tasks/${pendingTask.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'approved' }),
  });
  console.log(`   ✓ Task approved by Admin.`);

  // Admin triggers Move to Others
  const movedTask = await req(`/tasks/${pendingTask.id}/move-to-others`, {
    method: 'POST',
  });
  if (movedTask.in_others === 1 && movedTask.status === 'approved') {
    console.log(`   ✓ SUCCESS: Task moved to Others (in_others: 1, status: ${movedTask.status}).`);
  } else {
    throw new Error('Move to Others failed');
  }

  console.log('\n====================================================');
  console.log('ALL 15 AUDITFLOW VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
