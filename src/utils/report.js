// src/utils/report.js
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { DATA_DIR } = require('./storage');

function formatStamp(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function makeReportRow(contact, estado, id, fechaISO, fechaLocal, detalle) {
  return {
    Nombre: contact.nombre || '',
    Correo: contact.correo || '',
    Celular: contact.celular,
    Mensaje: 'aleatorio',
    Estado: estado,
    ID_Envio: id,
    FechaHora_ISO: fechaISO,
    FechaHora_Local: fechaLocal,
    Detalle: detalle || ''
  };
}

function writeExcelReport(rows) {
  const reportsDir = path.join(DATA_DIR, 'reportes');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const name = `reporte_envios_${formatStamp()}.xlsx`;
  const filepath = path.join(reportsDir, name);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Envios');
  XLSX.writeFile(wb, filepath);

  return filepath;
}

module.exports = { makeReportRow, writeExcelReport };
