/* ============================================
   tests/actions.test.js - Tests exhaustivos de actions.js
   ============================================ */

function freshState() {
  return M.newState();
}

suite('Actions · Gastos (createExpense)', () => {
  test('crea gasto válido', () => {
    const s = A.createExpense(freshState(), {
      name: 'Comida', amount: 50, type: 'fixed', category: 'comida'
    });
    assertEqual(s.expenses.length, 1);
    assertEqual(s.expenses[0].name, 'Comida');
    assertEqual(s.expenses[0].amount, 50);
  });

  test('lanza error si nombre está vacío', () => {
    assertThrows(
      () => A.createExpense(freshState(), { name: '', amount: 50, type: 'fixed', category: 'comida' }),
      /Concepto vacío/
    );
    assertThrows(
      () => A.createExpense(freshState(), { name: '   ', amount: 50, type: 'fixed', category: 'comida' }),
      /Concepto vacío/
    );
  });

  test('lanza error si importe es inválido', () => {
    assertThrows(
      () => A.createExpense(freshState(), { name: 'X', type: 'fixed', category: 'comida' }),
      /Importe no válido/
    );
    assertThrows(
      () => A.createExpense(freshState(), { name: 'X', amount: -10, type: 'fixed', category: 'comida' }),
      /Importe no válido/
    );
    assertThrows(
      () => A.createExpense(freshState(), { name: 'X', amount: NaN, type: 'fixed', category: 'comida' }),
      /Importe no válido/
    );
  });

  test('lanza error si categoría falta', () => {
    assertThrows(
      () => A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: '' }),
      /Categoría no especificada/
    );
  });

  test('acepta importe 0', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 0, type: 'fixed', category: 'extras' });
    assertEqual(s.expenses[0].amount, 0);
  });

  test('no muta el estado original', () => {
    const s0 = freshState();
    const s1 = A.createExpense(s0, { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    assertEqual(s0.expenses.length, 0);
    assertEqual(s1.expenses.length, 1);
  });
});

suite('Actions · Gastos (updateExpense)', () => {
  test('actualiza gasto existente', () => {
    const s0 = freshState();
    const s1 = A.createExpense(s0, { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const id = s1.expenses[0].id;
    const s2 = A.updateExpense(s1, id, { name: 'Y', amount: 20, type: 'fixed', category: 'extras' });
    assertEqual(s2.expenses.length, 1);
    assertEqual(s2.expenses[0].name, 'Y');
    assertEqual(s2.expenses[0].amount, 20);
  });

  test('lanza error si gasto no existe', () => {
    assertThrows(
      () => A.updateExpense(freshState(), 'fake-id', { name: 'X', amount: 10, type: 'fixed', category: 'extras' }),
      /Gasto no encontrado/
    );
  });

  test('lanza error en validación aunque gasto exista', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    assertThrows(
      () => A.updateExpense(s, s.expenses[0].id, { name: '', amount: 10, type: 'fixed', category: 'extras' }),
      /Concepto vacío/
    );
  });
});

suite('Actions · Gastos (deleteExpense)', () => {
  test('elimina gasto existente', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const s2 = A.deleteExpense(s, s.expenses[0].id);
    assertEqual(s2.expenses.length, 0);
  });

  test('desvincula gasto de tarjeta si tiene creditCardId', () => {
    const c = M.normalizeCreditCard({ name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const s1 = { ...s0, creditCards: s0.creditCards };
    const cardId = c.id;
    const e = M.normalizeExpense({ name: 'X', amount: 10, type: 'variable', category: 'extras', creditCardId: cardId });
    const s2 = A.createExpense(s1, e);
    const s3 = A.deleteExpense(s2, e.id);
    assertEqual(s3.expenses.length, 0);
  });

  test('lanza error si gasto no existe', () => {
    assertThrows(
      () => A.deleteExpense(freshState(), 'fake-id'),
      /Gasto no encontrado/
    );
  });
});

suite('Actions · togglePaid', () => {
  test('marca como pagado', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', optional: true, category: 'extras' });
    const id = s.expenses[0].id;
    const s2 = A.togglePaid(s, id, '2024-06');
    assertEqual(s2.expenses[0].paidMonths['2024-06'], true);
  });

  test('desmarca', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', optional: true, category: 'extras' });
    const id = s.expenses[0].id;
    const s2 = A.togglePaid(s, id, '2024-06');
    const s3 = A.togglePaid(s2, id, '2024-06');
    assertEqual(s3.expenses[0].paidMonths['2024-06'], undefined);
  });

  test('si gasto no existe, devuelve mismo estado', () => {
    const s = freshState();
    const s2 = A.togglePaid(s, 'fake-id', '2024-06');
    assertEqual(s2, s);
  });
});

