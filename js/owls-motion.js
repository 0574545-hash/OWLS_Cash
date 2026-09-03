/* ============================================================
   owls-motion.js — пять приёмов движения OWLS.
   1. Переход между экранами (со стороны нажатой вкладки, .26s)
   2. Свайп: экран едет за пальцем, переход при сдвиге > 1/4 ширины
      или быстром флике от 44px
   3. Каскад: строки выходят по одной, шаг 30ms, не дольше 14 шагов
   4. Отклик на нажатие (CSS .pressable) + удержание с видимой полосой
   5. Прогресс: кольцо .55s, процент докручивается .5s, карточка пружинит
   Всё отключается системной настройкой «Уменьшить движение».
   ============================================================ */
(function () {
  'use strict';
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => mq.matches;
  const SCREEN_MS = 260;

  /* Одноразовая анимация классом (nudge, pop, appear). */
  function once(el, cls) {
    if (!el || reduced()) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
  }

  /* Каскад: только на смену экрана и на старте. */
  function cascade(root, selector) {
    if (!root || reduced()) return;
    const els = [...root.querySelectorAll(selector)];
    els.forEach((e, i) => {
      e.style.animationDelay = Math.min(i, 14) * 30 + 'ms';
      e.classList.add('rise');
      e.addEventListener('animationend', () => { e.classList.remove('rise'); e.style.animationDelay = ''; }, { once: true });
    });
  }

  /* Докрутка числа. format(n) → строка. */
  function count(el, from, to, format, dur) {
    if (!el) return;
    dur = reduced() ? 0 : (dur == null ? 500 : dur);
    const t0 = performance.now();
    const ease = k => 1 - Math.pow(1 - k, 3);
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      el.textContent = format(Math.round(from + (to - from) * ease(k)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* Кольцо: circle.v с data-target (dashoffset) заполняется .55s. */
  function fillRings(root) {
    const rings = [...root.querySelectorAll('circle.v[data-target]')];
    if (!rings.length) return;
    const run = () => rings.forEach(c => { c.style.strokeDashoffset = c.dataset.target; });
    if (reduced()) { run(); return; }
    requestAnimationFrame(() => requestAnimationFrame(run));
  }

  /* Переход экрана. dir: 1 — новый справа, -1 — слева, 0 — без анимации.
     fromOffset — текущее смещение старого экрана после свайпа. */
  function transition(container, oldEl, newEl, dir, fromOffset) {
    const instant = reduced() || !oldEl || !dir;
    if (oldEl) {
      oldEl.classList.remove('dragging', 'moving', 'enter-r', 'enter-l');
      oldEl.style.transition = '';
    }
    if (instant) {
      if (oldEl) oldEl.remove();
      container.appendChild(newEl);
      return;
    }
    const w = container.clientWidth || 400;
    // Старый экран остаётся на месте абсолютно и уезжает.
    oldEl.classList.add('leave');
    if (fromOffset) oldEl.style.transform = `translateX(${fromOffset}px)`;
    // Новый приходит со стороны нажатой вкладки.
    newEl.classList.add(dir > 0 ? 'enter-r' : 'enter-l');
    if (fromOffset) newEl.style.transform = `translateX(${fromOffset + (dir > 0 ? w : -w)}px)`;
    container.appendChild(newEl);
    void newEl.offsetWidth;
    oldEl.classList.add('moving', dir > 0 ? 'leave-l' : 'leave-r');
    oldEl.style.transform = '';
    newEl.classList.add('moving');
    newEl.classList.remove('enter-r', 'enter-l');
    newEl.style.transform = '';
    setTimeout(() => { oldEl.remove(); newEl.classList.remove('moving'); }, SCREEN_MS + 20);
  }

  /* Свайп между вкладками. getScreen() → текущий .screen; onSwipe(dir, offset). */
  function swipe(container, opts) {
    let id = null, x0 = 0, y0 = 0, t0 = 0, dx = 0, locked = false, el = null;
    const reset = () => { if (el) { el.classList.remove('dragging'); el.style.transform = ''; } id = null; locked = false; el = null; dx = 0; };
    container.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || id !== null || !e.isPrimary) return;
      if (e.target.closest('input,textarea,[data-grip],.hold')) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); dx = 0; locked = false;
      el = opts.getScreen();
    });
    container.addEventListener('pointermove', e => {
      if (e.pointerId !== id || !el) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!locked) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        if (Math.abs(mx) <= Math.abs(my) * 1.2) { reset(); return; }
        locked = true; el.classList.add('dragging');
        try { container.setPointerCapture(id); } catch (_) {}
      }
      dx = mx;
      const dir = dx < 0 ? 1 : -1;
      const resist = opts.canGo(dir) ? 1 : 0.28;
      el.style.transform = `translateX(${dx * resist}px)`;
      e.preventDefault();
    });
    const end = e => {
      if (e.pointerId !== id) return;
      if (!locked || !el) { reset(); return; }
      const w = container.clientWidth || 400;
      const dt = Math.max(1, performance.now() - t0);
      const v = Math.abs(dx) / dt; // px per ms
      const dir = dx < 0 ? 1 : -1;
      const go = opts.canGo(dir) && (Math.abs(dx) > w / 4 || (v > 0.6 && Math.abs(dx) >= 44));
      const cur = el; const offset = go ? dx : 0;
      id = null; locked = false; el = null;
      if (go) { opts.onSwipe(dir, offset); }
      else { cur.classList.remove('dragging'); cur.classList.add('moving'); cur.style.transform = ''; setTimeout(() => cur.classList.remove('moving'), SCREEN_MS + 20); }
      dx = 0;
    };
    container.addEventListener('pointerup', end);
    container.addEventListener('pointercancel', end);
  }

  /* Удержание с видимой полосой. Элемент .hold с <i class="hold-bar">. */
  function hold(el, opts) {
    const dur = opts.duration || 650;
    let timer = null, id = null, x0 = 0, y0 = 0;
    el.style.setProperty('--hold-dur', dur + 'ms');
    const cancel = () => {
      if (timer) clearTimeout(timer); timer = null; id = null;
      el.classList.remove('holding');
    };
    el.addEventListener('pointerdown', e => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
      el.classList.add('holding');
      timer = setTimeout(() => { timer = null; el.classList.remove('holding'); id = null; opts.onComplete(el); }, dur);
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, e => { if (e.pointerId === id) cancel(); }));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* Перетаскивание строк за ручку. onChange(ids) после отпускания. */
  function sortable(list, opts) {
    let row = null, id = null, y0 = 0, rowY0 = 0, ph = 0;
    list.addEventListener('pointerdown', e => {
      const grip = e.target.closest(opts.handle);
      if (!grip || !e.isPrimary) return;
      row = grip.closest(opts.row); if (!row) return;
      id = e.pointerId; y0 = e.clientY; rowY0 = row.getBoundingClientRect().top;
      row.classList.add('drag'); row.style.transition = 'none';
      try { grip.setPointerCapture(id); } catch (_) {}
      e.preventDefault();
    });
    const move = e => {
      if (e.pointerId !== id || !row) return;
      const dy = e.clientY - y0;
      row.style.transform = `translateY(${dy}px)`;
      const rows = [...list.querySelectorAll(opts.row)].filter(r => r !== row);
      const cy = e.clientY;
      let target = null;
      for (const r of rows) {
        const b = r.getBoundingClientRect();
        if (cy < b.top + b.height / 2) { target = r; break; }
      }
      const cur = row.getBoundingClientRect().top;
      if (target ? target !== row.nextElementSibling : row.nextElementSibling) {
        if (target) list.insertBefore(row, target); else list.appendChild(row);
        // Сохраняем визуальную непрерывность: сдвигаем точку отсчёта на изменение позиции.
        const now = row.getBoundingClientRect().top;
        y0 += (now - cur);
        row.style.transform = `translateY(${e.clientY - y0}px)`;
      }
    };
    const end = e => {
      if (e.pointerId !== id || !row) return;
      row.classList.remove('drag'); row.style.transform = ''; row.style.transition = '';
      const ids = [...list.querySelectorAll(opts.row)].map(r => r.dataset.id);
      row = null; id = null;
      opts.onChange(ids);
    };
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
  }

  window.OwlsMotion = { reduced, once, cascade, count, fillRings, transition, swipe, hold, sortable, SCREEN_MS };
})();
