/* ============================================
   tests/actions.test.js - Tests para actions.js
   ============================================ */

function freshState() {
  return M.newState();
}

suite('Actions · togglePaid', () => {

  test('marca como pagado un mes', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.togglePaid(s0, e.id, '2024-06');
    assertEqual(s1.expenses[0].paidMonths['2024-06'], true);
  });

  test('desmarca un mes pagado', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01', paidMonths: { '2024-06': true } });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.togglePaid(s0, e.id, '2024-06');
    assertEqual(s1.expenses[0].paidMonths['2024-06'], undefined);
  });

  test('no muta el estado original', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.togglePaid(s0, e.id, '2024-06');
    assertEqual(s0.expenses[0].paidMonths, {});
    assertEqual(s1.expenses[0].paidMonths['2024-06'], true);
    assert(s0 !== s1);
  });

  test('id inexistente devuelve mismo estado', () => {
    const s0 = freshState();
    const s1 = A.togglePaid(s0, 'no-existe', '2024-06');
    assertEqual(s1, s0);
  });
});

suite('Actions · toggleSkipped', () => {

  test('marca y desmarca', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.toggleSkipped(s0, e.id, '2024-06');
    assertEqual(s1.expenses[0].skippedMonths['2024-06'], true);
    const s2 = A.toggleSkipped(s1, e.id, '2024-06');
    assertEqual(s2.expenses[0].skippedMonths['2024-06'], undefined);
  });
});

suite('Actions · togglePendingMandatory', () => {

  test('marca como pendiente', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.togglePendingMandatory(s0, e.id, '2024-06');
    assertEqual(s1.expenses[0].pendingMonths['2024-06'], true);
  });

  test('marcar pendiente borra paidMonths de ese mes', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01', paidMonths: { '2024-06': true } });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.togglePendingMandatory(s0, e.id, '2024-06');
    assertEqual(s1.expenses[0].pendingMonths['2024-06'], true);
    assertEqual(s1.expenses[0].paidMonths['2024-06'], undefined);
  });

  test('desmarcar pendiente no restaura paidMonths', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01', paidMonths: { '2024-06': true } });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.togglePendingMandatory(s0, e.id, '2024-06');
    const s2 = A.togglePendingMandatory(s1, e.id, '2024-06');
    assertEqual(s2.expenses[0].pendingMonths['2024-06'], undefined);
    assertEqual(s2.expenses[0].paidMonths['2024-06'], undefined);
  });
});

suite('Actions · toggleInactive', () => {

  test('alterna inactivo', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.toggleInactive(s0, e.id);
    assertEqual(s1.expenses[0].inactive, true);
    const s2 = A.toggleInactive(s1, e.id);
    assertEqual(s2.expenses[0].inactive, false);
  });
});

suite('Actions · payPendingDebt', () => {

  test('marca mes como pagado y elimina pendiente', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'fixed', category: 'extras', startDate: '2024-01-01', pendingMonths: { '2024-06': true } });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.payPendingDebt(s0, e.id, '2024-06', '2024-07');
    assertEqual(s1.expenses[0].pendingMonths['2024-06'], undefined);
    assertEqual(s1.expenses[0].paidMonths['2024-06'], true);
  });

  test('crea gasto de liquidación unico en el mes actual', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'fixed', category: 'extras', startDate: '2024-01-01', pendingMonths: { '2024-06': true } });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.payPendingDebt(s0, e.id, '2024-06', '2024-07');
    assertEqual(s1.expenses.length, 2);
    const catchUp = s1.expenses[1];
    assertEqual(catchUp.type, 'unico');
    assertEqual(catchUp.targetMonth, '2024-07');
    assertEqual(catchUp.amount, 50);
    assert(catchUp.name.includes('pago de'));
  });

  test('preserva budgetId en el gasto de liquidación', () => {
    const b = M.normalizeBudget({ category: 'extras', amount: 300, startDate: '2024-01-01' });
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'fixed', category: 'extras', startDate: '2024-01-01', pendingMonths: { '2024-06': true }, budgetId: b.id });
    const s0 = { ...freshState(), expenses: [e], budgets: [b] };
    const s1 = A.payPendingDebt(s0, e.id, '2024-06', '2024-07');
    assertEqual(s1.expenses[1].budgetId, b.id);
  });
});

