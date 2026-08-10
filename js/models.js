/* ============================================
   models.js - Modelo de datos y motor de proyección
   ============================================ */

(function (global) {
  'use strict';

  // ---------- Constantes ----------
  const CATEGORIES = {
    hogar: { icon: '🏠', label: 'Hogar' },
    suscripciones: { icon: '📺', label: 'Suscripciones' },
    transporte: { icon: '🚗', label: 'Transporte' },
    comida: { icon: '🍔', label: 'Comida' },
    salud: { icon: '💊', label: 'Salud' },
    ocio: { icon: '🎮', label: 'Ocio' },
    educacion: { icon: '📚', label: 'Educación' },
    seguros: { icon: '🛡️', label: 'Seguros' },
    deudas: { icon: '💳', label: 'Deudas/Créditos' },
    nomina: { icon: '💼', label: 'Nómina' },
    freelance: { icon: '💻', label: 'Freelance' },
    alquiler: { icon: '🏘️', label: 'Alquiler' },
    inversiones: { icon: '📈', label: 'Inversiones' },
    regalos: { icon: '🎁', label: 'Regalos' },
    extras: { icon: '✨', label: 'Extras' },
    otros: { icon: '📦', label: 'Otros' }
  };

  const EXPENSE_TYPES = {
    fixed: { label: 'Fijo', tag: 'Fijo', short: 'Fijo' },
    temporary: { label: 'Temporal', tag: 'Temporal', short: 'Temporal' },
    variable: { label: 'Variable', tag: 'Variable', short: 'Variable' }
  };

  const INCOME_TYPES = {
    recurring: { label: 'Recurrente', tag: 'Recurrente', short: 'Recurrente' },
    extra: { label: 'Puntual', tag: 'Puntual', short: 'Puntual' }
  };

  // ---------- Utilidades de fecha ----------
  /**
   * Convierte un Date o string ISO a 'YYYY-MM-DD' usando la fecha local (no UTC).
   */
  function toISODate(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    const d = value;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseISODate(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /**
   * Devuelve el primer día del mes dado. monthKey = 'YYYY-MM'.
   */
  function firstOfMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }

  function lastOfMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m, 0);
  }

  function addMonths(monthKey, n) {
    const d = firstOfMonth(monthKey);
    d.setMonth(d.getMonth() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function compareMonthKeys(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function todayMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const MONTH_NAMES_SHORT = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  function monthKeyToLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  function monthKeyToShort(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return `${MONTH_NAMES_SHORT[m - 1]} ${y}`;
  }

  // ---------- UUID ----------
  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // ---------- Normalización ----------
  function normalizeExpense(raw) {
    const paidMonths = (raw.paidMonths && typeof raw.paidMonths === 'object') ? raw.paidMonths : {};
    const skippedMonths = (raw.skippedMonths && typeof raw.skippedMonths === 'object') ? raw.skippedMonths : {};
    return {
      id: raw.id || uuid(),
      name: String(raw.name || '').trim(),
      amount: Number(raw.amount) || 0,
      type: ['fixed', 'temporary', 'variable'].includes(raw.type) ? raw.type : 'fixed',
      category: CATEGORIES[raw.category] ? raw.category : 'otros',
      startDate: raw.startDate || '',
      endDate: raw.endDate || null,
      targetMonth: raw.targetMonth || null, // solo para variable
      optional: !!raw.optional,
      oneTime: !!raw.oneTime,
      paidMonths,
      skippedMonths,
      amountHistory: normalizeAmountHistory(raw.amountHistory, raw.startDate, raw.amount),
      notes: String(raw.notes || ''),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeIncome(raw) {
    return {
      id: raw.id || uuid(),
      name: String(raw.name || '').trim(),
      amount: Number(raw.amount) || 0,
      type: ['recurring', 'extra'].includes(raw.type) ? raw.type : 'recurring',
      category: CATEGORIES[raw.category] ? raw.category : 'nomina',
      startDate: raw.startDate || '',
      endDate: raw.endDate || null,
      targetMonth: raw.targetMonth || null, // solo para extra
      amountHistory: normalizeAmountHistory(raw.amountHistory, raw.startDate, raw.amount),
      notes: String(raw.notes || ''),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeAmountHistory(raw, fallbackStartDate, fallbackAmount) {
    if (!Array.isArray(raw)) {
      // Sin historial previo: crear una entrada implícita con startDate y amount
      if (fallbackStartDate || fallbackAmount) {
        return [{ fromDate: fallbackStartDate || toISODate(new Date()), amount: Number(fallbackAmount) || 0 }];
      }
      return [];
    }
    return raw
      .filter((c) => c && c.fromDate)
      .map((c) => ({ fromDate: c.fromDate, amount: Number(c.amount) || 0 }))
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  }

  function normalizeSettings(raw) {
    const s = raw || {};
    return {
      currency: s.currency || 'EUR',
      theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
      startDayOfMonth: Number(s.startDayOfMonth) >= 1 && Number(s.startDayOfMonth) <= 28
        ? Number(s.startDayOfMonth) : 1
    };
  }

  function newState() {
    return {
      version: 1,
      expenses: [],
      income: [],
      settings: normalizeSettings({})
    };
  }

  // ---------- Reglas de proyección ----------
  /**
   * Determina si un item (gasto o ingreso) está activo en el mes monthKey.
   * Reglas:
   *  - fixed / temporary / recurring: aplica si startDate <= fin de mes
   *    y (endDate == null OR endDate >= inicio de mes).
   *  - variable / extra: aplica si targetMonth == monthKey.
   *  - Si startDate está vacío, se considera "desde el inicio de los tiempos"
   *    (no aparece en histórico hasta el mes actual).
   */
  function appliesToMonth(item, monthKey) {
    const monthStart = firstOfMonth(monthKey);
    const monthEnd = lastOfMonth(monthKey);

    if (item.type === 'variable' || item.type === 'extra') {
      return item.targetMonth === monthKey;
    }

    // Para items recurrentes (fixed, temporary, recurring income)
    // Si no hay startDate, lo consideramos activo desde el mes actual
    if (!item.startDate) {
      if (compareMonthKeys(monthKey, todayMonthKey()) < 0) return false;
    } else {
      const start = parseISODate(item.startDate);
      if (start > monthEnd) return false;

      if (item.endDate) {
        const end = parseISODate(item.endDate);
        if (end < monthStart) return false;
      }
    }

    // Gastos opcionales: solo cuentan los meses confirmados explícitamente
    if (item.optional) {
      return !!(item.paidMonths && item.paidMonths[monthKey]);
    }

    return true;
  }

  /**
   * Devuelve los items aplicables al mes, ordenados:
   *  - Expenses primero (por categoría, luego nombre)
   *  - Income después
   */
  function getItemsForMonth(state, monthKey) {
    const expenses = state.expenses
      .filter((e) => appliesToMonth(e, monthKey))
      .map((e) => ({ ...e, _kind: 'expense', effectiveAmount: effectiveAmountAt(e, monthKey) }))
      .sort(sortItem);

    const income = state.income
      .filter((i) => appliesToMonth(i, monthKey))
      .map((i) => ({ ...i, _kind: 'income', effectiveAmount: effectiveAmountAt(i, monthKey) }))
      .sort(sortItem);

    return { expenses, income, all: [...expenses, ...income] };
  }

  function sortItem(a, b) {
    if (a.type !== b.type) {
      const order = { fixed: 0, recurring: 0, temporary: 1, variable: 2, extra: 2 };
      return (order[a.type] ?? 9) - (order[b.type] ?? 9);
    }
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  }

  function summarize(state, monthKey) {
    const { expenses, income } = getItemsForMonth(state, monthKey);
    const totalExp = expenses.reduce((s, x) => s + (x.effectiveAmount || 0), 0);
    const totalInc = income.reduce((s, x) => s + (x.effectiveAmount || 0), 0);
    return {
      totalExpenses: totalExp,
      totalIncome: totalInc,
      balance: totalInc - totalExp,
      countExpenses: expenses.length,
      countIncome: income.length
    };
  }

  /**
   * Encuentra el primer y último mes en los que cualquier item está activo.
   * Si no hay items, devuelve { first: today, last: today }.
   */
  function stateDateRange(state) {
    const keys = new Set();
    const t = todayMonthKey();
    const today = firstOfMonth(t);
    // Considerar también el mes actual y un margen
    let earliest = today;
    let latest = today;

    const collect = (items) => {
      items.forEach((it) => {
        if (it.type === 'variable' || it.type === 'extra') {
          if (it.targetMonth) {
            const k = it.targetMonth;
            keys.add(k);
            const d = firstOfMonth(k);
            if (d < earliest) earliest = d;
            if (d > latest) latest = d;
          }
        } else {
          if (it.startDate) {
            const s = parseISODate(it.startDate);
            const e = it.endDate ? parseISODate(it.endDate) : null;
            if (s) {
              if (s < earliest) earliest = s;
              if (e && e > latest) latest = e;
              else if (!e) {
                // Sin fin: añadimos 12 meses hacia el futuro para el timeline
                const future = new Date(today);
                future.setMonth(future.getMonth() + 12);
                if (future > latest) latest = future;
              }
            }
          } else {
            // sin fecha: solo desde hoy
            if (today > latest) latest = today;
          }
        }
      });
    };

    collect(state.expenses);
    collect(state.income);

    const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { first: toKey(earliest), last: toKey(latest) };
  }

  /**
   * Devuelve una lista de meses entre first y last (inclusivo) y
   * el resumen de cada uno. Pensado para el timeline.
   */
  function getTimeline(state) {
    const range = stateDateRange(state);
    const result = [];
    let cur = range.first;
    let safety = 0;
    while (compareMonthKeys(cur, range.last) <= 0 && safety < 240) {
      result.push({
        monthKey: cur,
        summary: summarize(state, cur)
      });
      cur = addMonths(cur, 1);
      safety++;
    }
    return result;
  }

  /**
   * Devuelve los meses en los que un item está activo.
   * Útil para mostrar "próximos cobros" o info de cada item.
   */
  function monthsForItem(item, fromKey, toKey) {
    const out = [];
    let cur = fromKey;
    let safety = 0;
    while (compareMonthKeys(cur, toKey) <= 0 && safety < 240) {
      if (appliesToMonth(item, cur)) out.push(cur);
      cur = addMonths(cur, 1);
      safety++;
    }
    return out;
  }

  /**
   * Texto humano de la vigencia de un item.
   *  - "Activo siempre" (sin endDate)
   *  - "Hasta oct 2026" (con endDate)
   *  - "Solo oct 2026" (variable / extra)
   */
  function validityText(item) {
    if (item.type === 'variable' || item.type === 'extra') {
      if (!item.targetMonth) return 'Mes no definido';
      return `Solo ${monthKeyToShort(item.targetMonth)}`;
    }
    if (!item.startDate && !item.endDate) return 'Activo siempre';
    const startLabel = item.startDate ? formatShortDate(item.startDate) : '—';
    if (!item.endDate) return `Desde ${startLabel}, sin fin`;
    const endLabel = formatShortDate(item.endDate);
    return `Del ${startLabel} al ${endLabel}`;
  }

  function formatShortDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const monthShort = MONTH_NAMES_SHORT[m - 1].toLowerCase();
    return `${d} ${monthShort} ${y}`;
  }

  function isEndingSoon(item) {
    if (!item.endDate) return false;
    const end = parseISODate(item.endDate);
    const today = new Date();
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 31;
  }

  /**
   * Devuelve true si el item es opcional pero no está confirmado para el mes monthKey
   * (está dentro de su rango, pero pendiente de que el usuario lo marque como pagado).
   */
  function isPendingOptional(item, monthKey) {
    if (!item || !item.optional) return false;
    // Pago único: si ya se pagó alguna vez, ya está hecho y nunca más vuelve a salir como pendiente
    if (item.oneTime && item.paidMonths && Object.keys(item.paidMonths).length > 0) return false;
    if (item.paidMonths && item.paidMonths[monthKey]) return false;
    if (item.skippedMonths && item.skippedMonths[monthKey]) return false;
    // ¿Entraría en este mes si NO fuera opcional? Si ya no aplica por rango, no es "pendiente"
    return wouldApplyIfMandatory(item, monthKey);
  }

  function wouldApplyIfMandatory(item, monthKey) {
    const monthStart = firstOfMonth(monthKey);
    const monthEnd = lastOfMonth(monthKey);
    if (item.type === 'variable' || item.type === 'extra') {
      return item.targetMonth === monthKey;
    }
    if (!item.startDate) {
      return compareMonthKeys(monthKey, todayMonthKey()) >= 0;
    }
    const start = parseISODate(item.startDate);
    if (start > monthEnd) return false;
    if (item.endDate) {
      const end = parseISODate(item.endDate);
      if (end < monthStart) return false;
    }
    return true;
  }

  function togglePaidMonth(item, monthKey, paid) {
    const months = { ...(item.paidMonths || {}) };
    if (paid) months[monthKey] = true;
    else delete months[monthKey];
    return months;
  }

  function toggleSkippedMonth(item, monthKey, skipped) {
    const months = { ...(item.skippedMonths || {}) };
    if (skipped) months[monthKey] = true;
    else delete months[monthKey];
    return months;
  }

  /**
   * Devuelve el importe que aplicaba al mes monthKey según el historial.
   * Si no hay historial, devuelve item.amount.
   */
  function effectiveAmountAt(item, monthKey) {
    const history = Array.isArray(item.amountHistory) ? item.amountHistory : [];
    if (history.length === 0) return Number(item.amount) || 0;
    const monthStart = firstOfMonth(monthKey);
    let result = Number(item.amount) || 0;
    for (const ch of history) {
      const chDate = parseISODate(ch.fromDate);
      if (chDate && chDate <= monthStart) {
        result = Number(ch.amount) || 0;
      } else {
        break;
      }
    }
    return result;
  }

  // ---------- Formato de moneda ----------
  /**
   * Formato manual para evitar depender de ICU completo del navegador.
   *  - EUR / GBP: 1.234,56 € (símbolo al final)
   *  - resto:     $1,234.56  (símbolo delante, separadores US)
   */
  function formatMoney(amount, currency) {
    const c = currency || 'EUR';
    const symbol = c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$';
    const fixed = (Math.round(amount * 100) / 100);
    const sign = fixed < 0 ? '-' : '';
    const abs = Math.abs(fixed);

    if (c === 'EUR' || c === 'GBP') {
      // Estilo europeo: miles con punto, decimales con coma
      const intPart = Math.floor(abs);
      const decPart = Math.round((abs - intPart) * 100);
      const intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const decStr = String(decPart).padStart(2, '0');
      return `${sign}${intStr},${decStr} ${symbol}`;
    } else {
      // Estilo US: miles con coma, decimales con punto
      const intPart = Math.floor(abs);
      const decPart = Math.round((abs - intPart) * 100);
      const intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const decStr = String(decPart).padStart(2, '0');
      return `${sign}${symbol}${intStr}.${decStr}`;
    }
  }

  // ---------- API pública ----------
  global.Models = {
    CATEGORIES,
    EXPENSE_TYPES,
    INCOME_TYPES,
    newState,
    normalizeExpense,
    normalizeIncome,
    normalizeSettings,
    toISODate,
    parseISODate,
    firstOfMonth,
    lastOfMonth,
    addMonths,
    compareMonthKeys,
    todayMonthKey,
    monthKeyToLabel,
    monthKeyToShort,
    formatShortDate,
    formatMoney,
    appliesToMonth,
    getItemsForMonth,
    summarize,
    getTimeline,
    monthsForItem,
    validityText,
    isEndingSoon,
    isPendingOptional,
    togglePaidMonth,
    toggleSkippedMonth,
    effectiveAmountAt,
    uuid
  };
})(window);
