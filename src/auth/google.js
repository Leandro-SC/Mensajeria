// src/auth/google.js
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SECRETS = process.env.GOOGLE_CLIENT_SECRETS || path.join(ROOT, 'client_secrets.json');
const TOKENS_DIR = path.join(ROOT, 'tokens');
const TOKENS_PATH = path.join(TOKENS_DIR, 'google_sheets_token.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function ensureTokensDir() {
  if (!fs.existsSync(TOKENS_DIR)) fs.mkdirSync(TOKENS_DIR, { recursive: true });
}

function loadSecrets() {
  const secretsPath = path.resolve(DEFAULT_SECRETS);
  if (!fs.existsSync(secretsPath)) {
    throw new Error(`No se encontró client_secrets.json en: ${secretsPath}`);
  }
  return readJson(secretsPath);
}

function detectSecretsType(secrets) {
  if (secrets.type === 'service_account') return 'service_account';
  if (secrets.installed) return 'installed';
  if (secrets.web) return 'web';
  throw new Error('client_secrets.json inválido (sección installed/web)'); // <- tu error original
}

// ---------- OAuth client ----------
async function createOAuthClient() {
  const secrets = loadSecrets();
  const kind = detectSecretsType(secrets);
  if (kind === 'service_account') {
    throw new Error('Este client_secrets es Service Account; no requiere OAuth interactivo.');
  }

  const cfg = secrets[kind];
  const redirectUri =
    (cfg.redirect_uris || []).find(u => u.startsWith('http://localhost')) ||
    (cfg.redirect_uris && cfg.redirect_uris[0]) ||
    'http://localhost:53682';

  const oAuth2Client = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri);
  return oAuth2Client;
}

function getAuthUrl(oAuth2Client) {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

async function getTokenByCode(oAuth2Client, code) {
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

async function saveTokens(tokens) {
  ensureTokensDir();
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

// ---------- Sheets client (auto SA/OAuth) ----------
async function getSheetsClient() {
  const secrets = loadSecrets();
  const kind = detectSecretsType(secrets);

  if (kind === 'service_account') {
    // Service Account: NO requiere tokens ni script de autorización
    const { client_email, private_key } = secrets;
    if (!client_email || !private_key) {
      throw new Error('Service Account inválido: faltan client_email / private_key');
    }
    const jwt = new google.auth.JWT({
      email: client_email,
      key: private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await jwt.authorize();
    return google.sheets({ version: 'v4', auth: jwt });
  }

  // OAuth (installed/web)
  const cfg = secrets[kind];
  const redirectUri =
    (cfg.redirect_uris || []).find(u => u.startsWith('http://localhost')) ||
    (cfg.redirect_uris && cfg.redirect_uris[0]) ||
    'http://localhost:53682';

  const oAuth2Client = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, redirectUri);
  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error('No hay tokens OAuth. Ejecuta: node scripts/init_google_auth.js');
  }
  const tokens = readJson(TOKENS_PATH);
  oAuth2Client.setCredentials(tokens);
  return google.sheets({ version: 'v4', auth: oAuth2Client });
}

module.exports = {
  createOAuthClient,
  getAuthUrl,
  getTokenByCode,
  saveTokens,
  getSheetsClient,
  __paths: { DEFAULT_SECRETS, TOKENS_DIR, TOKENS_PATH },
  __internal: { detectSecretsType, loadSecrets },
};
