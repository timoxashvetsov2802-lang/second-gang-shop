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
  const saveFavs = () => store.set('sg_favs', [...favs]);

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
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const toast = (t) => {
    const el = document.getElementById('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1800);
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
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
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

  // Проданные вещи приходят с сервера бота и скрываются из каталога.
  let sold = new Set(store.get('sg_sold', []));
  const isSold = (id) => sold.has(id);

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

  // «Купить» открывает личку продавца с уже написанным сообщением — оплату и доставку обсуждают там.
  const itemLine = (p) => p.title + (p.size ? ' (' + p.size + ')' : '') + ' — ' + rub(p.price);
  const buyText = (list) => list.length === 1
    ? 'Здравствуйте! Хочу купить ' + itemLine(list[0])
    : 'Здравствуйте! Хочу купить:\n' + list.map((p) => '• ' + itemLine(p)).join('\n') + '\nИтого: ' + rub(list.reduce((sum, p) => sum + p.price, 0));
  const writeSeller = (list) => { haptic('medium'); openLink(`https://t.me/${S.manager}?text=${encodeURIComponent(buyText(list))}`); };

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
    const gone = isSold(id);
    const badge = gone ? 'Продано' : p.preorder ? 'Под заказ' : '';
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
        ${gone ? '<button class="btn" disabled>Продано</button>'
          : `${inCart(p.id) ? '<a class="btn outline" href="#/cart">В корзине</a>' : `<button class="btn outline" data-addcart="${esc(p.id)}">В корзину</button>`}
             <button class="btn accent" data-buy="${esc(p.id)}">Купить</button>`}
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
      <div class="actionbar"><button class="btn accent" data-buy="cart">Купить · ${rub(total)}</button></div>`
      : `<div class="empty"><b>Корзина пуста</b>Добавляй вещи кнопкой «В корзину»<br><a class="btn" href="#/">В каталог</a></div>`}
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

  function about() {
    return `
      <div class="ptop">${backLink('#/')}</div>
      <div class="hero"><img src="img/logo.jpg" alt=""><h1>${esc(S.name)}</h1><p>архивные вещи</p></div>
      <div class="block links">${linkRows()}</div>
      <div class="block">
        <h3>Как купить</h3>
        <ol class="howto">
          <li>Выбери вещь и нажми «Купить» — или собери несколько в корзину</li>
          <li>Откроется чат с менеджером, сообщение с вещью уже написано — просто отправь</li>
          <li>Договоритесь с менеджером об оплате и доставке</li>
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
        ${item('#/about', I.info, 'О магазине', 'about')}
      </nav>
      <div class="d-links links">${linkRows()}</div>
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
      tracking = drawerOpen ? true : sx < 28;
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

  // ---------- router ----------
  const scrollMem = {};
  function render() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [, route, arg] = h.split('/');

    let html;
    switch (route) {
      case 'p': html = product(arg); break;
      // Старые ссылки на оформление и заказы ведут в каталог.
      case 'checkout': case 'pay': case 'order': case 'done': case 'orders': location.replace('#/'); return;
      case 'cart': html = cartView(); break;
      case 'fav': html = favorites(); break;
      case 'about': html = about(); break;
      default: html = home();
    }
    $view.innerHTML = html;
    document.body.classList.toggle('has-bar', !!$view.querySelector('.actionbar'));
    if (tg) route ? tg.BackButton.show() : tg.BackButton.hide();
    // Списки (каталог, избранное, корзина) открываются на том же месте, где ушли с них.
    const key = location.hash || '#/';
    if (render.keepScroll) { /* остаёмся где были */ }
    else if (['', 'fav', 'cart'].includes(route || '') && scrollMem[key] != null) window.scrollTo(0, scrollMem[key]);
    else window.scrollTo(0, 0);
    render.keepScroll = false;

    if (route === 'p') bindGallery();
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

  // ---------- global clicks ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fav],[data-cat],[data-ask],[data-menu],[data-addcart],[data-rmcart],[data-buy],[data-ext]');
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
    } else if (t.dataset.ask) {
      e.preventDefault();
      const p = byId(t.dataset.ask);
      openLink(`https://t.me/${S.manager}?text=${encodeURIComponent('Здравствуйте! Интересует ' + p.title + (p.size ? ' (' + p.size + ')' : '') + ' за ' + rub(p.price))}`);
    } else if (t.dataset.buy) {
      const list = t.dataset.buy === 'cart' ? cartProducts() : [byId(t.dataset.buy)].filter(Boolean);
      if (list.length) writeSeller(list);
    } else if (t.hasAttribute('data-ext')) {
      e.preventDefault(); openLink(t.getAttribute('href'));
    }
  });

  window.addEventListener('hashchange', (e) => {
    scrollMem[new URL(e.oldURL).hash || '#/'] = window.scrollY;
    if (drawerOpen) setDrawer(false, true);
    render(); syncSold();
  });
  (() => {
    const intro = document.getElementById('intro');
    if (!intro) return;
    setTimeout(() => { intro.classList.add('out'); setTimeout(() => intro.remove(), 500); }, 3000);
  })();
  render();
  syncSold();
})();
