/* ============================================
   tests/models.test.js - Tests para models.js
   ============================================ */

suite('Models · Normalización', () => {

  test('normalizeExpense completa con defaults', () => {
    const e = M.normalizeExpense({
      name: 'Netflix',
      amount: 12.99,
      type: 'fixed',
      category: 'suscripciones'
    });
    assertEqual(e.name, 'Netflix');
    assertEqual(e.amount, 12.99);
    assertEqual(e.type, 'fixed');
    assertEqual(e.category, 'suscripciones');
    assertEqual(e.optional, false);
    assertEqual(e.inactive, false);
    assertEqual(e.budgetId, null);
    assertEqual(e.subcategoryId, null);
    assertEqual(e.paidMonths, {});
    assertEqual(e.skippedMonths, {});
    assertEqual(e.pendingMonths, {});
    assert(typeof e.id === 'string' && e.id.length > 0);
  });

  test('normalizeExpense limpia espacios y tipos', () => {
    const e = M.normalizeExpense({
      name: '  Hola  ',
      amount: 'not-a-number',
      type: 'invalid',
      category: 'invalid'
    });
    assertEqual(e.name, 'Hola');
    assertEqual(e.amount, 0);
    assertEqual(e.type, 'fixed');
    assertEqual(e.category, 'otros');
  });

  test('normalizeExpense unico siempre oneTime=true', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 5, type: 'unico', category: 'extras' });
    assertEqual(e.oneTime, true);
  });

  test('normalizeExpense paidMonths/skippedMonths/pendingMonths aceptados', () => {
    const e = M.normalizeExpense({
      name: 'X', amount: 0, type: 'fixed', category: 'extras',
      paidMonths: { '2024-01': true },
      skippedMonths: { '2024-02': true },
      pendingMonths: { '2024-03': true }
    });
    assertEqual(e.paidMonths['2024-01'], true);
    assertEqual(e.skippedMonths['2024-02'], true);
    assertEqual(e.pendingMonths['2024-03'], true);
  });

  test('normalizeIncome normaliza tipo', () => {
    const i = M.normalizeIncome({ name: 'Nómina', amount: 1000, type: 'extra', category: 'nomina' });
    assertEqual(i.type, 'extra');
    assertEqual(i.category, 'nomina');
  });

  test('normalizeBudget normaliza', () => {
    const b = M.normalizeBudget({ category: 'comida', amount: 300 });
    assertEqual(b.amount, 300);
    assertEqual(b.category, 'comida');
    assertEqual(b.subcategoryId, null);
  });

  test('normalizeSubcategory normaliza', () => {
    const s = M.normalizeSubcategory({ category: 'hogar', label: 'Limpieza', icon: '🧹' });
    assertEqual(s.label, 'Limpieza');
    assertEqual(s.icon, '🧹');
    assertEqual(s.category, 'hogar');
  });

  test('normalizeSettings toma defaults', () => {
    const s = M.normalizeSettings({});
    assertEqual(s.currency, 'EUR');
    assertEqual(s.theme, 'auto');
    assertEqual(s.startDayOfMonth, 1);
  });

  test('normalizeSettings ignora tema inválido', () => {
    const s = M.normalizeSettings({ theme: 'rainbow' });
    assertEqual(s.theme, 'auto');
  });

  test('newState devuelve schema v2', () => {
    const s = M.newState();
    assertEqual(s.version, 2);
    assert(Array.isArray(s.expenses));
    assert(Array.isArray(s.income));
    assert(Array.isArray(s.budgets));
    assert(Array.isArray(s.subcategories));
  });
});

