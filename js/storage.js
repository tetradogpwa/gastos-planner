/* ============================================
   storage.js - Persistencia en localStorage + Import/Export
   ============================================ */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'mis-gastos.v1';
  const SCHEMA_VERSION = 1;

  /**
   * Carga el estado desde localStorage. Si no existe, devuelve un estado vacío.
   * Si existe, normaliza los datos (tolerante a versiones antiguas).
   */
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
   * Normaliza el estado cargado para garantizar consistencia.
   */
  function migrate(data) {
    const state = Models.newState();
    if (!data || typeof data !== 'object') return state;

    if (Array.isArray(data.expenses)) {
      state.expenses = data.expenses.map((e) => Models.normalizeExpense(e));
    }
    if (Array.isArray(data.income)) {
      state.income = data.income.map((i) => Models.normalizeIncome(i));
    }
    state.settings = Models.normalizeSettings(data.settings || {});
    return state;
  }

  /**
   * Genera un Blob y dispara la descarga de un archivo JSON con todos los datos.
   */
  function exportJSON(state) {
    const payload = {
      app: 'Mis Gastos',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses: state.expenses,
      income: state.income,
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

  /**
   * Lee un archivo JSON seleccionado por el usuario y devuelve un estado listo.
   * Estrategia:
   *  - 'replace': reemplaza todo el estado
   *  - 'merge': combina, conservando items por id (los nuevos sobrescriben)
   */
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
            newState.expenses = data.expenses.map((e) => Models.normalizeExpense(e));
          }
          if (Array.isArray(data.income)) {
            newState.income = data.income.map((i) => Models.normalizeIncome(i));
          }
          newState.settings = Models.normalizeSettings(data.settings || {});

          if (mode === 'merge') {
            const current = load();
            const expMap = new Map(current.expenses.map((e) => [e.id, e]));
            newState.expenses.forEach((e) => expMap.set(e.id, e));
            const incMap = new Map(current.income.map((i) => [i.id, i]));
            newState.income.forEach((i) => incMap.set(i.id, i));
            newState.expenses = Array.from(expMap.values());
            newState.income = Array.from(incMap.values());
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
