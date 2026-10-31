// Бот SECOND GANG: /start с кнопкой магазина, приём оплаченных заказов,
// статусы и трек-номера от админа, уведомления покупателю.
// Без зависимостей, Node 18+. Переменные: BOT_TOKEN, ADMIN_IDS (через запятую), PORT, TUNNEL=1, PUBLIC_URL,
// WEBAPP_URL (если мини-аппка лежит на другом хостинге; по умолчанию её раздаёт этот сервер).
// В канал бот ничего не публикует.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startTunnel } from './tunnel.js';
import { importNew, autoProducts, checkGone } from './channel.js';

const TOKEN = process.env.BOT_TOKEN;
const ADMINS = (process.env.ADMIN_IDS || process.env.ADMIN_ID || '').split(',').map((x) => Number(x.trim())).filter(Boolean);
const isAdminId = (id) => ADMINS.includes(id);
// Мини-аппка живёт на GitHub Pages (работает 24/7, даже когда ПК выключен).
// WEBAPP_URL=self — раздавать её с этого сервера по адресу туннеля/Render.
const WEBAPP_URL = process.env.WEBAPP_URL === 'self' ? '' : process.env.WEBAPP_URL || 'https://timoxashvetsov2802-lang.github.io/second-gang-shop/';
const PORT = Number(process.env.PORT) || 3000;
if (!TOKEN) throw new Error('BOT_TOKEN is not set');

// ---------- данные ----------
const DATA_DIR = process.env.DATA_DIR ? new URL(`file:///${process.env.DATA_DIR.replace(/\\/g, '/').replace(/\/?$/, '/')}`) : new URL('./data/', import.meta.url);
fs.mkdirSync(DATA_DIR, { recursive: true });
// Заказов больше нет: «Купить» сразу открывает чат с менеджером. Из старого orders.json берём только тех,
// кому бот когда-то ставил личную кнопку «Магазин», — чтобы им тоже обновлялся адрес.
const LEGACY_USERS = (() => { try { return JSON.parse(fs.readFileSync(new URL('./orders.json', DATA_DIR), 'utf8')).map((o) => o.userId); } catch { return []; } })();
// Скрытые товары (админ убрал в аппке или в канале написали «продано») — для покупателей они как проданные.
// Заказы вещи больше не прячут: «Купить» теперь просто открывает чат с менеджером, а старые тестовые
// заказы из прежнего оформления сами «продавали» вещи, и вернуть их кнопкой было нельзя.
const HIDDEN_FILE = new URL('./hidden.json', DATA_DIR);
let hidden = new Set(fs.existsSync(HIDDEN_FILE) ? JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8')) : []);
const saveHidden = () => fs.writeFileSync(HIDDEN_FILE, JSON.stringify([...hidden]));
const soldIds = () => new Set(hidden);
const MANAGER = process.env.MANAGER || 'flex_why';

// ---------- Telegram API ----------
// Сбой сети не должен ронять бота: ошибку логируем и возвращаем undefined, вызывающий код это переживает.
const api = async (method, body) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(method === 'getUpdates' ? 70e3 : 20e3),
    });
    const j = await r.json();
    if (!j.ok) console.error(method, j.description);
    return j.result;
  } catch (e) {
    console.error(new Date().toISOString(), method, 'сеть:', e.cause?.code || e.message);
    return undefined;
  }
};
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// На Render адрес сервиса приходит сам (RENDER_EXTERNAL_URL) — тогда бот работает через вебхук.
let publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
const WEBHOOK = !!publicUrl && process.env.TUNNEL !== '1';
const tokenHash = crypto.createHash('sha256').update(TOKEN).digest('hex');
const HOOK_PATH = '/tg/' + tokenHash.slice(0, 24);
const HOOK_SECRET = tokenHash.slice(24, 56);
// v= меняется при каждом запуске бота, чтобы Telegram не показывал закэшированную старую версию.
const VERSION = process.env.APP_VERSION || Date.now().toString(36);
const shopBase = () => WEBAPP_URL || (publicUrl ? publicUrl + '/' : '');
const appUrl = (hash = '') => shopBase() + `?v=${VERSION}` + (publicUrl ? `&api=${encodeURIComponent(publicUrl)}` : '') + hash;
const shopButton = () => (shopBase() ? { inline_keyboard: [[{ text: 'Открыть магазин', web_app: { url: appUrl() } }]] } : undefined);

