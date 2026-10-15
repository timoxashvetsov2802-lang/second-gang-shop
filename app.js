(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.initData);
  const $view = document.getElementById('view');
  const $drawer = document.getElementById('drawer');
  const $scrim = document.getElementById('scrim');
  const S = window.SHOP;

  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000'); tg.setBottomBarColor && tg.setBottomBarColor('#000000'); } catch (e) {}
    if (inTg) {
      document.body.classList.add('tg');
      try {
        if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes();
        if (tg.isVersionAtLeast('8.0') && ['ios', 'android'].includes(tg.platform)) tg.requestFullscreen();
      } catch (e) {}
    }
    tg.BackButton.onClick(() => history.length > 1 ? history.back() : go('#/'));
  }

  // ---------- storage ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  let favs = new Set(store.get('sg_favs', []));
  let orders = store.get('sg_orders', []);
  const saveFavs = () => store.set('sg_favs', [...favs]);
  const saveOrders = () => store.set('sg_orders', orders);
  const draft = store.get('sg_contact', {});

  // Адрес сервера бота приходит параметром ?api= из кнопки бота (адрес туннеля меняется).
  const apiParam = new URLSearchParams(location.search).get('api');
  // Принимаем только адреса нашего туннеля, чтобы чужая ссылка не подменила сервер.
  const okApi = (u) => typeof u === 'string' && /^https:\/\/[a-z0-9-]+\.(lhr\.life|onrender\.com)$/.test(u);
  if (okApi(apiParam)) store.set('sg_api', apiParam);
  const stored = store.get('sg_api', '');
  const API = (okApi(apiParam) ? apiParam : okApi(stored) ? stored : '') || S.api || '';

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = (n) => Number(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
  const byId = (id) => window.PRODUCTS.find((p) => p.id === id);
  const go = (h) => { location.hash = h; };
  const haptic = (t = 'light') => { try { tg.HapticFeedback.impactOccurred(t); } catch (e) {} };
  const notify = (t) => { try { tg.HapticFeedback.notificationOccurred(t); } catch (e) {} };
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const ago = (iso) => {
    const d = new Date(iso), now = new Date();
    const days = Math.floor((now - d) / 864e5);
    const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (days <= 0 && now.getDate() === d.getDate()) return 'сегодня в ' + hm;
    if (days <= 1) return 'вчера в ' + hm;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };
  const toast = (t) => {
    const el = document.getElementById('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
  };
  const copy = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    notify('success'); toast('Скопировано');
    if (btn) { btn.classList.add('done'); setTimeout(() => btn.classList.remove('done'), 1500); }
  };
  const openLink = (url) => {
    if (tg && inTg) { url.startsWith('https://t.me/') ? tg.openTelegramLink(url) : tg.openLink(url); }
    else window.open(url, '_blank');
  };

  const I = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1 14H6zM9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    loader: '<svg viewBox="0 0 24 24" class="spin"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  };

  // Статусы заказа: paid ставит приложение после оплаты, остальные — админ в боте.
  const STATUS = {
    awaiting: 'Ждёт оплаты', paid: 'Оплачен', accepted: 'Принят', packing: 'Собираем',
    shipped: 'Отправлен', delivered: 'Доставлен', canceled: 'Отменён', expired: 'Бронь снята',
  };
  const FLOW = ['paid', 'packing', 'shipped', 'delivered'];
  const TRACK_URL = {
    cdek: (n) => `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(n)}`,
    post: (n) => `https://www.pochta.ru/tracking?barcode=${encodeURIComponent(n)}`,
  };

  const noPhoto = (p, big) => `
    <div class="noph ${big ? 'big' : ''}">
      <span class="np-brand">${esc(p.brand)}</span>
      <span class="np-cat">${esc(p.category)}</span>
      <span class="np-mark">SECOND GANG</span>
    </div>`;
  const initials = (b) => b.split(/[\s.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const thumbImg = (p) => !p ? '<div class="noph-mini">SG</div>'
    : p.photos.length ? `<img src="${esc(p.photos[0])}" alt="">` : `<div class="noph-mini">${esc(initials(p.brand))}</div>`;
  const favBtn = (id) => `<button class="fav ${favs.has(id) ? 'on' : ''}" data-fav="${esc(id)}" aria-label="В избранное">${I.heart}</button>`;
  const backLink = (href, label = 'Назад') => `<a class="back" href="${href}">${I.back}${label}</a>`;

  const card = (p) => `
    <a class="card fade" href="#/p/${esc(p.id)}">
      <div class="ph">
        ${p.photos.length ? `<img src="${esc(p.photos[0])}" alt="${esc(p.title)}" loading="lazy">` : noPhoto(p)}
        ${favBtn(p.id)}
        ${p.size ? `<span class="size">${esc(p.size)}</span>` : ''}
        ${p.preorder ? '<span class="pre">под заказ</span>' : ''}
      </div>
      <div class="price">${rub(p.price)}</div>
      <div class="title">${esc(p.title)}</div>
      <div class="meta">${esc(p.condition)}</div>
    </a>`;

  // ---------- state ----------
  let cat = 'Все';
  let query = '';
  let timer = null;

  // Проданные вещи (у всех покупателей) приходят с сервера бота и скрываются из каталога.
  let sold = new Set(store.get('sg_sold', []));
  const orderIds = (o) => (o.items && o.items.length ? o.items.map((i) => i.productId) : [o.productId]);
  const isSold = (id) => sold.has(id) || orders.some((o) => orderIds(o).includes(id) && !['awaiting', 'expired', 'canceled'].includes(o.status));

  // Корзина: id вещей; проданные и пропавшие из каталога выкидываем.
  let cart = store.get('sg_cart', []);
  const saveCart = () => store.set('sg_cart', cart);
  const cartProducts = () => cart.map(byId).filter((p) => p && !isSold(p.id));
  const inCart = (id) => cart.includes(id);
  async function syncSold() {
    if (!API) return;
    try {
      const r = await fetch(API + '/sold');
      if (!r.ok) return;
      const next = new Set(await r.json());
      if ([...next].join() !== [...sold].join()) {
        sold = next; store.set('sg_sold', [...sold]);
        const route = location.hash.split('/')[1] || '';
        if (['', 'fav', 'p'].includes(route)) { render.keepScroll = true; render(); }
      }
    } catch (e) {}
  }

  const activeOrders = () => orders.filter((o) => !['awaiting', 'expired', 'canceled', 'delivered'].includes(o.status)).length;

  // ---------- views ----------
  function home() {
    const list = window.PRODUCTS.filter((p) => !isSold(p.id) &&
      (cat === 'Все' || p.category === cat) &&
      (!query || (p.title + ' ' + p.brand).toLowerCase().includes(query.toLowerCase()))
    ).sort((a, b) => b.added.localeCompare(a.added));

    return `
      <header class="top">
        <div class="brand">
          <button class="avatar-btn" data-menu aria-label="Открыть меню"><img src="img/logo.jpg" alt="SECOND GANG SHOP"></button>
          <div class="grow"><b>${esc(S.name)}</b><small>shop · ${list.length} ${plural(list.length, 'вещь', 'вещи', 'вещей')} в наличии</small></div>
          <a class="icon-btn" href="#/cart" aria-label="Корзина">${I.bag}${cartProducts().length ? `<i class="num">${cartProducts().length}</i>` : ''}</a>
        </div>
        <label class="search">${I.search}<input id="q" type="search" placeholder="Поиск по бренду или вещи" value="${esc(query)}" autocomplete="off"></label>
      </header>
      <div class="chips">${window.CATEGORIES.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="section-head"><h2>${query ? 'Результаты' : 'Свежее'}</h2><span>${list.length} ${plural(list.length, 'вещь', 'вещи', 'вещей')}</span></div>
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>`
        : `<div class="empty"><b>Ничего не нашли</b>Попробуй другой бренд или категорию</div>`}
      <div class="swipe-hint">Свайп от левого края или тап по аватарке — меню</div>
    `;
  }

  function product(id) {
    const p = byId(id);
    if (!p) return notFound();
    const mine = orders.find((o) => orderIds(o).includes(id) && !['awaiting', 'expired', 'canceled'].includes(o.status));
    const gone = !mine && isSold(id);
    const badge = mine ? 'Твой заказ' : gone ? 'Продано' : p.preorder ? 'Под заказ' : '';
    return `
      <div class="gallery">
        ${p.photos.length ? `
        <div class="slides" id="slides">${p.photos.map((src, i) => `<img src="${esc(src)}" alt="${esc(p.title)} — фото ${i + 1}">`).join('')}</div>
        <div class="dots" id="dots">${p.photos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : noPhoto(p, true)}
        ${favBtn(p.id)}
      </div>
      ${p.photos.length > 1 ? `<div class="thumbs" id="thumbs">${p.photos.map((src, i) => `<img src="${esc(src)}" data-i="${i}" class="${i ? '' : 'on'}" alt="">`).join('')}</div>` : ''}
      <div class="pinfo">
        ${badge ? `<span class="pbadge">${badge}</span>` : ''}
        <h1>${esc(p.title)}</h1>
        <div class="price">${rub(p.price)}</div>
        <div class="facts">
          ${p.size ? `<div class="fact"><small>Размер</small><b>${esc(p.size)}</b></div>` : ''}
          ${p.condition ? `<div class="fact"><small>Состояние</small><b>${esc(p.condition)}</b></div>` : ''}
        </div>
        ${p.sizeNote ? `<div class="fact-note">${esc(p.sizeNote)}</div>` : ''}
        ${p.desc ? `<blockquote class="quote">${esc(p.desc)}</blockquote>` : ''}
        <a class="ask" href="#" data-ask="${esc(p.id)}">${I.chat}<span class="grow">Задать вопрос @${esc(S.manager)}</span>${I.arrow}</a>
      </div>
      <div class="actionbar">
        <button class="btn ghost ${favs.has(p.id) ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="В избранное">${I.heart}</button>
        ${mine ? `<a class="btn" href="#/order/${esc(mine.id)}">Мой заказ · ${esc(STATUS[mine.status])}</a>`
          : gone ? '<button class="btn" disabled>Продано</button>'
          : `${inCart(p.id) ? '<a class="btn outline" href="#/cart">В корзине</a>' : `<button class="btn outline" data-addcart="${esc(p.id)}">В корзину</button>`}
             <button class="btn accent" id="buy">Купить</button>`}
      </div>
    `;
  }

  function cartView() {
    const list = cartProducts();
    const total = list.reduce((sum, p) => sum + p.price, 0);
    return `
      <div class="ptop">${backLink('#/')}<h1>Корзина</h1><p>${list.length ? list.length + ' ' + plural(list.length, 'вещь', 'вещи', 'вещей') : 'Пока пусто'}</p></div>
      ${list.length ? `
      <div style="padding-top:12px">${list.map((p) => `
        <div class="block order cart-row">
          <a href="#/p/${esc(p.id)}">${thumbImg(p)}</a>
          <a class="grow" href="#/p/${esc(p.id)}"><b>${esc(p.title)}</b><small>${p.size ? esc(p.size) + ' · ' : ''}${esc(p.condition)}</small><small class="cprice">${rub(p.price)}</small></a>
          <button class="rm" data-rmcart="${esc(p.id)}" aria-label="Убрать">${I.cross}</button>
        </div>`).join('')}</div>
      <div class="block"><div class="total big" style="margin:0;padding:0;border:0"><span>Итого</span><b>${rub(total)}</b></div></div>
      <div class="actionbar"><a class="btn accent" href="#/checkout/cart">Оформить · ${rub(total)}</a></div>`
      : `<div class="empty"><b>Корзина пуста</b>Добавляй вещи кнопкой «В корзину»<br><a class="btn" href="#/">В каталог</a></div>`}
    `;
  }

  const fmtPhone = (digits) => {
    const d = digits.slice(0, 10);
    let s = '';
    if (d.length) s = '(' + d.slice(0, 3);
    if (d.length >= 3) s += ') ';
    if (d.length > 3) s += d.slice(3, 6);
    if (d.length > 6) s += '-' + d.slice(6, 8);
    if (d.length > 8) s += '-' + d.slice(8, 10);
    return s;
  };

  function checkout(id) {
    const items = id === 'cart' ? cartProducts() : [byId(id)].filter((p) => p && !isSold(p.id));
    if (!items.length) return notFound();
    const total = items.reduce((sum, p) => sum + p.price, 0);
    const d = draft;
    const del = S.delivery.some((x) => x.id === d.delivery) ? d.delivery : S.delivery[0].id;
    return `
      <div class="ptop">${backLink(id === 'cart' ? '#/cart' : '#/p/' + esc(id))}<h1>Оформление</h1><p>Шаг 1 из 2 — данные для доставки</p></div>
      <div class="steps"><i class="on"></i><i></i></div>
      <div class="block">
        ${items.map((p) => `
        <div class="mini">
          ${thumbImg(p)}
          <div class="grow"><b>${esc(p.title)}</b><small>${p.size ? 'Размер ' + esc(p.size) + ' · ' : ''}${esc(p.condition)}</small></div>
          <div class="p">${rub(p.price)}</div>
        </div>`).join('<div class="sep"></div>')}
      </div>
      <div class="block">
        <h3>Получатель</h3>
        <label class="field" data-f="name">
          <span>ФИО как в паспорте</span>
          <input id="f-name" value="${esc(d.name || '')}" placeholder="Иванов Иван Иванович" autocomplete="name" autocapitalize="words">
          <em class="hint">Фамилия, имя и отчество кириллицей — их проверят при выдаче</em>
        </label>
        <label class="field" data-f="phone">
          <span>Телефон</span>
          <div class="phone"><b>+7</b><input id="f-phone" type="tel" inputmode="numeric" value="${esc(fmtPhone((d.phoneDigits || '')))}" placeholder="(900) 123-45-67" autocomplete="tel-national"></div>
          <em class="hint">Только российский мобильный: +7 и 10 цифр, начинается с 9</em>
        </label>
      </div>
      <div class="block">
        <h3>Доставка</h3>
        <div class="opts" id="delivery">
          ${S.delivery.map((x) => `<button class="opt ${x.id === del ? 'on' : ''}" data-del="${x.id}"><span class="r"></span><span class="grow"><b>${esc(x.title)}${x.best ? '<em class="best">Лучший вариант</em>' : ''}</b><small>${esc(x.note)}</small></span></button>`).join('')}
        </div>
        <label class="field" data-f="addr" style="margin-top:12px">
          <span id="addr-lbl">Город и адрес пункта выдачи</span>
          <input id="f-addr" value="${esc(d.addr || '')}" placeholder="Москва, ул. Тверская, 1">
          <em class="hint">Укажи город и точный адрес</em>
        </label>
        <label class="field"><span>Комментарий</span><textarea id="f-comment" rows="2" placeholder="Необязательно"></textarea></label>
      </div>
      <div class="block">
        <div class="total"><span>${items.length > 1 ? 'Вещей: ' + items.length : 'Товар'}</span><b>${rub(total)}</b></div>
        <div class="total"><span>Доставка</span><b>по тарифу службы</b></div>
        <div class="total big"><span>Итого</span><b>${rub(total)}</b></div>
      </div>
      <div class="actionbar"><button class="btn accent" id="to-pay">Перейти к оплате</button></div>
    `;
  }

  function pay(orderId) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return notFound();
    if (o.status !== 'awaiting') return orderView(orderId);
    return `
      <div class="ptop">${backLink('#/checkout/' + esc(o.src || o.productId))}<h1>Оплата</h1><p>Шаг 2 из 2 — оплати заказ через СБП</p></div>
      <div class="steps"><i class="on"></i><i class="on"></i></div>
      <div class="paybox">
        <div class="lbl">К оплате</div>
        <div class="amt">${rub(o.total)}</div>
        <div class="ord">Заказ ${esc(o.id)} · ${esc(o.title)}</div>
        <div class="timer">${I.clock}<span>Вещь закреплена за тобой: <b id="left">--:--</b></span></div>
      </div>
      <div class="block">
        <div class="mini">
          ${thumbImg(byId(o.productId))}
          <div class="grow"><b>${esc(o.name)}</b><small>${esc(o.phone)}</small><small>${esc(o.delivery)} · ${esc(o.addr)}</small></div>
        </div>
      </div>
      ${S.demoPayment ? `<div class="block demo"><div class="note">${I.shield}<div><b>Демо-режим.</b> Оплата имитируется, деньги не списываются.</div></div></div>` : ''}
      <div class="actionbar"><button class="btn accent sbp-btn" id="sbp"><span class="sbp-logo">СБП</span>Оплатить через СБП</button></div>
      <div class="sheet" id="sheet" hidden><div class="sheet-card" id="sheet-card"></div></div>
    `;
  }

  function orderView(orderId) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return notFound();
    const bad = ['expired', 'canceled'].includes(o.status);
    const idx = FLOW.indexOf(o.status === 'accepted' ? 'paid' : o.status);
    const trackUrl = o.track && TRACK_URL[o.deliveryId] ? TRACK_URL[o.deliveryId](o.track) : '';
    return `
      <div class="status fade">
        <div class="ic">${bad ? I.cross : o.status === 'shipped' ? I.truck : I.check}</div>
        <h1>${esc(STATUS[o.status] || o.status)}</h1>
        <p>${bad ? (o.status === 'expired' ? 'Бронь на вещь истекла через 15 минут. Оформи заново, если она ещё в наличии.' : 'Заказ отменён. Если есть вопросы — напиши менеджеру.')
          : o.status === 'shipped' ? `Заказ ${esc(o.id)} в пути. Трек-номер ниже.`
          : o.status === 'delivered' ? `Заказ ${esc(o.id)} доставлен. Спасибо, что с нами!`
          : `Заказ ${esc(o.id)} на ${rub(o.total)}. Статус обновится здесь и придёт сообщением от бота.`}</p>
      </div>
      ${bad ? '' : `
      <div class="block">
        <h3>Где заказ</h3>
        <ol class="track">
          ${FLOW.map((s, i) => `<li class="${i <= idx ? 'on' : ''} ${i === idx ? 'now' : ''}"><i></i><span>${esc(STATUS[s])}</span></li>`).join('')}
        </ol>
        ${o.track ? `
        <div class="req first trackno">
          <div class="grow"><small>Трек-номер · ${esc(o.delivery)}</small><b>${esc(o.track)}</b></div>
          <button class="copy" data-copy="${esc(o.track)}">${I.copy}<span>Копировать</span></button>
        </div>
        ${trackUrl ? `<a class="btn outline wide" href="${esc(trackUrl)}" data-ext>${I.truck}Отследить на сайте ${esc(o.delivery)}</a>` : ''}` : `<div class="sub" style="margin-top:4px">Трек-номер появится, когда заказ передадут в ${esc(o.delivery)}</div>`}
      </div>`}
      <div class="block">
        ${(o.items && o.items.length ? o.items : [{ productId: o.productId, title: o.title, price: o.total }]).map((i) => `
        <div class="order">
          ${thumbImg(byId(i.productId))}
          <div class="grow"><b>${esc(i.title)}</b><small>${i.size ? esc(i.size) : ''}</small></div>
          <b>${rub(i.price)}</b>
        </div>`).join('<div class="sep"></div>')}
        <div class="sep"></div>
        <div class="sub">${esc(o.name)} · ${esc(o.phone)}<br>${esc(o.delivery)} · ${esc(o.addr)}</div>
      </div>
      <div class="actionbar">
        ${bad ? `<a class="btn" href="#/p/${esc(o.productId)}">К товару</a>`
          : `<button class="btn outline" data-manager="${esc(o.id)}">Менеджер</button><a class="btn" href="#/">В каталог</a>`}
      </div>
    `;
  }

  function favorites() {
    const list = window.PRODUCTS.filter((p) => favs.has(p.id));
    return `
      <div class="ptop">${backLink('#/')}<h1>Избранное</h1><p>${list.length ? list.length + ' ' + plural(list.length, 'вещь', 'вещи', 'вещей') : 'Жми на сердечко, чтобы не потерять вещь'}</p></div>
      ${list.length ? `<div class="grid" style="padding-top:12px">${list.map(card).join('')}</div>`
        : `<div class="empty"><b>Пока пусто</b>Сохраняй вещи, которые понравились<br><a class="btn" href="#/">В каталог</a></div>`}
    `;
  }

  function myOrders() {
    expireOld();
    return `
      <div class="ptop">${backLink('#/')}<h1>Заказы</h1><p>Статусы обновляются автоматически</p></div>
      ${orders.length ? `<div style="padding-top:12px">${orders.slice().reverse().map((o) => `
        <a class="block order" href="${o.status === 'awaiting' ? '#/pay/' : '#/order/'}${esc(o.id)}">
          ${thumbImg(byId(o.productId))}
          <div class="grow"><b>${esc(o.title)}</b><small>${esc(o.id)} · ${rub(o.total)}</small><small>${o.track ? 'трек ' + esc(o.track) : ago(o.createdAt)}</small></div>
          <span class="badge ${['awaiting', 'expired', 'canceled'].includes(o.status) ? '' : 'inv'}">${esc(STATUS[o.status] || o.status)}</span>
        </a>`).join('')}</div>`
        : `<div class="empty"><b>Заказов нет</b>Здесь появятся твои покупки<br><a class="btn" href="#/">В каталог</a></div>`}
    `;
  }

  function about() {
    return `
      <div class="ptop">${backLink('#/')}</div>
      <div class="hero"><img src="img/logo.jpg" alt=""><h1>${esc(S.name)}</h1><p>архивные вещи · оплата по СБП</p></div>
      <div class="block links">${linkRows()}</div>
      <div class="block">
        <h3>Как купить</h3>
        <ol class="howto">
          <li>Выбери вещь и нажми «Купить»</li>
          <li>Укажи ФИО как в паспорте, телефон и пункт выдачи</li>
          <li>Нажми «Оплатить через СБП» и подтверди платёж в банке</li>
          <li>Следи за заказом во вкладке «Заказы» — там появится трек-номер</li>
        </ol>
      </div>
    `;
  }

  const linkRows = () => {
    const L = S.links;
    const row = (href, title, sub) => `<a href="${esc(href)}" data-ext><div class="grow">${esc(title)}<small>${esc(sub)}</small></div>${I.arrow}</a>`;
    return [
      row('https://t.me/' + S.manager, 'Менеджер', '@' + S.manager),
      row(L.channel, 'Канал', 't.me/secondgangg'),
      row(L.stock, 'Наличие', 't.me/secondgang2'),
      row(L.feedback, 'Отзывы', 't.me/gangfeedback'),
      row(L.vk, 'ВКонтакте', 'vk.com/1brand_magazine'),
      row(L.tiktok, 'TikTok', '@second.gang'),
    ].join('');
  };

  const notFound = () => `<div class="empty"><b>Не найдено</b>Возможно, вещь уже продана<br><a class="btn" href="#/">В каталог</a></div>`;

  // ---------- drawer (свайп от левого края / тап по аватарке) ----------
  function drawerHtml() {
    const route = (location.hash.split('/')[1] || '');
    const item = (href, icon, label, r, count) =>
      `<a href="${href}" class="${route === r ? 'on' : ''}">${icon}<span class="grow">${label}</span>${count ? `<i class="num">${count}</i>` : ''}</a>`;
    return `
      <div class="d-head">
        <img src="img/logo.jpg" alt="SECOND GANG SHOP">
        <b>${esc(S.name)}</b>
        <small>shop</small>
      </div>
      <nav class="d-nav">
        ${item('#/', I.home, 'Каталог', '')}
        ${item('#/cart', I.bag, 'Корзина', 'cart', cartProducts().length)}
        ${item('#/fav', I.heart, 'Избранное', 'fav', favs.size)}
        ${item('#/orders', I.truck, 'Мои заказы', 'orders', activeOrders())}
        ${item('#/about', I.info, 'О магазине', 'about')}
      </nav>
      <div class="d-links links">${linkRows()}</div>
      ${S.demoPayment ? '<div class="d-foot">демо-версия · оплата не списывается</div>' : ''}
    `;
  }
  let drawerOpen = false;
  function setDrawer(open, instant) {
    drawerOpen = open;
    if (open) $drawer.innerHTML = drawerHtml();
    document.body.classList.toggle('drawer-open', open);
    $drawer.style.transition = $scrim.style.transition = instant ? 'none' : '';
    $drawer.style.transform = '';
    $scrim.style.opacity = '';
    if (open) haptic();
  }
  $scrim.addEventListener('click', () => setDrawer(false));
  $drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });

  (() => {
    let sx = 0, sy = 0, dx = 0, tracking = false, decided = false;
    const W = () => $drawer.offsetWidth;
    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; dx = 0; decided = false;
      tracking = drawerOpen ? true : sx < 28 && !document.getElementById('sheet')?.offsetParent;
      if (tracking && !drawerOpen) $drawer.innerHTML = drawerHtml();
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      const mx = t.clientX - sx, my = t.clientY - sy;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decided = true;
        if (Math.abs(my) > Math.abs(mx) || (drawerOpen && mx > 0)) { tracking = false; return; }
        $drawer.style.transition = $scrim.style.transition = 'none';
      }
      dx = mx;
      const x = drawerOpen ? Math.min(0, dx) : Math.min(0, -W() + dx);
      $drawer.style.transform = `translateX(${x}px)`;
      $scrim.style.opacity = String(1 + x / W());
      $scrim.style.pointerEvents = 'auto';
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (!tracking || !decided) { tracking = false; return; }
      tracking = false;
      $scrim.style.pointerEvents = '';
      setDrawer(drawerOpen ? dx > -60 : dx > 60);
    });
  })();

  // ---------- orders ----------
  function expireOld() {
    const ttl = S.reserveMinutes * 60e3;
    let changed = false;
    orders.forEach((o) => {
      if (o.status === 'awaiting' && Date.now() - new Date(o.createdAt) > ttl) { o.status = 'expired'; changed = true; }
      // Демо-оплата держит вещь 15 минут, потом она возвращается в каталог (так же делает сервер).
      if (S.demoPayment && o.status === 'paid' && Date.now() - new Date(o.paidAt || o.createdAt) > ttl) { o.status = 'expired'; changed = true; }
    });
    if (changed) saveOrders();
  }

  function managerText(o) {
    return `Здравствуйте! Вопрос по заказу ${o.id}\n` +
      `${o.title} — ${rub(o.total)}\n` +
      `Получатель: ${o.name}, ${o.phone}\n` +
      `Доставка: ${o.delivery}, ${o.addr}` + (o.track ? `\nТрек: ${o.track}` : '');
  }

  const apiFetch = (path, opts = {}) => fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Init-Data': tg ? tg.initData : '', ...(opts.headers || {}) },
  });

  // true — заказ принят; false — вещь уже купил кто-то другой.
  async function sendOrder(o) {
    if (!API || !inTg) return 'ok';
    try {
      const r = await apiFetch('/order', { method: 'POST', body: JSON.stringify({ order: o }) });
      return r.ok ? 'ok' : r.status === 409 ? 'sold' : r.status === 429 ? 'limit' : 'error';
    } catch (e) { return 'error'; }
  }

  // Подтягиваем статусы и трек-номера, которые админ выставил в боте.
  let syncing = false;
  async function syncOrders() {
    if (!API || !inTg || syncing) return;
    syncing = true;
    try {
      const r = await apiFetch('/orders');
      if (!r.ok) return;
      const remote = await r.json();
      let changed = false;
      for (const ro of remote) {
        const lo = orders.find((x) => x.id === ro.id);
        if (lo) {
          if (lo.status !== ro.status || lo.track !== ro.track) { lo.status = ro.status; lo.track = ro.track; changed = true; }
        } else { orders.push(ro); changed = true; }
      }
      if (changed) {
        saveOrders();
        const route = location.hash.split('/')[1];
        if (['orders', 'order', 'p', ''].includes(route || '')) { render.keepScroll = true; render(); }
      }
    } catch (e) { /* сервер недоступен — показываем то, что есть */ }
    finally { syncing = false; }
  }

  // ---------- router ----------
  const scrollMem = {};
  function render() {
    clearInterval(timer);
    const h = location.hash.replace(/^#/, '') || '/';
    const [, route, arg] = h.split('/');

    let html;
    switch (route) {
      case 'p': html = product(arg); break;
      case 'checkout': html = checkout(arg); break;
      case 'pay': html = pay(arg); break;
      case 'order': case 'done': html = orderView(arg); break;
      case 'cart': html = cartView(); break;
      case 'fav': html = favorites(); break;
      case 'orders': html = myOrders(); break;
      case 'about': html = about(); break;
      default: html = home();
    }
    $view.innerHTML = html;
    document.body.classList.toggle('has-bar', !!$view.querySelector('.actionbar'));
    if (tg) route ? tg.BackButton.show() : tg.BackButton.hide();
    // Списки (каталог, избранное, корзина, заказы) открываются на том же месте, где ушли с них.
    const key = location.hash || '#/';
    if (render.keepScroll) { /* остаёмся где были */ }
    else if (['', 'fav', 'cart', 'orders'].includes(route || '') && scrollMem[key] != null) window.scrollTo(0, scrollMem[key]);
    else window.scrollTo(0, 0);
    render.keepScroll = false;

    if (route === 'p') bindGallery();
    if (route === 'pay') bindPay(arg);
    if (route === 'checkout') bindCheckout(arg);
    if (!route) bindHome();
  }

  function bindHome() {
    const q = document.getElementById('q');
    q.addEventListener('input', () => {
      query = q.value;
      const pos = q.selectionStart;
      render.keepScroll = true; render();
      const nq = document.getElementById('q'); nq.focus(); nq.setSelectionRange(pos, pos);
    });
  }

  function bindGallery() {
    const slides = document.getElementById('slides');
    if (!slides) return;
    const dots = [...document.querySelectorAll('#dots i')];
    const thumbs = [...document.querySelectorAll('#thumbs img')];
    slides.addEventListener('scroll', () => {
      const i = Math.round(slides.scrollLeft / slides.clientWidth);
      dots.forEach((d, j) => d.classList.toggle('on', i === j));
      thumbs.forEach((t, j) => t.classList.toggle('on', i === j));
    }, { passive: true });
    thumbs.forEach((t) => t.addEventListener('click', () => slides.scrollTo({ left: slides.clientWidth * +t.dataset.i, behavior: 'smooth' })));
  }

  // ФИО: каждое слово с заглавной, только кириллица и дефис, 2–3 слова.
  const NAME_RE = /^[А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?( [А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?){1,2}$/;
  const normName = (s) => s.replace(/\s+/g, ' ').trim().split(' ')
    .map((w) => w.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-')).join(' ');

  function bindCheckout(id) {
    const items = id === 'cart' ? cartProducts() : [byId(id)].filter(Boolean);
    if (!items.length) return;
    const lbl = document.getElementById('addr-lbl');
    const setLbl = (d) => { lbl.textContent = d === 'post' ? 'Город, адрес и индекс' : 'Город и адрес пункта выдачи'; };
    let del = S.delivery.some((x) => x.id === draft.delivery) ? draft.delivery : S.delivery[0].id;
    setLbl(del);
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      del = b.dataset.del; haptic();
      document.querySelectorAll('[data-del]').forEach((x) => x.classList.toggle('on', x === b));
      setLbl(del);
    }));

    const name = document.getElementById('f-name');
    name.addEventListener('input', () => { name.value = name.value.replace(/[^А-Яа-яЁё\s-]/g, ''); });
    name.addEventListener('blur', () => { name.value = normName(name.value); });

    const phone = document.getElementById('f-phone');
    phone.addEventListener('input', () => {
      let d = phone.value.replace(/\D/g, '');
      if (d.length > 10 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
      phone.value = fmtPhone(d);
    });

    const setErr = (f, bad) => document.querySelector(`.field[data-f="${f}"]`).classList.toggle('err', bad);
    document.getElementById('to-pay').addEventListener('click', () => {
      name.value = normName(name.value);
      const digits = phone.value.replace(/\D/g, '');
      const addr = document.getElementById('f-addr').value.trim();
      const errs = {
        name: !NAME_RE.test(name.value),
        phone: !/^9\d{9}$/.test(digits),
        addr: addr.length < 8 || !/\d/.test(addr),
      };
      Object.entries(errs).forEach(([f, b]) => setErr(f, b));
      const first = Object.keys(errs).find((k) => errs[k]);
      if (first) {
        notify('error');
        toast({ name: 'Проверь ФИО', phone: 'Проверь номер телефона', addr: 'Укажи полный адрес' }[first]);
        document.querySelector(`.field[data-f="${first}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const phoneStr = '+7 ' + fmtPhone(digits);
      Object.assign(draft, { name: name.value, phoneDigits: digits, addr, delivery: del }); store.set('sg_contact', draft);
      const o = {
        id: 'SG-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
        src: id,
        productId: items[0].id,
        title: items[0].title + (items.length > 1 ? ` + ещё ${items.length - 1}` : ''),
        items: items.map((p) => ({ productId: p.id, title: p.title, size: p.size, price: p.price })),
        size: items[0].size, total: items.reduce((sum, p) => sum + p.price, 0),
        name: name.value, phone: phoneStr, addr,
        deliveryId: del, delivery: S.delivery.find((x) => x.id === del).title,
        comment: document.getElementById('f-comment').value.trim(),
        status: 'awaiting', createdAt: new Date().toISOString(),
      };
      orders = orders.filter((x) => x.status !== 'awaiting');
      orders.push(o); saveOrders(); haptic('medium');
      location.replace('#/pay/' + o.id);
    });
  }

  function bindPay(id) {
    const o = orders.find((x) => x.id === id);
    if (!o || o.status !== 'awaiting') return;
    const left = document.getElementById('left');
    const end = new Date(o.createdAt).getTime() + S.reserveMinutes * 60e3;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      left.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (!s) { o.status = 'expired'; saveOrders(); location.replace('#/order/' + o.id); }
    };
    tick(); timer = setInterval(tick, 1000);

    const sheet = document.getElementById('sheet');
    const card = document.getElementById('sheet-card');
    document.getElementById('sbp').addEventListener('click', async () => {
      haptic('medium');
      sheet.hidden = false;
      card.innerHTML = `<div class="sheet-bank"><span class="sbp-logo">СБП</span>Система быстрых платежей</div><div class="sheet-wait">${I.loader}<span>Проводим платёж…</span></div>`;
      const [res] = await Promise.all([sendOrder({ ...o, status: 'paid' }), new Promise((r) => setTimeout(r, 1600))]);
      if (res === 'limit' || res === 'error') {
        sheet.hidden = true; notify('error');
        return toast(res === 'limit' ? 'Слишком много заказов, попробуй позже' : 'Не получилось оформить, попробуй ещё раз');
      }
      if (res === 'sold') {
        o.status = 'canceled'; saveOrders(); orderIds(o).forEach((i) => sold.add(i));
        notify('error'); toast('Кто-то уже купил вещь из заказа');
        return location.replace('#/');
      }
      o.status = 'paid'; o.paidAt = new Date().toISOString(); saveOrders();
      cart = cart.filter((c) => !orderIds(o).includes(c)); saveCart();
      notify('success');
      location.replace('#/order/' + o.id);
    });
  }

  // ---------- global clicks ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fav],[data-cat],[data-copy],[data-ask],[data-manager],[data-menu],[data-addcart],[data-rmcart],#buy,[data-ext]');
    if (!t) return;
    if (t.dataset.fav) {
      e.preventDefault(); e.stopPropagation();
      const id = t.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      saveFavs(); haptic();
      document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle('on', favs.has(id)));
      toast(favs.has(id) ? 'Добавлено в избранное' : 'Убрано из избранного');
      if (location.hash === '#/fav') render();
    } else if (t.dataset.addcart) {
      if (!inCart(t.dataset.addcart)) cart.push(t.dataset.addcart);
      saveCart(); haptic('medium'); toast('Добавлено в корзину');
      render.keepScroll = true; render();
    } else if (t.dataset.rmcart) {
      cart = cart.filter((c) => c !== t.dataset.rmcart); saveCart(); haptic();
      render.keepScroll = true; render();
    } else if (t.hasAttribute('data-menu')) {
      setDrawer(true);
    } else if (t.dataset.cat) {
      cat = t.dataset.cat; haptic(); render.keepScroll = true; render();
    } else if (t.dataset.copy) {
      copy(t.dataset.copy, t);
    } else if (t.dataset.ask) {
      e.preventDefault();
      const p = byId(t.dataset.ask);
      openLink(`https://t.me/${S.manager}?text=${encodeURIComponent('Здравствуйте! Интересует ' + p.title + (p.size ? ' (' + p.size + ')' : '') + ' за ' + rub(p.price))}`);
    } else if (t.dataset.manager) {
      const o = orders.find((x) => x.id === t.dataset.manager);
      openLink(`https://t.me/${S.manager}?text=${encodeURIComponent(managerText(o))}`);
    } else if (t.id === 'buy') {
      haptic('medium'); go('#/checkout/' + location.hash.split('/')[2]);
    } else if (t.hasAttribute('data-ext')) {
      e.preventDefault(); openLink(t.getAttribute('href'));
    }
  });

  window.addEventListener('hashchange', (e) => {
    scrollMem[new URL(e.oldURL).hash || '#/'] = window.scrollY;
    if (drawerOpen) setDrawer(false, true);
    expireOld(); render(); syncOrders(); syncSold();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncOrders(); });
  setInterval(() => { if (/^#\/(order|orders)/.test(location.hash)) syncOrders(); }, 20000);
  (() => {
    const intro = document.getElementById('intro');
    if (!intro) return;
    setTimeout(() => { intro.classList.add('out'); setTimeout(() => intro.remove(), 500); }, 3000);
  })();
  expireOld();
  render();
  syncOrders();
  syncSold();
})();
