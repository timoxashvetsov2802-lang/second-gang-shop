(() => {
  const tg = window.Telegram && window.Telegram.WebApp;
  const inTg = !!(tg && tg.initData);
  const $view = document.getElementById('view');
  const $tabbar = document.getElementById('tabbar');
  const S = window.SHOP;

  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000'); tg.setBottomBarColor && tg.setBottomBarColor('#000000'); } catch (e) {}
    if (inTg) document.body.classList.add('tg');
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

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = (n) => n.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
  const byId = (id) => window.PRODUCTS.find((p) => p.id === id);
  const go = (h) => { location.hash = h; };
  const haptic = (t = 'light') => { try { tg.HapticFeedback.impactOccurred(t); } catch (e) {} };
  const notify = (t) => { try { tg.HapticFeedback.notificationOccurred(t); } catch (e) {} };
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
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1600);
  };
  const copy = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    notify('success'); toast('Скопировано');
    if (btn) { btn.classList.add('done'); btn.lastChild.textContent = 'Готово'; setTimeout(() => { btn.classList.remove('done'); btn.lastChild.textContent = 'Копировать'; }, 1500); }
  };
  const openLink = (url) => {
    if (tg && inTg) { url.startsWith('https://t.me/') ? tg.openTelegramLink(url) : tg.openLink(url); }
    else window.open(url, '_blank');
  };

  const I = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    loader: '<svg viewBox="0 0 24 24" class="spin"><path d="M12 3a9 9 0 1 0 9 9"/></svg>',
    box: '<svg viewBox="0 0 24 24"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>',
  };

  const favBtn = (id) => `<button class="fav ${favs.has(id) ? 'on' : ''}" data-fav="${esc(id)}" aria-label="В избранное">${I.heart}</button>`;
  const backLink = (href, label = 'Назад') => `<a class="back" href="${href}">${I.back}${label}</a>`;

  const card = (p) => `
    <a class="card fade" href="#/p/${esc(p.id)}">
      <div class="ph">
        <img src="${esc(p.photos[0])}" alt="${esc(p.title)}" loading="lazy">
        <span class="cnt">${p.photos.length} фото</span>
        ${favBtn(p.id)}
      </div>
      <div class="price">${rub(p.price)}</div>
      <div class="title">${esc(p.title)}</div>
      <div class="meta">${esc(p.size)} · ${esc(p.condition)}</div>
    </a>`;

  // ---------- state ----------
  let cat = 'Все';
  let query = '';
  let timer = null;

  // ---------- views ----------
  function home() {
    const list = window.PRODUCTS.filter((p) =>
      (cat === 'Все' || p.category === cat) &&
      (!query || (p.title + ' ' + p.brand).toLowerCase().includes(query.toLowerCase()))
    ).sort((a, b) => b.added.localeCompare(a.added));

    return `
      <header class="top">
        <div class="brand">
          <img src="img/logo.jpg" alt="">
          <div class="grow"><b>${esc(S.name)}</b><small>${esc(S.tagline)}</small></div>
        </div>
        <label class="search">${I.search}<input id="q" type="search" placeholder="Поиск по бренду или вещи" value="${esc(query)}" autocomplete="off"></label>
      </header>
      <div class="chips">${window.CATEGORIES.map((c) => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${!query && cat === 'Все' ? `<div class="sale"><b>F*CK SALE</b><span>по полной предоплате скидка от 20% до 60%</span></div>` : ''}
      <div class="section-head"><h2>${query ? 'Результаты' : 'Свежее'}</h2><span>${list.length} ${plural(list.length, 'вещь', 'вещи', 'вещей')}</span></div>
      ${list.length ? `<div class="grid" id="grid">${list.map(card).join('')}</div>`
        : `<div class="empty"><b>Ничего не нашли</b>Попробуй другой бренд или категорию</div>`}
    `;
  }

  function product(id) {
    const p = byId(id);
    if (!p) return notFound();
    const pending = orders.find((o) => o.productId === id && o.status === 'checking');
    return `
      <div class="gallery">
        <div class="slides" id="slides">${p.photos.map((src, i) => `<img src="${esc(src)}" alt="${esc(p.title)} — фото ${i + 1}">`).join('')}</div>
        <div class="dots" id="dots">${p.photos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
        ${favBtn(p.id)}
      </div>
      <div class="thumbs" id="thumbs">${p.photos.map((src, i) => `<img src="${esc(src)}" data-i="${i}" class="${i ? '' : 'on'}" alt="">`).join('')}</div>
      <div class="pinfo">
        <div class="price">${rub(p.price)}</div>
        <h1>${esc(p.title)}</h1>
        <div class="stamp">${ago(p.added)} · ${esc(p.category)}</div>
        <div class="tags">
          <span class="tag inv">${pending ? 'Забронировано' : 'В наличии'}</span>
          <span class="tag">${esc(p.brand)}</span>
          <span class="tag">Оригинал</span>
        </div>
      </div>
      <div class="block">
        <h3>Характеристики</h3>
        <dl class="specs">
          <dt>Состояние</dt><dd>${esc(p.condition)}</dd>
          <dt>Размер</dt><dd>${esc(p.size)}${p.sizeNote ? `<br><small style="color:var(--muted);font-weight:400">${esc(p.sizeNote)}</small>` : ''}</dd>
          <dt>Бренд</dt><dd>${esc(p.brand)}</dd>
          <dt>Категория</dt><dd>${esc(p.category)}</dd>
        </dl>
      </div>
      <div class="block"><h3>Описание</h3><p>${esc(p.desc)}</p></div>
      <div class="block">
        <div class="seller">
          <img src="img/logo.jpg" alt="">
          <div class="grow"><b>${esc(S.name)}</b><small>Менеджер @${esc(S.manager)}</small></div>
          <a class="copy" href="#" data-ask="${esc(p.id)}">${I.chat}<span>Спросить</span></a>
        </div>
      </div>
      <div class="block">
        <div class="note">${I.shield}<div>Оплата только по СБП, полная предоплата. Вещь бронируется за тобой на ${S.reserveMinutes} минут после оформления.</div></div>
      </div>
      <div class="actionbar">
        <button class="btn ghost ${favs.has(p.id) ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="В избранное">${I.heart}</button>
        <button class="btn" id="buy" ${pending ? 'disabled' : ''}>${pending ? 'Ожидает проверки оплаты' : 'Купить · ' + rub(p.price)}</button>
      </div>
    `;
  }

  function checkout(id) {
    const p = byId(id);
    if (!p) return notFound();
    const d = draft;
    const del = d.delivery || S.delivery[0].id;
    return `
      <div class="ptop">${backLink('#/p/' + esc(p.id))}<h1>Оформление</h1><p>Шаг 1 из 2 — данные для доставки</p></div>
      <div class="steps"><i class="on"></i><i></i></div>
      <div class="block">
        <div class="mini">
          <img src="${esc(p.photos[0])}" alt="">
          <div class="grow"><b>${esc(p.title)}</b><small>${esc(p.size)} · ${esc(p.condition)}</small></div>
          <div class="p">${rub(p.price)}</div>
        </div>
      </div>
      <div class="block">
        <h3>Получатель</h3>
        <label class="field" data-f="name"><span>ФИО</span><input id="f-name" value="${esc(d.name || (tg && tg.initDataUnsafe.user ? [tg.initDataUnsafe.user.first_name, tg.initDataUnsafe.user.last_name].filter(Boolean).join(' ') : ''))}" placeholder="Иванов Иван" autocomplete="name"></label>
        <label class="field" data-f="phone"><span>Телефон</span><input id="f-phone" type="tel" value="${esc(d.phone || '')}" placeholder="+7 900 123-45-67" autocomplete="tel"></label>
      </div>
      <div class="block">
        <h3>Доставка</h3>
        <div class="opts" id="delivery">
          ${S.delivery.map((x) => `<button class="opt ${x.id === del ? 'on' : ''}" data-del="${x.id}"><span class="r"></span><span class="grow"><b>${esc(x.title)}</b><small>${esc(x.note)}</small></span></button>`).join('')}
        </div>
        <label class="field" data-f="addr" style="margin-top:12px"><span id="addr-lbl">Город и адрес ПВЗ</span><input id="f-addr" value="${esc(d.addr || '')}" placeholder="Москва, ул. Пример, 1"></label>
        <label class="field"><span>Комментарий</span><textarea id="f-comment" rows="2" placeholder="Необязательно"></textarea></label>
      </div>
      <div class="block">
        <h3>Способ оплаты</h3>
        <div class="opts">
          <div class="opt on locked"><span class="sbp-mark">СБП</span><span class="grow"><b>Система быстрых платежей</b><small>перевод по номеру телефона</small></span><span class="r"></span></div>
          <div class="opt off"><span class="r"></span><span class="grow"><b>Оплата при получении</b><small>недоступно — только предоплата</small></span></div>
        </div>
      </div>
      <div class="block">
        <div class="total"><span>Товар</span><b>${rub(p.price)}</b></div>
        <div class="total"><span>Доставка</span><b>по тарифу службы</b></div>
        <div class="total big"><span>К оплате по СБП</span><b>${rub(p.price)}</b></div>
      </div>
      <div class="actionbar"><button class="btn" id="to-pay">Перейти к оплате</button></div>
    `;
  }

  function pay(orderId) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return notFound();
    if (o.status !== 'awaiting') return done(orderId);
    return `
      <div class="ptop">${backLink('#/checkout/' + esc(o.productId))}<h1>Оплата по СБП</h1><p>Шаг 2 из 2 — переведи сумму и подтверди</p></div>
      <div class="steps"><i class="on"></i><i class="on"></i></div>
      <div class="paybox">
        <div class="lbl">К оплате</div>
        <div class="amt">${rub(o.total)}</div>
        <div class="ord">Заказ ${esc(o.id)} · ${esc(o.title)}</div>
        <div class="timer">${I.clock}<span>Бронь: <b id="left">--:--</b></span></div>
      </div>
      <div class="block">
        <h3>Реквизиты</h3>
        ${req('Номер телефона (СБП)', S.sbp.phone, S.sbp.phone.replace(/[^\d+]/g, ''), 'first')}
        ${req('Банк получателя', S.sbp.bank)}
        ${req('Получатель', S.sbp.recipient)}
        ${req('Сумма', rub(o.total), String(o.total))}
        ${req('Комментарий к переводу', o.id)}
      </div>
      <div class="block">
        <h3>Как оплатить</h3>
        <ol class="howto">
          <li>Открой приложение своего банка → «Перевод по номеру телефона» (СБП)</li>
          <li>Вставь номер и выбери банк ${esc(S.sbp.bank)}</li>
          <li>Переведи ровно ${rub(o.total)}, в комментарии укажи ${esc(o.id)}</li>
          <li>Вернись сюда и нажми «Я оплатил»</li>
        </ol>
      </div>
      <div class="block">
        <label class="check"><input type="checkbox" id="agree"><span class="box"></span><span>Я перевёл ${rub(o.total)} по СБП на номер ${esc(S.sbp.phone)}</span></label>
      </div>
      <div class="actionbar"><button class="btn" id="paid" disabled>Я оплатил</button></div>
    `;
  }

  const req = (label, shown, value, cls = '') => `
    <div class="req ${cls}">
      <div class="grow"><small>${esc(label)}</small><b>${esc(shown)}</b></div>
      <button class="copy" data-copy="${esc(value ?? shown)}">${I.copy}<span>Копировать</span></button>
    </div>`;

  function done(orderId) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return notFound();
    const expired = o.status === 'expired';
    return `
      <div class="status fade">
        <div class="ic">${expired ? I.clock : I.loader}</div>
        <h1>${expired ? 'Бронь истекла' : 'Проверяем оплату'}</h1>
        <p>${expired ? 'Оплата не поступила вовремя. Оформи заказ заново, если вещь ещё в наличии.'
          : `Заказ ${esc(o.id)} на ${rub(o.total)}. Менеджер сверит перевод и напишет тебе в Telegram в течение 15 минут.`}</p>
      </div>
      <div class="block">
        <div class="order">
          <img src="${esc(byId(o.productId)?.photos[0] || 'img/logo.jpg')}" alt="">
          <div class="grow"><b>${esc(o.title)}</b><small>${esc(o.delivery)} · ${esc(o.addr)}</small></div>
          <b>${rub(o.total)}</b>
        </div>
      </div>
      ${expired ? '' : `<div class="block"><div class="note">${I.chat}<div>Если менеджер не ответил — нажми «Написать менеджеру», номер заказа подставится сам.</div></div></div>`}
      <div class="actionbar">
        ${expired ? `<a class="btn" href="#/p/${esc(o.productId)}">К товару</a>`
          : `<button class="btn outline" data-manager="${esc(o.id)}">Написать менеджеру</button><a class="btn" href="#/">В каталог</a>`}
      </div>
    `;
  }

  function favorites() {
    const list = window.PRODUCTS.filter((p) => favs.has(p.id));
    return `
      <div class="ptop"><h1>Избранное</h1><p>${list.length ? list.length + ' ' + plural(list.length, 'вещь', 'вещи', 'вещей') : 'Жми на сердечко, чтобы не потерять вещь'}</p></div>
      ${list.length ? `<div class="grid" style="padding-top:12px">${list.map(card).join('')}</div>`
        : `<div class="empty"><b>Пока пусто</b>Сохраняй вещи, которые понравились<br><a class="btn" href="#/">В каталог</a></div>`}
    `;
  }

  function myOrders() {
    expireOld();
    const label = { awaiting: 'ждёт оплаты', checking: 'проверка', expired: 'истёк' };
    return `
      <div class="ptop"><h1>Заказы</h1><p>Оплата по СБП, статусы обновляет менеджер</p></div>
      ${orders.length ? `<div style="padding-top:12px">${orders.slice().reverse().map((o) => `
        <a class="block order" style="display:flex" href="${o.status === 'awaiting' ? '#/pay/' : '#/done/'}${esc(o.id)}">
          <img src="${esc(byId(o.productId)?.photos[0] || 'img/logo.jpg')}" alt="">
          <div class="grow"><b>${esc(o.title)}</b><small>${esc(o.id)} · ${rub(o.total)}</small><small>${ago(o.createdAt)}</small></div>
          <span class="badge ${o.status === 'checking' ? 'inv' : ''}">${label[o.status]}</span>
        </a>`).join('')}</div>`
        : `<div class="empty"><b>Заказов нет</b>Здесь появятся твои покупки<br><a class="btn" href="#/">В каталог</a></div>`}
    `;
  }

  function about() {
    const L = S.links;
    const row = (href, title, sub) => `<a href="${esc(href)}" data-ext><div class="grow">${esc(title)}<small>${esc(sub)}</small></div>${I.arrow}</a>`;
    return `
      <div class="hero"><img src="img/logo.jpg" alt=""><h1>${esc(S.name)}</h1><p>${esc(S.tagline)}</p></div>
      <div class="block links">
        ${row('https://t.me/' + S.manager, 'Менеджер', '@' + S.manager)}
        ${row(L.channel, 'Канал', 't.me/secondgangg')}
        ${row(L.stock, 'Наличие', 't.me/secondgang2')}
        ${row(L.feedback, 'Отзывы', 't.me/gangfeedback')}
        ${row(L.vk, 'ВКонтакте', 'vk.com/1brand_magazine')}
        ${row(L.tiktok, 'TikTok', '@second.gang')}
      </div>
      <div class="block">
        <h3>Как купить</h3>
        <ol class="howto">
          <li>Выбери вещь и нажми «Купить»</li>
          <li>Укажи данные для доставки</li>
          <li>Переведи сумму по СБП — вещь забронирована на ${S.reserveMinutes} минут</li>
          <li>Нажми «Я оплатил» — менеджер подтвердит и отправит заказ</li>
        </ol>
      </div>
    `;
  }

  const notFound = () => `<div class="empty"><b>Не найдено</b>Возможно, вещь уже продана<br><a class="btn" href="#/">В каталог</a></div>`;
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };

  // ---------- orders ----------
  function expireOld() {
    const ttl = S.reserveMinutes * 60e3;
    let changed = false;
    orders.forEach((o) => { if (o.status === 'awaiting' && Date.now() - new Date(o.createdAt) > ttl) { o.status = 'expired'; changed = true; } });
    if (changed) saveOrders();
  }

  function managerText(o) {
    return `Здравствуйте! Оплатил заказ ${o.id} по СБП\n` +
      `${o.title} — ${rub(o.total)}\n` +
      `Получатель: ${o.name}, ${o.phone}\n` +
      `Доставка: ${o.delivery}, ${o.addr}` + (o.comment ? `\nКомментарий: ${o.comment}` : '');
  }

  function notifyManager(o) {
    // Если подключён сервер бота (SHOP.api) — заказ уходит админу автоматически.
    if (S.api) {
      fetch(S.api + '/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: o, initData: tg ? tg.initData : '' }),
      }).catch(() => {});
    } else {
      // Сервера пока нет — открываем чат с менеджером с готовым текстом заказа.
      setTimeout(() => openLink(`https://t.me/${S.manager}?text=${encodeURIComponent(managerText(o))}`), 600);
    }
  }

  // ---------- router ----------
  function render() {
    clearInterval(timer);
    const h = location.hash.replace(/^#/, '') || '/';
    const [, route, arg] = h.split('/');
    const tabRoutes = { '': 'home', fav: 'fav', orders: 'orders', about: 'about' };
    const tab = tabRoutes[route ?? ''];

    let html;
    switch (route) {
      case 'p': html = product(arg); break;
      case 'checkout': html = checkout(arg); break;
      case 'pay': html = pay(arg); break;
      case 'done': html = done(arg); break;
      case 'fav': html = favorites(); break;
      case 'orders': html = myOrders(); break;
      case 'about': html = about(); break;
      default: html = home();
    }
    $view.innerHTML = html;
    document.body.classList.toggle('no-tabs', !tab);
    $tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    updateBadge();
    if (tg) tab ? tg.BackButton.hide() : tg.BackButton.show();
    if (route !== '' || !render.keepScroll) window.scrollTo(0, 0);
    render.keepScroll = false;

    if (route === 'p') bindGallery();
    if (route === 'pay') bindPay(arg);
    if (route === 'checkout') bindCheckout(arg);
    if (!route) bindHome();
  }

  function updateBadge() {
    const a = $tabbar.querySelector('[data-tab="fav"]');
    let n = a.querySelector('.num');
    if (favs.size) { if (!n) { n = document.createElement('i'); n.className = 'num'; a.appendChild(n); } n.textContent = favs.size; }
    else if (n) n.remove();
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
    const dots = [...document.querySelectorAll('#dots i')];
    const thumbs = [...document.querySelectorAll('#thumbs img')];
    slides.addEventListener('scroll', () => {
      const i = Math.round(slides.scrollLeft / slides.clientWidth);
      dots.forEach((d, j) => d.classList.toggle('on', i === j));
      thumbs.forEach((t, j) => t.classList.toggle('on', i === j));
    }, { passive: true });
    thumbs.forEach((t) => t.addEventListener('click', () => slides.scrollTo({ left: slides.clientWidth * +t.dataset.i, behavior: 'smooth' })));
  }

  function bindCheckout(id) {
    const p = byId(id);
    const lbl = document.getElementById('addr-lbl');
    const setLbl = (d) => { lbl.textContent = d === 'meet' ? 'Город и удобное место встречи' : d === 'post' ? 'Город, адрес и индекс' : 'Город и адрес ПВЗ'; };
    let del = draft.delivery || S.delivery[0].id;
    setLbl(del);
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      del = b.dataset.del; haptic();
      document.querySelectorAll('[data-del]').forEach((x) => x.classList.toggle('on', x === b));
      setLbl(del);
    }));
    document.getElementById('to-pay').addEventListener('click', () => {
      const v = (k) => document.getElementById('f-' + k).value.trim();
      const vals = { name: v('name'), phone: v('phone'), addr: v('addr') };
      const bad = Object.keys(vals).filter((k) => k === 'phone' ? vals.phone.replace(/\D/g, '').length < 10 : vals[k].length < 2);
      document.querySelectorAll('.field[data-f]').forEach((f) => f.classList.toggle('err', bad.includes(f.dataset.f)));
      if (bad.length) { notify('error'); toast('Заполни выделенные поля'); return; }
      Object.assign(draft, vals, { delivery: del }); store.set('sg_contact', draft);
      const o = {
        id: 'SG-' + String(Date.now()).slice(-5),
        productId: p.id, title: p.title, total: p.price,
        ...vals, delivery: S.delivery.find((x) => x.id === del).title, comment: v('comment'),
        status: 'awaiting', createdAt: new Date().toISOString(),
      };
      orders = orders.filter((x) => !(x.productId === p.id && x.status === 'awaiting'));
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
      if (!s) { o.status = 'expired'; saveOrders(); location.replace('#/done/' + o.id); }
    };
    tick(); timer = setInterval(tick, 1000);
    const agree = document.getElementById('agree');
    const btn = document.getElementById('paid');
    agree.addEventListener('change', () => { btn.disabled = !agree.checked; haptic(); });
    btn.addEventListener('click', () => {
      o.status = 'checking'; o.paidAt = new Date().toISOString(); saveOrders();
      notify('success'); notifyManager(o);
      location.replace('#/done/' + o.id);
    });
  }

  // ---------- global clicks ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fav],[data-cat],[data-copy],[data-ask],[data-manager],#buy,[data-ext]');
    if (!t) return;
    if (t.dataset.fav) {
      e.preventDefault(); e.stopPropagation();
      const id = t.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      saveFavs(); haptic();
      document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle('on', favs.has(id)));
      toast(favs.has(id) ? 'Добавлено в избранное' : 'Убрано из избранного');
      updateBadge();
      if (location.hash === '#/fav') render();
    } else if (t.dataset.cat) {
      cat = t.dataset.cat; haptic(); render.keepScroll = true; render();
    } else if (t.dataset.copy) {
      copy(t.dataset.copy, t);
    } else if (t.dataset.ask) {
      e.preventDefault();
      const p = byId(t.dataset.ask);
      openLink(`https://t.me/${S.manager}?text=${encodeURIComponent('Здравствуйте! Интересует ' + p.title + ' за ' + rub(p.price))}`);
    } else if (t.dataset.manager) {
      const o = orders.find((x) => x.id === t.dataset.manager);
      openLink(`https://t.me/${S.manager}?text=${encodeURIComponent(managerText(o))}`);
    } else if (t.id === 'buy') {
      haptic('medium'); go('#/checkout/' + location.hash.split('/')[2]);
    } else if (t.hasAttribute('data-ext')) {
      e.preventDefault(); openLink(t.getAttribute('href'));
    }
  });

  window.addEventListener('hashchange', render);
  expireOld();
  render();
})();
