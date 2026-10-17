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
import { importNew, autoProducts } from './channel.js';

const TOKEN = process.env.BOT_TOKEN;
const ADMINS = (process.env.ADMIN_IDS || process.env.ADMIN_ID || '').split(',').map((x) => Number(x.trim())).filter(Boolean);
const isAdminId = (id) => ADMINS.includes(id);
// Мини-аппка живёт на GitHub Pages (работает 24/7, даже когда ПК выключен).
// WEBAPP_URL=self — раздавать её с этого сервера по адресу туннеля/Render.
const WEBAPP_URL = process.env.WEBAPP_URL === 'self' ? '' : process.env.WEBAPP_URL || 'https://timoxashvetsov2802-lang.github.io/second-gang-shop/';
const PORT = Number(process.env.PORT) || 3000;
if (!TOKEN) throw new Error('BOT_TOKEN is not set');

// ---------- хранилище заказов ----------
const DATA_DIR = process.env.DATA_DIR ? new URL(`file:///${process.env.DATA_DIR.replace(/\\/g, '/').replace(/\/?$/, '/')}`) : new URL('./data/', import.meta.url);
const DB_FILE = new URL('./orders.json', DATA_DIR);
fs.mkdirSync(DATA_DIR, { recursive: true });
let orders = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : [];
const save = () => { fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 1)); scheduleBackup(); };

// Бесплатный хостинг стирает диск при перезапуске, поэтому копия заказов лежит файлом,
// закреплённым в чате первого админа с ботом. Обновляется молча (правка сообщения не шлёт уведомлений).
const BACKUP_CHAT = ADMINS[0];
const BACKUP_TAG = '#sg_orders_backup';
let backupMsgId = 0;
let backupTimer = null;
function scheduleBackup() {
  if (!BACKUP_CHAT || process.env.BACKUP === '0') return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => pushBackup().catch((e) => console.error('backup', e)), 3000);
}
async function tgUpload(method, fields, fileField, name, content) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  form.append(fileField, new Blob([content], { type: 'application/json' }), name);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(30e3) });
    const j = await r.json();
    if (!j.ok) console.error(method, j.description);
    return j.result;
  } catch (e) { console.error(method, 'сеть:', e.cause?.code || e.message); return undefined; }
}
async function pushBackup() {
  const content = JSON.stringify(orders);
  const caption = `${BACKUP_TAG}\nКопия заказов для бота — не удаляй и не открепляй. Заказов: ${orders.length}`;
  if (backupMsgId) {
    const ok = await tgUpload('editMessageMedia', {
      chat_id: String(BACKUP_CHAT), message_id: String(backupMsgId),
      media: { type: 'document', media: 'attach://f', caption },
    }, 'f', 'orders.json', content);
    if (ok) return;
  }
  const msg = await tgUpload('sendDocument', { chat_id: String(BACKUP_CHAT), caption, disable_notification: 'true' }, 'document', 'orders.json', content);
  if (msg) {
    backupMsgId = msg.message_id;
    await api('pinChatMessage', { chat_id: BACKUP_CHAT, message_id: backupMsgId, disable_notification: true });
  }
}
// При старте без локального файла поднимаем заказы из закреплённой копии.
async function restoreBackup() {
  if (!BACKUP_CHAT) return;
  const chat = await api('getChat', { chat_id: BACKUP_CHAT });
  const pin = chat && chat.pinned_message;
  if (!pin || !pin.document || !(pin.caption || '').startsWith(BACKUP_TAG)) return;
  backupMsgId = pin.message_id;
  if (orders.length) return;
  const file = await api('getFile', { file_id: pin.document.file_id });
  if (!file) return;
  try {
    const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`, { signal: AbortSignal.timeout(30e3) });
    const data = await r.json();
    if (Array.isArray(data)) { orders = data; fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 1)); console.log('заказы восстановлены из копии:', orders.length); }
  } catch (e) { console.error('restore', e.message); }
}
const itemsOf = (o) => (o.items && o.items.length ? o.items : [{ productId: o.productId, title: o.title, size: o.size, price: o.total }]);
// Скрытые админом товары (продано / убрали из магазина) — для покупателей они как проданные.
const HIDDEN_FILE = new URL('./hidden.json', DATA_DIR);
let hidden = new Set(fs.existsSync(HIDDEN_FILE) ? JSON.parse(fs.readFileSync(HIDDEN_FILE, 'utf8')) : []);
const saveHidden = () => fs.writeFileSync(HIDDEN_FILE, JSON.stringify([...hidden]));
const soldIds = () => new Set(orders.filter((o) => !['canceled', 'expired'].includes(o.status)).flatMap((o) => itemsOf(o).map((i) => i.productId)).concat([...hidden]));
const findOrder = (id) => orders.find((o) => o.id.toUpperCase() === String(id).toUpperCase());

// paid и expired остались от старой демо-оплаты — чтобы старые заказы показывались нормально.
const STATUS = {
  new: 'Новый', paid: 'Новый', accepted: 'Принят', packing: 'Собираем', shipped: 'Отправлен',
  delivered: 'Доставлен', canceled: 'Отменён', expired: 'Бронь снята',
};
const EMOJI = { new: '🛍', paid: '🛍', accepted: '✅', packing: '📦', shipped: '🚚', delivered: '🏁', canceled: '✖️', expired: '⌛' };
const MANAGER = process.env.MANAGER || 'flex_why';
const TRACK_URL = {
  cdek: (n) => `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(n)}`,
  post: (n) => `https://www.pochta.ru/tracking?barcode=${encodeURIComponent(n)}`,
};

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
  const users = [...new Set(orders.map((o) => o.userId).concat(ADMINS))];
  for (const id of users) await api('setChatMenuButton', { chat_id: id, menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: appUrl() } } });
}

