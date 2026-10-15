// Бот SECOND GANG: отвечает на /start кнопкой магазина и пересылает оплаченные заказы админу.
// Без зависимостей, Node 18+. Переменные: BOT_TOKEN, ADMIN_ID, WEBAPP_URL, PORT.
import http from 'node:http';
import crypto from 'node:crypto';

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://timoxashvetsov2802-lang.github.io/second-gang-shop/';
const PORT = Number(process.env.PORT) || 3000;
if (!TOKEN) throw new Error('BOT_TOKEN is not set');

const api = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json();
  if (!j.ok) console.error(method, j.description);
  return j.result;
};

const shopButton = { inline_keyboard: [[{ text: 'Открыть магазин', web_app: { url: WEBAPP_URL } }]] };

async function setup() {
  await api('deleteWebhook', { drop_pending_updates: false });
  await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Магазин', web_app: { url: WEBAPP_URL } } });
  await api('setMyCommands', { commands: [{ command: 'start', description: 'Открыть магазин' }] });
  await api('setMyShortDescription', { short_description: 'SECOND GANG SHOP — архивные вещи. Оплата по СБП.' });
  await api('setMyDescription', { description: 'SECOND GANG SHOP\nhard work pays off.\n\nКаталог вещей прямо в Telegram: выбирай, оплачивай по СБП, менеджер @flex_why отправит заказ.' });
}

async function onUpdate(u) {
  const m = u.message;
  if (!m || !m.text) return;
  if (m.text.startsWith('/start')) {
    await api('sendMessage', {
      chat_id: m.chat.id,
      text: '<b>SECOND GANG SHOP</b>\nhard work pays off.\n\nАрхивные вещи с проверкой перед отправкой. Жми кнопку ниже, чтобы открыть каталог.',
      parse_mode: 'HTML',
      reply_markup: shopButton,
    });
  }
}

async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await api('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates || []) {
        offset = u.update_id + 1;
        onUpdate(u).catch((e) => console.error('update', e));
      }
    } catch (e) {
      console.error('poll', e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// Проверка подписи initData из мини-аппки: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function checkInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const data = [...params].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const sign = crypto.createHmac('sha256', secret).update(data).digest('hex');
  if (sign.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(sign), Buffer.from(hash))) return null;
  try { return JSON.parse(params.get('user') || 'null'); } catch { return null; }
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.url === '/health') return res.end('ok');
  if (req.method === 'POST' && req.url === '/order') {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 1e5) break; }
    try {
      const { order: o, initData } = JSON.parse(body);
      const user = checkInitData(initData || '');
      if (!user) { res.statusCode = 403; return res.end('bad initData'); }
      if (ADMIN_ID) {
        await api('sendMessage', {
          chat_id: ADMIN_ID,
          parse_mode: 'HTML',
          text: `🛍 <b>Новый заказ ${esc(o.id)}</b> (демо-оплата СБП)\n\n` +
            `${esc(o.title)} — <b>${esc(o.total)} ₽</b>\n` +
            `Банк: ${esc(o.bank)}\n\n` +
            `Получатель: ${esc(o.name)}, ${esc(o.phone)}\n` +
            `Доставка: ${esc(o.delivery)}, ${esc(o.addr)}\n` +
            (o.comment ? `Комментарий: ${esc(o.comment)}\n` : '') +
            `\nTelegram: ${user.username ? '@' + esc(user.username) : esc(user.first_name)} (id ${user.id})`,
        });
      }
      return res.end('ok');
    } catch (e) {
      res.statusCode = 400; return res.end('bad request');
    }
  }
  res.statusCode = 404; res.end();
});

server.listen(PORT, () => console.log('listening on', PORT));
setup().then(poll);