suite('Models · Reglas de proyección', () => {

  function exp(overrides) {
    return M.normalizeExpense(Object.assign({
      name: 'X', amount: 10, type: 'fixed', category: 'extras',
      startDate: '2024-01-01'
    }, overrides));
  }

  test('appliesToMonth fixed dentro de rango', () => {
    assertEqual(M.appliesToMonth(exp(), '2024-06'), true);
  });

  test('appliesToMonth fixed antes de startDate', () => {
    assertEqual(M.appliesToMonth(exp(), '2023-12'), false);
  });

  test('appliesToMonth fixed después de endDate', () => {
    assertEqual(M.appliesToMonth(exp({ endDate: '2024-03-01' }), '2024-05'), false);
  });

  test('appliesToMonth fixed sin startDate: desde mes actual', () => {
    const e = exp({ startDate: '' });
    assertEqual(M.appliesToMonth(e, M.todayMonthKey()), true);
    assertEqual(M.appliesToMonth(e, '2000-01'), false);
  });

  test('appliesToMonth unico con targetMonth solo aplica ese mes', () => {
    const u = M.normalizeExpense({ name: 'X', amount: 5, type: 'unico', category: 'extras', targetMonth: '2024-06' });
    assertEqual(M.appliesToMonth(u, '2024-06'), true);
    assertEqual(M.appliesToMonth(u, '2024-07'), false);
  });

  test('appliesToMonth unico con startDate aplica el mes de la fecha', () => {
    const u = M.normalizeExpense({ name: 'X', amount: 5, type: 'unico', category: 'extras', startDate: '2024-06-15' });
    assertEqual(M.appliesToMonth(u, '2024-06'), true);
    assertEqual(M.appliesToMonth(u, '2024-07'), false);
  });

  test('appliesToMonth unico pagado se mantiene', () => {
    const u = M.normalizeExpense({ name: 'X', amount: 5, type: 'unico', category: 'extras', startDate: '2024-06-15', paidMonths: { '2024-06': true } });
    assertEqual(M.appliesToMonth(u, '2024-06'), true);
  });

  test('appliesToMonth variable solo aplica en targetMonth', () => {
    const v = M.normalizeExpense({ name: 'X', amount: 5, type: 'variable', category: 'extras', targetMonth: '2024-06' });
    assertEqual(M.appliesToMonth(v, '2024-06'), true);
    assertEqual(M.appliesToMonth(v, '2024-07'), false);
  });

  test('appliesToMonth optional: solo si está pagado', () => {
    const o = exp({ optional: true });
    assertEqual(M.appliesToMonth(o, '2024-06'), false);
    assertEqual(M.appliesToMonth({ ...o, paidMonths: { '2024-06': true } }, '2024-06'), true);
  });

  test('appliesToMonth temporary respeta endDate', () => {
    const t = M.normalizeExpense({ name: 'X', amount: 5, type: 'temporary', category: 'extras', startDate: '2024-01-01', endDate: '2024-06-01' });
    assertEqual(M.appliesToMonth(t, '2024-06'), true);
    assertEqual(M.appliesToMonth(t, '2024-07'), false);
  });

  test('appliesToMonth inactive nunca aplica', () => {
    const i = M.normalizeExpense({ name: 'X', amount: 5, type: 'fixed', category: 'extras', startDate: '2024-01-01', inactive: true });
    assertEqual(M.appliesToMonth(i, '2024-06'), false);
  });

  test('appliesToMonth no-opcional con pending para ese mes no aplica', () => {
    const p = exp({ pendingMonths: { '2024-06': true } });
    assertEqual(M.appliesToMonth(p, '2024-06'), false);
  });

  test('appliesToMonth no-opcional con pending y pagado: sí aplica', () => {
    const p = exp({ pendingMonths: { '2024-06': true }, paidMonths: { '2024-06': true } });
    assertEqual(M.appliesToMonth(p, '2024-06'), true);
  });
});

