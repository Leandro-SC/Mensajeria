// src/utils/templates.js
const fs = require('fs');
const path = require('path');

function loadTemplates(filePath) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf-8');
  const data = JSON.parse(raw);
  const arr = Array.isArray(data) ? data : data.mensajes;
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('plantilla.json sin mensajes');
  return arr.map(String);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { loadTemplates, pickRandom };