async function setMenu() {
  if (!shopBase()) return; // адрес туннеля ещё не получен
  await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: appUrl() } } });
  // Покупателям с личной кнопкой тоже обновляем адрес.
  const users = [...new Set(LEGACY_USERS.concat(ADMINS))];
  for (const id of users) await api('setChatMenuButton', { chat_id: id, menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: appUrl() } } });
}

async function setup() {
  if (WEBHOOK) {
    await api('setWebhook', { url: publicUrl + HOOK_PATH, secret_token: HOOK_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  } else {
    await api('deleteWebhook', { drop_pending_updates: false });
  }
  await api('setMyCommands', { commands: [{ command: 'start', description: 'Открыть магазин' }] });
  // У админов были свои команды (заказы, треки) — возвращаем им общий список.
  for (const admin of ADMINS) await api('deleteMyCommands', { scope: { type: 'chat', chat_id: admin } });
  await api('setMyShortDescription', { short_description: 'SECOND GANG SHOP — архивные вещи.' });
  await api('setMyDescription', { description: `SECOND GANG SHOP\n\nКаталог вещей прямо в Telegram: жми «Магазин» внизу, выбирай вещь и жми «Купить» — откроется чат с менеджером @${MANAGER}, там договоритесь об оплате и отправке.` });
  await setMenu();
}

// ---------- обработка апдейтов ----------
async function onMessage(m) {
  const text = (m.text || '').trim();

  if (text.startsWith('/start')) {
    return api('sendMessage', {
      chat_id: m.chat.id,
      text: '<b>SECOND GANG SHOP</b>\n\nАрхивные вещи с проверкой перед отправкой. Жми кнопку ниже, чтобы открыть каталог.',
      parse_mode: 'HTML',
      reply_markup: shopButton(),
    });
  }
}

// Кнопок у бота больше нет — просто гасим «часики» на старых сообщениях.
const onCallback = (q) => api('answerCallbackQuery', { callback_query_id: q.id });

async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await api('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
      if (!updates) { await new Promise((r) => setTimeout(r, 5000)); continue; }
      for (const u of updates || []) {
        offset = u.update_id + 1;
        (u.message ? onMessage(u.message) : u.callback_query ? onCallback(u.callback_query) : Promise.resolve())
          .catch((e) => console.error('update', e));
      }
    } catch (e) {
      console.error('poll', e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// ---------- HTTP API для мини-аппки ----------
// Проверка подписи initData: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function checkInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const data = [...params].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const sign = crypto.createHmac('sha256', secret).update(data).digest('hex');
  if (sign.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(sign), Buffer.from(hash))) return null;
  // Подпись старше суток не принимаем, чтобы перехваченные данные нельзя было переиспользовать.
  if (Date.now() / 1000 - Number(params.get('auth_date') || 0) > 86400) return null;
  try { return JSON.parse(params.get('user') || 'null'); } catch { return null; }
}

// Каталог магазина (data.js) — по нему бот сверяет посты каналов.
const CATALOG_FILE = new URL('../data.js', import.meta.url);
const str = (v, n) => String(v ?? '').slice(0, n);

// ---------- файлы мини-аппки ----------
// Отдаём только страницу, скрипты, стили и картинки из img/ — папка bot/ (токен, заказы) наружу не попадает.
const SHOP_DIR = new URL('../', import.meta.url);
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
const ROOT_FILES = new Set(['index.html', 'app.js', 'data.js', 'style.css']);
function staticFile(rawUrl) {
  let path;
  try { path = decodeURIComponent(rawUrl.split('?')[0]).replace(/^\/+/, '') || 'index.html'; } catch { return null; }
  if (path.includes('..') || path.includes('\\')) return null;
  const ext = path.split('.').pop().toLowerCase();
  const ok = ROOT_FILES.has(path) || (/^img\/[\w/.-]+$/.test(path) && ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext));
  if (!ok) return null;
  const url = new URL(path, SHOP_DIR);
  let stat;
  try { stat = fs.statSync(url); if (!stat.isFile()) return null; } catch { return null; }
  return { url, ext, stat };
}

// ---------- выкладка каталога на GitHub Pages ----------
// live.js = товары из каналов + скрытые админом. Бот пишет его в корень магазина и пушит вместе с фото,
// через минуту GitHub Pages его отдаёт. PUBLISH=0 — не пушить (например, на Render).
const LIVE_FILE = new URL('live.js', SHOP_DIR);
const liveJs = () => `window.PRODUCTS.push(...${JSON.stringify(autoProducts()).replace(/</g, '\\u003c')});\nwindow.HIDDEN = ${JSON.stringify([...hidden])};\n`;
const git = (...args) => new Promise((resolve) => {
  execFile('git', args, { cwd: fileURLToPath(SHOP_DIR), windowsHide: true, timeout: 120e3 }, (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout) + String(stderr) }));
});
let publishTimer = null;
let publishing = false;
function publishLive() {
  if (process.env.PUBLISH === '0') return;
  clearTimeout(publishTimer);
  publishTimer = setTimeout(doPublish, 15e3); // копим изменения 15 с и выкладываем одним коммитом
}
async function doPublish() {
  if (publishing) return publishLive();
  publishing = true;
  try {
    const js = liveJs();
    if ((fs.existsSync(LIVE_FILE) ? fs.readFileSync(LIVE_FILE, 'utf8') : '') !== js) fs.writeFileSync(LIVE_FILE, js);
    for (const p of ['live.js', 'img/auto', 'img/t/auto']) await git('add', '--', p); // папок может ещё не быть
    if ((await git('diff', '--cached', '--quiet')).ok) return; // нечего выкладывать
    const c = await git('commit', '-m', 'Каталог: новые товары из каналов / скрытые');
    if (!c.ok) return console.error('publish commit', c.out.slice(0, 300));
    await git('pull', '--rebase', '--autostash', '-q');
    const p = await git('push', '-q');
    console.log(new Date().toISOString(), p.ok ? 'каталог выложен на GitHub' : 'push не удался: ' + p.out.slice(0, 300));
  } finally { publishing = false; }
}