async function setup() {
  if (WEBHOOK) {
    await api('setWebhook', { url: publicUrl + HOOK_PATH, secret_token: HOOK_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
  } else {
    await api('deleteWebhook', { drop_pending_updates: false });
  }
  await api('setMyCommands', { commands: [{ command: 'start', description: 'Открыть магазин' }] });
  for (const admin of ADMINS) {
    await api('setMyCommands', {
      scope: { type: 'chat', chat_id: admin },
      commands: [
        { command: 'start', description: 'Открыть магазин' },
        { command: 'orders', description: 'Активные заказы' },
        { command: 'track', description: 'Трек: /track SG-XXXXX номер' },
      ],
    });
  }
  await api('setMyShortDescription', { short_description: 'SECOND GANG SHOP — архивные вещи.' });
  await api('setMyDescription', { description: `SECOND GANG SHOP\n\nКаталог вещей прямо в Telegram: жми «Магазин» внизу, выбирай вещь и жми «Купить» — откроется чат с менеджером @${MANAGER}, там договоритесь об оплате и отправке.` });
  await setMenu();
}

// ---------- карточка заказа для админа ----------
function adminText(o) {
  return `${EMOJI[o.status] || '🛍'} <b>Заказ ${esc(o.id)}</b> — ${esc(STATUS[o.status] || o.status)}\n\n` +
    itemsOf(o).map((i) => `• ${esc(i.title)}${i.size ? ` (${esc(i.size)})` : ''} — ${esc(i.price)} ₽`).join('\n') + '\n' +
    `Итого: <b>${esc(o.total)} ₽</b>\n` +
    `💬 Оплаты в приложении нет — напиши покупателю и договорись об оплате.\n\n` +
    `ФИО: ${esc(o.name)}\nТел: ${esc(o.phone)}\n` +
    `Доставка: ${esc(o.delivery)}\nАдрес: ${esc(o.addr)}\n` +
    (o.comment ? `Комментарий: ${esc(o.comment)}\n` : '') +
    (o.track ? `\nТрек: <code>${esc(o.track)}</code>\n` : '') +
    `\nПокупатель: ${o.username ? '@' + esc(o.username) : `<a href="tg://user?id=${o.userId}">${esc(o.firstName) || 'написать'}</a>`} (id ${o.userId})\n` +
    (o.status === 'expired' ? ''
      : o.status === 'shipped' || o.status === 'delivered' || o.status === 'canceled' ? ''
      : '\n<i>Чтобы отправить трек-номер — ответь на это сообщение цифрами трека.</i>');
}
function adminKeyboard(o) {
  const b = (st, text) => ({ text: (o.status === st ? '• ' : '') + text, callback_data: `st:${o.id}:${st}` });
  return { inline_keyboard: [
    [b('accepted', 'Принят'), b('packing', 'Собираем')],
    [b('delivered', 'Доставлен'), b('canceled', 'Отменить')],
  ] };
}
async function refreshAdmin(o) {
  for (const m of o.adminMsgs || []) {
    await api('editMessageText', { chat_id: m.chat, message_id: m.msg, text: adminText(o), parse_mode: 'HTML', reply_markup: adminKeyboard(o) });
  }
}

async function notifyBuyer(o) {
  let text = `${EMOJI[o.status]} Заказ <b>${esc(o.id)}</b>: ${esc(STATUS[o.status])}\n${esc(o.title)}`;
  if (o.status === 'shipped' && o.track) {
    text += `\n\nТрек-номер ${esc(o.delivery)}: <code>${esc(o.track)}</code>`;
    if (TRACK_URL[o.deliveryId]) text += `\n<a href="${TRACK_URL[o.deliveryId](o.track)}">Отследить посылку</a>`;
  }
  if (o.status === 'delivered') text += '\n\nСпасибо за покупку! Будем рады отзыву в @gangfeedback';
  await api('sendMessage', {
    chat_id: o.userId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: 'Открыть заказ', web_app: { url: appUrl(`#/order/${o.id}`) } }]] },
  });
}

