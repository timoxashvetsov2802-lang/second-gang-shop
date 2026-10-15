// Каталог и настройки магазина. Новый товар — новый объект в PRODUCTS.
// photos: [] — карточка покажет фирменную заглушку; фото кладутся в img/ и пишутся сюда путями.
window.SHOP = {
  name: 'SECOND GANG',
  tagline: 'hard work pays off.',
  manager: 'flex_why',
  // Адрес сервера бота: заказы уходят админу. Пусто — заказ остаётся только в приложении.
  api: '',
  links: {
    stock: 'https://t.me/secondgang2',
    channel: 'https://t.me/secondgangg',
    vk: 'https://vk.com/1brand_magazine',
    feedback: 'https://t.me/gangfeedback',
    tiktok: 'https://www.tiktok.com/@second.gang',
  },
  // Демо-оплата: банки на экране СБП. Деньги не списываются, пока не подключена платёжка.
  demoPayment: true,
  banks: ['Сбербанк', 'Т-Банк', 'Альфа-Банк', 'ВТБ', 'Райффайзен', 'Озон Банк'],
  reserveMinutes: 15,
  delivery: [
    { id: 'cdek', title: 'СДЭК', note: 'до пункта выдачи' },
    { id: 'post', title: 'Почта России', note: 'до отделения' },
    { id: 'meet', title: 'Личная встреча', note: 'по договорённости' },
  ],
};

window.CATEGORIES = ['Все', 'Верх', 'Куртки', 'Низ', 'Обувь', 'Головные уборы', 'Аксессуары'];

const P = (id, brand, title, category, price, size, condition, desc, added, extra = {}) =>
  ({ id, brand, title, category, price, size, condition, desc, added, photos: [], ...extra });

window.PRODUCTS = [
  P('celine-archive-cap', 'Celine', 'Celine Paris Archive Cap', 'Головные уборы', 6790, 'uni', 'хорошее',
    'Редкая винтажная кепка Celine Paris с вышитым лого.', '2026-10-15T19:06:00'),
  P('stone-island-peach-sweatshirt', 'Stone Island', 'Stone Island Peach Sweatshirt', 'Верх', 3690, 'L–XL', 'отличное',
    'Шикарный свитшот от стоника в очень мягком цвете, невероятно тактильно приятный материал.', '2026-10-15T19:05:00',
    { sizeNote: 'замеры по запросу' }),
  P('cp-company-goggle-jacket', 'C.P. Company', 'C.P. Company Goggle Jacket', 'Куртки', 18990, 'M', 'отличное',
    'Классическая куртка с линзами на капюшоне. Плотный нейлон, все кнопки и молнии рабочие.', '2026-10-15T18:40:00'),
  P('stone-island-ghost-overshirt', 'Stone Island', 'Stone Island Ghost Piece Overshirt', 'Верх', 12490, 'L', 'хорошее',
    'Овершот из линейки Ghost — патч в цвет изделия. Носится и как рубашка, и как лёгкая куртка.', '2026-10-15T17:10:00'),
  P('arcteryx-beta-lt', "Arc'teryx", "Arc'teryx Beta LT Gore-Tex", 'Куртки', 21990, 'M', 'отличное',
    'Мембранная куртка Gore-Tex, проклеенные швы, не течёт. Чёрный цвет.', '2026-10-14T21:30:00'),
  P('margiela-tabi-boots', 'Maison Margiela', 'Maison Margiela Tabi Boots', 'Обувь', 34990, '41', 'хорошее',
    'Культовые таби на каблуке 3 см. Кожа без заломов, подошва с запасом.', '2026-10-14T20:15:00'),
  P('rick-owens-geobasket', 'Rick Owens', 'Rick Owens Geobasket', 'Обувь', 39990, '43', 'хорошее',
    'Высокие геобаскеты, чёрный/белый. Следы носки на подошве, верх в порядке.', '2026-10-14T18:00:00'),
  P('prada-re-nylon-bag', 'Prada', 'Prada Re-Nylon Shoulder Bag', 'Аксессуары', 27490, 'uni', 'отличное',
    'Сумка из нейлона с треугольным лого. Регулируемый ремень, внутри чисто.', '2026-10-13T19:20:00'),
  P('cdg-play-tee', 'Comme des Garçons', 'CDG Play Heart Tee', 'Верх', 4490, 'M', 'отличное',
    'Базовая футболка с сердцем. Принт не трескался, без катышков.', '2026-10-13T16:45:00'),
  P('yohji-wide-trousers', 'Yohji Yamamoto', 'Yohji Yamamoto Wide Wool Trousers', 'Низ', 22990, '2', 'хорошее',
    'Широкие шерстяные брюки, драпировка в стиле Yohji. Посадка свободная.', '2026-10-12T22:10:00',
    { sizeNote: 'ПОТ 48 см, длина 104 см' }),
  P('carhartt-detroit-jacket', 'Carhartt', 'Carhartt Detroit Jacket Vintage', 'Куртки', 11990, 'L', 'хорошее',
    'Винтажная плотная ткань дак с потёртостями в нужных местах, утеплённая подкладка.', '2026-10-12T15:30:00'),
  P('stussy-8-ball-fleece', 'Stüssy', 'Stüssy 8 Ball Sherpa Fleece', 'Верх', 9990, 'XL', 'отличное',
    'Флиска-шерпа с восьмым шаром на спине. Тёплая и очень мягкая.', '2026-10-11T19:00:00'),
  P('raf-simons-riot-hoodie', 'Raf Simons', 'Raf Simons Archive Hoodie', 'Верх', 29990, 'M', 'хорошее',
    'Архивное худи оверсайз с принтом. Редкий экземпляр.', '2026-10-11T13:25:00'),
  P('nike-acg-cargo', 'Nike ACG', 'Nike ACG Smith Summit Cargo', 'Низ', 8490, 'M', 'отличное',
    'Карго из прочного нейлона, много карманов, регулировка на щиколотке.', '2026-10-10T20:40:00'),
  P('salomon-xt6', 'Salomon', 'Salomon XT-6 Black', 'Обувь', 13990, '42', 'отличное',
    'Кроссовки XT-6 в чёрном. Ношены пару раз, коробка в комплекте.', '2026-10-10T12:05:00'),
  P('stone-island-beanie', 'Stone Island', 'Stone Island Ribbed Beanie', 'Головные уборы', 4990, 'uni', 'отличное',
    'Шапка в рубчик с компасом. Шерсть, не колется.', '2026-10-09T18:30:00'),
  P('chrome-hearts-cross-ring', 'Chrome Hearts', 'Chrome Hearts Cross Ring', 'Аксессуары', 24990, '18', 'хорошее',
    'Кольцо из серебра 925 с крестом. Есть клеймо.', '2026-10-09T11:50:00'),
  P('acne-studios-1996-jeans', 'Acne Studios', 'Acne Studios 1996 Jeans', 'Низ', 9490, '32/32', 'отличное',
    'Прямые джинсы свободной посадки, цвет vintage blue.', '2026-10-08T17:15:00'),
];
