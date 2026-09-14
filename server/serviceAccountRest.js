// server/serviceAccountRest.js
// Direct, zero-dependency REST client for Firebase Firestore using Google Service Account OAuth2 JWT.
// Eliminates bundling and cold-start failures of the heavy firebase-admin package on Vercel Serverless Functions.

import crypto from 'crypto';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'focusflow-d5a55';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// In-memory token cache (valid for ~55 minutes)
let cachedAccessToken = null;
let tokenExpiresAt = 0;

const POSSIBLE_ENV_VARS = [
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_ADMIN_CREDENTIALS',
  'SERVICE_ACCOUNT'
];

/**
 * Robustly parses and validates the Service Account credentials from environment variables.
 * Handles multiline JSON, base64-encoded strings, escaped newlines, and surrounding quotes.
 * @returns {{ serviceAccount: object | null, error: string | null, foundVar: string | null }}
 */
export function getServiceAccountCredentials() {
  let rawValue = null;
  let foundVar = null;

  for (const varName of POSSIBLE_ENV_VARS) {
    const val = process.env[varName];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      rawValue = val.trim();
      foundVar = varName;
      break;
    }
  }

  if (!rawValue) {
    const checked = POSSIBLE_ENV_VARS.join(', ');
    return {
      serviceAccount: null,
      error: `Keine Service-Account-Variable im Serverless Backend gefunden (geprüft: ${checked}).`,
      foundVar: null
    };
  }

  let cleanStr = rawValue;

  // Remove potential shell prefix e.g. "export FIREBASE_SERVICE_ACCOUNT="
  if (cleanStr.includes('=')) {
    const firstEq = cleanStr.indexOf('=');
    const prefix = cleanStr.slice(0, firstEq).trim();
    if (POSSIBLE_ENV_VARS.some(v => prefix.endsWith(v))) {
      cleanStr = cleanStr.slice(firstEq + 1).trim();
    }
  }

  // Strip single or double outer quotes
  if ((cleanStr.startsWith("'") && cleanStr.endsWith("'")) || (cleanStr.startsWith('"') && cleanStr.endsWith('"'))) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }

  let parsed = null;
  let parseErrorMsg = null;

  // 1. Direct JSON parse
  try {
    parsed = JSON.parse(cleanStr);
  } catch (err1) {
    parseErrorMsg = err1.message;

    // 2. Base64 decode attempt
    try {
      const decoded = Buffer.from(cleanStr, 'base64').toString('utf-8');
      parsed = JSON.parse(decoded);
    } catch {
      // 3. Fallback: unescape newlines if string was double-escaped or contains raw linebreaks
      try {
        const normalized = cleanStr.replace(/[\r\n]+/g, ' ');
        parsed = JSON.parse(normalized);
      } catch (err3) {
        return {
          serviceAccount: null,
          error: `Service-Account Parse-Fehler in ${foundVar}: ${parseErrorMsg || err3.message}`,
          foundVar
        };
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      serviceAccount: null,
      error: `Inhalt von ${foundVar} ist kein gültiges JSON-Objekt.`,
      foundVar
    };
  }

  if (!parsed.client_email) {
    return {
      serviceAccount: null,
      error: `In ${foundVar} fehlt das Pflichtfeld 'client_email'.`,
      foundVar
    };
  }

  if (!parsed.private_key) {
    return {
      serviceAccount: null,
      error: `In ${foundVar} fehlt das Pflichtfeld 'private_key'.`,
      foundVar
    };
  }

  // Normalize private key newlines
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return {
    serviceAccount: parsed,
    error: null,
    foundVar
  };
}

/**
 * Exchanges the Service Account credentials for a short-lived Google OAuth2 access token
 * with scope 'https://www.googleapis.com/auth/datastore'.
 * @returns {Promise<string>} Bearer access token
 */
export async function getServiceAccountAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedAccessToken && tokenExpiresAt > now + 300) {
    return cachedAccessToken;
  }

  const { serviceAccount, error, foundVar } = getServiceAccountCredentials();
  if (!serviceAccount) {
    throw new Error(error || 'Service Account nicht verfügbar.');
  }

  // 1. Build RS256 JWT
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: TOKEN_ENDPOINT,
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const signInput = `${header}.${payload}`;
  let signature;
  try {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    signature = signer.sign(serviceAccount.private_key, 'base64url');
  } catch (signErr) {
    throw new Error(`Signatur-Fehler mit Service-Account Private Key (${foundVar}): ${signErr.message}`);
  }

  const assertion = `${signInput}.${signature}`;

  // 2. Exchange JWT for access token
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }).toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth2 Token-Austausch fehlgeschlagen (${response.status}): ${errText}`);
  }

  const tokenData = await response.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);

  return cachedAccessToken;
}

// Convert JavaScript primitive/object to Firestore REST value representation
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convert Firestore REST value representation to JavaScript primitive/object
function fromFirestoreValue(valObj) {
  if (!valObj || typeof valObj !== 'object') return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return valObj.doubleValue;
  if ('nullValue' in valObj) return null;
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('arrayValue' in valObj) {
    return (valObj.arrayValue?.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in valObj) {
    const res = {};
    for (const [k, v] of Object.entries(valObj.mapValue?.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

/**
 * Reads a document from Firestore via REST API using Service Account authorization.
 * @param {string} docPath - e.g. "server_tokens/USER_UID"
 * @returns {Promise<object|null>} Document data as JS object or null if not found
 */
export async function firestoreRestGet(docPath) {
  const token = await getServiceAccountAccessToken();
  const url = `${FIRESTORE_BASE_URL}/${docPath}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST GET fehlgeschlagen (${res.status}): ${errText}`);
  }

  const doc = await res.json();
  if (!doc.fields) return {};

  const data = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    data[k] = fromFirestoreValue(v);
  }
  return data;
}

/**
 * Writes or merges a document to Firestore via REST API using Service Account authorization.
 * @param {string} docPath - e.g. "server_tokens/USER_UID"
 * @param {object} data - Object to write
 * @returns {Promise<void>}
 */
export async function firestoreRestSet(docPath, data) {
  const token = await getServiceAccountAccessToken();

  const fieldKeys = Object.keys(data);
  const query = fieldKeys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${FIRESTORE_BASE_URL}/${docPath}${query ? '?' + query : ''}`;

  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST SET fehlgeschlagen (${res.status}): ${errText}`);
  }
}

/**
 * Deletes a document from Firestore via REST API using Service Account authorization.
 * @param {string} docPath - e.g. "server_tokens/USER_UID"
 * @returns {Promise<void>}
 */
export async function firestoreRestDelete(docPath) {
  try {
    const token = await getServiceAccountAccessToken();
    const url = `${FIRESTORE_BASE_URL}/${docPath}`;

    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
  } catch (err) {
    console.warn(`[serviceAccountRest] Delete warning for ${docPath}:`, err.message);
  }
}

/**
 * Diagnostic helper to report the exact configuration state of the service account.
 */
export function getServiceAccountDiagnostics() {
  const { serviceAccount, error, foundVar } = getServiceAccountCredentials();
  return {
    isConfigured: Boolean(serviceAccount),
    variableFound: foundVar,
    clientEmail: serviceAccount?.client_email || null,
    projectId: serviceAccount?.project_id || PROJECT_ID,
    error: error || null
  };
}