suite('Models · Helpers de proyección', () => {

  function exp(overrides) {
    return M.normalizeExpense(Object.assign({
      name: 'X', amount: 10, type: 'fixed', category: 'extras',
      startDate: '2024-01-01'
    }, overrides));
  }

  test('togglePaidMonth añade y quita', () => {
    const e = exp();
    const marked = M.togglePaidMonth(e, '2024-01', true);
    assertEqual(marked['2024-01'], true);
    const unmarked = M.togglePaidMonth({ ...e, paidMonths: marked }, '2024-01', false);
    assertEqual(unmarked['2024-01'], undefined);
  });

  test('toggleSkippedMonth añade y quita', () => {
    const e = exp();
    const marked = M.toggleSkippedMonth(e, '2024-01', true);
    assertEqual(marked['2024-01'], true);
    const unmarked = M.toggleSkippedMonth({ ...e, skippedMonths: marked }, '2024-01', false);
    assertEqual(unmarked['2024-01'], undefined);
  });

  test('togglePendingMonth añade y quita', () => {
    const e = exp();
    const marked = M.togglePendingMonth(e, '2024-01', true);
    assertEqual(marked['2024-01'], true);
    const unmarked = M.togglePendingMonth({ ...e, pendingMonths: marked }, '2024-01', false);
    assertEqual(unmarked['2024-01'], undefined);
  });

  test('getItemsForMonth separa expenses de income', () => {
    const e = exp({ name: 'Gasto' });
    const i = M.normalizeIncome({ name: 'Ingreso', amount: 100, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [e], income: [i], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    const r = M.getItemsForMonth(state, '2024-06');
    assertEqual(r.expenses.length, 1);
    assertEqual(r.income.length, 1);
    assertEqual(r.all.length, 2);
  });

  test('summarize calcula totales', () => {
    const e1 = exp({ name: 'G1', amount: 30 });
    const e2 = exp({ name: 'G2', amount: 20, category: 'transporte' });
    const i = M.normalizeIncome({ name: 'Nómina', amount: 1000, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [e1, e2], income: [i], budgets: [], subcategories: [], creditCards: [], settings: M.normalizeSettings({}) };
    const s = M.summarize(state, '2024-06');
    assertEqual(s.totalExpenses, 50);
    assertEqual(s.totalIncome, 1000);
    assertEqual(s.balance, 950);
  });

  test('summarize excluye gastos con presupuesto del balance', () => {
    const b = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01' });
    const eSinBudget = exp({ name: 'Netflix', amount: 15, category: 'suscripciones' });
    const eConBudget = M.normalizeExpense({ name: 'Mercadona', amount: 50, type: 'variable', category: 'comida', targetMonth: '2024-06', budgetId: b.id });
    const i = M.normalizeIncome({ name: 'Nómina', amount: 1000, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [eSinBudget, eConBudget], income: [i], budgets: [b], subcategories: [], creditCards: [], settings: M.normalizeSettings({}) };
    const s = M.summarize(state, '2024-06');
    // totalExpenses = 15 (sin budget) + 300 (budget) = 315
    assertEqual(s.totalExpenses, 315);
    // balance = 1000 - 315 = 685
    assertEqual(s.balance, 685);
  });

  test('summarize sin presupuestos coincide con el modelo anterior', () => {
    const e1 = exp({ name: 'G1', amount: 50 });
    const i = M.normalizeIncome({ name: 'N', amount: 1000, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [e1], income: [i], budgets: [], subcategories: [], creditCards: [], settings: M.normalizeSettings({}) };
    const s = M.summarize(state, '2024-06');
    assertEqual(s.totalExpenses, 50);
    assertEqual(s.balance, 950);
  });

  test('summarize suma cuotas mensuales de tarjetas revolving', () => {
    const cc1 = M.normalizeCreditCard({ name: 'Visa', maxLimit: 3000, monthlyPayment: 100, startDate: '2024-01-01' });
    const cc2 = M.normalizeCreditCard({ name: 'Amex', maxLimit: 2000, monthlyPayment: 50, startDate: '2024-01-01' });
    const cc3 = M.normalizeCreditCard({ name: 'Inactiva', maxLimit: 1000, monthlyPayment: 999, startDate: '2024-01-01', inactive: true });
    const i = M.normalizeIncome({ name: 'N', amount: 1000, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [], income: [i], budgets: [], subcategories: [], creditCards: [cc1, cc2, cc3], settings: M.normalizeSettings({}) };
    const s = M.summarize(state, '2024-06');
    // totalExp = 100 + 50 = 150 (la inactiva no cuenta)
    assertEqual(s.totalExpenses, 150);
    assertEqual(s.balance, 850);
  });

  test('summarize no cuenta cuota de tarjeta antes de su startDate', () => {
    const cc = M.normalizeCreditCard({ name: 'Visa', maxLimit: 3000, monthlyPayment: 100, startDate: '2024-06-01' });
    const i = M.normalizeIncome({ name: 'N', amount: 1000, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [], income: [i], budgets: [], subcategories: [], creditCards: [cc], settings: M.normalizeSettings({}) };
    const s = M.summarize(state, '2024-05');
    assertEqual(s.totalExpenses, 0);
    assertEqual(s.balance, 1000);
  });

  test('summarize excluye compras con tarjeta del balance pero cuenta pagos extra', () => {
    const cc = M.normalizeCreditCard({ name: 'Visa', maxLimit: 3000, monthlyPayment: 100, startDate: '2024-01-01' });
    const compra = M.normalizeExpense({ name: 'Amazon', amount: 80, type: 'variable', category: 'extras', targetMonth: '2024-06', creditCardId: cc.id });
    const pagoExtra = M.normalizeExpense({ name: 'Visa (pago extra)', amount: 50, type: 'variable', category: 'deudas', targetMonth: '2024-06', creditCardId: cc.id, isExtraPayment: true });
    const i = M.normalizeIncome({ name: 'N', amount: 1000, type: 'recurring', category: 'nomina', startDate: '2024-01-01' });
    const state = { version: 2, expenses: [compra, pagoExtra], income: [i], budgets: [], subcategories: [], creditCards: [cc], settings: M.normalizeSettings({}) };
    const s = M.summarize(state, '2024-06');
    // totalExp = 50 (pago extra) + 100 (cuota tarjeta) = 150 (la compra NO cuenta, la paga la tarjeta)
    assertEqual(s.totalExpenses, 150);
    // balance = 1000 - 150 = 850
    assertEqual(s.balance, 850);
  });

  test('isPendingOptional true cuando aplica y no pagado', () => {
    const optional = M.normalizeExpense({ name: 'X', amount: 5, type: 'fixed', category: 'extras', optional: true, startDate: '2024-01-01' });
    assertEqual(M.isPendingOptional(optional, '2024-06'), true);
  });

  test('isPendingOptional false cuando pagado', () => {
    const optional = M.normalizeExpense({ name: 'X', amount: 5, type: 'fixed', category: 'extras', optional: true, startDate: '2024-01-01', paidMonths: { '2024-06': true } });
    assertEqual(M.isPendingOptional(optional, '2024-06'), false);
  });

  test('isPendingOptional false si inactive', () => {
    const optional = M.normalizeExpense({ name: 'X', amount: 5, type: 'fixed', category: 'extras', optional: true, startDate: '2024-01-01', inactive: true });
    assertEqual(M.isPendingOptional(optional, '2024-06'), false);
  });

  test('effectiveAmountAt respeta historial', () => {
    const e = M.normalizeExpense({
      name: 'X', amount: 10, type: 'fixed', category: 'extras',
      startDate: '2024-01-01',
      amountHistory: [
        { fromDate: '2024-01-01', amount: 10 },
        { fromDate: '2024-06-01', amount: 15 }
      ]
    });
    assertEqual(M.effectiveAmountAt(e, '2024-03'), 10);
    assertEqual(M.effectiveAmountAt(e, '2024-06'), 15);
  });
});

suite('Models · Subcategorías y presupuestos', () => {

  function exp(overrides) {
    return M.normalizeExpense(Object.assign({
      name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01'
    }, overrides));
  }

  test('getSubcategoriesForCategory filtra por categoría', () => {
    const s1 = M.normalizeSubcategory({ category: 'hogar', label: 'Limpieza', icon: '🧹' });
    const s2 = M.normalizeSubcategory({ category: 'comida', label: 'Fruta', icon: '🍎' });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [s1, s2], settings: M.normalizeSettings({}) };
    const result = M.getSubcategoriesForCategory(state, 'hogar');
    assertEqual(result.length, 1);
    assertEqual(result[0].label, 'Limpieza');
  });

  test('getSubcategory devuelve por id', () => {
    const s = M.normalizeSubcategory({ category: 'hogar', label: 'Limpieza', icon: '🧹' });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [s], settings: M.normalizeSettings({}) };
    assertEqual(M.getSubcategory(state, s.id).label, 'Limpieza');
    assertEqual(M.getSubcategory(state, 'nonexistent'), null);
  });

  test('deleteSubcategory cuenta usos', () => {
    const s = M.normalizeSubcategory({ category: 'hogar', label: 'Limpieza', icon: '🧹' });
    const e = exp({ subcategoryId: s.id });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [s], settings: M.normalizeSettings({}) };
    const counts = M.deleteSubcategory(state, s.id);
    assertEqual(counts.expenseCount, 1);
  });

  test('effectiveIconFor devuelve icono de sub si item.subcategoryId', () => {
    const s = M.normalizeSubcategory({ category: 'hogar', label: 'Limpieza', icon: '🧹' });
    const e = exp({ subcategoryId: s.id });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [s], settings: M.normalizeSettings({}) };
    assertEqual(M.effectiveIconFor(e, state), '🧹');
  });

  test('effectiveIconFor devuelve icono de categoria si no hay sub', () => {
    const e = exp({ category: 'comida' });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    assertEqual(M.effectiveIconFor(e, state), '🍔');
  });

  test('appliesBudgetToMonth respeta rango', () => {
    const b = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01', endDate: '2024-06-01' });
    assertEqual(M.appliesBudgetToMonth(b, '2024-03'), true);
    assertEqual(M.appliesBudgetToMonth(b, '2024-07'), false);
  });

  test('appliesBudgetToMonth sin startDate siempre aplica', () => {
    const b = M.normalizeBudget({ category: 'comida', amount: 300 });
    assertEqual(M.appliesBudgetToMonth(b, '2024-03'), true);
  });

  test('getBudgetsForMonth filtra por mes', () => {
    const b1 = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01' });
    const b2 = M.normalizeBudget({ category: 'comida', amount: 100, startDate: '2024-12-01' });
    const state = { version: 2, expenses: [], income: [], budgets: [b1, b2], subcategories: [], settings: M.normalizeSettings({}) };
    assertEqual(M.getBudgetsForMonth(state, '2024-06').length, 1);
    assertEqual(M.getBudgetsForMonth(state, '2025-01').length, 2);
  });

  test('getBudgetProgress cuenta solo gastos variable/unico/temporary con budgetId', () => {
    const b = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01' });
    const e1 = M.normalizeExpense({ name: 'compra', amount: 50, type: 'variable', category: 'comida', targetMonth: '2024-06', budgetId: b.id });
    const e2 = M.normalizeExpense({ name: 'fijo', amount: 100, type: 'fixed', category: 'comida', startDate: '2024-01-01', budgetId: b.id });
    const e3 = M.normalizeExpense({ name: 'unico', amount: 30, type: 'unico', category: 'comida', targetMonth: '2024-06', budgetId: b.id });
    const e4 = M.normalizeExpense({ name: 'temp', amount: 20, type: 'temporary', category: 'comida', startDate: '2024-01-01', endDate: '2024-12-01', budgetId: b.id });
    const e5 = M.normalizeExpense({ name: 'sin link', amount: 40, type: 'variable', category: 'comida', targetMonth: '2024-06' });
    const state = { version: 2, expenses: [e1, e2, e3, e4, e5], income: [], budgets: [b], subcategories: [], settings: M.normalizeSettings({}) };
    const progress = M.getBudgetProgress(state, '2024-06');
    assertEqual(progress.length, 1);
    assertEqual(progress[0].spent, 100);
  });

  test('summarizeBudgets calcula totales', () => {
    const b1 = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01' });
    const b2 = M.normalizeBudget({ category: 'transporte', amount: 100, startDate: '2024-01-01' });
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'variable', category: 'comida', targetMonth: '2024-06', budgetId: b1.id });
    const state = { version: 2, expenses: [e], income: [], budgets: [b1, b2], subcategories: [], settings: M.normalizeSettings({}) };
    const s = M.summarizeBudgets(state, '2024-06');
    assertEqual(s.totalAssigned, 400);
    assertEqual(s.totalSpent, 50);
    assertEqual(s.totalFree, 350);
  });

  test('findConflictingBudget detecta solape', () => {
    const b1 = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01', endDate: '2024-12-01' });
    const state = { version: 2, expenses: [], income: [], budgets: [b1], subcategories: [], settings: M.normalizeSettings({}) };
    const conflict = M.findConflictingBudget(state, 'comida', null, '2024-06-01', '2024-12-01');
    assert(conflict !== null);
    assertEqual(conflict.id, b1.id);
  });

  test('findConflictingBudget ignora mismo id', () => {
    const b1 = M.normalizeBudget({ category: 'comida', amount: 300, startDate: '2024-01-01' });
    const state = { version: 2, expenses: [], income: [], budgets: [b1], subcategories: [], settings: M.normalizeSettings({}) };
    const conflict = M.findConflictingBudget(state, 'comida', null, '2024-06-01', null, b1.id);
    assertEqual(conflict, null);
  });
});

suite('Models · Pagos pendientes', () => {

  function exp(overrides) {
    return M.normalizeExpense(Object.assign({
      name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01'
    }, overrides));
  }

  test('getPendingMandatory muestra actual y anteriores (no futuros)', () => {
    const e = exp({ pendingMonths: { '2024-06': true } });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    assertEqual(M.getPendingMandatory(state, '2024-06').length, 1);
    assertEqual(M.getPendingMandatory(state, '2024-07').length, 1);
    assertEqual(M.getPendingMandatory(state, '2024-05').length, 0);
  });

  test('getPendingMandatory muestra meses anteriores también', () => {
    const e = exp({ pendingMonths: { '2024-06': true, '2024-04': true } });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    const result = M.getPendingMandatory(state, '2024-08');
    assertEqual(result.length, 2);
  });

  test('getPendingMandatory no muestra meses futuros', () => {
    const e = exp({ pendingMonths: { '2024-08': true } });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    assertEqual(M.getPendingMandatory(state, '2024-06').length, 0);
  });

  test('getPendingMandatory excluye pagados', () => {
    const e = exp({ pendingMonths: { '2024-06': true }, paidMonths: { '2024-06': true } });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    assertEqual(M.getPendingMandatory(state, '2024-06').length, 0);
  });

  test('getPendingMandatory excluye opcionales', () => {
    const e = exp({ optional: true, pendingMonths: { '2024-06': true } });
    const state = { version: 2, expenses: [e], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    assertEqual(M.getPendingMandatory(state, '2024-06').length, 0);
  });

  test('getPendingMandatory ordenado por mes', () => {
    const e1 = exp({ pendingMonths: { '2024-08': true } });
    const e2 = exp({ pendingMonths: { '2024-04': true } });
    const e3 = exp({ pendingMonths: { '2024-06': true } });
    const state = { version: 2, expenses: [e1, e2, e3], income: [], budgets: [], subcategories: [], settings: M.normalizeSettings({}) };
    const result = M.getPendingMandatory(state, '2024-09');
    assertEqual(result[0].monthKey, '2024-04');
    assertEqual(result[1].monthKey, '2024-06');
    assertEqual(result[2].monthKey, '2024-08');
  });
});
