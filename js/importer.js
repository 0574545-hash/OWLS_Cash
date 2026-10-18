/* ============================================================
   importer.js — выписки банков: файл или текст → список операций.
   Тип файла определяется по содержимому, не по имени и не по выбору:
   картинка, PDF, Excel (xlsx), CSV/текст. Excel и CSV читаются здесь
   без библиотек, PDF — через pdf.js из vendor/ (грузится только для PDF),
   картинку читает Сова на сервере и возвращает текст строками.
   На выходе — операции { d, t, amount, sign, name, kind, bankCat, skip, transfer, hint }.
   Что из этого расход, решает пользователь на экране проверки.
   ============================================================ */
(function () {
  'use strict';

  const pad2 = n => String(n).padStart(2, '0');
  const HERE = (document.currentScript && document.currentScript.src) || document.baseURI;
  const MONTHS = { янв: 1, фев: 2, мар: 3, апр: 4, май: 5, мая: 5, июн: 6, июл: 7, авг: 8, сен: 9, окт: 10, ноя: 11, дек: 12 };
  const MON_RE = '(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[а-яё]*\\.?';
  const SP = /[    ]/g;

  /* ---------- даты ---------- */
  /* Год не указан — берём текущий; если такая дата ещё не наступила, значит прошлогодняя. */
  function ymd(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const now = new Date();
    if (y == null) {
      y = now.getFullYear();
      if (new Date(y, m - 1, d) - now > 86400000) y--;
    } else if (y < 100) y += 2000;
    if (y < 2000 || y > now.getFullYear() + 1) return null;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  const dayShift = k => { const x = new Date(); x.setDate(x.getDate() + k); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };

  /* Дата и время из ячейки или строки. Excel хранит дату числом дней с 1899-12-30. */
  function parseDate(v) {
    if (typeof v === 'number') {
      if (v < 30000 || v > 80000) return null;
      const ms = Math.round((v - 25569) * 86400000);
      const x = new Date(ms);
      const t = (v % 1) ? `${pad2(x.getUTCHours())}:${pad2(x.getUTCMinutes())}` : '';
      return { d: `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`, t, len: 0, at: 0 };
    }
    const s = String(v || '');
    let m, d = null, at = -1, len = 0;
    if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) { d = ymd(+m[1], +m[2], +m[3]); at = m.index; len = m[0].length; }
    else if ((m = s.match(/(^|[^\d.])(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?![\d])/))) { d = ymd(+m[4], +m[3], +m[2]); at = m.index + m[1].length; len = m[0].length - m[1].length; }
    else if ((m = s.match(new RegExp('(^|[^\\d])(\\d{1,2})\\s+' + MON_RE + '(?:\\s+(\\d{4}))?', 'i')))) {
      d = ymd(m[4] ? +m[4] : null, MONTHS[m[3].toLowerCase().slice(0, 3)] || MONTHS[m[3].toLowerCase()], +m[2]); at = m.index + m[1].length; len = m[0].length - m[1].length;
    }
    else if ((m = s.match(/^\s*(сегодня|вчера|позавчера)/i))) { const w = m[1].toLowerCase(); d = dayShift(w === 'сегодня' ? 0 : w === 'вчера' ? -1 : -2); at = m.index; len = m[0].length; }
    if (!d) return null;
    const tm = s.match(/(^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?!\d)/);
    return { d, t: tm ? `${pad2(+tm[2])}:${tm[3]}` : '', at, len };
  }

  /* ---------- деньги ---------- */
  /* Число из ячейки таблицы: «-1 286,00», «1286.5», «−193 ₽». */
  function parseMoney(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v || '').replace(SP, ' ').replace(/[−–—]/g, '-').trim();
    const m = s.match(/^([+-]?)\s*(\d{1,3}(?:[ ']\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:₽|руб\.?|р\.?|rub|rur)?$/i);
    if (!m) return null;
    const n = parseFloat(m[2].replace(/[ ']/g, '') + (m[3] ? '.' + m[3] : ''));
    return m[1] === '-' ? -n : n;
  }

  /* Суммы внутри строки текста. «Сильная» сумма — с копейками, знаком ₽,
     разделителем тысяч или знаком «+»: так не путаем её с кодом операции. */
  const MONEY_RE = /(^|[\s(:])([+\-−–]?)\s?(\d{1,3}(?:[   ]\d{3})+|\d+)(?:([.,])(\d{2}))?(?:\s?(₽|руб\.?|р\.|rub\b|rur\b))?(?=$|[\s);,])/gi;
  function moneyIn(line) {
    const out = [];
    let m;
    MONEY_RE.lastIndex = 0;
    while ((m = MONEY_RE.exec(line))) {
      const digits = m[3].replace(/\s/g, '');
      const strong = !!(m[5] || m[6] || /\s/.test(m[3]) || m[2] === '+');
      if (!strong && digits.length > 6) continue;       // код операции, номер карты
      const n = parseFloat(digits + (m[5] ? '.' + m[5] : ''));
      const sign = m[2] === '+' ? 1 : (m[2] ? -1 : 0);
      out.push({ n, sign, strong, cur: !!m[6], dec: !!m[5], at: m.index + m[1].length, len: m[0].length - m[1].length });
    }
    return out;
  }

  /* ---------- что это за операция ---------- */
  const BALANCE_RE = /(сч[её]т|карта)\s*:|остат|баланс|доступно|лимит|итого|всего\s|за период|входящий остаток|исходящий остаток/i;
  const KIND_RE = /^(оплата товаров и услуг|оплата услуг|оплата по qr|оплата|покупка|клиенту [а-яё]+|перевод[а-яё]*( .*)?|входящий перевод.*|пополнение.*|списание.*|снятие наличных|выдача наличных|зачисление.*|возврат.*|кэшб[эе]к.*|плат[её]ж.*|отправлен.*|сбп.*|внутренний перевод.*)$/i;
  const OWN_RE = /брокерск|инвест|копилк|накопит|вклад|между (своими|сч[её]тами)|на свой сч|собственн|своих сч/i;
  const CASH_RE = /снятие наличных|выдача наличных|банкомат|atm\b/i;
  const CANCEL_RE = /отклон|отмен|failed|declined|неуспеш/i;
  const PERSON_RE = /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.?$/;
  const TRANSFER_RE = /клиенту|перевод|сбп|по номеру телефона|p2p|card2card/i;

  /* Подсказка для категории по известным продавцам: слово, которое приложение
     уже умеет относить к своим категориям. */
  const MERCHANTS = [
    [/yandex\s*\.?\s*go|яндекс\s*go|такси|taxi|uber|citymobil|ситимобил|maxim|максим/i, 'такси'],
    [/пят[её]рочк|pyaterochka|magnit|магнит|перекр[её]ст|perekrestok|вкусвилл|vkusvill|лента|lenta|ашан|auchan|дикси|dixy|окей|o.?key|spar|спар|магнолия|верный|самокат|samokat|лавка|lavka|globus|глобус|светофор|красное.?белое|бристоль/i, 'продукты'],
    [/kfc|rostic|ростикс|макдон|mcdonald|вкусно\s*и\s*точка|burger|бургер|starbucks|кофе|coffee|cafe|кафе|ресторан|restoran|шоколадниц|додо|dodo|delivery\s*club|яндекс\s*еда|yandex\s*eda|pizza|пицц|суши|sushi|шаурм|столов/i, 'кафе'],
    [/аптек|apteka|здравсити|ригла|горздрав|столички|asna|асна/i, 'аптека'],
    [/лукойл|lukoil|роснефть|rosneft|газпромнефт|gazpromneft|\bазс\b|\bazs\b|shell|татнефт|tatneft|neste/i, 'бензин'],
    [/метро|metro\b|мосгортранс|тройка|troika|mosmetro|ржд|rzd|аэроэкспресс|aeroexpress|транспорт|transport/i, 'метро'],
    [/\bмтс\b|\bmts\b|билайн|beeline|мегафон|megafon|tele2|теле2|ростелеком|rostelecom|жкх|жку|мосэнерго|интернет/i, 'связь'],
    [/кино|cinema|театр|кинопоиск|kinopoisk|okko|ivi\b|netflix|spotify|яндекс\s*плюс|yandex\s*plus/i, 'кино'],
  ];
  const BANKS = [[/сбер|sber|спасибо/i, 'Сбербанк'], [/т-банк|тинькофф|tinkoff|tbank/i, 'Т-Банк'], [/альфа|alfa-?bank/i, 'Альфа-Банк'],
    [/\bвтб\b|\bvtb\b/i, 'ВТБ'], [/газпромбанк/i, 'Газпромбанк'], [/озон банк|ozon bank/i, 'Озон Банк'], [/райффайзен|raiffeisen/i, 'Райффайзен']];
  const bankOf = text => { const b = BANKS.find(([re]) => re.test(text)); return b ? b[1] : ''; };

  function classify(op) {
    const text = [op.name, op.kind, op.bankCat, op.status].join(' ');
    if (op.status && CANCEL_RE.test(op.status)) op.skip = 'операция отменена';
    else if (op.sign > 0) op.skip = /возврат/i.test(text) ? 'возврат' : 'поступление';
    else if (OWN_RE.test(text)) op.skip = 'перевод на свой счёт';
    else if (CASH_RE.test(text)) op.skip = 'снятие наличных';
    op.transfer = !op.skip && (TRANSFER_RE.test(op.kind + ' ' + op.bankCat) || PERSON_RE.test(op.name));
    const m = MERCHANTS.find(([re]) => re.test(op.name + ' ' + op.bankCat));
    op.hint = m ? m[1] : '';
    return op;
  }

  /* Название без мусора: маски карт, «операция по карте», номера, кавычки. */
  function cleanName(s) {
    let n = String(s || '')
      .replace(/операция по (карте|сч[её]ту)[^.]*$/i, '')
      .replace(/\*{2,}\s?\d{4}|\b\d{4}\s?\*{2,}\d{0,4}|карта\s*\d+/gi, '')
      .replace(/\bRUS\b|\bRU\b|\bMOSCOW\b/g, '')
      .replace(/_P_QR\b|_QR\b/gi, '')
      .replace(/[«»"]/g, '')
      .replace(/\s+\./g, '.')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '')
      .replace(/([^\s.]{2})\.$/, '$1')   // точку в конце убираем, у инициала «Б.» — оставляем
      .trim();
    if (n === n.toUpperCase() && /[A-ZА-ЯЁ]{3}/.test(n)) n = n.toLowerCase().replace(/(^|[\s_-])([a-zа-яё])/g, (x, a, b) => a + b.toUpperCase());
    n = n.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return n.slice(0, 60);
  }

  function makeOp(o) {
    const amount = Math.round(Math.abs(o.n) * 100) / 100;
    return classify({
      d: o.d || '', t: o.t || '', amount: Math.round(amount), sign: o.sign,
      name: cleanName(o.name) || cleanName(o.kind) || 'Без названия',
      kind: String(o.kind || '').trim(), bankCat: String(o.bankCat || '').trim(), status: String(o.status || '').trim(),
      skip: '', transfer: false, hint: ''
    });
  }

  /* ---------- текст: PDF, вставка, ответ Совы ---------- */
  function blank(line, spans) {
    let s = line;
    spans.slice().sort((a, b) => b.at - a.at).forEach(x => { s = s.slice(0, x.at) + ' '.repeat(x.len) + s.slice(x.at + x.len); });
    return s;
  }
  const stripCodes = s => s.replace(/(^|\s)\d{4,}(?=\s|$)/g, ' ').replace(/(^|\s)([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

  function opsFromText(text) {
    const lines = String(text || '').replace(SP, ' ').replace(/[−–]/g, '-').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const bank = bankOf(text);
    if (lines.filter(l => (l.match(/\|/g) || []).length >= 2).length >= Math.max(1, lines.length / 2)) return { bank, ops: opsFromPipes(lines) };
    const dated = lines.filter(l => { const dt = parseDate(l); return dt && dt.len > 5 && moneyIn(blank(l, [dt])).some(x => x.strong); }).length;
    return { bank, ops: dated >= 2 ? opsDated(lines) : opsBlocks(lines) };
  }

  /* Строки Совы со скриншота: «дата | название | тип | сумма». */
  function opsFromPipes(lines) {
    const ops = [];
    for (const l of lines) {
      const p = l.split('|').map(s => s.trim());
      if (p.length < 3) continue;
      const money = moneyIn(p[p.length - 1]);
      if (!money.length) continue;
      const dt = parseDate(p[0]);
      /* Тип операции главнее знака: «Клиенту…», «Оплата…» — всегда списание,
         даже если модель приписала плюс из-за значка рядом со строкой. */
      const kind = p.length > 3 ? p[2] : '';
      const out = /^(клиенту|оплата|покупка|пополнение брокерск|перевод (клиенту|на карту|по номеру|в другой банк)|сбп.*отправ)/i.test(kind);
      const sign = !out && (money[0].sign > 0 || /^\+/.test(p[p.length - 1])) ? 1 : -1;
      ops.push(makeOp({ d: dt ? dt.d : dayShift(0), t: dt ? dt.t : '', n: money[0].n, sign, name: p[1], kind }));
    }
    return ops;
  }

  /* Выписка с датой в каждой строке (PDF банка): строка с датой и суммой
     начинает операцию, следующие строки без суммы — её описание. */
  function opsDated(lines) {
    const recs = [];
    let cur = null;
    for (const l of lines) {
      const dt = parseDate(l);
      const rest = dt && dt.len > 5 ? blank(l, [dt]) : l;
      const money = moneyIn(rest).filter(x => x.strong);
      if (dt && dt.len > 5 && money.length && !BALANCE_RE.test(l)) {
        cur = { d: dt.d, t: dt.t, n: money[0].n, sign: money[0].sign > 0 ? 1 : -1, head: stripCodes(blank(rest, money)), more: [] };
        recs.push(cur);
      } else if (cur && !money.length && cur.more.length < 3 && !BALANCE_RE.test(l)) {
        cur.more.push(stripCodes(dt ? blank(l, [dt]) : l));
      } else if (money.length) cur = null;
    }
    return recs.map(r => {
      const desc = r.more.filter(Boolean).join(' ');
      return makeOp({ d: r.d, t: r.t, n: r.n, sign: r.sign, name: desc || r.head, bankCat: desc ? r.head : '' });
    });
  }

  /* Список из приложения банка (скопированный со скриншота): заголовки дней,
     название, тип операции, сумма — в любом порядке строк. */
  const DAY_HEAD_RE = new RegExp('^(сегодня|вчера|позавчера|\\d{1,2}\\s+' + MON_RE + '(\\s+\\d{4})?)(,?\\s+[а-яё]+)?(\\s|$)', 'i');
  function opsBlocks(lines) {
    const ops = [];
    let day = dayShift(0), name = '', kind = '', last = null;
    for (const l of lines) {
      if (DAY_HEAD_RE.test(l)) { const dt = parseDate(l); if (dt) day = dt.d; name = ''; kind = ''; continue; }
      if (BALANCE_RE.test(l)) continue;
      const money = moneyIn(l);
      /* В списке приложения банка сумма всегда с ₽ или копейками; число среди
         слов («шанс на 185 000 бонусов») — это реклама, не операция. */
      const bare = /^[+\-]?\s?[\d\s.,]+$/.test(l);
      const pick = money.find(x => x.cur || x.dec || (bare && x.strong)) || (money.length === 1 && !/[а-яёa-z]{3}/i.test(blank(l, money).slice(money[0].at + money[0].len)) && /[а-яёa-z]/i.test(l) ? money[0] : null);
      if (pick) {
        const own = cleanName(blank(l, [pick]));
        const inline = /[а-яёa-z]{2}/i.test(own) && !KIND_RE.test(own) ? own : '';
        last = makeOp({ d: day, n: pick.n, sign: pick.sign > 0 ? 1 : -1, name: inline || name, kind: kind || (KIND_RE.test(own) ? own : '') });
        ops.push(last);
        name = ''; kind = '';
        continue;
      }
      if (KIND_RE.test(l) && l.length < 48) {
        if (name) kind = l;
        else if (last && !last.kind) { last.kind = l; classify(last); }
        continue;
      }
      name = l;
    }
    return ops.filter(o => o.amount > 0);
  }

  /* ---------- таблицы: Excel, CSV ---------- */
  const H = {
    date: /дата\s*(и время\s*)?(операции|совершения|транзакции)?$|^дата|date/i,
    dateBad: /обработк|списани|зачислени|платежа|проводк/i,
    amount: /сумма|amount|sum$/i,
    amountPref: /в валюте сч|операции|платежа|руб/i,
    debit: /расход|списан|дебет|debit|withdraw/i,
    credit: /приход|поступлен|зачислен|кредит|credit|deposit/i,
    desc: /описание|назначение|наименование|контрагент|получатель|место|детали|комментар|merchant|description|payee|магазин|торгов/i,
    cat: /категори|category/i,
    type: /^тип|вид операц|^операция$|type/i,
    status: /статус|status/i
  };

  function opsFromRows(rows) {
    const S = v => (v == null ? '' : typeof v === 'number' ? String(v) : String(v).replace(SP, ' ').trim());
    let hi = -1, best = 0;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const r = rows[i] || [];
      const score = ['date', 'amount', 'desc', 'cat', 'debit', 'credit'].filter(k => r.some(c => typeof c === 'string' && c.length < 60 && H[k].test(c))).length;
      if (score > best) { best = score; hi = i; }
    }
    const col = {};
    if (hi >= 0 && best >= 2) {
      const h = rows[hi].map(S);
      const find = (re, bad) => h.findIndex(c => re.test(c) && !(bad && bad.test(c)));
      col.date = find(H.date, H.dateBad); if (col.date < 0) col.date = find(H.date);
      const amts = h.map((c, i) => (H.amount.test(c) && !H.debit.test(c) && !H.credit.test(c) && !/кэшб|бонус|комисс|остат/i.test(c) ? i : -1)).filter(i => i >= 0);
      col.amount = amts.find(i => H.amountPref.test(h[i])) ?? amts[0] ?? -1;
      col.debit = find(H.debit); col.credit = find(H.credit);
      col.desc = find(H.desc); col.cat = find(H.cat); col.type = find(H.type); col.status = find(H.status);
    } else {
      /* Без шапки: колонки угадываем по содержимому первых строк. */
      const sample = rows.slice(0, 60);
      const width = Math.max(0, ...sample.map(r => (r || []).length));
      const rate = (i, f) => sample.filter(r => r && r[i] != null && r[i] !== '' && f(r[i])).length;
      let bd = -1, ba = -1, bt = -1, sd = 0, sa = 0, st = 0;
      for (let i = 0; i < width; i++) {
        const d = rate(i, v => !!parseDate(v)), a = rate(i, v => parseMoney(v) != null && !parseDate(v));
        const t = rate(i, v => typeof v === 'string' && /[а-яёa-z]{3}/i.test(v) && !parseDate(v));
        if (d > sd) { sd = d; bd = i; }
        if (a > sa) { sa = a; ba = i; }
        if (t > st) { st = t; bt = i; }
      }
      Object.assign(col, { date: bd, amount: ba, desc: bt, debit: -1, credit: -1, cat: -1, type: -1, status: -1 });
      hi = -1;
    }
    if (col.date < 0 || (col.amount < 0 && col.debit < 0)) return [];

    const raw = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const dt = parseDate(r[col.date]);
      if (!dt) continue;
      let n = null, sign = 0;
      if (col.debit >= 0 || col.credit >= 0) {
        const dv = col.debit >= 0 ? parseMoney(r[col.debit]) : null, cv = col.credit >= 0 ? parseMoney(r[col.credit]) : null;
        if (dv) { n = dv; sign = -1; } else if (cv) { n = cv; sign = 1; }
      }
      if (n == null && col.amount >= 0) { n = parseMoney(r[col.amount]); if (n != null) sign = n < 0 ? -1 : (String(r[col.amount]).trim().startsWith('+') ? 1 : 0); }
      if (!n) continue;
      raw.push({ d: dt.d, t: dt.t, n, sign, name: S(r[col.desc]), bankCat: col.cat >= 0 ? S(r[col.cat]) : '',
        type: col.type >= 0 ? S(r[col.type]) : '', status: col.status >= 0 ? S(r[col.status]) : '' });
    }
    /* Знак не указан: если в выписке есть и минусы, и плюсы — плюс значит
       поступление; если минусов нет вовсе — это списания, кроме явных поступлений. */
    const hasNeg = raw.some(x => x.sign < 0);
    raw.forEach(x => {
      if (x.sign) return;
      if (/пополн|зачисл|поступ|доход|приход|возврат|кэшб/i.test(x.type)) x.sign = 1;
      else if (/списан|расход|покупк|оплат/i.test(x.type)) x.sign = -1;
      else if (hasNeg) x.sign = 1;
      else x.sign = /зачисл|поступлен|входящ|зарплат|возврат|кэшб/i.test(x.name) ? 1 : -1;
    });
    return raw.map(x => makeOp({ ...x, kind: x.type }));
  }

  function parseCsv(text) {
    const head = text.split(/\r?\n/).slice(0, 10).join('\n');
    const count = ch => (head.match(new RegExp(ch === '\t' ? '\\t' : '\\' + ch, 'g')) || []).length;
    const sep = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ---------- zip и xlsx ---------- */
  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Этот телефон не умеет открывать Excel — обновите iOS');
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(data); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function zipRead(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Файл Excel повреждён');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const loff = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      const start = loff + 30 + dv.getUint16(loff + 26, true) + dv.getUint16(loff + 28, true);
      const data = u8.slice(start, start + csize);
      if (/^xl\/(workbook|sharedStrings|worksheets\/|_rels\/)/.test(name)) {
        if (method === 0) out[name] = data;
        else if (method === 8) out[name] = await inflateRaw(data);
      }
      p += 46 + nlen + elen + clen;
    }
    return out;
  }
  const colIndex = ref => { let n = 0; for (const ch of ref) { if (ch < 'A' || ch > 'Z') break; n = n * 26 + ch.charCodeAt(0) - 64; } return n - 1; };
  async function xlsxSheets(buf) {
    const z = await zipRead(buf);
    const dec = new TextDecoder();
    const xml = n => {
      const d = z[n]; if (!d) return null;
      const doc = new DOMParser().parseFromString(dec.decode(d), 'application/xml');
      return doc.getElementsByTagName('parsererror').length ? null : doc;
    };
    const all = (el, tag) => Array.from(el.getElementsByTagNameNS('*', tag));
    const wb = xml('xl/workbook.xml');
    if (!wb) throw new Error('В файле нет книги Excel');
    const relMap = {};
    const rels = xml('xl/_rels/workbook.xml.rels');
    if (rels) for (const r of all(rels, 'Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target');
    const sst = [];
    const ss = xml('xl/sharedStrings.xml');
    if (ss) for (const si of all(ss, 'si')) sst.push(all(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''));
    const out = [];
    for (const sh of all(wb, 'sheet')) {
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = relMap[rid] || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const doc = xml(target);
      if (!doc) continue;
      const rows = [];
      for (const row of all(doc, 'row')) {
        const r = [];
        let ci = 0;
        for (const c of all(row, 'c')) {
          const ref = c.getAttribute('r');
          if (ref) ci = colIndex(ref);
          const t = c.getAttribute('t'), v = all(c, 'v')[0];
          let val = '';
          if (t === 's') val = sst[Number(v && v.textContent)] ?? '';
          else if (t === 'inlineStr') val = all(c, 't').map(x => x.textContent).join('');
          else if (t === 'str' || t === 'e' || t === 'b') val = v ? v.textContent : '';
          else if (v) { const n = Number(v.textContent); val = Number.isFinite(n) ? n : v.textContent; }
          r[ci] = val;
          ci++;
        }
        rows.push(r);
      }
      out.push(rows);
    }
    return out;
  }

  /* ---------- PDF ---------- */
  /* pdf.js лежит рядом с приложением и грузится только ради PDF.
     Текст собираем в строки по высоте на странице, слова — слева направо. */
  async function pdfText(buf) {
    const base = new URL('../vendor/pdfjs/', HERE).href;
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const lines = [];
    for (let p = 1; p <= Math.min(doc.numPages, 60); p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      /* Ячейка таблицы бывает в две строки (дата и время, под ними код) и
         выровнена по середине — поэтому строку собираем «цепочкой»: элемент
         ниже предыдущего меньше чем на высоту шрифта — та же строка. */
      const items = tc.items.filter(it => it.str && it.str.trim())
        .map(it => ({ x: it.transform[4], y: it.transform[5], h: Math.max(Math.abs(it.transform[3]) || 0, 8), s: it.str, w: it.width || 0 }))
        .sort((a, b) => b.y - a.y);
      const rows = [];
      let row = null;
      for (const it of items) {
        if (row && row.low - it.y < it.h * 0.75) { row.items.push(it); row.low = Math.min(row.low, it.y); }
        else { row = { y: it.y, low: it.y, items: [it] }; rows.push(row); }
      }
      for (const r of rows) {
        r.items.sort((a, b) => (Math.abs(a.x - b.x) < 2 ? b.y - a.y : a.x - b.x));
        let s = '', end = null;
        for (const it of r.items) { s += (end != null && (it.x - end > 1.5 || it.x < end - 0.5) ? '  ' : '') + it.s; end = it.x + it.w; }
        lines.push(s.trim());
      }
    }
    return lines.join('\n');
  }

  /* ---------- тип файла по содержимому ---------- */
  function sniff(u8, file) {
    const b = i => u8[i];
    if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return 'pdf';
    if (b(0) === 0x50 && b(1) === 0x4b) return 'xlsx';
    if (b(0) === 0xd0 && b(1) === 0xcf && b(2) === 0x11 && b(3) === 0xe0) return 'xls';
    if ((b(0) === 0xff && b(1) === 0xd8) || (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) ||
        (b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70) || (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) ||
        (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46) || /^image\//.test(file.type || '')) return 'image';
    return 'text';
  }

  /* Текст файла: UTF-8, а если в нём битые символы — Windows-1251 (так выгружают банки). */
  function decodeText(u8) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); }
    catch { return new TextDecoder('windows-1251').decode(u8); }
  }

  /* Главный вход: файл → { kind, bank, ops } или { kind: 'image', blob }. */
  async function readFile(file) {
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const kind = sniff(u8, file);
    if (kind === 'image') return { kind, ops: [], bank: '' };
    if (kind === 'xls') throw new Error('Это старый формат Excel (.xls). Откройте файл и сохраните как .xlsx или .csv — или загрузите выписку в PDF.');
    if (kind === 'pdf') {
      let text;
      try { text = await pdfText(buf); } catch (e) { throw new Error('Не получилось открыть PDF. Если он защищён паролем, снимите защиту.'); }
      if (!text.trim()) throw new Error('В этом PDF нет текста — похоже, это скан. Сделайте скриншот страницы и загрузите картинку.');
      const r = opsFromText(text);
      return { kind, bank: r.bank, ops: r.ops };
    }
    if (kind === 'xlsx') {
      const sheets = await xlsxSheets(buf);
      let best = [];
      for (const rows of sheets) { const ops = opsFromRows(rows); if (ops.length > best.length) best = ops; }
      const flat = sheets.map(rows => rows.slice(0, 15).map(r => (r || []).join(' ')).join(' ')).join(' ');
      return { kind, bank: bankOf(flat), ops: best };
    }
    const text = decodeText(u8);
    const rows = parseCsv(text);
    const table = rows.filter(r => r.length >= 3).length >= 2 ? opsFromRows(rows) : [];
    const plain = table.length ? null : opsFromText(text);
    return { kind: table.length ? 'csv' : 'text', bank: bankOf(text.slice(0, 3000)), ops: table.length ? table : plain.ops };
  }

  /* Вставленный текст похож на выписку: несколько строк и хотя бы две суммы. */
  function looksLikeStatement(text) {
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 3) return null;
    const r = opsFromText(text);
    return r.ops.length >= 2 ? r : null;
  }

  window.OwlsImport = { readFile, opsFromText, looksLikeStatement, parseDate, parseMoney };
})();
