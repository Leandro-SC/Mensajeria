// src/index.js
require('dotenv').config();
const fs = require('fs');
const { readContacts } = require('./services/googleSheets');
const { initWhatsApp } = require('./services/messaging');
const { loadTemplates, pickRandom } = require('./utils/templates');
const { sleep, randomInt, within24h, nowISO, nowLocalStr, makeId, HourlyRateLimiter } = require('./utils/time');
const { loadSendLog, saveSendLog } = require('./utils/storage');
const { makeReportRow, writeExcelReport } = require('./utils/report');
const { PROFILE_DIR, PLANTILLA_JSON, IMG_PATH } = require('./utils/paths');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE || 'Contactos!A:C';

// —— NUEVO: configuración de rate limit y delays aleatorios ——
// Máximo 5 por hora (requerimiento)
const HOURLY_LIMIT = 5;
// Entre cada envío: espera aleatoria (en segundos). Ajusta el rango si quieres.
const DELAY_MIN_S = 9 * 60;   // 9 minutos
const DELAY_MAX_S = 15 * 60;  // 15 minutos

async function main() {
  const templates = loadTemplates(PLANTILLA_JSON);
  const { ready, sendText, sendImage } = initWhatsApp({ profileDir: PROFILE_DIR });
  await ready;

  const contacts = await readContacts(SPREADSHEET_ID, SHEET_RANGE);
  const sendLog = loadSendLog();
  const reportRows = [];
  const sendImageIfExists = fs.existsSync(IMG_PATH);

  // —— NUEVO: limitador horario ——
  const limiter = new HourlyRateLimiter(HOURLY_LIMIT);

  for (const c of contacts) {
    const number = c.celular; // ya viene normalizado a E.164 (51xxxxxxxxx)
    const last = sendLog[number]?.lastSentISO;
    const id = makeId(number);
    const startISO = nowISO();
    const startLocal = nowLocalStr();

    // Antiduplicado 24h
    if (last && within24h(last)) {
      reportRows.push(makeReportRow(c, 'omitido_24h', id, startISO, startLocal, 'Política 24h'));
      continue;
    }

    // —— NUEVO: respeta 5/h —— (espera si ya alcanzaste el límite en la ventana actual)
    await limiter.beforeSend();

    const msg = pickRandom(templates);
    let estado = 'error';
    let detalle = '';

    // Enviar
    let result = sendImageIfExists
      ? await sendImage(number, IMG_PATH, msg)
      : await sendText(number, msg);

    // —— NUEVO: contamos el intento dentro de la ventana —— 
    // (contar intento, no solo éxito, así el límite es “salidas” por hora)
    limiter.markAttempt();

    if (result.ok) {
      estado = sendImageIfExists ? 'enviado_imagen' : 'enviado_texto';
      sendLog[number] = sendLog[number] || { history: [] };
      sendLog[number].lastSentISO = nowISO();
      sendLog[number].history.push({ id, at: sendLog[number].lastSentISO, estado });
    } else {
      if (result.code === 'no_whatsapp') {
        estado = 'no_whatsapp';
        detalle = 'El número no tiene cuenta de WhatsApp';
      } else if (result.code === 'ack_timeout') {
        estado = 'ack_timeout';
        detalle = 'No se recibió ACK del servidor (posible conexión lenta o restricción)';
      } else {
        estado = 'error_envio';
        detalle = result.error || 'Error no especificado';
      }
    }

    reportRows.push(makeReportRow(c, estado, id, startISO, startLocal, detalle));

    // —— NUEVO: delay aleatorio entre envíos —— 
    // (además del límite 5/h)
    const waitS = randomInt(DELAY_MIN_S, DELAY_MAX_S);
    console.log(`⏱️ Esperando ${Math.round(waitS / 60)} min antes del próximo intento...`);
    await sleep(waitS * 1000);
  }

  saveSendLog(sendLog);
  const reportPath = writeExcelReport(reportRows);
  console.log(`📄 Reporte generado: ${reportPath}`);
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Error en ejecución:', e.message || e);
  process.exit(1);
});



