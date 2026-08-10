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
    variable: { label: 'Variable', tag: 'Variable', short: 'Variable' },
    unico: { label: 'Único', tag: 'Único', short: 'Único' }
  };

  const INCOME_TYPES = {
    recurring: { label: 'Recurrente', tag: 'Recurrente', short: 'Recurrente' },
    extra: { label: 'Puntual', tag: 'Puntual', short: 'Puntual' }
  };

  // Paleta de iconos para picker (presupuestos y subcategorías)
  const ICON_OPTIONS = [
    { group: 'General', icons: ['💼','📌','🎯','⭐','🔖','🏷️','📎','🛒','📦','🎁','💰','💳'] },
    { group: 'Hogar', icons: ['🏠','🛋️','🧹','💡','🔌','🚿','🛁','🛏️','🍽️','🧺','🔧','🪴'] },
    { group: 'Comida', icons: ['🍔','🍕','🍝','🍣','🥗','🍞','🍎','☕','🍺','🍷','🥖','🍰','🍳','🥖','🧀'] },
    { group: 'Transporte', icons: ['🚗','⛽','🅿️','🚌','🚇','✈️','🚲','🔧','🛞','🚕','🚆'] },
    { group: 'Salud', icons: ['💊','🩺','🏥','🦷','👓','💪','🧘','🧴'] },
    { group: 'Ocio', icons: ['🎮','🎬','🎵','📚','🎨','⚽','🏊','🎸','🎭','🎲'] },
    { group: 'Trabajo', icons: ['💻','📊','📈','🖥️','📞','📝','✏️'] },
    { group: 'Otros', icons: ['🎓','🐾','👶','👕','💍','🛡️','🌐'] }
  ];

  // ---------- Utilidades de fecha ----------
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

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // ---------- Normalización ----------
  function normalizeExpense(raw) {
    const paidMonths = (raw.paidMonths && typeof raw.paidMonths === 'object') ? raw.paidMonths : {};
    const skippedMonths = (raw.skippedMonths && typeof raw.skippedMonths === 'object') ? raw.skippedMonths : {};
    const pendingMonths = (raw.pendingMonths && typeof raw.pendingMonths === 'object') ? raw.pendingMonths : {};
    const type = ['fixed', 'temporary', 'variable', 'unico'].includes(raw.type) ? raw.type : 'fixed';
    return {
      id: raw.id || uuid(),
      name: String(raw.name || '').trim(),
      amount: Number(raw.amount) || 0,
      type,
      category: CATEGORIES[raw.category] ? raw.category : 'otros',
      subcategoryId: raw.subcategoryId || null,
      budgetId: raw.budgetId || null,
      creditCardId: raw.creditCardId || null,
      isExtraPayment: !!raw.isExtraPayment,
      startDate: raw.startDate || '',
      endDate: raw.endDate || null,
      targetMonth: raw.targetMonth || null,
      optional: !!raw.optional,
      inactive: !!raw.inactive,
      // Único siempre es oneTime
      oneTime: type === 'unico' ? true : !!raw.oneTime,
      paidMonths,
      skippedMonths,
      pendingMonths,
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
      subcategoryId: raw.subcategoryId || null,
      startDate: raw.startDate || '',
      endDate: raw.endDate || null,
      targetMonth: raw.targetMonth || null,
      amountHistory: normalizeAmountHistory(raw.amountHistory, raw.startDate, raw.amount),
      notes: String(raw.notes || ''),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeSubcategory(raw) {
    return {
      id: raw.id || uuid(),
      category: CATEGORIES[raw.category] ? raw.category : 'otros',
      label: String(raw.label || '').trim().slice(0, 30),
      icon: String(raw.icon || '').slice(0, 4) || '📦',
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeBudget(raw) {
    return {
      id: raw.id || uuid(),
      category: CATEGORIES[raw.category] ? raw.category : 'otros',
      subcategoryId: raw.subcategoryId || null,
      amount: Number(raw.amount) || 0,
      icon: raw.icon ? String(raw.icon).slice(0, 4) : null,
      startDate: raw.startDate || '',
      endDate: raw.endDate || null,
      notes: String(raw.notes || ''),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeCreditCard(raw) {
    const paidMonths = (raw.paidMonths && typeof raw.paidMonths === 'object') ? raw.paidMonths : {};
    const skippedMonths = (raw.skippedMonths && typeof raw.skippedMonths === 'object') ? raw.skippedMonths : {};
    return {
      id: raw.id || uuid(),
      name: String(raw.name || '').trim(),
      maxLimit: Number(raw.maxLimit) || 0,
      currentBalance: Number(raw.currentBalance) || 0,
      monthlyPayment: Number(raw.monthlyPayment) || 0,
      purchaseAmount: Number(raw.purchaseAmount) || 0,
      installments: Number(raw.installments) || 0,
      installmentStartMonth: raw.installmentStartMonth || null,
      startDate: raw.startDate || '',
      category: CATEGORIES[raw.category] ? raw.category : 'deudas',
      paidMonths,
      skippedMonths,
      inactive: !!raw.inactive,
      icon: raw.icon || '💳',
      notes: String(raw.notes || ''),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function normalizeAmountHistory(raw, fallbackStartDate, fallbackAmount) {
    if (!Array.isArray(raw)) {
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
      version: 2,
      expenses: [],
      income: [],
      budgets: [],
      subcategories: [],
      creditCards: [],
      // balanceEntries: [],
      settings: normalizeSettings({})
    };
  }

  // function normalizeBalanceEntry(raw) {
  //   return {
  //     id: raw.id || uuid(),
  //     monthKey: raw.monthKey || todayMonthKey(),
  //     balance: Number(raw.balance) || 0,
  //     date: raw.date || new Date().toISOString()
  //   };
  // }

  // function getLatestBalance(state, monthKey) {
  //   if (!state.balanceEntries || state.balanceEntries.length === 0) return null;
  //   const entries = monthKey
  //     ? state.balanceEntries.filter((b) => b.monthKey === monthKey)
  //     : state.balanceEntries;
  //   if (entries.length === 0) return null;
  //   return entries[entries.length - 1];
  // }

  // ---------- Reglas de proyección ----------
  function appliesToMonth(item, monthKey) {
    if (item.inactive) return false;
    const monthStart = firstOfMonth(monthKey);
    const monthEnd = lastOfMonth(monthKey);

    if (item.type === 'variable' || item.type === 'extra') {
      return item.targetMonth === monthKey;
    }

    if (item.type === 'unico') {
      // Si ya está confirmado, sigue contando ese mes
      if (item.paidMonths && item.paidMonths[monthKey]) return true;
      if (item.skippedMonths && item.skippedMonths[monthKey]) return false;
      // Si tiene targetMonth, solo aparece ese mes
      if (item.targetMonth) return item.targetMonth === monthKey;
      // Si tiene startDate, aparece el mes de la fecha
      if (item.startDate) {
        const d = parseISODate(item.startDate);
        return d && d >= monthStart && d <= monthEnd;
      }
      return false;
    }

    // fixed / temporary / recurring
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

    if (item.optional) {
      return !!(item.paidMonths && item.paidMonths[monthKey]);
    }

    // No opcional: si está marcado como pendiente y no pagado, no aplica
    if (item.pendingMonths && item.pendingMonths[monthKey] && !(item.paidMonths && item.paidMonths[monthKey])) {
      return false;
    }

    return true;
  }

  function getItemsForMonth(state, monthKey) {
    const expenses = state.expenses
      .filter((e) => appliesToMonth(e, monthKey))
      .map((e) => ({
        ...e,
        _kind: 'expense',
        effectiveAmount: effectiveAmountAt(e, monthKey),
        effectiveIcon: effectiveIconFor(e, state)
      }))
      .sort(sortItem);

    const income = state.income
      .filter((i) => appliesToMonth(i, monthKey))
      .map((i) => ({
        ...i,
        _kind: 'income',
        effectiveAmount: effectiveAmountAt(i, monthKey),
        effectiveIcon: effectiveIconFor(i, state)
      }))
      .sort(sortItem);

    return { expenses, income, all: [...expenses, ...income] };
  }

  function sortItem(a, b) {
    if (a.type !== b.type) {
      const order = { fixed: 0, recurring: 0, temporary: 1, variable: 2, extra: 2, unico: 3 };
      return (order[a.type] ?? 9) - (order[b.type] ?? 9);
    }
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  }

  function summarize(state, monthKey) {
    const { expenses, income } = getItemsForMonth(state, monthKey);
    const totalInc = income.reduce((s, x) => s + (x.effectiveAmount || 0), 0);
    // Gastos SIN presupuesto asignado cuentan en el balance.
    // Los gastos CON presupuesto se trackean aparte en el progreso del presupuesto.
    // Las compras con tarjeta de crédito NO cuentan (las paga la tarjeta).
    // Los pagos extra a tarjeta SÍ cuentan (son salidas de caja reales).
    const nonBudgetExp = expenses
      .filter((e) => !e.budgetId && !(e.creditCardId && !e.isExtraPayment))
      .reduce((s, x) => s + (x.effectiveAmount || 0), 0);
    // Los presupuestos cuentan como gasto fijo en el balance.
    const budgetTotal = summarizeBudgets(state, monthKey).totalAssigned;
    // Las cuotas mensuales de tarjetas revolving cuentan como compromiso recurrente.
    const ccMonthly = state.creditCards
      .filter((c) => !c.inactive && appliesCreditCardToMonth(c, monthKey))
      .reduce((s, c) => s + c.monthlyPayment, 0);
    const totalExp = nonBudgetExp + budgetTotal + ccMonthly;
    return {
      totalExpenses: totalExp,
      totalIncome: totalInc,
      balance: totalInc - totalExp,
      countExpenses: expenses.length,
      countIncome: income.length
    };
  }

  function stateDateRange(state) {
    const keys = new Set();
    const t = todayMonthKey();
    const today = firstOfMonth(t);
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
        } else if (it.type === 'unico') {
          if (it.targetMonth) {
            const d = firstOfMonth(it.targetMonth);
            if (d < earliest) earliest = d;
            if (d > latest) latest = d;
          } else if (it.startDate) {
            const s = parseISODate(it.startDate);
            if (s) {
              if (s < earliest) earliest = s;
              if (s > latest) latest = s;
            }
          }
        } else {
          if (it.startDate) {
            const s = parseISODate(it.startDate);
            const e = it.endDate ? parseISODate(it.endDate) : null;
            if (s) {
              if (s < earliest) earliest = s;
              if (e && e > latest) latest = e;
              else if (!e) {
                const future = new Date(today);
                future.setMonth(future.getMonth() + 12);
                if (future > latest) latest = future;
              }
            }
          } else {
            if (today > latest) latest = today;
          }
        }
      });
    };

    collect(state.expenses);
    collect(state.income);
    collect(state.budgets);

    const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { first: toKey(earliest), last: toKey(latest) };
  }

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

  function validityText(item) {
    if (item.type === 'variable' || item.type === 'extra') {
      if (!item.targetMonth) return 'Mes no definido';
      return `Solo ${monthKeyToShort(item.targetMonth)}`;
    }
    if (item.type === 'unico') {
      if (item.targetMonth) return `Solo ${monthKeyToShort(item.targetMonth)}`;
      if (item.startDate) return `Fecha: ${formatShortDate(item.startDate)}`;
      return 'Fecha no definida';
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

  function isPendingOptional(item, monthKey) {
    if (!item || !item.optional || item.inactive) return false;
    if (item.oneTime && item.paidMonths && Object.keys(item.paidMonths).length > 0) return false;
    if (item.paidMonths && item.paidMonths[monthKey]) return false;
    if (item.skippedMonths && item.skippedMonths[monthKey]) return false;
    return wouldApplyIfMandatory(item, monthKey);
  }

  function wouldApplyIfMandatory(item, monthKey) {
    const monthStart = firstOfMonth(monthKey);
    const monthEnd = lastOfMonth(monthKey);
    if (item.type === 'variable' || item.type === 'extra') {
      return item.targetMonth === monthKey;
    }
    if (item.type === 'unico') {
      if (item.paidMonths && item.paidMonths[monthKey]) return true;
      if (item.targetMonth) return item.targetMonth === monthKey;
      if (item.startDate) {
        const d = parseISODate(item.startDate);
        return d && d >= monthStart && d <= monthEnd;
      }
      return false;
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

  function togglePendingMonth(item, monthKey, pending) {
    const months = { ...(item.pendingMonths || {}) };
    if (pending) months[monthKey] = true;
    else delete months[monthKey];
    return months;
  }

  /**
   * Devuelve todos los pagos pendientes de gastos no opcionales.
   * Cada elemento: { item, monthKey, amount }.
   * Excluye los meses que ya están pagados y los que no aplicarían.
   */
  function getPendingMandatory(state, monthKey) {
    const out = [];
    state.expenses.forEach((e) => {
      if (e.optional) return;
      if (!e.pendingMonths) return;
      Object.keys(e.pendingMonths).forEach((mk) => {
        if (!e.pendingMonths[mk]) return;
        if (e.paidMonths && e.paidMonths[mk]) return;
        // Mostrar solo pendientes del mes actual o anteriores (no futuros)
        if (mk > monthKey) return;
        if (!wouldApplyIfMandatory(e, mk)) return;
        out.push({
          item: e,
          monthKey: mk,
          amount: effectiveAmountAt(e, mk)
        });
      });
    });
    return out.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

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

  // ---------- Subcategorías ----------
  function getSubcategoriesForCategory(state, categoryKey) {
    return state.subcategories
      .filter((s) => s.category === categoryKey)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function getSubcategory(state, id) {
    if (!id) return null;
    return state.subcategories.find((s) => s.id === id) || null;
  }

  function deleteSubcategory(state, id) {
    const expenseCount = state.expenses.filter((e) => e.subcategoryId === id).length;
    const incomeCount = state.income.filter((i) => i.subcategoryId === id).length;
    const budgetCount = state.budgets.filter((b) => b.subcategoryId === id).length;
    return { expenseCount, incomeCount, budgetCount };
  }

  function effectiveIconFor(item, state) {
    if (item.icon) return item.icon;
    if (item.subcategoryId) {
      const sub = getSubcategory(state, item.subcategoryId);
      if (sub) return sub.icon;
    }
    const cat = CATEGORIES[item.category];
    return cat ? cat.icon : '📦';
  }

  // ---------- Presupuestos ----------
  function appliesBudgetToMonth(budget, monthKey) {
    const monthStart = firstOfMonth(monthKey);
    const monthEnd = lastOfMonth(monthKey);
    if (budget.startDate) {
      const start = parseISODate(budget.startDate);
      if (start > monthEnd) return false;
      if (budget.endDate) {
        const end = parseISODate(budget.endDate);
        if (end < monthStart) return false;
      }
    }
    return true;
  }

  function getBudgetsForMonth(state, monthKey) {
    return state.budgets
      .filter((b) => appliesBudgetToMonth(b, monthKey))
      .map((b) => ({
        ...b,
        effectiveIcon: b.icon || effectiveIconFor(b, state)
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.amount - b.amount);
  }

  /**
   * Devuelve el progreso de cada presupuesto en el mes:
   * - budget, spent, free, pct
   * - spent = suma de gastos (confirmados o automáticos) que coincidan
   *   en categoría (y subcategoría si el presupuesto la tiene fijada).
   * - Si el gasto es opcional y no está confirmado, NO cuenta.
   * - Si el gasto es variable y tiene targetMonth != monthKey, no cuenta.
   * - Si el gasto es único y su mes (target o fecha) != monthKey, no cuenta.
   */
  function getBudgetProgress(state, monthKey) {
    const { expenses } = getItemsForMonth(state, monthKey);
    const result = [];
    const budgets = getBudgetsForMonth(state, monthKey);
    budgets.forEach((b) => {
      const spent = expenses
        .filter((e) => e.budgetId === b.id && (e.type === 'variable' || e.type === 'unico' || e.type === 'temporary'))
        .reduce((s, e) => s + (e.effectiveAmount || 0), 0);
      const free = (b.amount || 0) - spent;
      const pct = b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0;
      result.push({
        budget: b,
        spent,
        free,
        pct,
        over: spent > b.amount
      });
    });
    return result;
  }

  function summarizeBudgets(state, monthKey) {
    const progress = getBudgetProgress(state, monthKey);
    const totalAssigned = progress.reduce((s, p) => s + (p.budget.amount || 0), 0);
    const totalSpent = progress.reduce((s, p) => s + p.spent, 0);
    const totalFree = totalAssigned - totalSpent;
    return { totalAssigned, totalSpent, totalFree, count: progress.length };
  }

  // ---------- Tarjetas de crédito revolving ----------
  function appliesCreditCardToMonth(card, monthKey) {
    if (card.inactive) return false;
    const monthStart = firstOfMonth(monthKey);
    const monthEnd = lastOfMonth(monthKey);
    if (card.startDate) {
      const start = parseISODate(card.startDate);
      if (start > monthEnd) return false;
    }
    if (card.installmentStartMonth && monthKey < card.installmentStartMonth) return false;
    if (card.installments > 0 && card.installmentStartMonth) {
      const endMonth = addMonths(card.installmentStartMonth, card.installments - 1);
      if (monthKey > endMonth) return false;
    }
    return true;
  }

  function getCreditCardsForMonth(state, monthKey) {
    return state.creditCards
      .filter((c) => appliesCreditCardToMonth(c, monthKey))
      .map((c) => ({
        ...c,
        availableCredit: Math.max(0, c.maxLimit - c.currentBalance),
        effectiveIcon: c.icon || '💳'
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function getCreditCardProgress(state, cardId, monthKey) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return null;
    const isPaid = !!(card.paidMonths && card.paidMonths[monthKey]);
    const isSkipped = !!(card.skippedMonths && card.skippedMonths[monthKey]);
    return {
      card,
      isPaid,
      isSkipped,
      isActive: appliesCreditCardToMonth(card, monthKey),
      availableCredit: Math.max(0, card.maxLimit - card.currentBalance)
    };
  }

  function summarizeCreditCards(state) {
    const active = state.creditCards.filter((c) => !c.inactive);
    const totalLimit = active.reduce((s, c) => s + c.maxLimit, 0);
    const totalBalance = active.reduce((s, c) => s + c.currentBalance, 0);
    const totalAvailable = Math.max(0, totalLimit - totalBalance);
    return {
      count: active.length,
      totalLimit,
      totalBalance,
      totalAvailable
    };
  }

  /**
   * Busca presupuestos existentes para la misma categoría que se solapen en fechas.
   * Sirve para detectar conflictos en la conversión.
   */
  function findConflictingBudget(state, category, subcategoryId, startDate, endDate, excludeId) {
    return state.budgets.find((b) => {
      if (b.id === excludeId) return false;
      if (b.category !== category) return false;
      if ((b.subcategoryId || null) !== (subcategoryId || null)) return false;
      // Comprobar solapamiento: si no hay start/end en uno o en otro, considerar solape
      const a1 = startDate ? parseISODate(startDate) : null;
      const a2 = endDate ? parseISODate(endDate) : null;
      const b1 = b.startDate ? parseISODate(b.startDate) : null;
      const b2 = b.endDate ? parseISODate(b.endDate) : null;
      if (!a1 && !a2) return true; // ambos sin fecha = siempre solapan
      if (!b1 && !b2) return true;
      const aS = a1 || new Date(-8640000000000000);
      const aE = a2 || new Date(8640000000000000);
      const bS = b1 || new Date(-8640000000000000);
      const bE = b2 || new Date(8640000000000000);
      return aS <= bE && bS <= aE;
    }) || null;
  }

  // ---------- Formato de moneda ----------
  function formatMoney(amount, currency) {
    const c = currency || 'EUR';
    const symbol = c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$';
    const fixed = (Math.round(amount * 100) / 100);
    const sign = fixed < 0 ? '-' : '';
    const abs = Math.abs(fixed);

    if (c === 'EUR' || c === 'GBP') {
      const intPart = Math.floor(abs);
      const decPart = Math.round((abs - intPart) * 100);
      const intStr = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const decStr = String(decPart).padStart(2, '0');
      return `${sign}${intStr},${decStr} ${symbol}`;
    } else {
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
    ICON_OPTIONS,
    newState,
    normalizeExpense,
    normalizeIncome,
    normalizeSubcategory,
    normalizeBudget,
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
    togglePendingMonth,
    getPendingMandatory,
    effectiveAmountAt,
    getSubcategoriesForCategory,
    getSubcategory,
    deleteSubcategory,
    effectiveIconFor,
    appliesBudgetToMonth,
    getBudgetsForMonth,
    getBudgetProgress,
    summarizeBudgets,
    findConflictingBudget,
    normalizeCreditCard,
    appliesCreditCardToMonth,
    getCreditCardsForMonth,
    getCreditCardProgress,
    summarizeCreditCards,
    // normalizeBalanceEntry,
    // getLatestBalance,
    uuid
  };
})(window);
