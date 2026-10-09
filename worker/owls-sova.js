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
 *                            ALLOW_ORIGINS = https://0574545-hash.github.io
 *      Адрес сервера задаётся только здесь и в репозиторий не попадает.
 *   3. Deploy. Адрес вида https://owls-sova.<ваш>.workers.dev скопировать
 *      в настройки приложения, поле «Адрес разбора».
 *
 * Метод у воркера без пароля, поэтому вход ограничен: только POST /parse,
 * только с разрешённых адресов страницы, строка до 200 знаков, 40 категорий.
 * В панели Cloudflare стоит добавить правило ограничения частоты на /parse.
 */

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
    if (new URL(request.url).pathname !== '/parse') return json({ error: 'not_found' }, 404, cors);
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

async function askSova(baseUrl, text, categories) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOVA_TIMEOUT_MS);
  try {
    const response = await fetch((baseUrl || '').replace(/\/+$/, '') + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
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
      }),
    });
    if (!response.ok) throw new Error('http_' + response.status);
    const data = await response.json();
    return data?.message?.content ?? '';
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'timeout' : 'unavailable');
  } finally {
    clearTimeout(timer);
  }
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