suite('Actions · toggleSkipped', () => {
  test('marca como saltado', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', optional: true, category: 'extras' });
    const id = s.expenses[0].id;
    const s2 = A.toggleSkipped(s, id, '2024-06');
    assertEqual(s2.expenses[0].skippedMonths['2024-06'], true);
  });

  test('desmarca', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', optional: true, category: 'extras' });
    const id = s.expenses[0].id;
    const s2 = A.toggleSkipped(s, id, '2024-06');
    const s3 = A.toggleSkipped(s2, id, '2024-06');
    assertEqual(s3.expenses[0].skippedMonths['2024-06'], undefined);
  });
});

suite('Actions · togglePendingMandatory', () => {
  test('marca pendiente', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'deudas' });
    const id = s.expenses[0].id;
    const s2 = A.togglePendingMandatory(s, id, '2024-06');
    assertEqual(s2.expenses[0].pendingMonths['2024-06'], true);
  });

  test('marcar pendiente quita el paidMonths', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'deudas' });
    const id = s.expenses[0].id;
    const s2 = A.updateExpense(s, id, { paidMonths: { '2024-06': true } });
    const s3 = A.togglePendingMandatory(s2, id, '2024-06');
    assertEqual(s3.expenses[0].pendingMonths['2024-06'], true);
    assertEqual(s3.expenses[0].paidMonths['2024-06'], undefined);
  });
});

suite('Actions · toggleInactive', () => {
  test('alterna inactivo', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const id = s.expenses[0].id;
    const s2 = A.toggleInactive(s, id);
    assertEqual(s2.expenses[0].inactive, true);
    const s3 = A.toggleInactive(s2, id);
    assertEqual(s3.expenses[0].inactive, false);
  });
});

suite('Actions · convertExpenseToBudget', () => {
  test('convierte gasto fijo en presupuesto nuevo', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 100, type: 'fixed', category: 'comida' });
    const id = s.expenses[0].id;
    const s2 = A.convertExpenseToBudget(s, id, '2024-06');
    assertEqual(s2.expenses.length, 0);
    assertEqual(s2.budgets.length, 1);
    assertEqual(s2.budgets[0].amount, 100);
    assertEqual(s2.budgets[0].category, 'comida');
  });

  test('reemplaza presupuesto existente en conflicto', () => {
    const s0 = freshState();
    const s1 = A.createBudget(s0, { category: 'comida', amount: 200 });
    const s2 = A.createExpense(s1, { name: 'X', amount: 50, type: 'fixed', category: 'comida' });
    const s3 = A.convertExpenseToBudget(s2, s2.expenses[0].id, '2024-06');
    assertEqual(s3.budgets.length, 1);
    assertEqual(s3.budgets[0].amount, 50);
    assertEqual(s3.expenses.length, 0);
  });

  test('no convierte gasto variable', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 100, type: 'variable', category: 'comida' });
    const s2 = A.convertExpenseToBudget(s, s.expenses[0].id, '2024-06');
    assertEqual(s2.expenses.length, 1);
    assertEqual(s2.budgets.length, 0);
  });
});

suite('Actions · convertExpenseToUnico', () => {
  test('convierte a unico', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const id = s.expenses[0].id;
    const s2 = A.convertExpenseToUnico(s, id, '2024-06');
    assertEqual(s2.expenses[0].type, 'unico');
    assertEqual(s2.expenses[0].targetMonth, '2024-06');
    assertEqual(s2.expenses[0].oneTime, true);
    assertEqual(s2.expenses[0].optional, false);
    assertEqual(s2.expenses[0].paidMonths, {});
    assertEqual(s2.expenses[0].skippedMonths, {});
    assertEqual(s2.expenses[0].pendingMonths, {});
  });
});

