// Автоимпорт товаров из каналов: бот читает публичную ленту t.me/s/<канал>, и каждый новый пост
// с ценой и фото становится товаром в магазине. Фото скачиваются в img/auto/, товары — в data/auto-products.json.
// Старые посты не трогаем: импортируются только посты новее последнего, что уже есть в каталоге.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CHANNELS = ['secondgangg', 'secondgang2'];
const SHOP_DIR = new URL('../', import.meta.url);
const DATA_DIR = new URL('./data/', import.meta.url);
const AUTO_FILE = new URL('auto-products.json', DATA_DIR);
const STATE_FILE = new URL('channel-state.json', DATA_DIR);

const BRANDS = ['Stone Island', 'C.P. Company', 'Rick Owens', 'Rick Owen’s', 'Dolce & Gabbana', 'Paul & Shark', 'Armani Exchange', 'Tommy Hilfiger',
  'Enfants Riches Deprimes', 'Loro Piano', 'Cav Empt', 'Ed Hardy', 'Nike Acg', 'Nike', 'Adidas', 'Puma', 'Reebok', 'Salomon', 'Lacoste',
  'Celine', 'Givenchy', 'Gucci', 'Diesel', 'Levi’s', 'Kenzo', 'Champion', 'Columbia', 'Superdry', 'Mizuno', 'Casio', 'Aape', 'Zara',
  'Amiri', 'Balenciaga', 'Carhartt', 'Dc Shoes', 'Realtree', 'Eminem', 'Alyaska', 'Buffalo Sabres', 'Russia Team',
  'Under Armour', 'Jordan', 'Polo Ralph Lauren', 'Ralph Lauren', 'The North Face', 'Stussy', 'New Balance', 'Vans', 'Converse',
  'Fila', 'Kappa', 'Umbro', 'Burberry', 'Prada', 'Moncler', 'Arc’teryx', 'Hugo Boss', 'Boss', 'Calvin Klein', 'Guess', 'Evisu'];
const BRAND_FIX = { 'Rick Owen’s': 'Rick Owens', 'Nike Acg': 'Nike ACG', 'Dc Shoes': 'DC Shoes', 'Loro Piano': 'Loro Piana' };
const CATS = [['Обувь', /shoes|sneaker|boots|кроссовк|huarache|dunk/i], ['Головные уборы', /\bcap\b|кепк|beanie/i],
  ['Аксессуары', /wallet|watch|кошел|часы|bag/i], ['Низ', /jeans|pants|shorts|джинс|штаны|брюки/i],
  ['Куртки', /jacket|windbreaker|bomber|puffer|куртк|track jacket|drill/i]];

const readJson = (url, d) => { try { return JSON.parse(fs.readFileSync(url, 'utf8')); } catch { return d; } };
export const autoProducts = () => readJson(AUTO_FILE, []);

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const field = (t, name) => (t.match(new RegExp('•\\s*' + name + '\\s*:\\s*(.+)', 'i')) || [])[1]?.trim() || '';
const key = (title) => title.toLowerCase().replace('archve', 'archive').replace('type ', '').replace(/[^a-zа-яё0-9]/g, '');

function normSize(raw, cat) {
  const base = raw.replace(/\(.*?\)/g, '').trim().replace(/^-+|-+$/g, '').trim();
  const notes = [...raw.matchAll(/\((.*?)\)/g)].map((m) => m[1]);
  if (!base || ['uni', '-', '—'].includes(base.toLowerCase())) return ['', notes];
  if (/^\d/.test(base)) return [cat === 'Обувь' ? base + ' EU' : base, notes];
  return [base.split(/\s*[-/]\s*/).filter(Boolean).map((p) => p.toUpperCase()).join('–'), notes];
}

// Пост из ленты t.me/s → { post, id, date, text, photos }
function parsePage(html) {
  return html.split('<div class="tgme_widget_message_wrap').slice(1).map((b) => {
    const post = (b.match(/data-post="([^"]+)"/) || [])[1];
    const t = (b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
    const text = decode(t.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''));
    const photos = [...b.matchAll(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g)].map((m) => m[1]);
    const date = (b.match(/<time datetime="([^"]+)"/) || [])[1] || '';
    return post && { post, id: Number(post.split('/')[1]), date, text, photos };
  }).filter(Boolean);
}