suite('Actions · CRUD gastos', () => {

  test('createExpense añade gasto normalizado', () => {
    const s0 = freshState();
    const s1 = A.createExpense(s0, { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    assertEqual(s1.expenses.length, 1);
    assertEqual(s1.expenses[0].name, 'X');
  });

  test('updateExpense modifica campos', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.updateExpense(s0, e.id, { name: 'Y', amount: 20 });
    assertEqual(s1.expenses[0].name, 'Y');
    assertEqual(s1.expenses[0].amount, 20);
  });

  test('deleteExpense elimina', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.deleteExpense(s0, e.id);
    assertEqual(s1.expenses.length, 0);
  });

  test('deleteExpense con id inexistente no rompe', () => {
    const s0 = freshState();
    const s1 = A.deleteExpense(s0, 'no-existe');
    assertEqual(s1, s0);
  });
});

suite('Actions · CRUD presupuestos', () => {

  test('createBudget añade presupuesto', () => {
    const s0 = freshState();
    const s1 = A.createBudget(s0, { category: 'comida', amount: 300 });
    assertEqual(s1.budgets.length, 1);
    assertEqual(s1.budgets[0].amount, 300);
  });

  test('deleteBudget desvincula gastos', () => {
    const b = M.normalizeBudget({ category: 'comida', amount: 300 });
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'variable', category: 'comida', targetMonth: '2024-06', budgetId: b.id });
    const s0 = { ...freshState(), budgets: [b], expenses: [e] };
    const s1 = A.deleteBudget(s0, b.id);
    assertEqual(s1.budgets.length, 0);
    assertEqual(s1.expenses[0].budgetId, null);
  });
});

suite('Actions · CRUD subcategorías', () => {

  test('createSubcategory añade', () => {
    const s0 = freshState();
    const s1 = A.createSubcategory(s0, { category: 'hogar', label: 'Limpieza', icon: '🧹' });
    assertEqual(s1.subcategories.length, 1);
  });

  test('deleteSubcategory desvincula gastos', () => {
    const s = M.normalizeSubcategory({ category: 'hogar', label: 'Limpieza', icon: '🧹' });
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'hogar', subcategoryId: s.id, startDate: '2024-01-01' });
    const s0 = { ...freshState(), subcategories: [s], expenses: [e] };
    const s1 = A.deleteSubcategory(s0, s.id, true);
    assertEqual(s1.subcategories.length, 0);
    assertEqual(s1.expenses[0].subcategoryId, null);
  });
});

suite('Actions · convertExpenseToBudget', () => {

  test('convierte gasto fijo en presupuesto', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'fixed', category: 'comida', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.convertExpenseToBudget(s0, e.id, '2024-06');
    assertEqual(s1.expenses.length, 0);
    assertEqual(s1.budgets.length, 1);
    assertEqual(s1.budgets[0].amount, 50);
    assertEqual(s1.budgets[0].category, 'comida');
  });

  test('ignora gastos que no son fixed ni temporary', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'variable', category: 'comida', targetMonth: '2024-06' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.convertExpenseToBudget(s0, e.id, '2024-06');
    assertEqual(s1.budgets.length, 0);
    assertEqual(s1.expenses.length, 1);
  });

  test('reemplaza presupuesto existente en misma categoría', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'fixed', category: 'comida', startDate: '2024-01-01' });
    const b = M.normalizeBudget({ category: 'comida', amount: 200, startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e], budgets: [b] };
    const s1 = A.convertExpenseToBudget(s0, e.id, '2024-06');
    assertEqual(s1.budgets.length, 1);
    assertEqual(s1.budgets[0].amount, 50);
  });
});

suite('Actions · convertExpenseToUnico', () => {

  test('convierte fijo a unico con targetMonth', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 50, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.convertExpenseToUnico(s0, e.id, '2024-07');
    assertEqual(s1.expenses[0].type, 'unico');
    assertEqual(s1.expenses[0].targetMonth, '2024-07');
    assertEqual(s1.expenses[0].optional, false);
  });

  test('limpia paid/skipped/pending al convertir', () => {
    const e = M.normalizeExpense({
      name: 'X', amount: 50, type: 'fixed', category: 'extras', startDate: '2024-01-01',
      paidMonths: { '2024-06': true },
      skippedMonths: { '2024-05': true },
      pendingMonths: { '2024-04': true }
    });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.convertExpenseToUnico(s0, e.id, '2024-07');
    assertEqual(s1.expenses[0].paidMonths, {});
    assertEqual(s1.expenses[0].skippedMonths, {});
    assertEqual(s1.expenses[0].pendingMonths, {});
  });
});