async function setStatus(o, status, track) {
  o.status = status;
  if (track) o.track = track;
  o.updatedAt = new Date().toISOString();
  save();
  await refreshAdmin(o);
  await notifyBuyer(o);
}

// ---------- обработка апдейтов ----------
const TRACK_RE = /^[A-Za-z0-9-]{6,30}$/;

async function onMessage(m) {
  const text = (m.text || '').trim();
  const isAdmin = m.from && isAdminId(m.from.id);

  if (text.startsWith('/start')) {
    return api('sendMessage', {
      chat_id: m.chat.id,
      text: '<b>SECOND GANG SHOP</b>\n\nАрхивные вещи с проверкой перед отправкой. Жми кнопку ниже, чтобы открыть каталог.',
      parse_mode: 'HTML',
      reply_markup: shopButton(),
    });
  }
  if (!isAdmin) return;

  // Ответ на карточку заказа цифрами — это трек-номер.
  const replied = m.reply_to_message && orders.find((o) => (o.adminMsgs || []).some((x) => x.chat === m.chat.id && x.msg === m.reply_to_message.message_id));
  if (replied && TRACK_RE.test(text.replace(/\s/g, ''))) {
    const track = text.replace(/\s/g, '');
    await setStatus(replied, 'shipped', track);
    return api('sendMessage', { chat_id: m.chat.id, text: `🚚 Трек ${track} добавлен к ${replied.id}, покупатель уведомлён.`, reply_parameters: { message_id: m.message_id } });
  }

  const tr = text.match(/^\/track\s+(SG-\w+)\s+(\S+)/i);
  if (tr) {
    const o = findOrder(tr[1]);
    if (!o) return api('sendMessage', { chat_id: m.chat.id, text: `Заказ ${tr[1]} не найден` });
    await setStatus(o, 'shipped', tr[2]);
    return api('sendMessage', { chat_id: m.chat.id, text: `🚚 Трек ${tr[2]} добавлен к ${o.id}, покупатель уведомлён.` });
  }
  if (text.startsWith('/track')) {
    return api('sendMessage', { chat_id: m.chat.id, text: 'Формат: /track SG-XXXXX трек-номер\nИли просто ответь на карточку заказа цифрами трека.' });
  }

  if (text.startsWith('/orders')) {
    const active = orders.filter((o) => !['delivered', 'canceled'].includes(o.status)).slice(-20);
    if (!active.length) return api('sendMessage', { chat_id: m.chat.id, text: 'Активных заказов нет' });
    return api('sendMessage', {
      chat_id: m.chat.id, parse_mode: 'HTML',
      text: '<b>Активные заказы</b>\n\n' + active.map((o) => `${EMOJI[o.status]} <code>${o.id}</code> — ${esc(o.title)}, ${esc(STATUS[o.status])}${o.track ? `, трек ${esc(o.track)}` : ''}`).join('\n'),
    });
  }
}

async function onCallback(q) {
  const [kind, id, st] = (q.data || '').split(':');
  if (kind !== 'st' || !isAdminId(q.from.id)) return api('answerCallbackQuery', { callback_query_id: q.id });
  const o = findOrder(id);
  if (!o || !STATUS[st]) return api('answerCallbackQuery', { callback_query_id: q.id, text: 'Заказ не найден' });
  if (o.status === st) return api('answerCallbackQuery', { callback_query_id: q.id, text: 'Уже стоит этот статус' });
  await setStatus(o, st);
  return api('answerCallbackQuery', { callback_query_id: q.id, text: `${o.id}: ${STATUS[st]}` });
}

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

// Каталог читаем с диска (тот же data.js, что на сайте): цены и названия берём отсюда, а не из запроса.
const CATALOG_FILE = new URL('../data.js', import.meta.url);
let catalog = { mtime: 0, byId: new Map() };
function getCatalog() {
  const { mtimeMs } = fs.statSync(CATALOG_FILE);
  if (mtimeMs !== catalog.mtime) {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(CATALOG_FILE, 'utf8'), sandbox, { timeout: 1000 });
    catalog = { mtime: mtimeMs, byId: new Map((sandbox.window.PRODUCTS || []).map((p) => [p.id, p])) };
  }
  return catalog.byId;
}

