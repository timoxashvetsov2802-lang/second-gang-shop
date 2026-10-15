// Каталог и настройки магазина. Новый товар — новый объект в PRODUCTS, фото кладутся в img/.
window.SHOP = {
  name: 'SECOND GANG',
  tagline: 'hard work pays off.',
  manager: 'flex_why',
  sale: 'F*CK SALE — по полной предоплате скидка от 20% до 60%',
  links: {
    stock: 'https://t.me/secondgang2',
    channel: 'https://t.me/secondgangg',
    vk: 'https://vk.com/1brand_magazine',
    feedback: 'https://t.me/gangfeedback',
    tiktok: 'https://www.tiktok.com/@second.gang',
  },
  // Реквизиты для перевода по СБП. ЗАМЕНИТЬ на настоящие.
  sbp: {
    phone: '+7 900 000-00-00',
    bank: 'Т-Банк',
    recipient: 'Имя Ф.',
  },
  reserveMinutes: 15,
  delivery: [
    { id: 'cdek', title: 'СДЭК', note: 'до пункта выдачи' },
    { id: 'post', title: 'Почта России', note: 'до отделения' },
    { id: 'meet', title: 'Личная встреча', note: 'по договорённости' },
  ],
};

window.CATEGORIES = ['Все', 'Верх', 'Головные уборы', 'Низ', 'Обувь', 'Аксессуары'];

window.PRODUCTS = [
  {
    id: 'celine-archive-cap',
    title: 'Celine Paris Archive Cap',
    brand: 'Celine',
    category: 'Головные уборы',
    condition: 'хорошее',
    size: 'uni',
    price: 6790,
    desc: 'Редкая винтажная кепка Celine Paris с вышитым лого.',
    photos: ['img/cap-2.jpg', 'img/cap-1.jpg', 'img/cap-3.jpg', 'img/cap-4.jpg', 'img/cap-5.jpg'],
    added: '2026-10-15T19:06:00',
  },
  {
    id: 'stone-island-peach-sweatshirt',
    title: 'Stone Island Peach Sweatshirt',
    brand: 'Stone Island',
    category: 'Верх',
    condition: 'отличное',
    size: 'L–XL',
    sizeNote: 'замеры по запросу',
    price: 3690,
    desc: 'Шикарный свитшот от стоника в очень мягком цвете, невероятно тактильно приятный материал.',
    photos: ['img/stone-2.jpg', 'img/stone-1.jpg', 'img/stone-3.jpg', 'img/stone-4.jpg', 'img/stone-5.jpg'],
    added: '2026-10-15T19:05:00',
  },
];
