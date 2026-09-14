// tests/calendar_security.test.js
// Automated security verification suite for Google Calendar OAuth flow and backend endpoints.

import assert from 'assert';
import fs from 'fs';
import path from 'path';

import authUrlHandler from '../api/calendar/auth-url.js';
import callbackHandler from '../api/calendar/callback.js';
import eventsHandler from '../api/calendar/events.js';
import statusHandler from '../api/calendar/status.js';
import disconnectHandler from '../api/calendar/disconnect.js';
import refreshHandler from '../api/calendar/refresh.js';
import { generateOAuthState, verifyOAuthState } from '../server/calendarService.js';
import { authorizeUser, authorizeUid } from '../server/authHelper.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.body = data;
      return this;
    }
  };
}

async function runSecurityTests() {
  console.log('\n🔒 Starting Google Calendar & Server Authorization Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // --- VULNERABILITY 1: Auth URL Endpoint Protection ---
  await testAsync('VULN-1: auth-url endpoint rejects unauthenticated request (missing auth header)', async () => {
    const req = { method: 'GET', headers: {}, query: { uid: 'attacker_target', redirectUri: 'https://attacker.com' } };
    const res = createMockRes();
    await authUrlHandler(req, res);
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
    assert(res.body?.error, 'Response should contain error message');
  });

  await testAsync('VULN-1: auth-url endpoint rejects invalid bearer token format', async () => {
    const req = { method: 'GET', headers: { authorization: 'Basic 12345' }, query: {} };
    const res = createMockRes();
    await authUrlHandler(req, res);
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  test('VULN-1: auth-url code never trusts query.uid or query.redirectUri directly', () => {
    const src = fs.readFileSync(path.resolve('api/calendar/auth-url.js'), 'utf-8');
    assert(!src.includes('req.query.uid'), 'auth-url.js must not accept req.query.uid');
    assert(!src.includes('clientRedirectUri = req.query.redirectUri'), 'auth-url.js must not accept arbitrary redirectUri');
    assert(src.includes('authorizeUser(req)') || src.includes('verifyAuthToken(req)'), 'auth-url.js must invoke authorizeUser');
  });

  test('AUTH: authHelper never accepts structurally decoded JWTs without verification', () => {
    const authSrc = fs.readFileSync(path.resolve('server/authHelper.js'), 'utf-8');
    assert(authSrc.includes('Identity Toolkit REST API'), 'authHelper must retain a cryptographic verification path');
    assert(authSrc.includes('Serverseitige Token-Verifizierung ist nicht konfiguriert.'), 'authHelper must fail closed when verification is unavailable');
    assert(!authSrc.includes('parsedPayload.firebase?.sign_in_provider'), 'authHelper must not derive provider claims from decoded JWT contents');
    assert(!authSrc.includes('parsedPayload.aud === projectId'), 'authHelper must not treat audience/issuer claims as signature verification');
  });

  // --- VULNERABILITY 2: Callback Script Injection & Safe PostMessage ---
  test('VULN-2: callback.js does not interpolate dynamic user or token variables into script', () => {
    const callbackSrc = fs.readFileSync(path.resolve('api/calendar/callback.js'), 'utf-8');
    assert(!callbackSrc.includes('${encodeURIComponent(uid)}'), 'callback.js must not interpolate dynamic uid into script');
    assert(!callbackSrc.includes('${encodeURIComponent(accessToken)}'), 'callback.js must not interpolate accessToken into script');
    assert(!callbackSrc.includes('accessToken:'), 'callback.js script must not send accessToken in postMessage');
  });

  test('VULN-2: callback.js invokes authorizeUid to verify account/whitelist before code exchange', () => {
    const callbackSrc = fs.readFileSync(path.resolve('api/calendar/callback.js'), 'utf-8');
    assert(callbackSrc.includes('authorizeUid(uid)'), 'callback.js must invoke authorizeUid');
  });

  test('VULN-2: functions/index.js callback does not interpolate dynamic token variables into script', () => {
    const indexSrc = fs.readFileSync(path.resolve('functions/index.js'), 'utf-8');
    assert(!indexSrc.includes('${encodeURIComponent(verifiedUid)}'), 'functions/index.js must not interpolate verifiedUid into script');
    assert(!indexSrc.includes('${encodeURIComponent(accessToken)}'), 'functions/index.js must not interpolate accessToken into script');
  });

  test('VULN-2: vite.config.js callback does not interpolate dynamic token variables into script', () => {
    const viteSrc = fs.readFileSync(path.resolve('vite.config.js'), 'utf-8');
    assert(!viteSrc.includes('${encodeURIComponent(verifiedUid)}'), 'vite.config.js must not interpolate verifiedUid into script');
    assert(!viteSrc.includes('${encodeURIComponent(accessToken)}'), 'vite.config.js must not interpolate accessToken into script');
  });

  await testAsync('VULN-2: callback.js returns 400 when authorization code is missing', async () => {
    const req = { method: 'GET', query: {}, headers: {} };
    const res = createMockRes();
    await callbackHandler(req, res);
    assert.strictEqual(res.statusCode, 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body.includes('Kein Autorisierungs-Code'), 'Expected missing code error');
  });

  // --- OAUTH STATE & REPLAY ATTACK DEFENSE ---
  test('OAUTH-REPLAY: state includes cryptographic nonce and prevents replay upon second verification', () => {
    const testSecret = 'super_secret_test_key_12345';
    const state = generateOAuthState('test_uid_999', testSecret);
    
    // First verification should pass
    const verified = verifyOAuthState(state, testSecret);
    assert.strictEqual(verified.uid, 'test_uid_999');

    // Second verification with identical state MUST be rejected (Replay Prevention)
    assert.throws(() => {
      verifyOAuthState(state, testSecret);
    }, /bereits eingelöst|Replay-Angriff/);
  });

  test('OAUTH-INTEGRITY: state with tampered signature is immediately rejected', () => {
    const testSecret = 'super_secret_test_key_12345';
    const state = generateOAuthState('test_uid_999', testSecret);
    const tampered = state.slice(0, -4) + 'abcd';

    assert.throws(() => {
      verifyOAuthState(tampered, testSecret);
    }, /Signatur ungültig/);
  });

  // --- VULNERABILITY 3: Events Endpoint Authentication & Google Token Defense ---
  await testAsync('VULN-3: events endpoint rejects unauthenticated request', async () => {
    const req = { method: 'GET', headers: {}, query: {} };
    const res = createMockRes();
    await eventsHandler(req, res);
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  test('VULN-3: events.js does not accept raw Google bearer tokens from client', () => {
    const eventsSrc = fs.readFileSync(path.resolve('api/calendar/events.js'), 'utf-8');
    assert(!eventsSrc.includes('fetchEventsFromGoogle({ accessToken: token'), 'events.js must not pass client header token to Google');
    assert(eventsSrc.includes('authorizeUser(req)') || eventsSrc.includes('verifyAuthToken(req)'), 'events.js must verify Firebase ID token');
    assert(eventsSrc.includes('getStoredUserRefreshToken'), 'events.js must retrieve token server-side');
  });

  // --- VULNERABILITY 4: Status & Disconnect Endpoint Authentication ---
  await testAsync('VULN-4: status endpoint rejects unauthenticated request', async () => {
    const req = { method: 'GET', headers: {}, query: { uid: 'arbitrary_user' } };
    const res = createMockRes();
    await statusHandler(req, res);
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  await testAsync('VULN-4: disconnect endpoint rejects unauthenticated request', async () => {
    const req = { method: 'POST', headers: {}, body: {} };
    const res = createMockRes();
    await disconnectHandler(req, res);
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  await testAsync('VULN-4: disconnect endpoint rejects non-POST request', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();
    await disconnectHandler(req, res);
    assert.strictEqual(res.statusCode, 405, `Expected 405, got ${res.statusCode}`);
  });

  // --- VULNERABILITY 5: Refresh Endpoint Token Oracle Defense ---
  await testAsync('VULN-5: refresh endpoint rejects unauthenticated request', async () => {
    const req = { method: 'POST', headers: {}, body: { refreshToken: '1//stolen_token' } };
    const res = createMockRes();
    await refreshHandler(req, res);
    assert.strictEqual(res.statusCode, 401, `Expected 401, got ${res.statusCode}`);
  });

  test('VULN-5: refresh endpoints never accept refreshToken from client request body', () => {
    const refreshSrc = fs.readFileSync(path.resolve('api/calendar/refresh.js'), 'utf-8');
    assert(!refreshSrc.includes('body.refreshToken'), 'refresh.js must not accept body.refreshToken');
    const indexSrc = fs.readFileSync(path.resolve('functions/index.js'), 'utf-8');
    assert(!indexSrc.includes('body.refreshToken'), 'functions/index.js must not accept body.refreshToken');
    const viteSrc = fs.readFileSync(path.resolve('vite.config.js'), 'utf-8');
    assert(!viteSrc.includes('body.refreshToken'), 'vite.config.js must not accept body.refreshToken');
  });

  // --- TOKEN STORE ISOLATION & MIGRATION ---
  test('TOKEN-STORE: tokenStore.js writes strictly to server_tokens and deletes legacy user tokens', () => {
    const storeSrc = fs.readFileSync(path.resolve('server/tokenStore.js'), 'utf-8');
    assert(storeSrc.includes('collection(\'server_tokens\')'), 'tokenStore must use server_tokens');
    assert(storeSrc.includes('collection(\'users\').doc(uid).collection(\'tokens\').doc(\'google\').delete()'), 'tokenStore must delete legacy user tokens upon migration');
  });

  // --- CLIENT-SIDE ARCHITECTURE: No Google Tokens in Browser ---
  test('CLIENT: calendarAPI.js never calls Google API directly and stores no tokens in storage', () => {
    const clientSrc = fs.readFileSync(path.resolve('src/lib/calendarAPI.js'), 'utf-8');
    assert(!clientSrc.includes('https://www.googleapis.com/calendar'), 'calendarAPI.js must not call Google API directly');
    assert(!clientSrc.includes('sessionStorage.setItem'), 'calendarAPI.js must not store tokens in sessionStorage');
    assert(!clientSrc.includes('fetchWithGoogleAuth'), 'calendarAPI.js must proxy through backend, not direct Google auth');
  });

  console.log(`\n=======================================================`);
  console.log(`Security Test Results: ${passed} passed, ${failed} failed`);
  console.log(`=======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal error in security tests:', err);
  process.exit(1);
});
