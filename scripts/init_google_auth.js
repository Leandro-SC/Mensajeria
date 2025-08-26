// scripts/init_google_auth.js
const http = require('http');
const readline = require('readline');
const { spawn } = require('child_process');
const { createOAuthClient, saveTokens, getAuthUrl } = require('../src/auth/google');
const { __internal } = require('../src/auth/google');

(async () => {
  try {
    // Si el secrets es Service Account, no se necesita OAuth
    const secrets = __internal.loadSecrets();
    const kind = __internal.detectSecretsType(secrets);
    if (kind === 'service_account') {
      console.log('ℹ️ Tu client_secrets.json es Service Account. No se requiere autorización OAuth.');
      console.log('👉 Comparte la hoja de cálculo con este correo:', secrets.client_email);
      process.exit(0);
    }

    const oAuth2Client = await createOAuthClient();
    const authUrl = getAuthUrl(oAuth2Client);

    console.log('\n💠 URL de autorización:\n', authUrl, '\n');
    openUrl(authUrl);

    const code = await tryLocalRedirectCapture(oAuth2Client).catch(() => null) || await askCodeFromStdin();
    const { tokens } = await oAuth2Client.getToken(code.trim());
    await saveTokens(tokens);
    console.log('✅ Tokens guardados en tokens/google_sheets_token.json');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error iniciando OAuth:', e.message || e);
    process.exit(1);
  }
})();

function openUrl(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
  } catch {}
}

function askCodeFromStdin() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('👉 Pega aquí el código que te dio Google: ', (code) => {
      rl.close();
      resolve(code);
    });
  });
}

async function tryLocalRedirectCapture(oAuth2Client) {
  const fallback = 'http://localhost:53682';
  const redirect = oAuth2Client.redirectUri || fallback;
  if (!redirect.startsWith('http://localhost')) throw new Error('Sin redirect http://localhost');

  const { port, pathname } = new URL(redirect);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://localhost:${port}`);
      if (u.pathname !== (pathname || '/')) { res.statusCode = 404; return res.end(); }
      const code = u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Autorización completada ✔</h1><p>Ya puedes cerrar esta pestaña.</p>');
      server.close();
      return code ? resolve(code) : reject(new Error('No se recibió "code"'));
    });
    server.listen(port, () => {});
    setTimeout(() => { try { server.close(); } catch {} ; reject(new Error('Timeout esperando redirect')); }, 120000);
  });
}
