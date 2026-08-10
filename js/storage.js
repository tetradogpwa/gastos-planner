/* ============================================
   storage.js - Persistencia en localStorage + Import/Export
   ============================================ */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'mis-gastos.v1';
  const SCHEMA_VERSION = 2;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Models.newState();
      const data = JSON.parse(raw);
      return migrate(data);
    } catch (err) {
      console.error('[storage] Error al cargar:', err);
      return Models.newState();
    }
  }

  function save(state) {
    try {
      const payload = {
        version: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        expenses: state.expenses,
        income: state.income,
        budgets: state.budgets || [],
        subcategories: state.subcategories || [],
        creditCards: state.creditCards || [],
        // balanceEntries: state.balanceEntries || [],
        settings: state.settings
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('[storage] Error al guardar:', err);
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (err) {
      console.error('[storage] Error al limpiar:', err);
      return false;
    }
  }

  /**
   * Normaliza el estado cargado para garantizar consistencia y migración.
   * v1 → v2: añade budgets/subcategories, migra oneTime+variable → unico.
   */
  function migrate(data) {
    const state = Models.newState();
    if (!data || typeof data !== 'object') return state;

    if (Array.isArray(data.expenses)) {
      state.expenses = data.expenses.map((e) => {
        // Migración: oneTime + variable → unico
        if (e.oneTime && e.type === 'variable') {
          return Models.normalizeExpense({ ...e, type: 'unico' });
        }
        return Models.normalizeExpense(e);
      });
    }
    if (Array.isArray(data.income)) {
      state.income = data.income.map((i) => Models.normalizeIncome(i));
    }
    if (Array.isArray(data.budgets)) {
      state.budgets = data.budgets.map((b) => Models.normalizeBudget(b));
    }
    if (Array.isArray(data.subcategories)) {
      state.subcategories = data.subcategories.map((s) => Models.normalizeSubcategory(s));
    }
    if (Array.isArray(data.creditCards)) {
      state.creditCards = data.creditCards.map((c) => Models.normalizeCreditCard(c));
    }
    // if (Array.isArray(data.balanceEntries)) {
    //   state.balanceEntries = data.balanceEntries.map((b) => Models.normalizeBalanceEntry(b));
    // }
    state.settings = Models.normalizeSettings(data.settings || {});
    return state;
  }

  function exportJSON(state) {
    const payload = {
      app: 'Mis Gastos',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses: state.expenses,
      income: state.income,
      budgets: state.budgets || [],
      subcategories: state.subcategories || [],
      creditCards: state.creditCards || [],
      balanceEntries: state.balanceEntries || [],
      settings: state.settings
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const today = Models.toISODate(new Date());
    const filename = `mis-gastos-${today}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { ok: true, filename, count: state.expenses.length + state.income.length };
  }

  function importFromFile(file, mode = 'replace') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || typeof data !== 'object') {
            reject(new Error('Archivo no válido.'));
            return;
          }

          const newState = Models.newState();
          if (Array.isArray(data.expenses)) {
            newState.expenses = data.expenses.map((e) => {
              if (e.oneTime && e.type === 'variable') {
                return Models.normalizeExpense({ ...e, type: 'unico' });
              }
              return Models.normalizeExpense(e);
            });
          }
          if (Array.isArray(data.income)) {
            newState.income = data.income.map((i) => Models.normalizeIncome(i));
          }
          if (Array.isArray(data.budgets)) {
            newState.budgets = data.budgets.map((b) => Models.normalizeBudget(b));
          }
          if (Array.isArray(data.subcategories)) {
            newState.subcategories = data.subcategories.map((s) => Models.normalizeSubcategory(s));
          }
          if (Array.isArray(data.creditCards)) {
            newState.creditCards = data.creditCards.map((c) => Models.normalizeCreditCard(c));
          }
          // if (Array.isArray(data.balanceEntries)) {
          //   newState.balanceEntries = data.balanceEntries.map((b) => Models.normalizeBalanceEntry(b));
          // }
          newState.settings = Models.normalizeSettings(data.settings || {});

          if (mode === 'merge') {
            const current = load();
            const expMap = new Map(current.expenses.map((e) => [e.id, e]));
            newState.expenses.forEach((e) => expMap.set(e.id, e));
            const incMap = new Map(current.income.map((i) => [i.id, i]));
            newState.income.forEach((i) => incMap.set(i.id, i));
            const budMap = new Map((current.budgets || []).map((b) => [b.id, b]));
            newState.budgets.forEach((b) => budMap.set(b.id, b));
            const subMap = new Map((current.subcategories || []).map((s) => [s.id, s]));
            newState.subcategories.forEach((s) => subMap.set(s.id, s));
            const ccMap = new Map((current.creditCards || []).map((c) => [c.id, c]));
            newState.creditCards.forEach((c) => ccMap.set(c.id, c));
            newState.expenses = Array.from(expMap.values());
            newState.income = Array.from(incMap.values());
            newState.budgets = Array.from(budMap.values());
            newState.subcategories = Array.from(subMap.values());
            newState.creditCards = Array.from(ccMap.values());
          }

          resolve(newState);
        } catch (err) {
          reject(new Error('JSON inválido: ' + err.message));
        }
      };
      reader.readAsText(file);
    });
  }

  global.Storage = {
    load,
    save,
    clear,
    exportJSON,
    importFromFile,
    STORAGE_KEY
  };
})(window);