function toProduct(p, takenIds) {
  const t = p.text;
  if (!/цена/i.test(t) || !p.photos.length || /продан/i.test(t)) return null;
  const lines = t.split('\n').map((l) => l.trim()).filter((l) => l && !/доступно\s*#подзаказ/i.test(l));
  const title = (lines[0] || '').replace(/\s+/g, ' ').trim();
  const price = Number(field(t, 'цена').replace(/\D/g, ''));
  if (!title || !price) return null;
  const cat = (CATS.find(([, rx]) => rx.test(title)) || ['Верх'])[0];
  const [size, notes] = normSize(field(t, 'размер'), cat);
  const cond = field(t, 'состояние').toLowerCase();
  const desc = ((t.match(/•\s*цена[^\n]*\n([\s\S]*?)(•\s*Наличие|$)/i) || [])[1] || '').replace(/\n{2,}/g, '\n').trim();
  const low = ' ' + title.toLowerCase();
  let brand = BRANDS.find((b) => low.startsWith(' ' + b.toLowerCase()) || low.includes(' ' + b.toLowerCase())) || title.split(' ')[0];
  brand = BRAND_FIX[brand] || brand;
  let id = title.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item-' + p.id;
  while (takenIds.has(id)) id += '-' + p.id;
  return {
    id, brand, title, category: cat, price, size, sizeNote: notes.join(', '), condition: cond ? cond[0].toUpperCase() + cond.slice(1) : '',
    desc, preorder: /доступно\s*#подзаказ/i.test(t), added: p.date.slice(0, 19), post: p.post, src: p.photos.slice(0, 5),
  };
}

const UA = { 'User-Agent': 'Mozilla/5.0' };
async function get(url, binary) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30e3) });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}

// Новые посты канала: листаем ленту назад (?before=), пока не дойдём до уже виденного.
async function newPosts(ch, lastSeen) {
  const out = [];
  let before = '';
  for (let page = 0; page < 5; page++) {
    const posts = parsePage(await get(`https://t.me/s/${ch}${before ? '?before=' + before : ''}`));
    if (!posts.length) break;
    out.push(...posts.filter((p) => p.id > lastSeen));
    const oldest = Math.min(...posts.map((p) => p.id));
    if (oldest <= lastSeen + 1) break;
    before = oldest;
  }
  return out.sort((a, b) => a.id - b.id);
}

// Один проход: вернёт добавленные товары. baseProducts — каталог из data.js.
export async function importNew(baseProducts) {
  const auto = autoProducts();
  const all = baseProducts.concat(auto);
  const state = readJson(STATE_FILE, {});
  // Первый запуск: точка отсчёта — самый свежий пост канала, который уже есть в каталоге.
  for (const ch of CHANNELS) {
    if (state[ch] == null) state[ch] = Math.max(0, ...all.filter((p) => p.post?.startsWith(ch + '/')).map((p) => Number(p.post.split('/')[1])));
  }
  const takenIds = new Set(all.map((p) => p.id));
  const seenKeys = new Set(all.map((p) => key(p.title)));
  const added = [];
  for (const ch of CHANNELS) {
    for (const post of await newPosts(ch, state[ch])) {
      state[ch] = Math.max(state[ch], post.id);
      const item = toProduct(post, takenIds);
      if (!item || seenKeys.has(key(item.title))) continue;
      item.photos = [];
      fs.mkdirSync(new URL('img/auto/', SHOP_DIR), { recursive: true });
      for (const [i, src] of item.src.entries()) {
        const rel = `img/auto/${item.id}-${i + 1}.jpg`;
        try { fs.writeFileSync(new URL(rel, SHOP_DIR), await get(src, true)); item.photos.push(rel); } catch (e) { console.error('фото', post.post, e.message); }
      }
      delete item.src;
      if (!item.photos.length) continue;
      // Лёгкие превью для каталога (img/t/...). Нет Python — аппка сама возьмёт полное фото.
      const py = spawnSync('python', [fileURLToPath(new URL('tools/thumbs.py', SHOP_DIR)),
        ...item.photos.map((rel) => fileURLToPath(new URL(rel, SHOP_DIR)))], { timeout: 60e3, windowsHide: true });
      if (py.status !== 0) console.error('превью', post.post, String(py.stderr || py.error || '').slice(0, 200));
      takenIds.add(item.id); seenKeys.add(key(item.title));
      auto.push(item); added.push(item);
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (added.length) fs.writeFileSync(AUTO_FILE, JSON.stringify(auto, null, 1));
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  return added;
}
