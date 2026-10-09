/* ============================================================
   app.js — OWLS Cash, трекер расходов по макету 2a.
   Экраны: Сегодня · История · Дашборд · Настройки (оверлей)
   + лист редактирования категории.
   ============================================================ */
(function () {
  'use strict';
  const I = window.OWLS_ICONS;
  const M = window.OwlsMotion;
  const Store = window.OwlsStore;

  /* ---------- справочники ---------- */
  const DEFAULT_CATS = [
    ['Продукты', 'shopping-bag'], ['Кафе и рестораны', 'coffee'], ['Транспорт', 'bus'], ['Дом и ЖКХ', 'house'],
    ['Здоровье', 'heart'], ['Одежда', 'shirt'], ['Развлечения', 'clapperboard'], ['Прочее', 'ellipsis']
  ];
  const ICON_CHOICES = [
    'shopping-bag', 'coffee', 'bus', 'house', 'heart', 'shirt', 'clapperboard', 'ellipsis',
    'shopping-cart', 'utensils', 'car', 'train-front', 'bike', 'fuel', 'gift', 'smartphone',
    'book-open', 'graduation-cap', 'pill', 'baby', 'dumbbell', 'plane', 'wallet', 'credit-card',
    'paw-print', 'cat', 'dog', 'gamepad-2', 'music', 'scissors', 'wrench', 'briefcase', 'receipt', 'sparkles'
  ];
  /* Установки про деньги: на заставке показывается одна случайная. */
  const QUOTES = [
    'Деньги — не главное, но много не бывает',
    'Деньги — хороший слуга, но плохой хозяин',
    'Cash is king',
    'Богатый не тот, у кого много, а тот, кому хватает',
    'Копейка рубль бережёт',
    'Деньги любят тишину',
    'Скупой платит дважды',
    'Деньги к деньгам идут'
  ];

  const RAMP = ['#0B1E35', '#F26336', '#16304E', '#6B6152', '#C4B79E', '#2A3A52', '#FBD5C7', '#9A8F7C'];
  const TABS = ['today', 'history', 'dash'];
  const MAX_DIGITS = 7;
  const RING_C = 2 * Math.PI * 47;

  /* Примерные данные из прототипа, привязанные к текущей дате (смещение в днях). */
  const SAMPLE = [
    [0, [[240, 'Кафе и рестораны', 'Кофе с собой', '09:12'], [780, 'Продукты', 'Пятёрочка', '12:40'], [220, 'Транспорт', 'Метро', '18:05']]],
    [1, [[1450, 'Продукты', 'Лента, закупка на неделю', '11:20'], [640, 'Кафе и рестораны', 'Обед на работе', '13:45'], [3200, 'Дом и ЖКХ', 'Квартплата', '19:30']]],
    [2, [[890, 'Здоровье', 'Аптека', '08:50'], [2490, 'Одежда', 'Кроссовки', '15:10'], [450, 'Развлечения', 'Кино', '21:00']]],
    [3, [[2180, 'Продукты', 'Ашан', '12:05'], [320, 'Транспорт', 'Такси', '17:25'], [1290, 'Кафе и рестораны', 'Ужин с семьёй', '20:15']]],
    [6, [[4900, 'Дом и ЖКХ', 'Интернет и связь, год', '10:00'], [1560, 'Продукты', 'ВкусВилл', '18:40']]],
    [8, [[3400, 'Здоровье', 'Стоматолог', '09:30'], [1800, 'Развлечения', 'Концерт', '19:50'], [260, 'Транспорт', 'Автобус', '22:10']]],
    [10, [[2340, 'Продукты', 'Магнит', '13:15'], [780, 'Кафе и рестораны', 'Кофейня', '16:05'], [1500, 'Прочее', 'Химчистка', '18:20']]],
    [13, [[5200, 'Одежда', 'Куртка', '14:40'], [640, 'Транспорт', 'Каршеринг', '20:30']]],
    [15, [[1890, 'Продукты', 'Перекрёсток', '11:55']]]
  ];

  /* ---------- утилиты ---------- */
  const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; if (m > 10 && m < 20) return c; if (k === 1) return a; if (k > 1 && k < 5) return b; return c; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const monthKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const localISO = d => `${dayKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const svg = (name, size, sw) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.ellipsis}</svg>`;

  function dayLabel(key) {
    const now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (key === dayKey(now)) return 'Сегодня';
    if (key === dayKey(y)) return 'Вчера';
    const [Y, Mo, D] = key.split('-').map(Number);
    const d = new Date(Y, Mo - 1, D);
    const opts = { day: 'numeric', month: 'long' };
    if (Y !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('ru-RU', opts);
  }

  /* ---------- состояние ---------- */
  const state = {
    tab: 'today',
    smartText: '',
    smartCat: null,   // категория, выбранная руками поверх распознанной
    sovaRes: null,    // последний разбор от Совы: {text, amount, category, name}
    sovaBusy: false,  // ждём ответ Совы
    mic: false,       // идёт голосовой ввод
    amount: '', cat: null, comment: '', pad: false, padAnim: false,
    settings: false, editor: null,
    data: null
  };

  function defaults() {
    return {
      categories: DEFAULT_CATS.map(([name, icon], i) => ({ id: 'c' + (i + 1), name, icon, order: i, hidden: false })),
      expenses: [],
      backupAt: '',      // день последней копии, YYYY-MM-DD
      edits: 0,          // правок с последней копии
      backupSnooze: '',  // день, до которого напоминание отложено
      smart: false,      // умный ввод: одна строка вместо трёх полей
      sova: false,       // разбор фразы через Сову, а не только правилами
      sovaUrl: '',       // адрес посредника, который спрашивает Сову
      learned: {}        // слово → id категории, выученное на ваших правках
    };
  }
  /* Данные из хранилища могут быть от старой версии: добавляем недостающие поля. */
  function normalize(d) {
    const base = defaults();
    if (!d || !Array.isArray(d.categories) || !Array.isArray(d.expenses)) return base;
    const out = Object.assign(base, d);
    if (!out.learned || typeof out.learned !== 'object') out.learned = {};
    out.sovaUrl = typeof out.sovaUrl === 'string' ? out.sovaUrl : '';
    return out;
  }
  state.data = normalize(Store.load());
  const persist = () => Store.save(state.data);
  const bumpEdits = () => { state.data.edits = (state.data.edits || 0) + 1; };

  /* ---------- производные значения (считаются из данных, не хранятся) ---------- */
  const catById = id => state.data.categories.find(c => c.id === id);
  const catName = id => { const c = catById(id); return c ? c.name : 'Прочее'; };
  const catIcon = id => { const c = catById(id); return c ? c.icon : 'ellipsis'; };
  const orderedCats = () => state.data.categories.slice().sort((a, b) => a.order - b.order);
  const visibleCats = () => orderedCats().filter(c => !c.hidden);

  function derive() {
    const now = new Date();
    const tk = dayKey(now), mk = monthKey(now);
    const all = state.data.expenses.slice().sort((a, b) => b.ts.localeCompare(a.ts));
    const todayRows = all.filter(e => e.ts.slice(0, 10) === tk);
    const monthRows = all.filter(e => e.ts.slice(0, 7) === mk);
    const sum = rows => rows.reduce((t, e) => t + e.amount, 0);
    const monthTotal = sum(monthRows);
    const totals = {};
    monthRows.forEach(e => { totals[e.catId] = (totals[e.catId] || 0) + e.amount; });
    const groups = [];
    all.forEach(e => {
      const k = e.ts.slice(0, 10);
      let g = groups[groups.length - 1];
      if (!g || g.key !== k) { g = { key: k, label: dayLabel(k), items: [], sum: 0 }; groups.push(g); }
      g.items.push(e); g.sum += e.amount;
    });
    const bars = Object.keys(totals).sort((a, b) => totals[b] - totals[a]).map((id, i) => ({
      id, name: catName(id), icon: catIcon(id), total: totals[id],
      share: monthTotal ? totals[id] / monthTotal : 0, color: RAMP[i % RAMP.length]
    }));
    return {
      now, todayTotal: sum(todayRows), todayCount: todayRows.length,
      monthTotal, monthAvg: monthTotal / now.getDate(), monthRows, totals, groups, bars
    };
  }

  /* Размеры рядов «сот»: не больше трёх в ряду, ряды выложены зеркально,
     чтобы фигура читалась как соты, а не как лесенка.
     8 категорий дают 3/2/3, как в макете; 7 → 2/3/2; 9 → 3/3/3. */
  function honeyRows(n) {
    if (n <= 3) return [n];
    const r = Math.ceil(n / 3);
    const base = Math.floor(n / r), extra = n % r;
    const desc = Array.from({ length: r }, (_, k) => (k < extra ? base + 1 : base));
    const mirror = sizes => {
      const out = new Array(r);
      let lo = 0, hi = r - 1, k = 0;
      while (lo <= hi) { out[lo++] = sizes[k++]; if (lo <= hi) out[hi--] = sizes[k++]; }
      return out;
    };
    const a = mirror(desc), b = mirror(desc.slice().reverse());
    const isMirror = v => v.every((x, k) => x === v[r - 1 - k]);
    return isMirror(a) ? a : (isMirror(b) ? b : a);
  }

  /* ================= умный ввод =================
     Разбор строки вроде «1000 кафе с семьёй» на сумму, категорию и
     наименование. Работает на устройстве: сначала выученные вами слова,
     потом названия самих категорий, потом встроенный словарь.
     Подбор только из категорий, которые уже есть. */

  /* Встроенные подсказки: слово → название категории. Берутся в расчёт,
     только если категория с таким названием у вас существует. */
  const HINTS = {
    'Продукты': ['продукт', 'пятерочка', 'магнит', 'ашан', 'лента', 'перекресток', 'вкусвилл', 'дикси', 'окей', 'супермаркет', 'магазин', 'хлеб', 'молоко', 'мясо', 'овощи', 'рынок', 'бакалея'],
    'Кафе и рестораны': ['кафе', 'ресторан', 'кофе', 'кофейня', 'обед', 'ужин', 'завтрак', 'бар', 'пицца', 'суши', 'бургер', 'столовая', 'шаурма', 'доставка', 'перекус'],
    'Транспорт': ['метро', 'автобус', 'такси', 'трамвай', 'троллейбус', 'маршрутка', 'каршеринг', 'электричка', 'поезд', 'проезд', 'самокат', 'парковка'],
    'Дом и ЖКХ': ['квартплата', 'жкх', 'коммуналка', '電', 'электричество', 'интернет', 'связь', 'аренда', 'ремонт', 'мебель', 'уборка'],
    'Здоровье': ['аптека', 'лекарств', 'врач', 'стоматолог', 'анализы', 'клиника', 'больница', 'массаж', 'витамин'],
    'Одежда': ['одежда', 'обувь', 'кроссовки', 'куртка', 'джинсы', 'рубашка', 'платье', 'носки', 'футболка'],
    'Развлечения': ['кино', 'театр', 'концерт', 'музей', 'выставка', 'боулинг', 'игра', 'подписка', 'парк'],
    'Бензин': ['бензин', 'заправка', 'азс', 'топливо', 'дизель', 'шины', 'колеса', 'сервис', 'автомойка', 'масло']
  };

  const STOP = new Set(['и', 'в', 'на', 'с', 'со', 'за', 'для', 'по', 'от', 'до', 'из', 'у', 'о', 'об', 'при', 'под', 'над', 'руб', 'рублей', 'рубля', 'р']);

  const normWord = w => w.toLowerCase().replace(/ё/g, 'е').replace(/[^0-9a-zа-я]/g, '');

  /* Слова считаются одним и тем же, если совпадает начало: так переживаем
     склонения — «семья» и «семьёй», «продукт» и «продукты». */
  function wordsMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const n = Math.min(a.length, b.length);
    if (n < 4) return false;
    let i = 0;
    while (i < n && a[i] === b[i]) i++;
    return i >= 4 && i >= n - 2;
  }

  const textWords = s => String(s || '').split(/[\s,.;:!?()«»"'\/\\-]+/).map(normWord).filter(w => w.length > 1 && !STOP.has(w));

  /* Категория по названию: сверяем по словам, чтобы «Кафе» нашлось
     по подсказке, записанной как «Кафе и рестораны». */
  function catByName(name) {
    const want = textWords(name);
    if (!want.length) return null;
    return orderedCats().find(c => !c.sys && textWords(c.name).some(w => want.some(q => wordsMatch(w, q)))) || null;
  }

  /* Служебная категория для нераспознанного. Создаётся при первой нужде. */
  function noneCat(create) {
    let c = state.data.categories.find(x => x.sys === 'none');
    if (!c && create) {
      const order = (state.data.categories.reduce((m, x) => Math.max(m, x.order), -1)) + 1;
      c = { id: Store.uid(), name: 'Без категории', icon: 'circle-help', order, hidden: true, sys: 'none' };
      state.data.categories.push(c);
    }
    return c || null;
  }

  /* Разбор строки. Возвращает сумму, категорию (или null) и наименование. */
  function parseLocal(text) {
    const src = String(text || '').trim();
    let amount = 0, rest = src;

    /* Число: цифры с пробелами-разделителями тысяч и необязательной дробью.
       Множитель «к»/«тыс» засчитывается, только если это отдельное слово,
       иначе «кафе» и «такси» превращались бы в тысячи. */
    const m = src.match(/\d[\d\s\u00a0]*(?:[.,]\d{1,3})?/);
    if (m) {
      const token = m[0];
      const after = src.slice(m.index + token.length);
      const mult = after.match(/^\s*(к|k|т|тыс|тысяч[а-я]*)(?![а-яёa-z])/i);
      const num = parseFloat(token.replace(/[\s\u00a0]/g, '').replace(',', '.')) || 0;
      amount = Math.round(mult ? num * 1000 : num);
      const consumed = token.length + (mult ? mult[0].length : 0);
      rest = (src.slice(0, m.index) + ' ' + src.slice(m.index + consumed)).trim();
    }
    /* Хвосты вроде «руб» и «₽» в наименование не тащим. */
    rest = rest.replace(/(^|\s)(р|руб|руб\.|рубль|рубля|рублей|₽)(?=\s|$)/gi, ' ')
               .replace(/\s+/g, ' ')
               .replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, '');

    const words = textWords(rest);
    const live = orderedCats().filter(c => !c.sys);
    let cat = null, learnedHit = false;

    /* 1. ваши выученные слова — они главнее всего */
    for (const w of words) {
      for (const key of Object.keys(state.data.learned)) {
        if (!wordsMatch(w, key)) continue;
        const c = catById(state.data.learned[key]);
        if (c && !c.sys) { cat = c; learnedHit = true; break; }
      }
      if (cat) break;
    }
    /* 2. названия самих категорий */
    if (!cat) {
      outer: for (const w of words) {
        for (const c of live) {
          if (textWords(c.name).some(cw => wordsMatch(cw, w))) { cat = c; break outer; }
        }
      }
    }
    /* 3. встроенный словарь, но только на существующие категории */
    if (!cat) {
      outer2: for (const w of words) {
        for (const [name, keys] of Object.entries(HINTS)) {
          if (!keys.some(k => wordsMatch(k, w))) continue;
          const c = catByName(name);
          if (c) { cat = c; break outer2; }
        }
      }
    }

    const name = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '';
    return { amount, cat, name, learnedHit, raw: src };
  }

  /* Разбор строки для экрана: правила на устройстве плюс, если Сова успела
     ответить на эту же строку, её разбор поверх. Выученные вами слова Сова
     не переучивает — ваша правка главнее любой догадки. */
  function parseSmart(text) {
    const base = parseLocal(text);
    const s = state.sovaRes;
    if (!s || s.text !== base.raw) return base;
    const out = Object.assign({}, base, { sova: true });
    if (s.amount > 0) out.amount = s.amount;
    if (s.name) out.name = s.name;
    if (!base.learnedHit && s.category) {
      const c = catByName(s.category);
      if (c && !c.sys) out.cat = c;
    }
    return out;
  }

  /* Кнопка «Внести расход» — только свайп ручки вправо, нажатие не вносит:
     так расход не уйдёт случайным касанием. Ручка и заливка лежат поверх
     кнопки и её габаритов не меняют. */
  function commitBtn(can, act, iconSize) {
    return `<button type="button" class="commit${can ? ' on' : ''}" data-slide-act="${act}" aria-disabled="${!can}">
          <i class="slide-fill" aria-hidden="true"></i>
          <span class="commit-t slide-label">${svg('plus', iconSize, 2.3)}Внести расход</span>
          <i class="slide-thumb" aria-hidden="true">${svg('chevron-right', 20, 2.4)}</i>
        </button>`;
  }

  /* ---------- голосовой ввод ---------- */
  /* Распознаёт сам телефон: служба распознавания на сервере ИИ пускает только
     свои адреса, а у посредника в облаке адрес плавающий. На iPhone за этим
     стоит диктовка Apple, в Chrome — распознавание Google. Где такого нет,
     кнопку не показываем: мёртвая кнопка хуже её отсутствия. */
  const APP_V = (document.querySelector('script[src*="app.js"]')?.src.match(/v=(\d+)/) || [])[1] || '?';
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micOk = () => !!Rec;
  const MIC_LIMIT = 15000;   // сам закроется: открытый микрофон забывать нельзя
  const MIC_WATCH = 1500;    // столько ждём открытия, дальше считаем сбоем
  const MIC_WATCH_1 = 20000; // в первый раз iOS спрашивает разрешение: человек читает
  let recObj = null;
  let micGen = 0;            // номер сеанса: события от прошлых не слушаем
  let micStarting = false, micHeard = false, micBefore = '';
  let micEverStarted = false;
  let micTimer = 0, micWatch = 0;

  /* Журнал событий микрофона. Временный: четыре правки по догадкам не помогли,
     нужно увидеть, что телефон присылает на самом деле. Показывается сам
     после неудачного сеанса. */
  const micLog = [];
  const micT0 = performance.now();
  let micInst = 0;
  function mlog(msg) {
    micLog.push(((performance.now() - micT0) / 1000).toFixed(2) + ' ' + msg);
    if (micLog.length > 60) micLog.shift();
  }

  /* На каждый сеанс — новый распознаватель со своими обработчиками и номером.
     «Конец» прошлого сеанса приходит с опозданием, уже после начала нового.
     Раньше он гасил кнопку, и дальше распознанный текст отбрасывался —
     микрофон слышал, а приложение выбрасывало. Это и было «второй раз не
     слышит». Теперь у остановленного распознавателя обработчики сняты, и
     запоздавшее событие уходит в пустоту; номер сеанса — второй замок. */
  function bindRec(r, gen) {
    r.lang = 'ru-RU';
    r.interimResults = true;
    /* На iPhone непрерывный режим поддержан плохо: сеанс заканчивается сам
       после фразы. Так надёжнее, чем держать микрофон открытым. */
    r.continuous = false;

    r.onstart = () => {
      if (gen !== micGen) return;
      micStarting = false;
      micEverStarted = true;
      clearTimeout(micWatch);
      setMic(true);
      clearTimeout(micTimer);
      micTimer = setTimeout(() => { mlog('лимит 15 с'); stopMic(!micHeard); }, MIC_LIMIT);
    };

    /* Текст принимаем всегда, пока сеанс наш. Никаких проверок состояния
       кнопки: ошибиться в её состоянии дешевле, чем потерять сказанное. */
    r.onresult = e => {
      if (gen !== micGen) return;
      micAccept(e);
    };

    r.onerror = ev => {
      if (gen !== micGen) return;
      if (ev && ev.error === 'aborted') return;   // это наш же вызов
      micDetach();
      micFinish(!micHeard);
    };
    r.onend = () => {
      if (gen !== micGen) return;
      micDetach();
      micFinish(!micHeard);
    };
  }

  function micAccept(e) {
    let said = '';
    for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
    said = said.trim();
    if (!said) return;
    micHeard = true;
    state.smartText = micBefore ? micBefore + ' ' + said : said;
    const el = state.tab === 'today' ? currentScreen() : null;
    if (!el) return;
    const si = el.querySelector('#smart-in');
    if (si) si.value = state.smartText;
    patchSmart(el);
    /* Сову спрашиваем только по готовой фразе, а не по каждому слову. */
    if (e.results[e.results.length - 1].isFinal) sovaSchedule(state.smartText);
  }

  /* Слушатели, которые не снимаются никогда: пишут журнал и ловят случай,
     когда Safari отдаёт звук нового сеанса прежнему распознавателю. Тогда
     обработчики прежнего уже сняты, и без этого сказанное терялось бы. */
  function micWatchRec(r, k) {
    ['start', 'audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch']
      .forEach(t => r.addEventListener(t, () => mlog('#' + k + ' ' + t)));
    r.addEventListener('error', e => mlog('#' + k + ' error: ' + (e.error || '?') + (e.message ? ' — ' + e.message : '')));
    r.addEventListener('end', () => mlog('#' + k + ' end'));
    r.addEventListener('result', e => {
      const last = e.results[e.results.length - 1];
      const txt = Array.from(e.results).map(x => x[0].transcript).join('').trim();
      mlog('#' + k + ' result: ' + (txt ? '«' + txt.slice(0, 32) + '»' : 'пусто') + (last && last.isFinal ? ', итог' : ''));
      if (r !== recObj && (state.mic || micStarting) && txt) {
        mlog('   ↳ пришло прежнему #' + k + ', беру в текущий сеанс');
        micAccept(e);
      }
    });
  }

  let micSkipClick = false;   // долгое нажатие открыло журнал — щелчок не считаем

  function micToggle() {
    if (micSkipClick) { micSkipClick = false; return; }
    mlog('нажатие: запись ' + (state.mic ? 'идёт' : 'нет') + (micStarting ? ', запуск идёт' : '') + ', текст ' + (micHeard ? 'был' : 'не был'));
    /* Остановили сами, а текста так и не было — это тоже неудача: показываем журнал. */
    if (state.mic || micStarting) { stopMic(!micHeard); return; }
    if (!micOk()) return;
    /* Текст, который был до начала записи: распознанное дописываем к нему. */
    micBefore = state.smartText.trim();
    micHeard = false;
    micStart(false);
  }

  /* Второй сеанс подряд Safari иногда не открывает: либо бросает ошибку на
     start, либо молчит — ни начала, ни ошибки. Отпускаем распознаватель и
     пробуем ещё раз; не вышло и со второй — мигаем. */
  function micStart(retry) {
    micDetach();
    try { recObj = new Rec(); } catch (err) { mlog('new: сбой ' + (err && err.message)); micFail(); return; }
    const k = ++micInst;
    micWatchRec(recObj, k);
    const gen = ++micGen;
    bindRec(recObj, gen);
    micStarting = true;
    mlog('── #' + k + ' start()' + (retry ? ', повтор' : ''));
    try {
      recObj.start();
    } catch (err) {
      mlog('#' + k + ' start бросил: ' + (err && err.message));
      micStarting = false;
      if (retry) { micFail(); return; }
      micRecycle();
      setTimeout(() => micStart(true), 260);
      return;
    }
    clearTimeout(micWatch);
    micWatch = setTimeout(() => {
      if (state.mic) return;          // всё-таки открылся
      mlog('сторож: не открылся за ' + (micEverStarted ? MIC_WATCH : MIC_WATCH_1) + ' мс');
      micStarting = false;
      micRecycle();
      if (retry) micFail(); else micStart(true);
    }, micEverStarted ? MIC_WATCH : MIC_WATCH_1);
  }

  /* Отвязываем распознаватель: его поздние события больше никого не трогают. */
  function micDetach() {
    if (!recObj) return null;
    const r = recObj;
    recObj = null;
    micGen++;
    r.onstart = r.onresult = r.onerror = r.onend = null;
    return r;
  }

  function micRecycle() {
    const r = micDetach();
    if (r) { try { r.abort(); } catch {} }
  }

  function micFail() {
    clearTimeout(micWatch);
    micStarting = false;
    setMic(false);
    micMiss();
  }

  /* Сеанс кончился сам: микрофон уже закрыт, трогать распознаватель не надо. */
  function micFinish(miss) {
    clearTimeout(micWatch);
    clearTimeout(micTimer);
    const was = state.mic || micStarting;
    micStarting = false;
    setMic(false);
    if (was && miss) micMiss();
  }

  /* Останавливаем мы: завершаем мягко, abort на iPhone ломает следующий сеанс. */
  function stopMic(miss) {
    clearTimeout(micWatch);
    clearTimeout(micTimer);
    const was = state.mic || micStarting;
    micStarting = false;
    setMic(false);
    const r = micDetach();
    if (r && was) { try { r.stop(); } catch {} }
    if (was && miss) micMiss();
  }

  /* Мигание кнопки: меняем только цвет, сдвиг сбил бы её с места. */
  function micMiss() {
    mlog('✕ ничего не разобрано');
    showMicLog();
    const el = state.tab === 'today' ? currentScreen() : null;
    const b = el && el.querySelector('.mic');
    if (!b) return;
    b.classList.remove('miss');
    void b.offsetWidth;
    b.classList.add('miss');
    setTimeout(() => b.classList.remove('miss'), 600);
  }

  function showMicLog() {
    let box = document.getElementById('mic-log');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mic-log';
      box.className = 'mic-log';
      box.addEventListener('click', () => box.remove());
      document.body.appendChild(box);
    }
    const ua = navigator.userAgent.match(/OS (\d+[_\d]*)/);
    box.innerHTML = '<b>Журнал микрофона</b><i>сфотографируйте экран и пришлите · нажмите, чтобы закрыть</i>'
      + '<pre>' + esc('iOS ' + (ua ? ua[1].replace(/_/g, '.') : '?') + ', ' + (navigator.standalone ? 'с экрана «Домой»' : 'в Safari') + ', v' + APP_V + '\n'
      + micLog.slice(-26).join('\n')) + '</pre>';
  }

  /* Класс переключаем на месте: перерисовка во время записи сбросила бы фокус. */
  function setMic(on) {
    if (state.mic === on) return;
    state.mic = on;
    const el = state.tab === 'today' ? currentScreen() : null;
    const b = el && el.querySelector('.mic');
    if (!b) return;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Остановить голосовой ввод' : 'Голосовой ввод');
  }

  /* ---------- разбор через Сову ---------- */
  /* Запрос уходит не прямо в Ollama, а посреднику (Cloudflare Worker,
     см. worker/owls-sova.js): страница на https, у Совы обычный http,
     и адрес сервера не должен лежать в открытом репозитории. Путь в ссылке —
     это ключ: без него посредник отвечает 404, поэтому ссылку шлём целиком. */
  const SOVA_IDLE = 550;   // пауза в наборе, после которой спрашиваем
  const SOVA_WAIT = 4000;  // дольше не ждём: разбор на устройстве уже на экране
  let sovaTimer = 0, sovaSeq = 0;

  const sovaReady = () => !!(state.data.smart && state.data.sova && state.data.sovaUrl);

  function sovaForget() {
    clearTimeout(sovaTimer);
    if (sovaCtl) { sovaCtl.abort(); sovaCtl = null; }
    sovaSeq++;
    state.sovaRes = null;
    setSovaBusy(false);
  }

  function setSovaBusy(on) {
    if (state.sovaBusy === on) return;
    state.sovaBusy = on;
    const el = state.tab === 'today' ? currentScreen() : null;
    const p = el && el.querySelector('.parse');
    if (p) p.classList.toggle('waiting', on);
  }

  function sovaSchedule(text) {
    clearTimeout(sovaTimer);
    const src = String(text || '').trim();
    if (state.sovaRes && state.sovaRes.text !== src) state.sovaRes = null;
    if (!sovaReady() || src.length < 3) { sovaSeq++; setSovaBusy(false); return; }
    if (state.sovaRes && state.sovaRes.text === src) return;
    sovaTimer = setTimeout(() => sovaAsk(src), SOVA_IDLE);
  }

  /* Сервер Совы общий для всех проектов компании: больше двух запросов разом
     с одного места слать нельзя. Новый запрос отменяет прежний — он уже не
     о той строке, и держать его на сервере незачем. */
  let sovaCtl = null;

  function sovaAsk(src) {
    const seq = ++sovaSeq;
    setSovaBusy(true);
    if (sovaCtl) sovaCtl.abort();
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    sovaCtl = ctl;
    const stop = setTimeout(() => { if (ctl) ctl.abort(); }, SOVA_WAIT);
    const done = () => { clearTimeout(stop); if (seq === sovaSeq) setSovaBusy(false); };
    fetch(state.data.sovaUrl.replace(/\/+$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({
        text: src,
        categories: orderedCats().filter(c => !c.sys).map(c => c.name)
      })
    }).then(res => {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(d => {
      /* Пока ждали, строку могли дописать — тогда ответ уже не о ней. */
      if (seq !== sovaSeq || src !== String(state.smartText).trim()) return;
      state.sovaRes = {
        text: src,
        amount: Math.max(0, Math.round(+d.amount) || 0),
        category: String(d.category || ''),
        name: String(d.name || '')
      };
      const el = state.tab === 'today' ? currentScreen() : null;
      if (el) patchSmart(el);
    }).catch(() => {
      /* Молчим намеренно: на экране стоит разбор на устройстве, он не хуже. */
    }).then(done, done);
  }

  /* Куда слово попадёт само, без обучения. */
  function autoCatForWord(w) {
    for (const key of Object.keys(state.data.learned)) {
      if (!wordsMatch(w, key)) continue;
      const c = catById(state.data.learned[key]);
      if (c && !c.sys) return c;
    }
    for (const c of orderedCats()) {
      if (!c.sys && textWords(c.name).some(cw => wordsMatch(cw, w))) return c;
    }
    for (const [n, keys] of Object.entries(HINTS)) {
      if (!keys.some(k => wordsMatch(k, w))) continue;
      const c = catByName(n);
      if (c) return c;
    }
    return null;
  }

  /* Какие слова стоит запомнить за выбранной категорией.
     Сначала те, что сейчас не узнаются вовсе, потом те, что уводят не туда:
     иначе «продукты» нельзя было бы переучить на другую категорию. */
  function learnCandidates(name, targetId) {
    const ws = textWords(name);
    const unknown = ws.filter(w => !autoCatForWord(w));
    if (unknown.length) return unknown;
    if (!targetId) return [];
    return ws.filter(w => { const c = autoCatForWord(w); return c && c.id !== targetId; });
  }

  /* ---------- экран «Сегодня» ---------- */
  function honeycomb(cats) {
    if (!cats.length) return '<div class="honey-empty">Все категории скрыты. Откройте настройки, чтобы вернуть их.</div>';
    const rows = [];
    let i = 0;
    for (const size of honeyRows(cats.length)) { rows.push(cats.slice(i, i + size)); i += size; }
    return rows.map(r => `<div class="honey-row">${r.map(c =>
      `<button type="button" class="cat${state.cat === c.id ? ' on' : ''}" data-cat="${c.id}" title="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${state.cat === c.id}">${svg(c.icon, 26, 1.6)}</button>`
    ).join('')}</div>`).join('');
  }

  function formHint(has, can) { return can ? 'готово к внесению' : (has ? 'выберите категорию' : 'введите сумму'); }

  function renderToday(d) {
    const has = state.amount.length > 0 && parseInt(state.amount, 10) > 0;
    const can = has && !!state.cat && !!catById(state.cat);
    const picked = state.cat && catById(state.cat);
    const dateStr = d.now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const monthStr = d.now.toLocaleDateString('ru-RU', { month: 'long' });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'];
    const numpad = state.pad ? `<div class="numpad${state.padAnim ? ' appear' : ''}" role="group" aria-label="Клавиатура">
      ${keys.map(k => `<button type="button" class="key" data-key="${k}">${k}</button>`).join('')}
      <button type="button" class="key bs" data-key="bs" aria-label="Стереть">${svg('delete', 21, 1.7)}</button>
    </div>` : '';
    const longToday = fmt(d.todayTotal).length > 7, longMonth = fmt(d.monthTotal).length > 7;
    return `<section class="screen" data-screen="today">
      <header class="head cascade-item">
        <div class="spacer"></div>
        <button type="button" class="brand pressable" data-act="settings" aria-label="Настройки категорий">
          <span class="brand-t"><span class="brand-n">OWLS Cash</span><span class="brand-d">${dateStr}</span></span>
          <img src="assets/owls_owl.png" alt="">
        </button>
      </header>
      ${backupDue() ? `<div class="card pad bk cascade-item">
        <div class="bk-top">
          <span class="bk-ic">${svg('wallet', 18, 1.7)}</span>
          <span class="bk-t"><b>${backupDaysAgo() === null ? 'Копии данных ещё не было' : `Копии не было ${backupDaysAgo()} ${plural(backupDaysAgo(), 'день', 'дня', 'дней')}`}</b><span>Файл в iCloud Drive вернёт всё на новом телефоне.</span></span>
        </div>
        <div class="bk-btns">
          <button type="button" class="btn-add" data-act="bk-save">Сохранить копию</button>
          <button type="button" class="btn-ghost" data-act="bk-later">Позже</button>
        </div>
      </div>` : ''}
      <div class="sums">
        <div class="card sum cascade-item${longToday ? ' compact' : ''}" id="card-today">
          <div class="lbl">Сегодня</div>
          <div class="num"><span class="n">${fmt(d.todayTotal)}</span><span class="rub accent">₽</span></div>
          <div class="sub">${d.todayCount} ${plural(d.todayCount, 'операция', 'операции', 'операций')}</div>
        </div>
        <div class="card sum cascade-item${longMonth ? ' compact' : ''}">
          <div class="lbl">${esc(monthStr)}</div>
          <div class="num"><span class="n">${fmt(d.monthTotal)}</span><span class="rub">₽</span></div>
          <div class="sub">${fmt(d.monthAvg)} ₽ в день</div>
        </div>
      </div>
      ${state.data.smart ? smartForm() : `<div class="card form cascade-item">
        <div class="form-h"><span class="form-t">Новый расход</span><span class="form-hint">${formHint(has, can)}</span></div>
        <div class="field amount-f">
          <div class="field-h"><span class="lbl">Сумма</span>${state.pad ? '<button type="button" class="done" data-act="done">Готово</button>' : ''}</div>
          <button type="button" class="amount${state.pad ? ' open' : ''}" data-act="focus" aria-label="Сумма, ${has ? fmt(parseInt(state.amount, 10)) : 0} рублей">
            <span class="a-n${has ? '' : ' ph'}">${has ? fmt(parseInt(state.amount, 10)) : '0'}</span><span class="a-rub">₽</span>
          </button>
        </div>
        ${numpad}
        <div class="field">
          <div class="field-h"><span class="lbl">Категория</span><span class="picked${picked ? '' : ' none'}">${picked ? esc(picked.name) : 'не выбрана'}</span></div>
          <div class="honey">${honeycomb(visibleCats())}</div>
        </div>
        <div class="field">
          <label class="lbl" for="exp-name">Наименование</label>
          <input id="exp-name" class="input name-input" type="text" value="${esc(state.comment)}" placeholder="например, кофе с собой" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="60">
        </div>
        ${commitBtn(can, 'save', 19)}
      </div>`}
    </section>`;
  }

  /* Карточка умного ввода. Высота не зависит от состояния: полоса разбора
     и подпись под ней есть всегда, меняется только содержимое. */
  /* Категория показа: ручной выбор важнее распознанного. */
  function smartCat(r) {
    const manual = state.smartCat && catById(state.smartCat);
    return manual || r.cat || null;
  }

  function smartForm() {
    const r = parseSmart(state.smartText);
    const empty = !state.smartText.trim();
    const can = r.amount > 0;
    const cat = smartCat(r);
    const catLabel = cat ? cat.name : (empty ? 'категория' : 'Без категории');
    return `<div class="card form cascade-item">
      <div class="form-h"><span class="form-t">Новый расход</span></div>
      <div class="field">
        <div class="in-wrap">
          <input id="smart-in" class="smart-in${micOk() ? ' with-mic' : ''}" type="text" value="${esc(state.smartText)}" placeholder="1000 кафе с семьёй"
                 autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="80" aria-label="Сумма и описание одной строкой">
          ${micOk() ? `<button type="button" class="mic${state.mic ? ' on' : ''}" data-act="mic"
                  aria-label="${state.mic ? 'Остановить голосовой ввод' : 'Голосовой ввод'}" aria-pressed="${state.mic}">${svg('mic', 19, 1.9)}</button>` : ''}
        </div>
        <div class="parse${empty ? ' idle' : ''}${state.sovaBusy ? ' waiting' : ''}">
          <div class="parse-top">
            <span class="p-sum">${r.amount > 0 ? fmt(r.amount) : '0'}<i>₽</i></span>
            <button type="button" class="p-cat${cat ? '' : ' none'}${state.smartCat ? ' manual' : ''}" data-act="smart-cat" aria-label="${smartCatLabel(r, catLabel)}">
              ${svg(cat ? cat.icon : 'circle-help', 15, 1.7)}<span class="p-cat-n">${esc(catLabel)}</span>${smartLearnWord(r) ? `<i class="p-learn">${svg('sparkles', 13, 1.8)}</i>` : ''}${svg('chevron-right', 13, 2)}
            </button>
          </div>
          <div class="p-name">${empty ? 'наименование' : esc(r.name || catLabel)}</div>
          <i class="p-wait"></i>
        </div>
        ${commitBtn(can, 'save-smart', 20)}
      </div>
    </div>`;
  }

  /* Слово, которое запомнится при внесении с выбранной руками категорией. */
  function smartLearnWord(r) {
    if (!state.smartCat) return '';
    const cat = catById(state.smartCat);
    if (!cat || cat.sys) return '';
    if (r.cat && r.cat.id === cat.id) return '';
    return learnCandidates(r.name, cat.id)[0] || '';
  }

  function smartCatLabel(r, catLabel) {
    const word = smartLearnWord(r);
    const base = `Категория: ${catLabel}. Коснитесь, чтобы изменить`;
    return word ? `${base}. Слово «${word}» запомнится за этой категорией` : base;
  }

  /* Выбор категории прямо из строки разбора. */
  function openSmartCat() {
    const r = parseSmart(state.smartText);
    const cur = smartCat(r);
    const cats = orderedCats().filter(c => !c.sys && !c.hidden);
    const rows = [];
    let i = 0;
    for (const size of honeyRows(cats.length)) { rows.push(cats.slice(i, i + size)); i += size; }
    sheetHost.innerHTML = `<div class="sheet-wrap">
      <div class="dim" data-act="close-smartcat"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Категория расхода">
        <div class="sheet-h"><span class="sec-t">Категория</span><button type="button" class="x pressable" data-act="close-smartcat" aria-label="Закрыть">${svg('x', 18, 1.8)}</button></div>
        <div class="honey">${rows.map(row => `<div class="honey-row">${row.map(c =>
          `<button type="button" class="cat${cur && cur.id === c.id ? ' on' : ''}" data-act="smartcat-pick" data-id="${c.id}" title="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${!!cur && cur.id === c.id}">${svg(c.icon, 26, 1.6)}</button>`
        ).join('')}</div>`).join('')}</div>
        <div class="picked-name">${cur ? esc(cur.name) : 'не выбрана'}</div>
        <p class="hint center">Выбранное здесь запомнится за словом из строки и дальше подставится само.</p>
        ${state.smartCat ? `<button type="button" class="btn-ghost wide" data-act="smartcat-auto">Определять самому</button>` : ''}
      </div>
    </div>`;
  }
  function closeSmartCat() {
    const wrap = sheetHost.querySelector('.sheet-wrap');
    if (!wrap) return;
    if (M.reduced()) { sheetHost.innerHTML = ''; return; }
    wrap.classList.add('closing');
    setTimeout(() => { sheetHost.innerHTML = ''; }, 210);
  }

  /* Обновление полосы разбора без перерисовки: фокус в поле не теряется. */
  function patchSmart(el) {
    const r = parseSmart(state.smartText);
    const empty = !state.smartText.trim();
    const can = r.amount > 0;
    if (empty) state.smartCat = null;
    const cat = smartCat(r);
    const catLabel = cat ? cat.name : (empty ? 'категория' : 'Без категории');
    const parse = el.querySelector('.parse');
    if (parse) {
      parse.classList.toggle('idle', empty);
      parse.classList.toggle('waiting', state.sovaBusy);
      parse.querySelector('.p-sum').innerHTML = `${r.amount > 0 ? fmt(r.amount) : '0'}<i>₽</i>`;
      const pc = parse.querySelector('.p-cat');
      pc.classList.toggle('none', !cat);
      pc.classList.toggle('manual', !!state.smartCat);
      pc.innerHTML = svg(cat ? cat.icon : 'circle-help', 15, 1.7)
        + `<span class="p-cat-n">${esc(catLabel)}</span>`
        + (smartLearnWord(r) ? `<i class="p-learn">${svg('sparkles', 13, 1.8)}</i>` : '')
        + svg('chevron-right', 13, 2);
      pc.setAttribute('aria-label', smartCatLabel(r, catLabel));
      parse.querySelector('.p-name').textContent = empty ? 'наименование' : (r.name || catLabel);
    }
    const c = el.querySelector('.commit');
    if (c) { c.classList.toggle('on', can); c.setAttribute('aria-disabled', String(!can)); }
  }

  /* Точечное обновление формы без перерисовки (цифры numpad). */
  function patchForm(el) {
    const has = state.amount.length > 0 && parseInt(state.amount, 10) > 0;
    const can = has && !!state.cat;
    const n = el.querySelector('.a-n'); if (n) { n.textContent = has ? fmt(parseInt(state.amount, 10)) : '0'; n.classList.toggle('ph', !has); }
    const h = el.querySelector('.form-hint'); if (h) h.textContent = formHint(has, can);
    const c = el.querySelector('.commit'); if (c) { c.classList.toggle('on', can); c.setAttribute('aria-disabled', String(!can)); }
  }

  /* ---------- экран «История» ---------- */
  function renderHistory(d) {
    const monthStr = d.now.toLocaleDateString('ru-RU', { month: 'long' });
    const body = d.groups.length ? d.groups.map(g => `<div class="group cascade-item">
        <div class="group-h"><span class="g-day">${esc(g.label)}</span><span class="g-sum">${fmt(g.sum)} ₽</span></div>
        <div class="card flush">${g.items.map(e => {
          const un = isUnsorted(e);
          return `<div class="row hold${un ? ' unsorted' : ''}" data-id="${e.id}" data-act="row-cat" role="button" tabindex="0" aria-label="${esc(e.name)}, ${fmt(e.amount)} рублей, ${un ? 'без категории' : esc(catName(e.catId))}. Коснитесь, чтобы выбрать категорию, удерживайте, чтобы удалить">
            <span class="${un ? 'qmark' : 'row-ic'}">${svg(un ? 'circle-help' : catIcon(e.catId), 17, 1.6)}</span>
            <span class="row-c"><span class="row-n">${esc(e.name)}</span><span class="row-m">${un
              ? '<span class="fixme">нужна категория</span>'
              : `<span class="row-cat">${esc(catName(e.catId))}</span>`}<i class="dot"></i><span class="row-t">${e.ts.slice(11, 16)}</span></span></span>
            <span class="row-a">${fmt(e.amount)} ₽</span><i class="hold-bar"></i>
          </div>`;
        }).join('')}</div>
      </div>`).join('')
      : `<div class="card empty cascade-item"><span class="e-ic">${svg('inbox', 20, 1.6)}</span><span class="e-t">Пока пусто</span><span class="e-s">Внесите первый расход на вкладке «Сегодня» — здесь появится история по дням.</span></div>`;
    return `<section class="screen" data-screen="history">
      <header class="page-h cascade-item"><h1 class="h1">История</h1><span class="page-sub">${fmt(d.monthTotal)} ₽ за ${esc(monthStr)}</span></header>
      ${body}
      ${d.groups.length ? '<p class="hint center small">Тап по строке меняет категорию, удержание удаляет запись.</p>' : ''}
    </section>`;
  }

  /* ---------- экран «Дашборд» ---------- */
  function renderDash(d) {
    const monthStr = cap(d.now.toLocaleDateString('ru-RU', { month: 'long' }));
    const tot = fmt(d.monthTotal);
    const bars = d.bars.map(b => {
      const amt = fmt(b.total);
      return `<div class="ring-item cascade-item">
        <div class="ring">
          <svg width="104" height="104" viewBox="0 0 104 104"><circle cx="52" cy="52" r="47" fill="#fff" stroke="#E5DCC9" stroke-width="8"/><circle class="v" cx="52" cy="52" r="47" fill="none" stroke="${b.color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${RING_C.toFixed(1)}" data-target="${(RING_C * (1 - b.share)).toFixed(1)}"/></svg>
          <div class="ring-in"><span class="ring-ic">${svg(b.icon, 16, 1.6)}</span><span class="ring-n${amt.length > 7 ? ' long' : ''}">${amt}</span><span class="ring-p" data-pct="${Math.round(b.share * 100)}">0%</span></div>
        </div>
        <span class="ring-cap">${esc(b.name)}</span>
      </div>`;
    }).join('');
    return `<section class="screen" data-screen="dash">
      <h1 class="h1 cascade-item">Дашборд</h1>
      <div class="rings">
        <div class="ring-item cascade-item">
          <div class="total"><span class="t-l">Всего</span><span class="t-n${tot.length > 7 ? ' long' : ''}">${tot}</span><span class="t-r">₽</span></div>
          <span class="ring-cap strong">${esc(monthStr)}</span>
        </div>
        ${bars}
      </div>
      ${d.bars.length ? '' : `<p class="dash-empty cascade-item">В этом месяце расходов ещё нет. Доли категорий появятся после первой записи.</p>`}
    </section>`;
  }

  /* ---------- монтирование экрана ---------- */
  const screens = document.getElementById('screens');
  const tabbar = document.getElementById('tabbar');
  const currentScreen = () => screens.querySelector('.screen:not(.leave)');

  function renderScreen(tab) {
    const d = derive();
    const html = tab === 'today' ? renderToday(d) : tab === 'history' ? renderHistory(d) : renderDash(d);
    const t = document.createElement('template'); t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function afterMount(tab, el) {
    if (tab === 'dash') {
      M.fillRings(el);
      el.querySelectorAll('.ring-p').forEach(p => M.count(p, 0, +p.dataset.pct, n => n + '%'));
    }
    if (tab === 'history') {
      el.querySelectorAll('.row.hold').forEach(r => M.hold(r, { duration: 650, onComplete: () => removeExpense(r.dataset.id, r) }));
    }
    if (tab === 'today') {
      const si = el.querySelector('#smart-in');
      if (si) {
        si.addEventListener('input', () => { state.smartText = si.value; sovaSchedule(si.value); patchSmart(el); });
        si.addEventListener('keydown', e => { if (e.key === 'Enter') { si.blur(); saveSmart(el.querySelector('.commit')); } });
      }
      const inp = el.querySelector('#exp-name');
      if (inp) {
        inp.addEventListener('input', () => { state.comment = inp.value; });
        inp.addEventListener('focus', () => { if (state.pad) { state.pad = false; rerender(); } });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.blur(); } });
      }
      /* Долгое нажатие на микрофон открывает журнал в любой момент. */
      const mb = el.querySelector('.mic');
      if (mb) {
        let lp = 0;
        const cancel = () => clearTimeout(lp);
        mb.addEventListener('pointerdown', () => {
          cancel();
          lp = setTimeout(() => { micSkipClick = true; mlog('журнал открыт долгим нажатием'); showMicLog(); }, 650);
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => mb.addEventListener(t, cancel));
        mb.addEventListener('contextmenu', e => e.preventDefault());
      }
      const cb = el.querySelector('.commit');
      if (cb) {
        M.slide(cb, {
          enabled: () => cb.classList.contains('on'),
          onComplete: () => (cb.dataset.slideAct === 'save-smart' ? saveSmart(cb) : saveExpense(cb))
        });
        /* Нажатие ничего не вносит, но и не молчит: ручка подскакивает
           вправо и возвращается — подсказка, что её надо тянуть. */
        cb.addEventListener('click', () => {
          if (!cb.classList.contains('on') || cb.classList.contains('saving')) return;
          cb.classList.remove('hint');
          void cb.offsetWidth;
          cb.classList.add('hint');
          setTimeout(() => cb.classList.remove('hint'), 700);
        });
      }
      state.padAnim = false;
    }
  }

  function show(tab, dir, fromOffset) {
    const old = currentScreen();
    const el = renderScreen(tab);
    M.transition(screens, old, el, dir, fromOffset);
    afterMount(tab, el);
    if (dir) window.scrollTo(0, 0);
    if (dir || !old) M.cascade(el, '.cascade-item');
    tabbar.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  }

  /* Перерисовка текущего экрана на месте (без перехода и каскада). */
  function rerender() {
    const old = currentScreen();
    const y = window.scrollY;
    const el = renderScreen(state.tab);
    if (old) old.replaceWith(el); else screens.appendChild(el);
    afterMount(state.tab, el);
    window.scrollTo(0, y);
  }

  function goTab(tab, fromOffset) {
    if (tab === state.tab) { window.scrollTo({ top: 0, behavior: M.reduced() ? 'auto' : 'smooth' }); return; }
    const dir = TABS.indexOf(tab) > TABS.indexOf(state.tab) ? 1 : -1;
    state.tab = tab;
    if (state.pad) state.pad = false;
    show(tab, dir, fromOffset);
  }

  /* ---------- действия ---------- */
  function pressKey(k, el) {
    if (k === 'bs') state.amount = state.amount.slice(0, -1);
    else {
      const next = (state.amount + k).replace(/^0+(?=\d)/, '');
      if (next.length > MAX_DIGITS) return;
      state.amount = next;
    }
    patchForm(el);
  }

  /* Внесение расхода. Кнопка сначала показывает галочку (300ms),
     потом запись уходит в список и форма очищается. */
  const SAVE_DELAY = 300;
  let saving = false;

  function saveExpense(btn) {
    if (saving) return;
    const amount = parseInt(state.amount || '0', 10);
    const cat = state.cat && catById(state.cat);
    if (!(amount > 0) || !cat) return;
    const row = { id: Store.uid(), ts: localISO(new Date()), amount, catId: cat.id, name: state.comment.trim() || cat.name };
    const commit = () => {
      saving = false;
      state.data.expenses.unshift(row);
      bumpEdits();
      persist();
      state.amount = ''; state.cat = null; state.comment = ''; state.pad = false;
      rerender();
      M.once(document.getElementById('card-today'), 'nudge');
    };
    if (!btn || M.reduced()) { commit(); return; }
    saving = true;
    btn.classList.add('saving');
    const label = btn.querySelector('.commit-t');
    if (label) label.innerHTML = `${svg('check', 20, 2.4)}Внесено`;
    else btn.innerHTML = `${svg('check', 20, 2.4)}Внесено`;
    setTimeout(commit, SAVE_DELAY);
  }

  /* Внесение из умной строки. Нераспознанное уходит в «Без категории». */
  let savingSmart = false;
  function saveSmart(btn) {
    if (savingSmart) return;
    const r = parseSmart(state.smartText);
    if (!(r.amount > 0)) return;
    const cat = smartCat(r) || noneCat(true);
    const learnWord = smartLearnWord(r);
    const row = {
      id: Store.uid(), ts: localISO(new Date()), amount: r.amount,
      catId: cat.id, name: r.name || cat.name,
      src: 'smart'
    };
    const commit = () => {
      savingSmart = false;
      state.data.expenses.unshift(row);
      if (learnWord) state.data.learned[learnWord] = cat.id;
      bumpEdits();
      persist();
      state.smartText = '';
      stopMic();
      sovaForget();
      state.smartCat = null;
      rerender();
      M.once(document.getElementById('card-today'), 'nudge');
    };
    if (!btn || M.reduced()) { commit(); return; }
    savingSmart = true;
    btn.classList.add('saving');
    const label = btn.querySelector('.commit-t');
    if (label) label.innerHTML = `${svg('check', 20, 2.4)}Внесено`;
    else btn.innerHTML = `${svg('check', 20, 2.4)}Внесено`;
    setTimeout(commit, SAVE_DELAY);
  }

  function removeExpense(id, rowEl) {
    const i = state.data.expenses.findIndex(e => e.id === id);
    if (i < 0) return;
    state.data.expenses.splice(i, 1);
    bumpEdits();
    persist();
    if (rowEl && !M.reduced()) {
      rowEl.classList.add('removing');
      setTimeout(rerender, 200);
    } else rerender();
  }

  /* ---------- копия данных ----------
     Сайт на iPhone не может сам писать в файлы, поэтому файл уходит через
     «Поделиться», а пользователь выбирает «Сохранить в Файлы» → iCloud Drive.
     Имя всегда одно, значит копия заменяется, а не плодит файлы. */
  const BACKUP_NAME = 'OWLS Cash.json';
  const BK_EVERY_DAYS = 7, BK_FIRST_EDITS = 15;

  function backupDaysAgo() {
    if (!state.data.backupAt) return null;
    const [Y, Mo, D] = state.data.backupAt.split('-').map(Number);
    const then = new Date(Y, Mo - 1, D), now = new Date();
    return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - then) / 86400000);
  }
  function backupDue() {
    if (state.data.backupSnooze === dayKey(new Date())) return false;
    const ago = backupDaysAgo();
    if (ago === null) return (state.data.edits || 0) >= BK_FIRST_EDITS;
    return ago >= BK_EVERY_DAYS && (state.data.edits || 0) > 0;
  }
  function backupLabel() {
    const ago = backupDaysAgo();
    if (ago === null) return 'Копии ещё не было';
    if (ago === 0) return 'Копия сохранена сегодня';
    if (ago === 1) return 'Копия сохранена вчера';
    return `Копия сохранена ${ago} ${plural(ago, 'день', 'дня', 'дней')} назад`;
  }

  function backupBlob() {
    const payload = {
      app: 'owls-cash', version: 1, savedAt: new Date().toISOString(),
      data: { categories: state.data.categories, expenses: state.data.expenses }
    };
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
  }

  /* На iPhone файл уходит через «Поделиться», иначе обычной загрузкой.
     Возвращает false, если окно «Поделиться» закрыли. */
  async function deliverFile(blob, name) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && navigator.canShare) {
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); return true; }
        catch (_) { return false; }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  }

  async function backupSave(btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Готовим файл…'; }
    const ok = await deliverFile(backupBlob(), BACKUP_NAME);
    if (ok) {
      state.data.backupAt = dayKey(new Date());
      state.data.edits = 0;
      state.data.backupSnooze = '';
      persist();
    }
    if (state.settings) openSettings(); else rerender();
  }

  /* Проверяем, что файл наш, и собираем сводку для подтверждения. */
  function backupInspect(obj) {
    if (!obj || obj.app !== 'owls-cash' || !obj.data || !Array.isArray(obj.data.expenses) || !Array.isArray(obj.data.categories)) {
      throw new Error('Это не файл копии OWLS Cash');
    }
    const e = obj.data.expenses.length, c = obj.data.categories.length;
    const sum = obj.data.expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const when = obj.savedAt ? new Date(obj.savedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'дата неизвестна';
    return {
      when,
      line: `${e} ${plural(e, 'запись', 'записи', 'записей')} на ${fmt(sum)} ₽, ${c} ${plural(c, 'категория', 'категории', 'категорий')}`
    };
  }
  function backupRestore(obj) {
    state.data = normalize({
      categories: obj.data.categories, expenses: obj.data.expenses,
      backupAt: dayKey(new Date()), edits: 0, backupSnooze: ''
    });
    state.cat = null;
    persist();
  }

  /* ---------- Настройки ---------- */
  const overlay = document.getElementById('overlay');
  function renderSettings() {
    const d = derive();
    const cats = orderedCats();
    return `<div class="overlay appear" role="dialog" aria-modal="true" aria-label="Настройки">
      <header class="set-h">
        <button type="button" class="back pressable" data-act="close-settings" aria-label="Назад">${svg('chevron-left', 18, 1.8)}</button>
        <h1 class="h1 h1-sm">Настройки</h1>
      </header>
      <p class="set-hint">Категории можно переименовать, скрыть или добавить свою. Порядок здесь задаёт порядок в списке при вводе.</p>
      <div class="card flush" id="catlist">${cats.map(c => {
        const used = state.data.expenses.filter(e => e.catId === c.id).length;
        return `<div class="crow${c.hidden ? ' is-hidden' : ''}" data-id="${c.id}">
          <span class="grip" data-grip aria-label="Перетащить">${svg('grip-vertical', 16, 1.8)}</span>
          <span class="c-ic">${svg(c.icon, 18, 1.6)}</span>
          <button type="button" class="c-main" data-act="edit-cat" data-id="${c.id}"><span class="c-n">${esc(c.name)}</span>${c.sys ? '<span class="c-hid">служебная</span>' : (c.hidden ? '<span class="c-hid">скрыта</span>' : '')}</button>
          <button type="button" class="c-act" data-act="edit-cat" data-id="${c.id}" aria-label="Изменить категорию ${esc(c.name)}">${svg('square-pen', 17, 1.7)}</button>
          <button type="button" class="c-act del${used ? ' locked' : ' hold'}" data-act="del-cat" data-id="${c.id}" data-used="${used}" aria-label="Удалить категорию ${esc(c.name)}">${svg('trash-2', 16, 1.7)}${used ? '' : '<i class="hold-bar"></i>'}</button>
        </div>`;
      }).join('')}</div>
      <button type="button" class="add-cat pressable" data-act="new-cat">${svg('plus', 17, 1.9)}Добавить категорию</button>
      <div class="card pad data-card">
        <div class="sec-t">Ввод расхода</div>
        <button type="button" class="set-row" data-act="toggle-smart" role="switch" aria-checked="${state.data.smart}">
          <span class="t"><b>Умный ввод</b><span>Одна строка вместо трёх полей. «1000 кафе с семьёй» разберётся само.</span></span>
          <span class="switch${state.data.smart ? ' on' : ''}"><i></i></span>
        </button>
        ${state.data.smart ? `<button type="button" class="set-row bordered" data-act="toggle-sova" role="switch" aria-checked="${state.data.sova}">
          <span class="t"><b>Разбор через Сову</b><span>Свободную фразу разбирает ИИ. Не ответил — выручает разбор на устройстве.</span></span>
          <span class="switch${state.data.sova ? ' on' : ''}"><i></i></span>
        </button>` : ''}
        ${state.data.smart && state.data.sova ? `<div class="set-row bordered col">
          <span class="t"><b>Адрес разбора</b><span>Ссылка на посредника целиком, вместе с путём: путь в ней служит ключом. Без неё разбор остаётся на устройстве.</span></span>
          <input id="sova-url" class="input" type="url" value="${esc(state.data.sovaUrl)}" placeholder="https://owls-sova.workers.dev/ключ"
                 autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Адрес посредника для разбора через Сову">
        </div>` : ''}
        ${learnedCount() ? `<button type="button" class="set-row bordered" data-act="learned-list">
          <span class="t"><b>Запомнено слов: ${learnedCount()}</b><span>${esc(learnedPreview())}</span></span>
          <span class="c-chev">${svg('chevron-right', 16, 1.8)}</span>
        </button>` : ''}
      </div>
      <div class="card pad data-card">
        <div class="sec-t">Копия данных</div>
        <p class="hint">Файл уходит в «Файлы» → iCloud Drive: на iPhone нажмите «Сохранить в Файлы». Имя всегда одно, поэтому копия заменяется. На новом телефоне тот же файл вернёт всё обратно.</p>
        <div class="bk-when">${backupLabel()}</div>
        <button type="button" class="btn-add" data-act="bk-save">${svg('wallet', 16, 1.8)}Сохранить копию</button>
        <button type="button" class="btn-ghost" data-act="bk-restore">${svg('inbox', 15, 1.8)}Восстановить из копии</button>
      </div>
      ${state.data.expenses.length ? '' : `<button type="button" class="btn-ghost sample" data-act="sample">${svg('sparkles', 15, 1.7)}Заполнить примерами</button>`}
      <p class="set-foot">Данные хранятся только на этом устройстве.</p>
    </div>`;
  }

  function openSettings() {
    state.settings = true;
    overlay.innerHTML = renderSettings();
    const su = overlay.querySelector('#sova-url');
    if (su) {
      su.addEventListener('input', () => { state.data.sovaUrl = su.value.trim(); sovaForget(); persist(); });
      su.addEventListener('keydown', e => { if (e.key === 'Enter') su.blur(); });
    }
    const list = overlay.querySelector('#catlist');
    list.querySelectorAll('.del.hold').forEach(b => M.hold(b, {
      duration: 800,
      onComplete: () => { deleteCategoryById(b.dataset.id); }
    }));
    M.sortable(list, { handle: '[data-grip]', row: '.crow', onChange: ids => {
      ids.forEach((id, i) => { const c = catById(id); if (c) c.order = i; });
      bumpEdits();
      persist();
    } });
  }
  function closeSettings() {
    state.settings = false;
    overlay.innerHTML = '';
    rerender();
  }

  /* ---------- лист категории ---------- */
  const sheetHost = document.getElementById('sheet');
  function openEditor(id) {
    const c = id ? catById(id) : null;
    state.editor = { id: c ? c.id : null, name: c ? c.name : '', icon: c ? c.icon : ICON_CHOICES[8], hidden: c ? !!c.hidden : false };
    renderEditor();
    const inp = sheetHost.querySelector('#cat-name');
    if (inp && !c) setTimeout(() => inp.focus(), 220);
  }
  function renderEditor() {
    const ed = state.editor; if (!ed) return;
    const isNew = !ed.id;
    const used = isNew ? 0 : state.data.expenses.filter(e => e.catId === ed.id).length;
    const onlyVisible = !isNew && visibleCats().length === 1 && !catById(ed.id).hidden;
    sheetHost.innerHTML = `<div class="sheet-wrap">
      <div class="dim" data-act="close-editor"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${isNew ? 'Новая категория' : 'Категория'}">
        <div class="sheet-h"><span class="sec-t">${isNew ? 'Новая категория' : 'Категория'}</span><button type="button" class="x pressable" data-act="close-editor" aria-label="Закрыть">${svg('x', 18, 1.8)}</button></div>
        <div class="f"><label for="cat-name">Название</label><input id="cat-name" type="text" value="${esc(ed.name)}" placeholder="например, Подписки" maxlength="32" autocomplete="off" autocapitalize="sentences" enterkeyhint="done"></div>
        <div class="f"><label>Иконка</label><div class="icon-grid" role="radiogroup" aria-label="Иконка">${ICON_CHOICES.map(n => `<button type="button" class="ichip${ed.icon === n ? ' on' : ''}" data-icon="${n}" role="radio" aria-checked="${ed.icon === n}" aria-label="${n}">${svg(n, 20, 1.6)}</button>`).join('')}</div></div>
        ${isNew ? '' : `<button type="button" class="switch-row" data-act="toggle-hidden" role="switch" aria-checked="${ed.hidden}"${onlyVisible ? ' disabled' : ''}>
          <span class="sw-t"><span>Скрывать при вводе</span><span class="sw-s">${onlyVisible ? 'Последнюю видимую категорию скрыть нельзя' : 'Записи остаются в истории и на дашборде'}</span></span>
          <span class="switch${ed.hidden ? ' on' : ''}"><i></i></span>
        </button>`}
        <button type="button" class="save" data-act="save-cat" aria-disabled="${!ed.name.trim()}">Сохранить</button>
        ${isNew ? '' : (used ? `<p class="hint center">В категории ${used} ${plural(used, 'запись', 'записи', 'записей')} — её можно скрыть, но не удалить.</p>`
          : `<button type="button" class="btn-ghost danger hold" data-act="delete-cat">Удерживайте, чтобы удалить<i class="hold-bar"></i></button>`)}
      </div>
    </div>`;
    const inp = sheetHost.querySelector('#cat-name');
    inp.addEventListener('input', () => { ed.name = inp.value; sheetHost.querySelector('[data-act="save-cat"]').setAttribute('aria-disabled', String(!ed.name.trim())); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveCategory(); } });
    const del = sheetHost.querySelector('[data-act="delete-cat"]');
    if (del) M.hold(del, { duration: 800, onComplete: deleteCategory });
  }
  /* Замена всех данных необратима, поэтому сначала сводка и явное подтверждение. */
  function confirmRestore(obj, info) {
    sheetHost.innerHTML = `<div class="sheet-wrap">
      <div class="dim" data-act="close-confirm"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Восстановление из копии">
        <div class="sheet-h"><span class="sec-t">Восстановить из копии</span><button type="button" class="x pressable" data-act="close-confirm" aria-label="Закрыть">${svg('x', 18, 1.8)}</button></div>
        <p class="hint">Копия от ${esc(info.when)}: ${esc(info.line)}.</p>
        <p class="hint"><b>Текущие записи и категории будут заменены.</b> Отменить это нельзя, поэтому сначала сохраните копию того, что есть сейчас.</p>
        <button type="button" class="save" data-act="do-restore">Заменить данные</button>
        <button type="button" class="btn-ghost" data-act="close-confirm">Отмена</button>
      </div>
    </div>`;
    pendingRestore = obj;
  }
  function restoreError(msg, title = 'Файл не подошёл') {
    sheetHost.innerHTML = `<div class="sheet-wrap">
      <div class="dim" data-act="close-confirm"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-h"><span class="sec-t">${esc(title)}</span><button type="button" class="x pressable" data-act="close-confirm" aria-label="Закрыть">${svg('x', 18, 1.8)}</button></div>
        <p class="hint">${esc(msg)}</p>
        <button type="button" class="btn-ghost" data-act="close-confirm">Понятно</button>
      </div>
    </div>`;
  }
  let pendingRestore = null;
  function closeConfirm() {
    pendingRestore = null;
    const wrap = sheetHost.querySelector('.sheet-wrap');
    if (!wrap) return;
    if (M.reduced()) { sheetHost.innerHTML = ''; return; }
    wrap.classList.add('closing');
    setTimeout(() => { sheetHost.innerHTML = ''; }, 210);
  }
  function pickBackupFile() {
    const inp = document.getElementById('restore-input');
    inp.value = '';
    inp.click();
  }
  document.getElementById('restore-input').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      confirmRestore(obj, backupInspect(obj));
    } catch (err) {
      restoreError(err && err.message === 'Это не файл копии OWLS Cash'
        ? 'Это не файл копии OWLS Cash. Нужен файл «OWLS Cash.json», сохранённый из этого приложения.'
        : 'Файл повреждён или это не JSON.');
    }
  });

  const learnedCount = () => Object.keys(state.data.learned).filter(w => catById(state.data.learned[w])).length;
  function learnedPreview() {
    return Object.keys(state.data.learned)
      .filter(w => catById(state.data.learned[w]))
      .slice(0, 3)
      .map(w => `${w} → ${catName(state.data.learned[w])}`)
      .join(', ');
  }

  /* Список выученных слов: посмотреть и забыть лишнее. */
  function openLearned() {
    const words = Object.keys(state.data.learned).filter(w => catById(state.data.learned[w])).sort();
    sheetHost.innerHTML = `<div class="sheet-wrap">
      <div class="dim" data-act="close-learned"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Запомненные слова">
        <div class="sheet-h"><span class="sec-t">Запомненные слова</span><button type="button" class="x pressable" data-act="close-learned" aria-label="Закрыть">${svg('x', 18, 1.8)}</button></div>
        <p class="hint">Эти слова приложение выучило на ваших правках. Забытое слово просто перестанет подставляться.</p>
        <div class="card flush">${words.map(w => `<div class="lrow">
          <span class="l-w">${esc(w)}</span>
          <span class="l-arrow">${svg('chevron-right', 14, 1.8)}</span>
          <span class="l-c">${svg(catIcon(state.data.learned[w]), 15, 1.6)}${esc(catName(state.data.learned[w]))}</span>
          <button type="button" class="c-act del hold" data-act="forget" data-w="${esc(w)}" aria-label="Забыть слово ${esc(w)}">${svg('trash-2', 16, 1.7)}<i class="hold-bar"></i></button>
        </div>`).join('')}</div>
        <p class="hint center small">Удержите корзину, чтобы забыть слово.</p>
      </div>
    </div>`;
    sheetHost.querySelectorAll('.del.hold').forEach(b => M.hold(b, {
      duration: 700,
      onComplete: () => { delete state.data.learned[b.dataset.w]; persist(); if (learnedCount()) openLearned(); else { closeLearned(); openSettings(); } }
    }));
  }
  function closeLearned() {
    const wrap = sheetHost.querySelector('.sheet-wrap');
    if (!wrap) return;
    if (M.reduced()) { sheetHost.innerHTML = ''; return; }
    wrap.classList.add('closing');
    setTimeout(() => { sheetHost.innerHTML = ''; }, 210);
  }

  const isUnsorted = e => { const c = catById(e.catId); return !!c && c.sys === 'none'; };

  /* Лист «Категория записи»: соты для выбора плюс предложение запомнить слово. */
  let rowPick = null;
  function openRowCat(id) {
    const e = state.data.expenses.find(x => x.id === id);
    if (!e) return;
    rowPick = { id, catId: isUnsorted(e) ? null : e.catId, remember: true };
    drawRowCat();
  }
  function drawRowCat() {
    const e = state.data.expenses.find(x => x.id === rowPick.id);
    if (!e) { rowPick = null; return; }
    const cats = orderedCats().filter(c => !c.sys && !c.hidden);
    const rows = [];
    let i = 0;
    for (const size of honeyRows(cats.length)) { rows.push(cats.slice(i, i + size)); i += size; }
    const target = rowPick.catId ? catById(rowPick.catId) : null;
    rowPick.word = learnCandidates(e.name, rowPick.catId)[0] || '';
    sheetHost.innerHTML = `<div class="sheet-wrap">
      <div class="dim" data-act="close-rowcat"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Категория записи">
        <div class="sheet-h"><span class="sec-t">Категория записи</span><button type="button" class="x pressable" data-act="close-rowcat" aria-label="Закрыть">${svg('x', 18, 1.8)}</button></div>
        <p class="hint">${esc(e.name)} · ${fmt(e.amount)} ₽</p>
        <div class="honey">${rows.map(r => `<div class="honey-row">${r.map(c =>
          `<button type="button" class="cat${rowPick.catId === c.id ? ' on' : ''}" data-act="rowcat-pick" data-id="${c.id}" title="${esc(c.name)}" aria-label="${esc(c.name)}" aria-pressed="${rowPick.catId === c.id}">${svg(c.icon, 26, 1.6)}</button>`
        ).join('')}</div>`).join('')}</div>
        <div class="picked-name">${target ? esc(target.name) : 'категория не выбрана'}</div>
        ${rowPick.word ? `<button type="button" class="remember${rowPick.remember ? ' on' : ''}" data-act="rowcat-remember" role="switch" aria-checked="${rowPick.remember}">
          <span class="r-ic">${svg('sparkles', 18, 1.7)}</span>
          <span class="t">Запомнить «${esc(rowPick.word)}»${target ? ' как ' + esc(target.name) : ''}<i>В следующий раз подставится сама</i></span>
          <span class="switch${rowPick.remember ? ' on' : ''}"><i></i></span>
        </button>` : ''}
        <button type="button" class="save" data-act="rowcat-save" aria-disabled="${!rowPick.catId}">Сохранить</button>
      </div>
    </div>`;
  }
  function closeRowCat() {
    rowPick = null;
    const wrap = sheetHost.querySelector('.sheet-wrap');
    if (!wrap) return;
    if (M.reduced()) { sheetHost.innerHTML = ''; return; }
    wrap.classList.add('closing');
    setTimeout(() => { sheetHost.innerHTML = ''; }, 210);
  }
  function saveRowCat() {
    if (!rowPick || !rowPick.catId) return;
    const e = state.data.expenses.find(x => x.id === rowPick.id);
    if (e) {
      e.catId = rowPick.catId;
      if (rowPick.remember && rowPick.word) state.data.learned[rowPick.word] = rowPick.catId;
      bumpEdits();
      persist();
    }
    closeRowCat();
    rerender();
  }

  function closeEditor() {
    const wrap = sheetHost.querySelector('.sheet-wrap');
    state.editor = null;
    if (!wrap) return;
    if (M.reduced()) { sheetHost.innerHTML = ''; return; }
    wrap.classList.add('closing');
    setTimeout(() => { sheetHost.innerHTML = ''; }, 210);
  }
  function saveCategory() {
    const ed = state.editor; if (!ed) return;
    const name = ed.name.trim(); if (!name) return;
    if (ed.id) {
      const c = catById(ed.id); if (!c) return;
      c.name = name; c.icon = ed.icon; c.hidden = ed.hidden;
    } else {
      const order = state.data.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
      state.data.categories.push({ id: Store.uid(), name, icon: ed.icon, order, hidden: false });
    }
    bumpEdits();
    persist();
    closeEditor();
    openSettings();
  }
  /* Удаление прямо из списка: только для категорий без записей. */
  function deleteCategoryById(id) {
    const c = catById(id);
    if (!c || state.data.expenses.some(e => e.catId === id)) return;
    state.data.categories = state.data.categories.filter(x => x.id !== id);
    orderedCats().forEach((x, i) => { x.order = i; });
    if (state.cat === id) state.cat = null;
    bumpEdits();
    persist();
    openSettings();
  }

  function deleteCategory() {
    const ed = state.editor; if (!ed || !ed.id) return;
    if (state.data.expenses.some(e => e.catId === ed.id)) return;
    state.data.categories = state.data.categories.filter(c => c.id !== ed.id);
    orderedCats().forEach((c, i) => { c.order = i; });
    if (state.cat === ed.id) state.cat = null;
    bumpEdits();
    persist();
    closeEditor();
    openSettings();
  }

  function loadSample() {
    if (state.data.expenses.length) return;
    const byName = {}; state.data.categories.forEach(c => { byName[c.name] = c.id; });
    const fallback = state.data.categories[state.data.categories.length - 1].id;
    const now = new Date();
    SAMPLE.forEach(([off, items]) => items.forEach(([amount, cat, name, time]) => {
      const d = new Date(now); d.setDate(now.getDate() - off);
      const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0);
      state.data.expenses.push({ id: Store.uid(), ts: localISO(d), amount, catId: byName[cat] || fallback, name });
    }));
    persist();
    openSettings();
  }

  /* ---------- события ---------- */
  screens.addEventListener('click', e => {
    const el = currentScreen(); if (!el) return;
    const key = e.target.closest('[data-key]');
    if (key) { pressKey(key.dataset.key, el); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) { state.cat = state.cat === cat.dataset.cat ? null : cat.dataset.cat; state.pad = false; rerender(); return; }
    const act = e.target.closest('[data-act]'); if (!act) return;
    switch (act.dataset.act) {
      case 'settings': openSettings(); break;
      case 'focus': if (!state.pad) { state.pad = true; state.padAnim = true; const a = document.activeElement; if (a && a.blur) a.blur(); rerender(); } break;
      case 'done': state.pad = false; rerender(); break;
      case 'save': saveExpense(act); break;
      case 'save-smart': saveSmart(act); break;
      case 'smart-cat': openSmartCat(); break;
      case 'mic': micToggle(); break;
      case 'bk-save': backupSave(act); break;
      case 'row-cat': openRowCat(act.dataset.id); break;
      case 'bk-later': state.data.backupSnooze = dayKey(new Date()); persist(); rerender(); break;
    }
  });
  screens.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const row = e.target.closest('.row.hold');
      if (row) { e.preventDefault(); if (confirm('Удалить запись?')) removeExpense(row.dataset.id, row); }
    }
  });
  tabbar.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) goTab(b.dataset.tab); });
  overlay.addEventListener('click', e => {
    const act = e.target.closest('[data-act]'); if (!act) return;
    switch (act.dataset.act) {
      case 'close-settings': closeSettings(); break;
      case 'edit-cat': openEditor(act.dataset.id); break;
      case 'new-cat': openEditor(null); break;
      case 'sample': loadSample(); break;
      case 'bk-save': backupSave(act); break;
      case 'bk-restore': pickBackupFile(); break;
      case 'toggle-smart': state.data.smart = !state.data.smart; state.smartText = ''; sovaForget(); state.pad = false; persist(); openSettings(); break;
      case 'toggle-sova': state.data.sova = !state.data.sova; sovaForget(); persist(); openSettings(); break;
      case 'learned-list': openLearned(); break;
      case 'del-cat': {
        const used = +act.dataset.used;
        if (used) {
          const c = catById(act.dataset.id);
          restoreError(`В категории «${c ? c.name : ''}» ${used} ${plural(used, 'запись', 'записи', 'записей')}. Её можно скрыть при вводе, но не удалить, иначе записи останутся без категории.`, 'Удалить нельзя');
        }
        break;
      }
    }
  });
  sheetHost.addEventListener('click', e => {
    const ic = e.target.closest('[data-icon]');
    if (ic && state.editor) {
      state.editor.icon = ic.dataset.icon;
      sheetHost.querySelectorAll('.ichip').forEach(b => { const on = b === ic; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      M.once(ic, 'pop'); return;
    }
    const act = e.target.closest('[data-act]'); if (!act) return;
    switch (act.dataset.act) {
      case 'close-editor': closeEditor(); break;
      case 'save-cat': saveCategory(); break;
      case 'toggle-hidden': state.editor.hidden = !state.editor.hidden; act.setAttribute('aria-checked', String(state.editor.hidden)); act.querySelector('.switch').classList.toggle('on', state.editor.hidden); break;
      case 'close-confirm': closeConfirm(); break;
      case 'close-rowcat': closeRowCat(); break;
      case 'close-learned': closeLearned(); break;
      case 'close-smartcat': closeSmartCat(); break;
      case 'smartcat-pick': state.smartCat = (state.smartCat === act.dataset.id) ? null : act.dataset.id; closeSmartCat(); rerender(); break;
      case 'smartcat-auto': state.smartCat = null; closeSmartCat(); rerender(); break;
      case 'rowcat-pick': rowPick.catId = (rowPick.catId === act.dataset.id) ? null : act.dataset.id; drawRowCat(); break;
      case 'rowcat-remember': rowPick.remember = !rowPick.remember; drawRowCat(); break;
      case 'rowcat-save': saveRowCat(); break;
      case 'do-restore': { const obj = pendingRestore; closeConfirm(); if (obj) { backupRestore(obj); closeSettings(); } break; }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (sheetHost.querySelector('.sheet-wrap')) { if (state.editor) closeEditor(); else if (rowPick) closeRowCat(); else closeConfirm(); }
    else if (state.settings) closeSettings();
  });

  /* Свайп между вкладками. */
  M.swipe(screens, {
    getScreen: currentScreen,
    canGo: dir => { const i = TABS.indexOf(state.tab) + dir; return i >= 0 && i < TABS.length; },
    onSwipe: (dir, offset) => goTab(TABS[TABS.indexOf(state.tab) + dir], offset)
  });

  /* Смена даты (приложение открыто через полночь) — пересчитать. */
  let lastDay = dayKey(new Date());
  setInterval(() => { const k = dayKey(new Date()); if (k !== lastDay) { lastDay = k; if (!state.settings) rerender(); } }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { const k = dayKey(new Date()); if (k !== lastDay) { lastDay = k; if (!state.settings) rerender(); } } });

  /* ---------- заставка ----------
     Одна случайная установка, следом сова и название. Экран убирается
     по таймеру, тапом или при возврате в приложение. */
  function splash() {
    const el = document.getElementById('splash');
    if (!el) return;
    const text = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    document.getElementById('splash-line').innerHTML = `<span class="s-ln">«${esc(text)}»</span>`;
    el.hidden = false;
    el.classList.add('play');
    const total = M.reduced() ? 1400 : 3000;
    let gone = false;
    const hide = () => {
      if (gone) return;
      gone = true;
      el.classList.add('hide');
      setTimeout(() => el.remove(), 450);
    };
    const timer = setTimeout(hide, total);
    el.addEventListener('click', () => { clearTimeout(timer); hide(); }, { once: true });
    /* Если таймер проспал (телефон ушёл в сон), убираем при первом возврате. */
    setTimeout(() => { if (el.isConnected) el.remove(); }, total + 2500);
    document.addEventListener('visibilitychange', () => { if (el.isConnected) el.remove(); }, { once: true });
  }

  /* Старт. */
  splash();
  show(state.tab, 0);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
