/**
 * Посредник между OWLS Cash и «Совой» — Cloudflare Worker.
 *
 * Зачем он нужен: приложение открывается по HTTPS с GitHub Pages, а сервер ИИ
 * работает по обычному HTTP. Браузер блокирует такие запросы, и адрес сервера
 * нельзя класть в публичный репозиторий. Воркер решает оба вопроса: он на HTTPS,
 * а адрес ИИ живёт в его переменных.
 *
 * Выкладка:
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker, вставить этот файл.
 *   2. Settings → Variables: SOVA_URL — адрес сервера ИИ с портом
 *                            PATH_TOKEN — случайная строка, она же путь метода
 *                            ALLOW_ORIGINS = https://0574545-hash.github.io
 *      Адрес сервера задаётся только здесь и в репозиторий не попадает.
 *   3. Deploy. В настройки приложения, поле «Адрес разбора», вставить
 *      https://owls-sova.<ваш>.workers.dev/<PATH_TOKEN> — целиком, с путём.
 *
 * Метод у воркера без пароля, поэтому вход ограничен: только POST /parse,
 * только с разрешённых адресов страницы, строка до 200 знаков, 40 категорий.
 * В панели Cloudflare стоит добавить правило ограничения частоты на /parse.
 */

import { connect } from 'cloudflare:sockets';

const SYSTEM = `Ты разбираешь короткую запись о расходе на три поля.

Отвечай ТОЛЬКО одной строкой JSON, без пояснений и без markdown:
{"amount": <целое>, "category": "<из списка или пусто>", "name": "<наименование>"}

Правила:
- amount — рубли целым числом. «штука», «косарь», «тыща» = 1000; «полторы тысячи» = 1500; «пятихатка» = 500. Суммы нет — 0.
- category — строго из списка, слово в слово. Сомневаешься — пустая строка, не угадывай.
- name — что купили: 1–4 слова. С большой буквы только первое слово и имена собственные. Без суммы, без слов «потратил», «закинул», «купил».
- Ничего не добавляй от себя: чего нет в записи, того нет в ответе.`;

const MAX_TEXT = 200;
const MAX_CATS = 40;
const SOVA_TIMEOUT_MS = 12000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    /* Путь и есть ключ: без пароля метод был бы открыт любому, кто узнает адрес. */
    if (new URL(request.url).pathname !== '/' + (env.PATH_TOKEN || 'parse')) {
      return json({ error: 'not_found' }, 404, cors);
    }
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'forbidden' }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400, cors);
    }

    const text = String(body?.text ?? '').trim().slice(0, MAX_TEXT);
    if (!text) return json({ error: 'empty_text' }, 400, cors);

    const categories = Array.isArray(body?.categories)
      ? body.categories.map(c => String(c).slice(0, 60)).filter(Boolean).slice(0, MAX_CATS)
      : [];

    let reply;
    try {
      reply = await askSova(env.SOVA_URL, text, categories);
    } catch (e) {
      // Сервер ИИ выключен или не успел ответить: приложение молча вернётся
      // к разбору на устройстве, поэтому код ошибки важнее текста.
      return json({ error: e.message === 'timeout' ? 'timeout' : 'sova_unavailable' }, 503, cors);
    }

    const parsed = extractJson(reply);
    if (!parsed) return json({ error: 'bad_reply' }, 502, cors);

    // Категорию принимаем, только если она слово в слово из присланного списка:
    // выдуманное название приложению не пригодится.
    const category = categories.includes(parsed.category) ? parsed.category : '';
    return json({
      amount: Number.isFinite(+parsed.amount) ? Math.max(0, Math.round(+parsed.amount)) : 0,
      category,
      name: String(parsed.name ?? '').trim().slice(0, 60),
    }, 200, cors);
  },
};

/* Обращаемся к Сове не через fetch, а по сокету: обычный fetch из воркера
   на голый IP Cloudflare отбивает своей же ошибкой 1003, до сервера запрос
   не доходит. Сокет такого ограничения не имеет, и адрес остаётся в секрете —
   заводить ради этого публичное доменное имя для Совы не нужно. */
async function askSova(baseUrl, text, categories) {
  const { hostname, port } = parseEndpoint(baseUrl);
  const payload = JSON.stringify({
    model: 'sova',
    stream: false,
    think: false, // обязательно: иначе модель тратит лимит на рассуждения и молчит
    options: {
      temperature: 0,
      top_p: 0.9,
      num_predict: 120,
      repeat_penalty: 1.0, // для русского: без этого Сова коверкает слова
    },
    // format со схемой не используем: на русском он ломает текст
    messages: [
      { role: 'system', content: SYSTEM + '\n\nСписок категорий: ' + categories.join(', ') },
      { role: 'user', content: text },
    ],
  });
  const body = new TextEncoder().encode(payload);
  /* Origin не шлём: Ollama отвечает 403 на любой источник не из своего списка. */
  const head =
    'POST /api/chat HTTP/1.1\r\n' +
    `Host: ${hostname}:${port}\r\n` +
    'Content-Type: application/json\r\n' +
    `Content-Length: ${body.length}\r\n` +
    'Connection: close\r\n\r\n';

  const socket = connect({ hostname, port });
  const timer = setTimeout(() => socket.close().catch(() => {}), SOVA_TIMEOUT_MS);
  try {
    const writer = socket.writable.getWriter();
    await writer.write(new TextEncoder().encode(head));
    await writer.write(body);
    writer.releaseLock();

    const raw = await readAll(socket.readable);
    const { status, body: text2 } = parseHttp(raw);
    if (status !== 200) throw new Error('http_' + status);
    const data = JSON.parse(text2);
    return data?.message?.content ?? '';
  } catch (e) {
    throw new Error(/^http_/.test(e.message) ? e.message : 'unavailable');
  } finally {
    clearTimeout(timer);
    try { await socket.close(); } catch {}
  }
}

/** Разбирает `http://адрес:порт` на части; порт по умолчанию 80. */
function parseEndpoint(url) {
  const m = String(url || '').match(/^https?:\/\/([^/:]+)(?::(\d+))?/i);
  if (!m) throw new Error('unavailable');
  return { hostname: m[1], port: Number(m[2] || 80) };
}

async function readAll(readable) {
  const reader = readable.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
    if (total > 1_000_000) break; // ответ на три поля столько не весит
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Разбирает сырой ответ HTTP/1.1, включая передачу кусками. */
function parseHttp(bytes) {
  const text = new TextDecoder().decode(bytes);
  const split = text.indexOf('\r\n\r\n');
  if (split < 0) throw new Error('unavailable');
  const head = text.slice(0, split);
  let body = text.slice(split + 4);
  const status = Number((head.match(/^HTTP\/1\.[01] (\d{3})/) || [])[1] || 0);
  if (/transfer-encoding:\s*chunked/i.test(head)) body = unchunk(body);
  return { status, body };
}

function unchunk(body) {
  let out = '', at = 0;
  for (;;) {
    const nl = body.indexOf('\r\n', at);
    if (nl < 0) break;
    const size = parseInt(body.slice(at, nl).trim(), 16);
    if (!Number.isFinite(size) || size === 0) break;
    out += body.slice(nl + 2, nl + 2 + size);
    at = nl + 2 + size + 2;
  }
  return out;
}

/** Модель иногда оборачивает ответ в ```json — достаём первый объект. */
function extractJson(reply) {
  const match = String(reply).match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function corsHeaders(origin, allowed) {
  const ok = !allowed.length || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok && origin ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