// Каждый запрос через туннель — это 0,3–0,6 с, поэтому страницу отдаём одним файлом:
// стили, каталог (data.js + товары из каналов) и скрипт вшиты прямо в index.html.
let bundle = { key: '', etag: '', raw: null, gz: null };
function sendBundle(req, res) {
  const read = (f) => fs.readFileSync(new URL(f, SHOP_DIR), 'utf8');
  const parts = ['index.html', 'style.css', 'data.js', 'app.js'].map((f) => fs.statSync(new URL(f, SHOP_DIR)).mtimeMs);
  const autoJs = liveJs();
  const key = parts.join() + ':' + crypto.createHash('md5').update(autoJs).digest('hex');
  if (bundle.key !== key) {
    const js = (s) => s.replace(/<\/script/gi, '<\\/script');
    const html = read('index.html')
      .replace(/<link rel="stylesheet" href="style\.css[^"]*">/, () => `<style>${read('style.css')}</style>`)
      .replace(/<script src="data\.js[^"]*"><\/script>/, () => `<script>${js(read('data.js'))}</script>`)
      .replace(/<script id="live-loader">[\s\S]*?<\/script>/, () => `<script>${js(autoJs)}</script>`)
      .replace(/<script src="app\.js[^"]*"><\/script>/, () => `<script>${js(read('app.js'))}</script>`);
    const raw = Buffer.from(html);
    bundle = { key, etag: `"b-${crypto.createHash('md5').update(raw).digest('hex').slice(0, 16)}"`, raw, gz: zlib.gzipSync(raw, { level: 9 }) };
  }
  res.setHeader('Content-Type', MIME.html);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', bundle.etag);
  res.setHeader('Vary', 'Accept-Encoding');
  if (req.headers['if-none-match'] === bundle.etag) { res.statusCode = 304; return res.end(); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = gz ? bundle.gz : bundle.raw;
  if (gz) res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}

// Туннель рвёт ответы без длины (chunked), поэтому отдаём файл целиком с Content-Length.
// Текст жмём gzip и держим в памяти; ETag даёт 304, чтобы повторно не качать то, что уже есть.
const gzCache = new Map();
function sendFile(req, res, { url, ext, stat }) {
  const text = ['html', 'js', 'css', 'svg'].includes(ext);
  const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  res.setHeader('Content-Type', MIME[ext]);
  // Страницу и скрипты каждый раз сверяем (ETag), чтобы правки сразу доходили; фото кэшируем на неделю.
  res.setHeader('Cache-Control', text && ext !== 'svg' ? 'no-cache' : 'public, max-age=604800');
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
  let body;
  if (text && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const k = url.href;
    if (gzCache.get(k)?.etag !== etag) gzCache.set(k, { etag, buf: zlib.gzipSync(fs.readFileSync(url), { level: 9 }) });
    body = gzCache.get(k).buf;
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
  } else {
    body = fs.readFileSync(url);
  }
  res.setHeader('Content-Length', body.length);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  if (req.url === '/health') return res.end('ok');

  // Вебхук Telegram: принимаем только запросы с нашим секретом.
  if (req.method === 'POST' && req.url === HOOK_PATH) {
    if (req.headers['x-telegram-bot-api-secret-token'] !== HOOK_SECRET) { res.statusCode = 403; return res.end(); }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 1e6) break; }
    res.end('ok');
    try {
      const u = JSON.parse(body);
      await (u.message ? onMessage(u.message) : u.callback_query ? onCallback(u.callback_query) : null);
    } catch (e) { console.error('webhook', e); }
    return;
  }

  const user = checkInitData(req.headers['x-init-data'] || '');
  const json = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  // Товары из каналов и скрытые админом (то же, что бот выкладывает на GitHub в live.js).
  if (req.method === 'GET' && /^\/(auto|live)\.js$/.test(req.url.split('?')[0])) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(liveJs());
  }

  // Проданные вещи: всё, что оплачено и не отменено. Мини-аппка прячет их из каталога.
  if (req.method === 'GET' && req.url === '/sold') {
    return json(200, [...soldIds()]);
  }

  // Мини-аппка спрашивает, админ ли открыл её — тогда показывает кнопки «Убрать / Вернуть».
  if (req.method === 'GET' && req.url === '/me') {
    return json(200, { admin: !!user && isAdminId(user.id) });
  }

  // Админ убирает товар из магазина или возвращает его: { id, hidden: true|false }.
  if (req.method === 'POST' && req.url === '/hide') {
    if (!user || !isAdminId(user.id)) return json(403, { error: 'admins only' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 2e3) return json(413, { error: 'too large' }); }
    try {
      const { id, hidden: hide } = JSON.parse(body);
      const pid = str(id, 80);
      if (!pid) return json(400, { error: 'bad id' });
      hide ? hidden.add(pid) : hidden.delete(pid);
      saveHidden();
      publishLive();
      console.log(new Date().toISOString(), hide ? 'скрыт' : 'возвращён', pid, 'админом', user.id);
      return json(200, [...soldIds()]);
    } catch { return json(400, { error: 'bad request' }); }
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (/^\/(index\.html)?(\?.*)?$/.test(req.url)) return sendBundle(req, res);
    const file = staticFile(req.url);
    if (file) return sendFile(req, res, file);
  }
  json(404, { error: 'not found' });
});

