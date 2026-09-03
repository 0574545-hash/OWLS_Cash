/* ============================================================
   store.js — постоянное хранилище OWLS Cash (localStorage).
   Схема v1:
     categories: [{ id, name, icon, order, hidden }]
     expenses:   [{ id, ts, amount, catId, name }]
   ts — локальная дата-время «YYYY-MM-DDTHH:MM:SS» (без зоны),
   amount — целые рубли. Сеть и синхронизация не проектировались.
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'owls-cash:v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.categories) && Array.isArray(d.expenses)) return d;
    } catch (_) { /* повреждённые или недоступные данные — начнём заново */ }
    return null;
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (_) { return false; }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  window.OwlsStore = { KEY, load, save, uid };
})();
