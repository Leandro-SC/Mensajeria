// src/services/messaging.js
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

function detectChrome() {
  const paths = {
    win: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    winAlt: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    mac: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome',
  };
  if (process.platform === 'win32') {
    if (fs.existsSync(paths.win)) return paths.win;
    if (fs.existsSync(paths.winAlt)) return paths.winAlt;
  } else if (process.platform === 'darwin') {
    if (fs.existsSync(paths.mac)) return paths.mac;
  } else if (fs.existsSync(paths.linux)) return paths.linux;
  return undefined;
}

// Espera ACK >= minAck (0=pending,1=server,2=device,3=read)
function waitAck(client, messageIdSerialized, timeoutMs = 15000, minAck = 1) {
  return new Promise((resolve) => {
    let done = false;
    const onAck = (msg, ack) => {
      if (done) return;
      if (msg?.id?._serialized === messageIdSerialized && ack >= minAck) {
        done = true;
        cleanup();
        resolve(true);
      }
    };
    const timer = setTimeout(() => {
      if (!done) { done = true; cleanup(); resolve(false); }
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      client.removeListener('message_ack', onAck);
    }
    client.on('message_ack', onAck);
  });
}

function initWhatsApp({ profileDir, chromePath }) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: profileDir }),
    puppeteer: {
      headless: false,
      executablePath: chromePath || detectChrome(),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=es-ES']
    }
  });

  const ready = new Promise((resolve, reject) => {
    client.on('qr', qr => {
      console.log('Escanea el QR (solo la primera vez):');
      qrcode.generate(qr, { small: true });
    });
    client.on('ready', () => {
      console.log('✅ WhatsApp listo.');
      resolve();
    });
    client.on('auth_failure', m => { console.error('❌ Auth failure:', m); reject(new Error(m)); });
    client.on('disconnected', r => console.warn('⚠️ Desconectado:', r));
  });

  client.initialize();

  async function resolveWaId(e164Number) {
    // Devuelve null si el número no tiene WhatsApp
    try {
      const result = await client.getNumberId(e164Number);
      return result ? result._serialized : null;
    } catch {
      return null;
    }
  }

  async function sendText(e164Number, text) {
    const waId = await resolveWaId(e164Number);
    if (!waId) return { ok: false, code: 'no_whatsapp' };

    try {
      const msg = await client.sendMessage(waId, text);
      const ackOk = await waitAck(client, msg.id._serialized, 15000, 1);
      return ackOk ? { ok: true, ack: msg.ack } : { ok: false, code: 'ack_timeout', ack: msg.ack };
    } catch (e) {
      return { ok: false, code: 'send_error', error: e?.message || String(e) };
    }
  }

  async function sendImage(e164Number, imgPath, caption) {
    const waId = await resolveWaId(e164Number);
    if (!waId) return { ok: false, code: 'no_whatsapp' };

    const buf = fs.readFileSync(imgPath);
    const mimetype = mime.lookup(imgPath) || 'image/jpeg';
    const media = new MessageMedia(mimetype, buf.toString('base64'), path.basename(imgPath));

    try {
      const msg = await client.sendMessage(waId, media, { caption });
      const ackOk = await waitAck(client, msg.id._serialized, 20000, 1);
      return ackOk ? { ok: true, ack: msg.ack } : { ok: false, code: 'ack_timeout', ack: msg.ack };
    } catch (e) {
      return { ok: false, code: 'send_error', error: e?.message || String(e) };
    }
  }

  return { client, ready, sendText, sendImage };
}

module.exports = { initWhatsApp };