process.on('unhandledRejection', (e) => console.error('unhandled', e));
// Убираем из закрепа старую «Копию заказов» (раньше бот хранил там заказы).
(async () => {
  for (const id of ADMINS) {
    const pin = (await api('getChat', { chat_id: id }))?.pinned_message;
    if (pin?.document && (pin.caption || '').startsWith('#sg_orders_backup')) await api('unpinChatMessage', { chat_id: id, message_id: pin.message_id });
  }
})().catch((e) => console.error('unpin', e));
server.listen(PORT, () => console.log('listening on', PORT, WEBHOOK ? `вебхук ${publicUrl}` : 'long polling'));
setup().catch((e) => console.error('setup', e)).then(() => (WEBHOOK ? null : poll()));

// Новые посты в каналах → товары в магазине. Проверяем раз в 5 минут и пишем админам, что добавили.
async function syncChannels() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(CATALOG_FILE, 'utf8'), sandbox, { timeout: 1000 });
  const added = await importNew(sandbox.window.PRODUCTS || []);
  if (!added.length) return;
  publishLive();
  console.log(new Date().toISOString(), 'добавлено из каналов:', added.map((p) => p.post).join(', '));
  const text = '🆕 <b>Добавил в магазин</b>\n\n' + added.map((p) => `• ${esc(p.title)} — ${esc(p.price)} ₽`).join('\n');
  for (const admin of ADMINS) await api('sendMessage', { chat_id: admin, text, parse_mode: 'HTML', disable_notification: true });
}
const runSync = () => syncChannels().catch((e) => console.error(new Date().toISOString(), 'каналы:', e.message));
runSync();
setInterval(runSync, 5 * 60e3);