suite('Actions · payPendingDebt', () => {
  test('crea gasto de liquidación', () => {
    const s = A.createExpense(freshState(), { name: 'X', amount: 100, type: 'fixed', category: 'deudas' });
    const id = s.expenses[0].id;
    const s2 = A.togglePendingMandatory(s, id, '2024-05');
    const s3 = A.payPendingDebt(s2, id, '2024-05', '2024-06');
    assertEqual(s3.expenses.length, 1);  // el gasto original ya tiene paidMonths
    assertEqual(s3.income.length, 1);
    assertEqual(s3.income[0].amount, 100);
    assertEqual(s3.income[0].targetMonth, '2024-06');
  });

  test('lanza error si gasto no existe', () => {
    assertThrows(
      () => A.payPendingDebt(freshState(), 'fake-id', '2024-05', '2024-06'),
      /Gasto no encontrado/
    );
  });
});

suite('Actions · Ingresos', () => {
  test('createIncome valida', () => {
    assertThrows(() => A.createIncome(freshState(), { name: '', amount: 100, type: 'recurring', category: 'nomina' }), /Concepto vacío/);
    assertThrows(() => A.createIncome(freshState(), { name: 'X', type: 'recurring', category: 'nomina' }), /Importe no válido/);
    assertThrows(() => A.createIncome(freshState(), { name: 'X', amount: 100, type: 'recurring', category: '' }), /Categoría no especificada/);
  });

  test('updateIncome modifica', () => {
    const s = A.createIncome(freshState(), { name: 'X', amount: 100, type: 'recurring', category: 'nomina' });
    const id = s.income[0].id;
    const s2 = A.updateIncome(s, id, { name: 'Y', amount: 200, type: 'recurring', category: 'nomina' });
    assertEqual(s2.income[0].name, 'Y');
    assertEqual(s2.income[0].amount, 200);
  });

  test('updateIncome falla si no existe', () => {
    assertThrows(() => A.updateIncome(freshState(), 'fake-id', { name: 'X', amount: 10, type: 'recurring', category: 'nomina' }), /Ingreso no encontrado/);
  });

  test('deleteIncome elimina', () => {
    const s = A.createIncome(freshState(), { name: 'X', amount: 100, type: 'recurring', category: 'nomina' });
    const id = s.income[0].id;
    const s2 = A.deleteIncome(s, id);
    assertEqual(s2.income.length, 0);
  });

  test('deleteIncome falla si no existe', () => {
    assertThrows(() => A.deleteIncome(freshState(), 'fake-id'), /Ingreso no encontrado/);
  });
});

suite('Actions · Presupuestos', () => {
  test('createBudget valida', () => {
    assertThrows(() => A.createBudget(freshState(), { category: '', amount: 100 }), /Categoría no especificada/);
    assertThrows(() => A.createBudget(freshState(), { category: 'comida', amount: -10 }), /Importe no válido/);
  });

  test('updateBudget modifica', () => {
    const s = A.createBudget(freshState(), { category: 'comida', amount: 100 });
    const id = s.budgets[0].id;
    const s2 = A.updateBudget(s, id, { category: 'comida', amount: 200 });
    assertEqual(s2.budgets[0].amount, 200);
  });

  test('deleteBudget desvincula gastos', () => {
    const s0 = A.createBudget(freshState(), { category: 'comida', amount: 100 });
    const bid = s0.budgets[0].id;
    const s1 = A.createExpense(s0, { name: 'X', amount: 10, type: 'fixed', category: 'comida', budgetId: bid });
    const s2 = A.deleteBudget(s1, bid);
    assertEqual(s2.budgets.length, 0);
    assertEqual(s2.expenses[0].budgetId, null);
  });

  test('deleteBudget falla si no existe', () => {
    assertThrows(() => A.deleteBudget(freshState(), 'fake-id'), /Presupuesto no encontrado/);
  });
});

suite('Actions · Subcategorías', () => {
  test('createSubcategory valida', () => {
    assertThrows(() => A.createSubcategory(freshState(), { category: 'hogar', label: '', icon: '📦' }), /Nombre vacío/);
    assertThrows(() => A.createSubcategory(freshState(), { category: '', label: 'L', icon: '📦' }), /Categoría no especificada/);
  });

  test('deleteSubcategory desvincula gastos/ingresos/presupuestos', () => {
    const s0 = A.createSubcategory(freshState(), { category: 'hogar', label: 'Limpieza', icon: '🧹' });
    const sid = s0.subcategories[0].id;
    const s1 = A.createExpense(s0, { name: 'X', amount: 10, type: 'fixed', category: 'hogar', subcategoryId: sid });
    const s2 = A.deleteSubcategory(s1, sid, true);
    assertEqual(s2.subcategories.length, 0);
    assertEqual(s2.expenses[0].subcategoryId, null);
  });

  test('deleteSubcategory falla si no existe', () => {
    assertThrows(() => A.deleteSubcategory(freshState(), 'fake-id', true), /Subcategoría no encontrada/);
  });
});

