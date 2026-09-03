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
    amount: '', cat: null, comment: '', pad: false, padAnim: false,
    settings: false, editor: null,
    data: null
  };

  function defaults() {
    return {
      categories: DEFAULT_CATS.map(([name, icon], i) => ({ id: 'c' + (i + 1), name, icon, order: i, hidden: false })),
      expenses: []
    };
  }
  state.data = Store.load() || defaults();
  const persist = () => Store.save(state.data);

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
      <div class="card form cascade-item">
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
        <button type="button" class="commit${can ? ' on' : ''}" data-act="save" aria-disabled="${!can}">${svg('plus', 19, 2.2)}Внести расход</button>
      </div>
    </section>`;
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
        <div class="card flush">${g.items.map(e => `<div class="row hold" data-id="${e.id}" role="button" tabindex="0" aria-label="${esc(e.name)}, ${fmt(e.amount)} рублей. Удерживайте, чтобы удалить">
            <span class="row-ic">${svg(catIcon(e.catId), 17, 1.6)}</span>
            <span class="row-c"><span class="row-n">${esc(e.name)}</span><span class="row-m"><span class="row-cat">${esc(catName(e.catId))}</span><i class="dot"></i><span class="row-t">${e.ts.slice(11, 16)}</span></span></span>
            <span class="row-a">${fmt(e.amount)} ₽</span><i class="hold-bar"></i>
          </div>`).join('')}</div>
      </div>`).join('')
      : `<div class="card empty cascade-item"><span class="e-ic">${svg('inbox', 20, 1.6)}</span><span class="e-t">Пока пусто</span><span class="e-s">Внесите первый расход на вкладке «Сегодня» — здесь появится история по дням.</span></div>`;
    return `<section class="screen" data-screen="history">
      <header class="page-h cascade-item"><h1 class="h1">История</h1><span class="page-sub">${fmt(d.monthTotal)} ₽ за ${esc(monthStr)}</span></header>
      ${body}
      ${d.groups.length ? '<p class="hint center small">Чтобы удалить запись, удерживайте строку.</p>' : ''}
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
      const inp = el.querySelector('#exp-name');
      if (inp) {
        inp.addEventListener('input', () => { state.comment = inp.value; });
        inp.addEventListener('focus', () => { if (state.pad) { state.pad = false; rerender(); } });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.blur(); } });
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
      persist();
      state.amount = ''; state.cat = null; state.comment = ''; state.pad = false;
      rerender();
      M.once(document.getElementById('card-today'), 'nudge');
    };
    if (!btn || M.reduced()) { commit(); return; }
    saving = true;
    btn.classList.add('saving');
    btn.innerHTML = `${svg('check', 20, 2.4)}Внесено`;
    setTimeout(commit, SAVE_DELAY);
  }

  function removeExpense(id, rowEl) {
    const i = state.data.expenses.findIndex(e => e.id === id);
    if (i < 0) return;
    state.data.expenses.splice(i, 1);
    persist();
    if (rowEl && !M.reduced()) {
      rowEl.classList.add('removing');
      setTimeout(rerender, 200);
    } else rerender();
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
      <div class="card flush" id="catlist">${cats.map(c => `<div class="crow${c.hidden ? ' is-hidden' : ''}" data-id="${c.id}">
          <span class="grip" data-grip aria-label="Перетащить">${svg('grip-vertical', 16, 1.8)}</span>
          <span class="c-ic">${svg(c.icon, 18, 1.6)}</span>
          <button type="button" class="c-main" data-act="edit-cat" data-id="${c.id}"><span class="c-n">${esc(c.name)}</span>${c.hidden ? '<span class="c-hid">скрыта</span>' : ''}</button>
          <span class="c-sum">${fmt(d.totals[c.id] || 0)} ₽</span>
          <span class="c-chev">${svg('chevron-right', 16, 1.8)}</span>
        </div>`).join('')}</div>
      <button type="button" class="add-cat pressable" data-act="new-cat">${svg('plus', 17, 1.9)}Добавить категорию</button>
      ${state.data.expenses.length ? '' : `<button type="button" class="btn-ghost sample" data-act="sample">${svg('sparkles', 15, 1.7)}Заполнить примерами</button>`}
      <p class="set-foot">Данные хранятся только на этом устройстве.</p>
    </div>`;
  }

  function openSettings() {
    state.settings = true;
    overlay.innerHTML = renderSettings();
    const list = overlay.querySelector('#catlist');
    M.sortable(list, { handle: '[data-grip]', row: '.crow', onChange: ids => {
      ids.forEach((id, i) => { const c = catById(id); if (c) c.order = i; });
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
    persist();
    closeEditor();
    openSettings();
  }
  function deleteCategory() {
    const ed = state.editor; if (!ed || !ed.id) return;
    if (state.data.expenses.some(e => e.catId === ed.id)) return;
    state.data.categories = state.data.categories.filter(c => c.id !== ed.id);
    orderedCats().forEach((c, i) => { c.order = i; });
    if (state.cat === ed.id) state.cat = null;
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
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (state.editor) closeEditor(); else if (state.settings) closeSettings();
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

  /* Старт. */
  show(state.tab, 0);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