// Старые посты: написали в посте «продано» или удалили пост — вещь сама уходит из магазина.
// Каждую вещь убираем один раз: если админ вернул её кнопкой в аппке, повторно не прячем.
const GONE_FILE = new URL('./gone-done.json', DATA_DIR);
async function syncGone() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(CATALOG_FILE, 'utf8'), sandbox, { timeout: 1000 });
  const gone = await checkGone((sandbox.window.PRODUCTS || []).concat(autoProducts()));
  const done = new Set(fs.existsSync(GONE_FILE) ? JSON.parse(fs.readFileSync(GONE_FILE, 'utf8')) : []);
  const fresh = gone.filter((g) => !done.has(g.id) && !hidden.has(g.id));
  for (const g of gone) done.add(g.id);
  fs.writeFileSync(GONE_FILE, JSON.stringify([...done]));
  if (!fresh.length) return;
  for (const g of fresh) hidden.add(g.id);
  saveHidden();
  publishLive();
  console.log(new Date().toISOString(), 'убрано по каналу:', fresh.map((g) => `${g.id} (${g.why})`).join(', '));
  const text = '🗑 <b>Убрал из магазина</b> — в канале продано или пост удалён\n\n' +
    fresh.map((g) => `• ${esc(g.title)} — ${g.why === 'deleted' ? 'пост удалён' : 'продано'}`).join('\n') +
    '\n\n<i>Если ошибся — открой вещь в аппке и нажми «Вернуть в магазин».</i>';
  for (const admin of ADMINS) await api('sendMessage', { chat_id: admin, text, parse_mode: 'HTML', disable_notification: true });
}
const runGone = () => syncGone().catch((e) => console.error(new Date().toISOString(), 'проданные в каналах:', e.message));
setTimeout(runGone, 60e3);
setInterval(runGone, 10 * 60e3);
publishLive(); // на случай, если что-то поменялось, пока бот был выключен
// Бесплатный Render засыпает без входящих запросов — пингуем себя раз в 10 минут.
if (WEBHOOK) setInterval(() => fetch(publicUrl + '/health').catch(() => {}), 10 * 60e3);

if (process.env.TUNNEL === '1' && !process.env.PUBLIC_URL) {
  startTunnel(PORT, (url) => {
    publicUrl = url;
    console.log(new Date().toISOString(), 'публичный адрес', url);
    setMenu().catch((e) => console.error('menu', e));
  });
}