// Не больше 3 заказов в сутки и 1 запроса в 10 секунд на покупателя — защита от того,
// чтобы кто-то «скупил» весь каталог фейковыми заказами.
const lastHit = new Map();
function rateLimited(userId) {
  const now = Date.now();
  if (now - (lastHit.get(userId) || 0) < 10e3) return true;
  lastHit.set(userId, now);
  const day = orders.filter((o) => o.userId === userId && now - Date.parse(o.createdAt) < 864e5 && o.status !== 'canceled');
  return day.length >= 3;
}
const NAME_RE = /^[А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?( [А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?){1,2}$/;
const PHONE_RE = /^\+7 \(9\d\d\) \d{3}-\d\d-\d\d$/;

const pick = (o) => ({
  id: o.id, productId: o.productId, items: itemsOf(o), title: o.title, size: o.size, total: o.total, name: o.name, phone: o.phone,
  addr: o.addr, delivery: o.delivery, deliveryId: o.deliveryId, comment: o.comment,
  status: o.status, track: o.track || '', createdAt: o.createdAt, updatedAt: o.updatedAt,
});
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

  if (req.method === 'GET' && req.url === '/orders') {
    if (!user) return json(403, { error: 'bad initData' });
    return json(200, orders.filter((o) => o.userId === user.id).map(pick));
  }

  if (req.method === 'POST' && req.url === '/order') {
    if (!user) return json(403, { error: 'bad initData' });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 2e4) return json(413, { error: 'too large' }); }
    try {
      const o = JSON.parse(body).order || {};
      if (!/^SG-[A-Z0-9]{3,8}$/.test(o.id) || findOrder(o.id)) return json(400, { error: 'bad id' });
      // Из запроса берём только id вещей; цену, название и размер — из каталога на сервере.
      const ids = [...new Set((Array.isArray(o.items) && o.items.length ? o.items.map((i) => i && i.productId) : [o.productId]).map((x) => str(x, 80)))];
      const cat = getCatalog();
      if (!ids.length || ids.length > 10 || ids.some((id) => !cat.has(id))) return json(400, { error: 'bad items' });
      const items = ids.map((id) => { const p = cat.get(id); return { productId: id, title: p.title, size: p.size || '', price: p.price }; });
      if (!NAME_RE.test(str(o.name, 120)) || !PHONE_RE.test(str(o.phone, 30)) || str(o.addr, 300).trim().length < 8) return json(400, { error: 'bad contact' });
      if (!['cdek', 'post', '5post', 'ymarket'].includes(o.deliveryId)) return json(400, { error: 'bad delivery' });
      if (rateLimited(user.id)) return json(429, { error: 'too many orders' });
      const taken = soldIds();
      if (items.some((i) => taken.has(i.productId))) return json(409, { error: 'sold' });
      const rec = {
        id: o.id, userId: user.id, username: user.username || '', firstName: user.first_name || '',
        productId: items[0].productId, items, title: items[0].title + (items.length > 1 ? ` + ещё ${items.length - 1}` : ''),
        size: items[0].size, total: items.reduce((sum, i) => sum + i.price, 0),
        name: str(o.name, 120), phone: str(o.phone, 30), addr: str(o.addr, 300),
        delivery: str(o.delivery, 40), deliveryId: o.deliveryId, comment: str(o.comment, 500),
        status: 'new', track: '', createdAt: new Date().toISOString(),
      };
      orders.push(rec); save();
      rec.adminMsgs = [];
      for (const admin of ADMINS) {
        const msg = await api('sendMessage', { chat_id: admin, text: adminText(rec), parse_mode: 'HTML', reply_markup: adminKeyboard(rec) });
        if (msg) rec.adminMsgs.push({ chat: admin, msg: msg.message_id });
      }
      save();
      await api('sendMessage', {
        chat_id: rec.userId, parse_mode: 'HTML',
        text: `🛍 Заказ <b>${esc(rec.id)}</b> оформлен\n${esc(rec.title)} — ${esc(rec.total)} ₽\n\nМенеджер @${MANAGER} напишет тебе, чтобы договориться об оплате и отправке.`,
        reply_markup: { inline_keyboard: [[{ text: 'Открыть заказ', web_app: { url: appUrl(`#/order/${rec.id}`) } }]] },
      });
      return json(200, pick(rec));
    } catch (e) {
      return json(400, { error: 'bad request' });
    }
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (/^\/(index\.html)?(\?.*)?$/.test(req.url)) return sendBundle(req, res);
    const file = staticFile(req.url);
    if (file) return sendFile(req, res, file);
  }
  json(404, { error: 'not found' });
});

process.on('unhandledRejection', (e) => console.error('unhandled', e));
await restoreBackup().catch((e) => console.error('restore', e));
if (!backupMsgId && orders.length) scheduleBackup();
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
