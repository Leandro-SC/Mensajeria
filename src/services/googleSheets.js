  // src/services/googleSheets.js
const { getSheetsClient } = require('../auth/google');

function toE164Peru(input) {
  const d = String(input || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('51') && d.length === 11) return d;        // 51 + 9 dígitos
  // quita 0 inicial si viene como 0 9xx xxx xxx
  const local = d.replace(/^0+/, '');
  if (local.length === 9 && local.startsWith('9')) return `51${local}`;
  // si ya viene 11 pero no empieza con 51, no es válido para PE
  if (d.length === 11 && !d.startsWith('51')) return '';
  // último intento: si son 11 y empiezan con 51, toma tal cual
  return (d.length === 11 && d.startsWith('51')) ? d : '';
}

async function readContacts(spreadsheetId, range) {
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = resp.data.values || [];
  if (rows.length < 2) return [];

  const head = rows[0].map(h => String(h || '').trim().toLowerCase());
  const iNombre = head.indexOf('full_name');
  const iCorreo = head.indexOf('email');
  const iCel = head.indexOf('phone_number');
  if (iNombre === -1 || iCorreo === -1 || iCel === -1) {
    throw new Error('Cabeceras requeridas: full_name, email, phone_number');
  }

  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nombre = String(r[iNombre] || '').trim();
    const correo = String(r[iCorreo] || '').trim();
    const celularE164 = toE164Peru(r[iCel]);
    if (!celularE164) continue; // descarta inválidos
    list.push({ nombre, correo, celular: celularE164 });
  }

  // dedupe por número
  const map = new Map();
  list.forEach(c => map.set(c.celular, c));
  return [...map.values()];
}

module.exports = { readContacts, toE164Peru };
