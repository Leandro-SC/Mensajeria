// src/utils/paths.js
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROFILE_DIR = path.join(ROOT, '.wwebjs_auth');
const PLANTILLA_JSON = path.join(ROOT, 'plantilla.json');
const IMG_PATH = path.join(ROOT, 'img', 'expo.jpeg');

module.exports = { ROOT, PROFILE_DIR, PLANTILLA_JSON, IMG_PATH };