suite('Actions · Ajustes', () => {

  test('updateSettings cambia moneda', () => {
    const s0 = freshState();
    const s1 = A.updateSettings(s0, { currency: 'USD' });
    assertEqual(s1.settings.currency, 'USD');
  });

  test('updateSettings normaliza tema inválido', () => {
    const s0 = freshState();
    const s1 = A.updateSettings(s0, { theme: 'rainbow' });
    assertEqual(s1.settings.theme, 'auto');
  });
});

suite('Actions · Datos', () => {

  test('resetState devuelve schema v2 vacío', () => {
    const s = A.resetState();
    assertEqual(s.version, 2);
    assertEqual(s.expenses.length, 0);
    assertEqual(s.income.length, 0);
    assertEqual(s.budgets.length, 0);
    assertEqual(s.subcategories.length, 0);
  });

  test('seedExampleData añade datos', () => {
    const s0 = freshState();
    const s1 = A.seedExampleData(s0);
    assert(s1.expenses.length > 0);
    assert(s1.income.length > 0);
    assert(s1.budgets.length > 0);
    assert(s1.subcategories.length > 0);
  });

  test('seedExampleData preserva datos existentes', () => {
    const e = M.normalizeExpense({ name: 'mio', amount: 1, type: 'fixed', category: 'extras' });
    const s0 = { ...freshState(), expenses: [e] };
    const s1 = A.seedExampleData(s0);
    assert(s1.expenses.some((x) => x.id === e.id));
    assert(s1.expenses.length > 1);
  });

  test('applyImport replace', () => {
    const imported = M.newState();
    const e = M.normalizeExpense({ name: 'imp', amount: 1, type: 'fixed', category: 'extras' });
    imported.expenses = [e];
    const s0 = A.seedExampleData(freshState());
    const s1 = A.applyImport(s0, imported, 'replace');
    assertEqual(s1.expenses.length, 1);
    assertEqual(s1.expenses[0].name, 'imp');
  });

  test('applyImport merge suma por id', () => {
    const e1 = M.normalizeExpense({ name: 'A', amount: 1, type: 'fixed', category: 'extras' });
    const e2 = M.normalizeExpense({ name: 'B', amount: 2, type: 'fixed', category: 'extras' });
    const imported = M.newState();
    imported.expenses = [e2];
    const s0 = { ...freshState(), expenses: [e1] };
    const s1 = A.applyImport(s0, imported, 'merge');
    assertEqual(s1.expenses.length, 2);
    assert(s1.expenses.some((x) => x.name === 'A'));
    assert(s1.expenses.some((x) => x.name === 'B'));
  });
});

suite('Actions · Inmutabilidad', () => {

  test('ninguna acción muta el estado original', () => {
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'fixed', category: 'extras', startDate: '2024-01-01' });
    const b = M.normalizeBudget({ category: 'comida', amount: 300 });
    const s = M.normalizeSubcategory({ category: 'hogar', label: 'L', icon: '🧹' });
    const s0 = { ...freshState(), expenses: [e], budgets: [b], subcategories: [s] };
    const snapshot = JSON.stringify(s0);

    A.togglePaid(s0, e.id, '2024-06');
    A.toggleSkipped(s0, e.id, '2024-06');
    A.togglePendingMandatory(s0, e.id, '2024-06');
    A.toggleInactive(s0, e.id);
    A.payPendingDebt(s0, e.id, '2024-06', '2024-07');
    A.updateExpense(s0, e.id, { name: 'Z' });
    A.deleteExpense(s0, e.id);
    A.updateBudget(s0, b.id, { amount: 999 });
    A.deleteBudget(s0, b.id);
    A.updateSubcategory(s0, s.id, { label: 'Z' });
    A.deleteSubcategory(s0, s.id, true);
    A.updateSettings(s0, { currency: 'USD' });

    assertEqual(JSON.stringify(s0), snapshot);
  });
});
