// src/utils/storage.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOG_PATH = path.join(DATA_DIR, 'send_log.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSendLog() {
  ensureDataDir();
  if (!fs.existsSync(LOG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveSendLog(obj) {
  ensureDataDir();
  fs.writeFileSync(LOG_PATH, JSON.stringify(obj, null, 2), 'utf-8');
}

module.exports = { loadSendLog, saveSendLog, DATA_DIR };
