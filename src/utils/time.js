// src/utils/time.js
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function within24h(isoThen) { return Date.now() - new Date(isoThen).getTime() < 24 * 3600 * 1000; }
function nowISO() { return new Date().toISOString(); }
function nowLocalStr() { return new Date().toLocaleString('es-PE', { hour12: false }); }
function makeId(number) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14); // yyyymmddHHMMSS
  return `${number}_${stamp}`;
}

/**
 * Limitador de 5 envíos por hora (o el límite que configures).
 * - Ventana deslizante de 60 min anclada al primer envío.
 * - Si se alcanza el límite, espera hasta abrir una nueva ventana.
 */
class HourlyRateLimiter {
  constructor(limitPerHour = 5, windowMs = 3600000) {
    this.limit = limitPerHour;
    this.windowMs = windowMs;
    this.windowStart = 0;
    this.count = 0;
  }

  _resetWindow(now) {
    this.windowStart = now;
    this.count = 0;
  }

  async beforeSend() {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) this._resetWindow(now);

    if (this.count >= this.limit) {
      const waitMs = this.windowStart + this.windowMs - now;
      const minLeft = Math.ceil(waitMs / 60000);
      console.log(`⏳ Límite ${this.limit}/h alcanzado. Esperando ~${minLeft} min para nueva ventana...`);
      await sleep(waitMs);
      this._resetWindow(Date.now());
    }
  }

  markAttempt() {
    const now = Date.now();
    if (now - this.windowStart >= this.windowMs) this._resetWindow(now);
    this.count += 1;
  }
}

module.exports = {
  sleep,
  randomInt,
  within24h,
  nowISO,
  nowLocalStr,
  makeId,
  HourlyRateLimiter,
};