suite('Actions · Tarjetas de crédito (CRUD)', () => {
  test('createCreditCard valida', () => {
    assertThrows(() => A.createCreditCard(freshState(), { name: '', maxLimit: 1000, monthlyPayment: 50, category: 'extras' }), /Nombre vacío/);
    assertThrows(() => A.createCreditCard(freshState(), { name: 'X', monthlyPayment: 50, category: 'extras' }), /Importe no válido/);
  });

  test('deleteCreditCard desvincula gastos', () => {
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const cid = s0.creditCards[0].id;
    const s1 = A.createExpense(s0, { name: 'X', amount: 10, type: 'variable', category: 'extras', creditCardId: cid });
    const s2 = A.deleteCreditCard(s1, cid);
    assertEqual(s2.creditCards.length, 0);
    assertEqual(s2.expenses[0].creditCardId, null);
  });

  test('updateCreditCard valida y modifica', () => {
    const s = A.createCreditCard(freshState(), { name: 'X', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const id = s.creditCards[0].id;
    assertThrows(() => A.updateCreditCard(s, id, { name: '', maxLimit: 1000, monthlyPayment: 50, category: 'extras' }), /Nombre vacío/);
    const s2 = A.updateCreditCard(s, id, { name: 'Y', maxLimit: 2000, monthlyPayment: 50, category: 'extras' });
    assertEqual(s2.creditCards[0].name, 'Y');
    assertEqual(s2.creditCards[0].maxLimit, 2000);
  });

  test('deleteCreditCard falla si no existe', () => {
    assertThrows(() => A.deleteCreditCard(freshState(), 'fake-id'), /Tarjeta no encontrada/);
  });

  test('payCreditCardMonth marca mes', () => {
    const s = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const id = s.creditCards[0].id;
    const s2 = A.payCreditCardMonth(s, id, '2024-06');
    assertEqual(s2.creditCards[0].paidMonths['2024-06'], true);
  });

  test('skipCreditCardMonth marca mes', () => {
    const s = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const id = s.creditCards[0].id;
    const s2 = A.skipCreditCardMonth(s, id, '2024-06');
    assertEqual(s2.creditCards[0].skippedMonths['2024-06'], true);
  });

  test('updateCreditCardBalance actualiza', () => {
    const s = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const id = s.creditCards[0].id;
    const s2 = A.updateCreditCardBalance(s, id, 750);
    assertEqual(s2.creditCards[0].currentBalance, 750);
  });

  test('toggleCreditCardInactive alterna', () => {
    const s = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const id = s.creditCards[0].id;
    const s2 = A.toggleCreditCardInactive(s, id);
    assertEqual(s2.creditCards[0].inactive, true);
  });

  test('addExtraPayment crea gasto y reduce saldo', () => {
    const s = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const id = s.creditCards[0].id;
    const s2 = A.addExtraPayment(s, id, 200, '2024-06');
    assertEqual(s2.creditCards[0].currentBalance, 0);  // 200 was capped at 0
    assertEqual(s2.expenses.length, 1);
    assertEqual(s2.expenses[0].isExtraPayment, true);
    assertEqual(s2.expenses[0].creditCardId, id);
  });

  test('addExtraPayment falla si no existe la tarjeta', () => {
    assertThrows(() => A.addExtraPayment(freshState(), 'fake-id', 100, '2024-06'), /Tarjeta no encontrada/);
  });
});

suite('Actions · Tarjetas (gasto con tarjeta)', () => {
  test('crear gasto con tarjeta aumenta saldo', () => {
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({ name: 'Compra', amount: 100, type: 'variable', category: 'extras', creditCardId: cid });
    const s = A.createExpense(s0, e);
    assertEqual(s.creditCards[0].currentBalance, 100);
  });

  test('crear gasto con tarjeta y cambiar a otra tarjeta ajusta ambos saldos', () => {
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const s1 = A.createCreditCard(s0, { name: 'MC', maxLimit: 2000, monthlyPayment: 80, category: 'extras' });
    const cid1 = s1.creditCards[0].id;
    const cid2 = s1.creditCards[1].id;
    const e = M.normalizeExpense({ name: 'X', amount: 100, type: 'variable', category: 'extras', creditCardId: cid1 });
    const s2 = A.createExpense(s1, e);
    assertEqual(s2.creditCards[0].currentBalance, 100);  // Visa
    assertEqual(s2.creditCards[1].currentBalance, 0);    // MC

    // Cambiar a MC
    e.id = s2.expenses[0].id;
    const s3 = A.updateExpense(s2, e.id, { ...e, creditCardId: cid2 });
    assertEqual(s3.creditCards[0].currentBalance, 0);    // Visa
    assertEqual(s3.creditCards[1].currentBalance, 100);  // MC
  });

  test('pago extra no aumenta saldo de tarjeta', () => {
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({ name: 'Pago', amount: 100, type: 'variable', category: 'extras', creditCardId: cid, isExtraPayment: true });
    const s = A.createExpense(s0, e);
    assertEqual(s.creditCards[0].currentBalance, 0);  // se resta
  });

  test('eliminar gasto con tarjeta desvincula y reduce saldo', () => {
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({ name: 'Compra', amount: 200, type: 'variable', category: 'extras', creditCardId: cid });
    const s = A.createExpense(s0, e);
    assertEqual(s.creditCards[0].currentBalance, 200);
    const s2 = A.deleteExpense(s, e.id);
    assertEqual(s2.creditCards[0].currentBalance, 0);
  });

  test('payPendingDebt con gasto de tarjeta crea extra payment que reduce saldo', () => {
    const s0 = A.createCreditCard(freshState(), { name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras' });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({ name: 'Cuota', amount: 100, type: 'fixed', category: 'extras', creditCardId: cid });
    const s = A.createExpense(s0, e);
    A.togglePendingMandatory(s, e.id, '2024-05');
    const s2 = A.payPendingDebt(s, e.id, '2024-05', '2024-06');
    // El pago se hace con el saldo inicial (que ya está en el sistema como gasto)
    // La extra payment creada reduce el saldo
    assertEqual(s2.creditCards[0].currentBalance, 0);
  });
});

suite('Actions · Settings y datos', () => {
  test('updateSettings cambia currency', () => {
    const s = A.updateSettings(freshState(), { currency: 'USD' });
    assertEqual(s.settings.currency, 'USD');
  });

  test('updateSettings normaliza theme inválido', () => {
    const s = A.updateSettings(freshState(), { theme: 'rainbow' });
    assertEqual(s.settings.theme, 'auto');
  });

  test('resetState devuelve schema v2 vacío', () => {
    const s0 = A.createExpense(freshState(), { name: 'X', amount: 10, type: 'fixed', category: 'extras' });
    const s = A.resetState();
    assertEqual(s.expenses.length, 0);
  });

  test('seedExampleData añade datos', () => {
    const s = A.seedExampleData(freshState());
    assert(s.expenses.length > 0);
    assert(s.income.length > 0);
    assert(s.budgets.length > 0);
    assert(s.subcategories.length > 0);
  });

  test('seedExampleData preserva datos existentes', () => {
    const e0 = M.normalizeExpense({ name: 'mio', amount: 1, type: 'fixed', category: 'extras' });
    const s0 = { ...freshState(), expenses: [e0] };
    const s = A.seedExampleData(s0);
    assert(s.expenses.some((x) => x.id === e0.id));
  });

  test('applyImport replace', () => {
    const imported = M.newState();
    const e = M.normalizeExpense({ name: 'imp', amount: 1, type: 'fixed', category: 'extras' });
    imported.expenses = [e];
    const s = A.applyImport(freshState(), imported, 'replace');
    assertEqual(s.expenses.length, 1);
    assertEqual(s.expenses[0].name, 'imp');
  });

  test('applyImport merge suma por id', () => {
    const e1 = M.normalizeExpense({ name: 'A', amount: 1, type: 'fixed', category: 'extras' });
    const e2 = M.normalizeExpense({ name: 'B', amount: 2, type: 'fixed', category: 'extras' });
    const imported = M.newState();
    imported.expenses = [e2];
    const s0 = { ...freshState(), expenses: [e1] };
    const s = A.applyImport(s0, imported, 'merge');
    assertEqual(s.expenses.length, 2);
    assert(s.expenses.some((x) => x.name === 'A'));
    assert(s.expenses.some((x) => x.name === 'B'));
  });
});
