const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:3000';

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json, text };
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json, text };
}

async function run() {
  console.log('Starting smoke test against', { AUTH_URL, API_URL });

  // Owner register (or login if already exists)
  const owner = { email: 'owner@example.com', password: 'Pass1234!', name: 'Owner' };
  let r = await postJson(`${AUTH_URL}/auth/register`, owner);
  let ownerToken;
  if (r.status === 201) {
    ownerToken = r.body.accessToken;
    console.log('Owner registered');
  } else if (r.status === 409) {
    const login = await postJson(`${AUTH_URL}/auth/login`, { email: owner.email, password: owner.password });
    if (login.status !== 200) { console.error('Owner login failed', login.status, login.text); process.exit(1); }
    ownerToken = login.body.accessToken;
    console.log('Owner logged in');
  } else {
    console.error('Owner register failed', r.status, r.text); process.exit(1);
  }

  // Create workspace
  r = await postJson(`${API_URL}/workspaces`, { name: 'SmokeTestWS' }, ownerToken);
  if (r.status !== 201) { console.error('Workspace create failed', r.status, r.text); process.exit(1); }
  const workspace = r.body.workspace;
  console.log('Workspace created', workspace.id);

  // Invite user
  const inviteeEmail = 'invitee@example.com';
  r = await postJson(`${API_URL}/workspaces/${workspace.id}/invite`, { email: inviteeEmail, role: 'member' }, ownerToken);
  if (r.status !== 200) { console.error('Invite failed', r.status, r.text); process.exit(1); }
  const token = r.body.token;
  console.log('Invite created, token', token);

  // Invitee register (or login)
  const invitee = { email: inviteeEmail, password: 'Pass1234!', name: 'Invitee' };
  r = await postJson(`${AUTH_URL}/auth/register`, invitee);
  let inviteeToken;
  if (r.status === 201) {
    inviteeToken = r.body.accessToken;
    console.log('Invitee registered');
  } else if (r.status === 409) {
    const login = await postJson(`${AUTH_URL}/auth/login`, { email: invitee.email, password: invitee.password });
    if (login.status !== 200) { console.error('Invitee login failed', login.status, login.text); process.exit(1); }
    inviteeToken = login.body.accessToken;
    console.log('Invitee logged in');
  } else {
    console.error('Invitee register failed', r.status, r.text); process.exit(1);
  }

  // Accept invite
  r = await postJson(`${API_URL}/workspaces/accept-invite`, { token }, inviteeToken);
  if (r.status !== 200) { console.error('Accept invite failed', r.status, r.text); process.exit(1); }
  console.log('Invite accepted, workspaceId', r.body.workspaceId);

  // List members
  r = await getJson(`${API_URL}/workspaces/${workspace.id}/members`, ownerToken);
  if (r.status !== 200) { console.error('List members failed', r.status, r.text); process.exit(1); }
  console.log('Members:', r.body.members.map((m) => ({ email: m.email, role: m.role }))); 

  console.log('Smoke test passed');
}

run().catch((err) => { console.error('Smoke test error', err); process.exit(1); });
