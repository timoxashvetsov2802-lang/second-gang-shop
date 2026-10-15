// Бот SECOND GANG: /start с кнопкой магазина, приём оплаченных заказов,
// статусы и трек-номера от админа, уведомления покупателю.
// Без зависимостей, Node 18+. Переменные: BOT_TOKEN, ADMIN_IDS (через запятую), WEBAPP_URL, PORT, TUNNEL=1, PUBLIC_URL.
// В канал бот ничего не публикует.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { startTunnel } from './tunnel.js';

const TOKEN = process.env.BOT_TOKEN;
const ADMINS = (process.env.ADMIN_IDS || process.env.ADMIN_ID || '').split(',').map((x) => Number(x.trim())).filter(Boolean);
const isAdminId = (id) => ADMINS.includes(id);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://timoxashvetsov2802-lang.github.io/second-gang-shop/';
const PORT = Number(process.env.PORT) || 3000;
if (!TOKEN) throw new Error('BOT_TOKEN is not set');

// ---------- хранилище заказов ----------
const DATA_DIR = process.env.DATA_DIR ? new URL(`file:///${process.env.DATA_DIR.replace(/\\/g, '/').replace(/\/?$/, '/')}`) : new URL('./data/', import.meta.url);
const DB_FILE = new URL('./orders.json', DATA_DIR);
fs.mkdirSync(DATA_DIR, { recursive: true });
let orders = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : [];
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 1));
const itemsOf = (o) => (o.items && o.items.length ? o.items : [{ productId: o.productId, title: o.title, size: o.size, price: o.total }]);
const soldIds = () => new Set(orders.filter((o) => !['canceled', 'expired'].includes(o.status)).flatMap((o) => itemsOf(o).map((i) => i.productId)));
const findOrder = (id) => orders.find((o) => o.id.toUpperCase() === String(id).toUpperCase());

const STATUS = {
  paid: 'Оплачен', accepted: 'Принят', packing: 'Собираем', shipped: 'Отправлен',
  delivered: 'Доставлен', canceled: 'Отменён', expired: 'Бронь снята',
};
const EMOJI = { paid: '💳', accepted: '✅', packing: '📦', shipped: '🚚', delivered: '🏁', canceled: '✖️', expired: '⌛' };

// Демо-оплата: деньги не приходят, поэтому «оплаченный» заказ держит вещь только 15 минут.
// Если за это время админ не взял заказ в работу (Принят/Собираем/трек), вещь возвращается в каталог.
const DEMO_PAYMENT = process.env.DEMO_PAYMENT !== '0';
const DEMO_HOLD_MS = 15 * 60e3;
async function releaseDemoHolds() {
  if (!DEMO_PAYMENT) return;
  for (const o of orders) {
    if (o.status === 'paid' && Date.now() - Date.parse(o.createdAt) > DEMO_HOLD_MS) {
      o.status = 'expired'; o.updatedAt = new Date().toISOString(); save();
      await refreshAdmin(o);
    }
  }
}
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

let publicUrl = process.env.PUBLIC_URL || '';
// v= меняется при каждом запуске бота, чтобы Telegram не показывал закэшированную старую версию.
const VERSION = process.env.APP_VERSION || Date.now().toString(36);
const appUrl = (hash = '') => WEBAPP_URL + `?v=${VERSION}` + (publicUrl ? `&api=${encodeURIComponent(publicUrl)}` : '') + hash;
const shopButton = () => ({ inline_keyboard: [[{ text: 'Открыть магазин', web_app: { url: appUrl() } }]] });

async function setMenu() {
  await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: appUrl() } } });
  // Покупателям с личной кнопкой тоже обновляем адрес.
  const users = [...new Set(orders.map((o) => o.userId).concat(ADMINS))];
  for (const id of users) await api('setChatMenuButton', { chat_id: id, menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: appUrl() } } });
}

async function setup() {
  await api('deleteWebhook', { drop_pending_updates: false });
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
  await api('setMyShortDescription', { short_description: 'SECOND GANG SHOP — архивные вещи. Оплата по СБП.' });
  await api('setMyDescription', { description: 'SECOND GANG SHOP\n\nКаталог вещей прямо в Telegram: жми «Магазин» внизу, выбирай, оплачивай по СБП. Менеджер @flex_why отправит заказ.' });
  await setMenu();
}

// ---------- карточка заказа для админа ----------
function adminText(o) {
  return `${EMOJI[o.status] || '🛍'} <b>Заказ ${esc(o.id)}</b> — ${esc(STATUS[o.status] || o.status)}\n\n` +
    itemsOf(o).map((i) => `• ${esc(i.title)}${i.size ? ` (${esc(i.size)})` : ''} — ${esc(i.price)} ₽`).join('\n') + '\n' +
    `Итого: <b>${esc(o.total)} ₽</b>\n` +
    `⚠️ <b>ДЕМО-оплата: деньги НЕ поступали.</b> Не отправляй вещь, пока не увидишь деньги на счёте.\n\n` +
    `ФИО: ${esc(o.name)}\nТел: ${esc(o.phone)}\n` +
    `Доставка: ${esc(o.delivery)}\nАдрес: ${esc(o.addr)}\n` +
    (o.comment ? `Комментарий: ${esc(o.comment)}\n` : '') +
    (o.track ? `\nТрек: <code>${esc(o.track)}</code>\n` : '') +
    `\nПокупатель: ${o.username ? '@' + esc(o.username) : esc(o.firstName)} (id ${o.userId})\n` +
    (o.status === 'expired' ? '\n<i>Демо-бронь истекла через 15 минут — вещь вернулась в каталог.</i>'
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Init-Data');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.end();
  if (req.url === '/health') return res.end('ok');

  const user = checkInitData(req.headers['x-init-data'] || '');
  const json = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  // Проданные вещи: всё, что оплачено и не отменено. Мини-аппка прячет их из каталога.
  if (req.method === 'GET' && req.url === '/sold') {
    return json(200, [...soldIds()]);
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
        status: 'paid', track: '', createdAt: new Date().toISOString(),
      };
      orders.push(rec); save();
      rec.adminMsgs = [];
      for (const admin of ADMINS) {
        const msg = await api('sendMessage', { chat_id: admin, text: adminText(rec), parse_mode: 'HTML', reply_markup: adminKeyboard(rec) });
        if (msg) rec.adminMsgs.push({ chat: admin, msg: msg.message_id });
      }
      save();
      return json(200, pick(rec));
    } catch (e) {
      return json(400, { error: 'bad request' });
    }
  }
  json(404, { error: 'not found' });
});

server.listen(PORT, () => console.log('listening on', PORT));
setup().catch((e) => console.error('setup', e)).then(poll);
releaseDemoHolds();
setInterval(() => releaseDemoHolds().catch((e) => console.error('holds', e)), 60e3);
process.on('unhandledRejection', (e) => console.error('unhandled', e));

if (process.env.TUNNEL === '1' && !process.env.PUBLIC_URL) {
  startTunnel(PORT, (url) => {
    publicUrl = url;
    console.log(new Date().toISOString(), 'публичный адрес', url);
    setMenu().catch((e) => console.error('menu', e));
  });
}
