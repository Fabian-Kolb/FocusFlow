import assert from 'node:assert/strict';
import { authorizeUser, authorizeUid } from '../server/authHelper.js';
import { checkRateLimit } from '../server/rateLimiter.js';
import {
  generateOAuthState,
  verifyOAuthState,
  getGoogleOAuthUrl,
  fetchEventsFromGoogle,
  createEventInGoogle
} from '../server/calendarService.js';
import { getServiceAccountCredentials } from '../server/serviceAccountRest.js';

describe('critical backend behavior', () => {
  it('rejects missing and malformed authorization headers before any external call', async () => {
    await assert.rejects(
      authorizeUser({ headers: {} }),
      (error) => error.statusCode === 401 && error.message.includes('Fehlendes')
    );
    await assert.rejects(
      authorizeUser({ headers: { authorization: 'Basic token' } }),
      (error) => error.statusCode === 401
    );
    await assert.rejects(
      authorizeUser({ headers: { authorization: 'Bearer' } }),
      (error) => error.statusCode === 401
    );
  });

  it('requires a UID for OAuth callback authorization', async () => {
    await assert.rejects(
      authorizeUid(''),
      (error) => error.statusCode === 401
    );
  });

  it('enforces separate guest and authenticated rate limits', () => {
    const guestReq = { headers: { 'x-forwarded-for': '198.51.100.10' } };
    let result;
    for (let i = 0; i < 15; i += 1) result = checkRateLimit(guestReq);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 0);
    result = checkRateLimit(guestReq);
    assert.equal(result.allowed, false);
    assert.equal(result.limit, 15);

    const authReq = { headers: { 'x-forwarded-for': '198.51.100.10' } };
    result = checkRateLimit(authReq, { uid: 'authenticated-user' });
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 99);
  });

  it('generates verifiable, one-time OAuth state and rejects tampering', () => {
    const secret = 'test-secret';
    const state = generateOAuthState('uid-123', secret);
    assert.deepEqual(verifyOAuthState(state, secret), { uid: 'uid-123' });
    assert.throws(() => verifyOAuthState(state, secret), /Replay-Angriff/);

    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const tamperedPayload = `${decoded.slice(0, -1)}${decoded.endsWith('a') ? 'b' : 'a'}`;
    const tampered = Buffer.from(tamperedPayload).toString('base64url');
    assert.throws(() => verifyOAuthState(tampered, secret), /Signatur ungültig/);
  });

  it('builds an offline-consent Google OAuth URL and rejects incomplete config', () => {
    const url = getGoogleOAuthUrl({
      uid: 'uid-123',
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'https://example.test/callback'
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('access_type'), 'offline');
    assert.equal(parsed.searchParams.get('prompt'), 'consent');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.test/callback');
    assert.throws(
      () => getGoogleOAuthUrl({ uid: 'uid-123', clientId: '', clientSecret: 'secret', redirectUri: 'x' }),
      /unvollständig/
    );
  });

  it('maps calendar event payloads and returns Google items', async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ items: [{ id: 'event-1' }] }) };
    };
    try {
      const items = await fetchEventsFromGoogle({ accessToken: 'access-token', year: '2026', monthIndex: '8' });
      assert.deepEqual(items, [{ id: 'event-1' }]);
      await createEventInGoogle({
        accessToken: 'access-token',
        eventData: {
          title: 'Planning',
          description: 'Quarterly planning',
          allDay: true,
          startDate: '2026-09-15',
          endDate: '2026-09-16',
          reminderMinutes: 15
        }
      });
      const createCall = calls[1];
      assert.equal(createCall.options.method, 'POST');
      const body = JSON.parse(createCall.options.body);
      assert.deepEqual(body.start, { date: '2026-09-15' });
      assert.equal(body.reminders.overrides[0].minutes, 15);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('parses service-account JSON and rejects incomplete credentials', () => {
    const previous = process.env.FIREBASE_SERVICE_ACCOUNT;
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
      client_email: 'service@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'
    });
    try {
      const result = getServiceAccountCredentials();
      assert.equal(result.error, null);
      assert.equal(result.serviceAccount.client_email, 'service@example.iam.gserviceaccount.com');
      assert.equal(result.serviceAccount.private_key.includes('\n'), true);

      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'missing-key' });
      assert.match(getServiceAccountCredentials().error, /private_key/);
    } finally {
      if (previous === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
      else process.env.FIREBASE_SERVICE_ACCOUNT = previous;
    }
  });
});
