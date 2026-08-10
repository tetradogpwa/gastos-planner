/* ============================================
   actions.js - Lógica de negocio PURA
   Todas las funciones reciben `state` y devuelven `state` nuevo.
   No tocan DOM, no leen localStorage, no generan toast.
   ============================================ */

(function (global) {
  'use strict';

  const M = global.Models;

  const _now = () => new Date().toISOString();

  function _updateInList(state, key, id, updates) {
    return {
      ...state,
      [key]: state[key].map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: _now() } : item
      )
    };
  }

  function _removeFromList(state, key, id) {
    return { ...state, [key]: state[key].filter((it) => it.id !== id) };
  }

  function _addToList(state, key, item) {
    return { ...state, [key]: [...state[key], item] };
  }

  // ---------- Gastos ----------
  function togglePaid(state, itemId, monthKey) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    const newPaidMonths = M.togglePaidMonth(
      item, monthKey, !(item.paidMonths && item.paidMonths[monthKey])
    );
    return _updateInList(state, 'expenses', itemId, { paidMonths: newPaidMonths });
  }

  function toggleSkipped(state, itemId, monthKey) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    const newSkippedMonths = M.toggleSkippedMonth(
      item, monthKey, !(item.skippedMonths && item.skippedMonths[monthKey])
    );
    return _updateInList(state, 'expenses', itemId, { skippedMonths: newSkippedMonths });
  }

  function togglePendingMandatory(state, itemId, monthKey) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    const wasPending = !!(item.pendingMonths && item.pendingMonths[monthKey]);
    const newPendingMonths = M.togglePendingMonth(item, monthKey, !wasPending);
    const updates = { pendingMonths: newPendingMonths };
    if (!wasPending && item.paidMonths && item.paidMonths[monthKey]) {
      const pm = { ...item.paidMonths };
      delete pm[monthKey];
      updates.paidMonths = pm;
    }
    return _updateInList(state, 'expenses', itemId, updates);
  }

  function toggleInactive(state, itemId) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    return _updateInList(state, 'expenses', itemId, { inactive: !item.inactive });
  }

  function payPendingDebt(state, itemId, monthKey, currentMonth) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    const amount = M.effectiveAmountAt(item, monthKey);
    const paidMonths = { ...(item.paidMonths || {}) };
    paidMonths[monthKey] = true;
    const pendingMonths = { ...(item.pendingMonths || {}) };
    delete pendingMonths[monthKey];
    let next = _updateInList(state, 'expenses', itemId, { paidMonths, pendingMonths });
    const catchUp = M.normalizeExpense({
      name: item.name + ' (pago de ' + M.monthKeyToShort(monthKey) + ')',
      amount,
      type: 'unico',
      category: item.category,
      subcategoryId: item.subcategoryId,
      budgetId: item.budgetId,
      targetMonth: currentMonth,
      startDate: M.toISODate(new Date()),
      notes: 'Liquidación de deuda pendiente'
    });
    return _addToList(next, 'expenses', catchUp);
  }

  function createExpense(state, payload) {
    const expense = M.normalizeExpense(payload);
    return _addToList(state, 'expenses', expense);
  }

  function updateExpense(state, itemId, payload) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    return _updateInList(state, 'expenses', itemId, payload);
  }

  function deleteExpense(state, itemId) {
    return _removeFromList(state, 'expenses', itemId);
  }

  function deleteExpenseBudgetLink(state, itemId) {
    return _updateInList(state, 'expenses', itemId, { budgetId: null });
  }

  function convertExpenseToBudget(state, expenseId, currentMonth) {
    const expense = state.expenses.find((e) => e.id === expenseId);
    if (!expense) return state;
    if (expense.type !== 'fixed' && expense.type !== 'temporary') return state;
    const conflict = M.findConflictingBudget(
      state, expense.category, expense.subcategoryId,
      expense.startDate, expense.endDate
    );
    let next = state;
    if (conflict) {
      next = _updateInList(state, 'budgets', conflict.id, {
        amount: expense.amount,
        icon: expense.icon || conflict.icon,
        notes: expense.notes || conflict.notes,
        subcategoryId: expense.subcategoryId || conflict.subcategoryId
      });
    } else {
      const budget = M.normalizeBudget({
        category: expense.category,
        subcategoryId: expense.subcategoryId,
        amount: expense.amount,
        icon: expense.icon || null,
        startDate: expense.startDate,
        endDate: expense.endDate,
        notes: expense.notes || ''
      });
      next = _addToList(state, 'budgets', budget);
    }
    return _removeFromList(next, 'expenses', expense.id);
  }

  function convertExpenseToUnico(state, itemId, currentMonth) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    return _updateInList(state, 'expenses', itemId, {
      type: 'unico',
      targetMonth: currentMonth,
      startDate: M.toISODate(new Date()),
      endDate: null,
      oneTime: true,
      optional: false,
      paidMonths: {},
      skippedMonths: {},
      pendingMonths: {}
    });
  }

  // ---------- Ingresos ----------
  function createIncome(state, payload) {
    const income = M.normalizeIncome(payload);
    return _addToList(state, 'income', income);
  }

  function updateIncome(state, itemId, payload) {
    const item = state.income.find((i) => i.id === itemId);
    if (!item) return state;
    return _updateInList(state, 'income', itemId, payload);
  }

  function deleteIncome(state, itemId) {
    return _removeFromList(state, 'income', itemId);
  }

  // ---------- Presupuestos ----------
  function createBudget(state, payload) {
    const budget = M.normalizeBudget(payload);
    return _addToList(state, 'budgets', budget);
  }

  function updateBudget(state, itemId, payload) {
    const item = state.budgets.find((b) => b.id === itemId);
    if (!item) return state;
    return _updateInList(state, 'budgets', itemId, payload);
  }

  function deleteBudget(state, itemId) {
    const next = _removeFromList(state, 'budgets', itemId);
    // Desvincular gastos que apunten a este presupuesto
    return {
      ...next,
      expenses: next.expenses.map((e) => e.budgetId === itemId ? { ...e, budgetId: null } : e)
    };
  }

  // ---------- Subcategorías ----------
  function createSubcategory(state, payload) {
    const sub = M.normalizeSubcategory(payload);
    return _addToList(state, 'subcategories', sub);
  }

  function updateSubcategory(state, itemId, payload) {
    const item = state.subcategories.find((s) => s.id === itemId);
    if (!item) return state;
    return _updateInList(state, 'subcategories', itemId, payload);
  }

  function deleteSubcategory(state, itemId, unlink = true) {
    const counts = M.deleteSubcategory(state, itemId);
    const total = counts.expenseCount + counts.incomeCount + counts.budgetCount;
    if (total > 0 && !unlink) return state;
    const next = _removeFromList(state, 'subcategories', itemId);
    if (total > 0) {
      return {
        ...next,
        expenses: next.expenses.map((e) => e.subcategoryId === itemId ? { ...e, subcategoryId: null } : e),
        income: next.income.map((i) => i.subcategoryId === itemId ? { ...i, subcategoryId: null } : i),
        budgets: next.budgets.map((b) => b.subcategoryId === itemId ? { ...b, subcategoryId: null } : b)
      };
    }
    return next;
  }

  // ---------- Ajustes ----------
  function updateSettings(state, updates) {
    return { ...state, settings: M.normalizeSettings(updates) };
  }

  // ---------- Tarjetas de crédito ----------
  function createCreditCard(state, payload) {
    const card = M.normalizeCreditCard(payload);
    return _addToList(state, 'creditCards', card);
  }

  function updateCreditCard(state, cardId, payload) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return state;
    return _updateInList(state, 'creditCards', cardId, payload);
  }

  function deleteCreditCard(state, cardId) {
    const next = _removeFromList(state, 'creditCards', cardId);
    return {
      ...next,
      expenses: next.expenses.filter((e) => e.creditCardId !== cardId)
    };
  }

  function payCreditCardMonth(state, cardId, monthKey) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return state;
    const paidMonths = { ...(card.paidMonths || {}) };
    paidMonths[monthKey] = true;
    return _updateInList(state, 'creditCards', cardId, { paidMonths });
  }

  function skipCreditCardMonth(state, cardId, monthKey) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return state;
    const skippedMonths = { ...(card.skippedMonths || {}) };
    skippedMonths[monthKey] = true;
    return _updateInList(state, 'creditCards', cardId, { skippedMonths });
  }

  function updateCreditCardBalance(state, cardId, newBalance) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return state;
    return _updateInList(state, 'creditCards', cardId, { currentBalance: Number(newBalance) || 0 });
  }

  // ---------- Saldo a principios de mes (DESHABILITADO) ----------
  /*
  // El saldo es el saldo inicial del mes. Se guarda en `balanceEntries`.
  // NO se añade como income (es el punto de partida, no un income adicional).
  function setBalance(state, monthKey, balance) {
    const newBalance = Number(balance) || 0;

    // 1. Actualizar o crear la entrada de saldo (una sola por mes)
    const existingEntry = (state.balanceEntries || []).find(
      (b) => b.monthKey === monthKey
    );
    let next;
    if (existingEntry) {
      next = {
        ...state,
        balanceEntries: state.balanceEntries.map((b) =>
          b.id === existingEntry.id
            ? { ...b, balance: newBalance, date: new Date().toISOString() }
            : b
        )
      };
    } else {
      const entry = M.normalizeBalanceEntry({ monthKey, balance: newBalance });
      next = _addToList(state, 'balanceEntries', entry);
    }

    // 2. Si ya existía un ingreso "Saldo" (versión anterior), eliminarlo
    // para evitar el doble-conteo (el Saldo ahora es solo el saldo inicial)
    const oldSaldoIncome = next.income.find(
      (i) => i.name === 'Saldo' && i.targetMonth === monthKey
    );
    if (oldSaldoIncome) {
      next = {
        ...next,
        income: next.income.filter((i) => i.id !== oldSaldoIncome.id)
      };
    }

    return next;
  }
  */

  function toggleCreditCardInactive(state, cardId) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return state;
    return _updateInList(state, 'creditCards', cardId, { inactive: !card.inactive });
  }

  function addExtraPayment(state, cardId, amount, monthKey) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return state;
    const today = M.toISODate(new Date());
    const extraExpense = M.normalizeExpense({
      name: card.name + ' (pago extra)',
      amount: Number(amount) || 0,
      type: 'variable',
      category: card.category,
      targetMonth: monthKey,
      startDate: today,
      creditCardId: cardId,
      isExtraPayment: true,
      notes: 'Pago extra a tarjeta'
    });
    const newBalance = Math.max(0, card.currentBalance - (Number(amount) || 0));
    const next = _addToList(state, 'expenses', extraExpense);
    return _updateInList(next, 'creditCards', cardId, { currentBalance: newBalance });
  }

  // Cuando un gasto se vincula/desvincula de una tarjeta, ajusta el saldo de la tarjeta
  // (las compras con tarjeta suben la deuda; los pagos extra la bajan).
  function _recalcCreditCardBalance(state, oldExpense, newExpense) {
    const oldId = oldExpense && oldExpense.creditCardId;
    const oldIsExtra = oldExpense && oldExpense.isExtraPayment;
    const oldAmount = oldExpense ? (oldExpense.amount || 0) : 0;
    const newId = newExpense && newExpense.creditCardId;
    const newIsExtra = newExpense && newExpense.isExtraPayment;
    const newAmount = newExpense ? (newExpense.amount || 0) : 0;
    let next = state;
    // Desvincular del anterior: si era compra la deuda baja, si era pago extra la deuda sube
    if (oldId) {
      const card = next.creditCards.find((c) => c.id === oldId);
      if (card) {
        const delta = oldIsExtra ? oldAmount : -oldAmount;
        const newBal = Math.max(0, card.currentBalance + delta);
        next = _updateInList(next, 'creditCards', oldId, { currentBalance: newBal });
      }
    }
    // Vincular al nuevo: si es compra la deuda sube, si es pago extra la deuda baja
    if (newId) {
      const card = next.creditCards.find((c) => c.id === newId);
      if (card) {
        const delta = newIsExtra ? -newAmount : newAmount;
        const newBal = Math.max(0, card.currentBalance + delta);
        next = _updateInList(next, 'creditCards', newId, { currentBalance: newBal });
      }
    }
    return next;
  }

  function createExpense(state, payload) {
    const expense = M.normalizeExpense(payload);
    let next = _addToList(state, 'expenses', expense);
    return _recalcCreditCardBalance(next, null, expense);
  }

  function updateExpense(state, itemId, payload) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    const oldItem = { ...item };
    const updated = M.normalizeExpense({ ...item, ...payload });
    let next = _updateInList(state, 'expenses', itemId, { ...payload, updatedAt: new Date().toISOString() });
    // Normalizar el item actualizado para recálculo
    const updatedNormalized = M.normalizeExpense({ ...item, ...payload });
    return _recalcCreditCardBalance(next, oldItem, updatedNormalized);
  }

  function deleteExpense(state, itemId) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return state;
    let next = _removeFromList(state, 'expenses', itemId);
    return _recalcCreditCardBalance(next, item, null);
  }

  // ---------- Datos ----------
  function resetState() {
    return M.newState();
  }

  function seedExampleData(state) {
    const subMap = {};
    const createSub = (category, label, icon) => {
      const s = M.normalizeSubcategory({ category, label, icon });
      subMap[label] = s.id;
      return s;
    };
    const subs = [
      createSub('hogar', 'Comida del hogar', '🍽️'),
      createSub('hogar', 'Limpieza', '🧹'),
      createSub('transporte', 'Gasolina', '⛽'),
      createSub('comida', 'Supermercado', '🛒'),
      createSub('ocio', 'Streaming', '🎬')
    ];
    const today = M.toISODate(new Date());
    const expenses = [
      M.normalizeExpense({ name: 'Alquiler', amount: 750, type: 'fixed', category: 'hogar', subcategoryId: subMap['Comida del hogar'], startDate: today }),
      M.normalizeExpense({ name: 'Luz', amount: 60, type: 'fixed', category: 'hogar', subcategoryId: subMap['Limpieza'], startDate: today }),
      M.normalizeExpense({ name: 'Netflix', amount: 12.99, type: 'fixed', category: 'suscripciones', startDate: today }),
      M.normalizeExpense({ name: 'Spotify', amount: 9.99, type: 'fixed', category: 'suscripciones', startDate: today }),
      M.normalizeExpense({ name: 'Seguro coche', amount: 45, type: 'temporary', category: 'seguros', startDate: today, endDate: M.toISODate(new Date(new Date().setMonth(new Date().getMonth() + 6))) }),
      M.normalizeExpense({ name: 'Gimnasio', amount: 35, type: 'fixed', category: 'salud', optional: true, startDate: today })
    ];
    const income = [
      M.normalizeIncome({ name: 'Nómina', amount: 1800, type: 'recurring', category: 'nomina', startDate: today }),
      M.normalizeIncome({ name: 'Freelance web', amount: 400, type: 'recurring', category: 'freelance', startDate: today })
    ];
    const budgets = [
      M.normalizeBudget({ category: 'comida', subcategoryId: subMap['Supermercado'], amount: 300, startDate: today }),
      M.normalizeBudget({ category: 'ocio', subcategoryId: subMap['Streaming'], amount: 30, startDate: today }),
      M.normalizeBudget({ category: 'transporte', subcategoryId: subMap['Gasolina'], amount: 90, startDate: today })
    ];
    return {
      ...state,
      expenses: [...state.expenses, ...expenses],
      income: [...state.income, ...income],
      budgets: [...state.budgets, ...budgets],
      subcategories: [...state.subcategories, ...subs]
    };
  }

  function applyImport(state, imported, mode = 'replace') {
    if (mode === 'merge') {
      const expMap = new Map(state.expenses.map((e) => [e.id, e]));
      imported.expenses.forEach((e) => expMap.set(e.id, e));
      const incMap = new Map(state.income.map((i) => [i.id, i]));
      imported.income.forEach((i) => incMap.set(i.id, i));
      const budMap = new Map(state.budgets.map((b) => [b.id, b]));
      imported.budgets.forEach((b) => budMap.set(b.id, b));
      const subMap = new Map(state.subcategories.map((s) => [s.id, s]));
      imported.subcategories.forEach((s) => subMap.set(s.id, s));
      return {
        ...state,
        expenses: Array.from(expMap.values()),
        income: Array.from(incMap.values()),
        budgets: Array.from(budMap.values()),
        subcategories: Array.from(subMap.values()),
        settings: imported.settings || state.settings
      };
    }
    return imported;
  }

  global.Actions = {
    togglePaid, toggleSkipped, togglePendingMandatory, toggleInactive,
    payPendingDebt, createExpense, updateExpense, deleteExpense, deleteExpenseBudgetLink,
    convertExpenseToBudget, convertExpenseToUnico,
    createIncome, updateIncome, deleteIncome,
    createBudget, updateBudget, deleteBudget,
    createSubcategory, updateSubcategory, deleteSubcategory,
    createCreditCard, updateCreditCard, deleteCreditCard,
    payCreditCardMonth, skipCreditCardMonth, updateCreditCardBalance,
    toggleCreditCardInactive, addExtraPayment,
    // setBalance,
    updateSettings, resetState, seedExampleData, applyImport
  };
})(window);
