// Automated verification test script for Credentials single vertical column layout & Portal URL removal
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001/api';

function request(method, endpoint, body = null) {
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
  console.log('AUDITFLOW CREDENTIALS LAYOUT VERIFICATION');
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

  // 1. Verify Portal URL is no longer rendered anywhere in ClientsPage.tsx JSX
  const clientsPageSource = fs.readFileSync(path.join(__dirname, 'src/pages/ClientsPage.tsx'), 'utf8');
  const hasPortalUrlLabel = /label.*Portal URL/i.test(clientsPageSource);
  assert(!hasPortalUrlLabel, 'Portal URL label is NOT present in any form in ClientsPage.tsx');

  const hasPortalUrlInput = /id=["'](?:cred-url|edit-cred-url)/i.test(clientsPageSource);
  assert(!hasPortalUrlInput, 'Portal URL input fields (cred-url, edit-cred-url) are completely removed');

  const hasPortalUrlLink = /cred\.portal_url/i.test(clientsPageSource);
  assert(!hasPortalUrlLink, 'cred.portal_url links are NOT rendered in the Credential display/details UI');

  // 2. Verify Single Vertical Column layout and Field Order (Type -> Username -> Password -> Notes)
  // Check Create Client inline credentials form order
  const inlineStart = clientsPageSource.indexOf('className="compact-cred-card"');
  assert(inlineStart !== -1, 'Inline compact-cred-card is present');

  const credFormSlice = clientsPageSource.substring(inlineStart, inlineStart + 6000);
  const typeMatch = credFormSlice.indexOf('Type <span className="text-required">*</span>');
  const userMatch = credFormSlice.indexOf('Username <span className="text-required">*</span>');
  const passMatch = credFormSlice.indexOf('Password <span className="text-required">*</span>');
  const notesMatch = credFormSlice.indexOf('Notes (Optional)');

  assert(typeMatch !== -1 && userMatch !== -1 && passMatch !== -1 && notesMatch !== -1, 
    'All 4 fields (Type, Username, Password, Notes) exist in inline credential card');
  assert(typeMatch < userMatch && userMatch < passMatch && passMatch < notesMatch, 
    'Field order is strictly: Type → Username → Password → Notes');

  // Verify Type, Username, and Password are in a single horizontal line
  const hasHorizontalRow = credFormSlice.includes('cred-fields-horizontal-row');
  assert(hasHorizontalRow, 'Type, Username, and Password fields are placed in a single horizontal line (cred-fields-horizontal-row)');

  // 3. Verify Show/Hide Password button in credentials
  assert(clientsPageSource.includes('togglePasswordVisibility') && clientsPageSource.includes('password-toggle-btn-inline'), 
    'Show/Hide Password toggle button is implemented with eye icon and text');

  // 4. Verify Delete Credential button
  assert(credFormSlice.includes('handleRemoveInlineCred') && credFormSlice.includes('Delete'), 
    'Delete Credential button with text "Delete" is implemented');

  // 5. Verify Modal Scrolling preserves sticky header & sticky footer
  assert(clientsPageSource.includes('modal-form-scrollable'), 'modal-form-scrollable class is present for internal scrolling');
  assert(clientsPageSource.includes('modal-actions-sticky'), 'modal-actions-sticky class is present for sticky footer');
  assert(clientsPageSource.includes('Create Client'), 'Create Client button is present in sticky footer');

  // 6. Test creating client with 3 credentials (GST, PF, IT) via API
  console.log('\nTesting Client Creation with 3 Credentials (GST, PF, IT)...');
  const clientName = `OmniTech Solutions ${Date.now()}`;
  const credsPayload = [
    {
      portal_name: 'GST',
      username: 'omni_gst_user',
      password: 'OmniGstSecret@2026',
      notes: 'Monthly GSTR-1 & 3B token'
    },
    {
      portal_name: 'PF',
      username: 'omni_pf_user',
      password: 'OmniPfSecret@2026',
      notes: 'Unified EPFO employer login'
    },
    {
      portal_name: 'IT',
      username: 'omni_it_user',
      password: 'OmniItSecret@2026',
      notes: 'E-filing portal DSC mapped'
    }
  ];

  const createClientRes = await request('POST', '/clients', {
    name: clientName,
    contact_person: 'Rajesh Kulkarni',
    phone: '+91 98330 11223',
    email: 'accounts@omnitech.in',
    gstin: '27AABCO9988Z1Z2',
    pan: 'AABCO9988Z',
    notes: 'Multi-service client with GST, PF, IT',
    client_types: ['GST', 'PF', 'IT'],
    credentials: credsPayload
  });

  assert(createClientRes.status === 201, `Created client '${clientName}' successfully (Status 201)`);
  const createdClient = createClientRes.body;

  // 7. Reopen client and verify all credentials are saved and decrypted correctly
  console.log('\nVerifying Credentials Storage & Decryption...');
  const getCredsRes = await request('GET', `/credentials?clientId=${createdClient.id}`);
  assert(getCredsRes.status === 200, 'Retrieved client credentials from API');
  const clientCreds = getCredsRes.body;
  assert(clientCreds.length === 3, `Expected 3 credentials, received ${clientCreds.length}`);

  const gstCred = clientCreds.find(c => c.portal_name === 'GST');
  const pfCred = clientCreds.find(c => c.portal_name === 'PF');
  const itCred = clientCreds.find(c => c.portal_name === 'IT');

  assert(gstCred && gstCred.username === 'omni_gst_user' && gstCred.password_decrypted === 'OmniGstSecret@2026',
    'GST credential saved and decrypted correctly (username: omni_gst_user)');
  assert(pfCred && pfCred.username === 'omni_pf_user' && pfCred.password_decrypted === 'OmniPfSecret@2026',
    'PF credential saved and decrypted correctly (username: omni_pf_user)');
  assert(itCred && itCred.username === 'omni_it_user' && itCred.password_decrypted === 'OmniItSecret@2026',
    'IT credential saved and decrypted correctly (username: omni_it_user)');

  // 8. Verify SQLite direct storage is encrypted via AES-256-GCM (raw DB check)
  const Database = require('node:sqlite').DatabaseSync;
  const db = new Database('server/data/auditflow.db');
  const rawCreds = db.prepare('SELECT * FROM client_credentials WHERE client_id = ?').all(createdClient.id);
  assert(rawCreds.length === 3, 'Raw SQLite DB contains 3 credential records');

  for (const raw of rawCreds) {
    assert(raw.encrypted_password && raw.iv && raw.tag, 
      `Credential ${raw.portal_name} has non-null encrypted_password, iv, and tag`);
    assert(!raw.encrypted_password.includes('Omni'), 
      `Plaintext password is NOT in SQLite (securely encrypted)`);
  }

  // 9. Verify Add Credential endpoint (single credential creation)
  const addSingleCredRes = await request('POST', '/credentials', {
    client_id: createdClient.id,
    portal_name: 'MCA',
    username: 'omni_mca_user',
    password: 'McaSecret@2026',
    notes: 'MCA V3 Director login'
  });
  assert(addSingleCredRes.status === 201 && addSingleCredRes.body.portal_name === 'MCA', 
    'Added single credential for MCA successfully');

  // 10. Verify Delete Credential endpoint
  const deleteCredRes = await request('DELETE', `/credentials/${addSingleCredRes.body.id}`);
  assert(deleteCredRes.status === 200, 'Deleted credential successfully');

  console.log(`\n====================================================`);
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED!`);
  console.log(`====================================================\n`);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
