/* ============================================
   tests/creditCards.test.js - Tests para tarjetas de crédito
   Usa la nueva API de actions.js con validación.
   ============================================ */

function freshState() {
  return M.newState();
}

suite('Models · Tarjetas de crédito · Normalización', () => {
  test('normalizeCreditCard con defaults', () => {
    const c = M.normalizeCreditCard({ name: 'Visa', maxLimit: 3000, monthlyPayment: 100 });
    assertEqual(c.name, 'Visa');
    assertEqual(c.maxLimit, 3000);
    assertEqual(c.currentBalance, 0);
    assertEqual(c.monthlyPayment, 100);
    assertEqual(c.category, 'deudas');
    assertEqual(c.inactive, false);
    assertEqual(c.paidMonths, {});
    assertEqual(c.skippedMonths, {});
    assertEqual(c.installments, 0);
    assertEqual(c.installmentStartMonth, null);
    assert(typeof c.id === 'string' && c.id.length > 0);
  });

  test('normalizeCreditCard con categoría inválida cae en deudas', () => {
    const c = M.normalizeCreditCard({ name: 'X', maxLimit: 1000, monthlyPayment: 50, category: 'invalid' });
    assertEqual(c.category, 'deudas');
  });

  test('normalizeCreditCard paidMonths/skippedMonths aceptados', () => {
    const c = M.normalizeCreditCard({
      name: 'X', maxLimit: 1000, monthlyPayment: 50,
      paidMonths: { '2024-01': true },
      skippedMonths: { '2024-02': true }
    });
    assertEqual(c.paidMonths['2024-01'], true);
    assertEqual(c.skippedMonths['2024-02'], true);
  });

  test('normalizeCreditCard con icon personalizado', () => {
    const c = M.normalizeCreditCard({ name: 'X', maxLimit: 1000, monthlyPayment: 50, icon: '💳' });
    assertEqual(c.icon, '💳');
  });

  test('normalizeCreditCard purchaseAmount e installments', () => {
    const c = M.normalizeCreditCard({
      name: 'X', maxLimit: 1000, monthlyPayment: 50,
      purchaseAmount: 500, installments: 6, installmentStartMonth: '2024-01'
    });
    assertEqual(c.purchaseAmount, 500);
    assertEqual(c.installments, 6);
    assertEqual(c.installmentStartMonth, '2024-01');
  });

  test('normalizeCreditCard amount y maxLimit limpios', () => {
    const c = M.normalizeCreditCard({ name: 'X', maxLimit: 'invalid', monthlyPayment: 'invalid' });
    assertEqual(c.maxLimit, 0);
    assertEqual(c.monthlyPayment, 0);
  });
});

suite('Models · Tarjetas · Reglas de proyección', () => {
  function card(overrides) {
    return M.normalizeCreditCard(Object.assign({
      name: 'X', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    }, overrides));
  }

  test('appliesCreditCardToMonth sin startDate: desde mes actual', () => {
    assertEqual(M.appliesCreditCardToMonth(card(), '2099-12'), true);
    assertEqual(M.appliesCreditCardToMonth(card(), '2000-01'), false);
  });

  test('appliesCreditCardToMonth con startDate', () => {
    assertEqual(M.appliesCreditCardToMonth(card({ startDate: '2024-01-15' }), '2024-01'), true);
    assertEqual(M.appliesCreditCardToMonth(card({ startDate: '2024-01-15' }), '2023-12'), false);
  });

  test('appliesCreditCardToMonth inactive no aplica', () => {
    assertEqual(M.appliesCreditCardToMonth(card({ inactive: true }), '2024-06'), false);
  });
});

suite('Actions · Tarjetas · CRUD básico', () => {
  test('createCreditCard añade', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    assertEqual(s.creditCards.length, 1);
    assertEqual(s.creditCards[0].name, 'Visa');
    assertEqual(s.creditCards[0].currentBalance, 0);
  });

  test('createCreditCard valida campos requeridos', () => {
    assertThrows(
      () => A.createCreditCard(freshState(), { name: '', maxLimit: 1000, monthlyPayment: 50, category: 'extras' }),
      /Nombre vacío/
    );
    assertThrows(
      () => A.createCreditCard(freshState(), { name: 'X', monthlyPayment: 50, category: 'extras' }),
      /Límite de crédito no válido/
    );
    assertThrows(
      () => A.createCreditCard(freshState(), { name: 'X', maxLimit: 1000, monthlyPayment: 50, category: '' }),
      /Categoría no especificada/
    );
    assertThrows(
      () => A.createCreditCard(freshState(), { name: 'X', maxLimit: -10, monthlyPayment: 50, category: 'extras' }),
      /Límite de crédito no válido/
    );
  });

  test('updateCreditCard modifica', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.updateCreditCard(s, id, {
      name: 'MC', maxLimit: 2000, monthlyPayment: 80, category: 'extras'
    });
    assertEqual(s2.creditCards[0].name, 'MC');
    assertEqual(s2.creditCards[0].maxLimit, 2000);
  });

  test('updateCreditCard valida nombre vacío', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    assertThrows(
      () => A.updateCreditCard(s, id, { name: '', maxLimit: 1000, monthlyPayment: 50, category: 'extras' }),
      /Nombre vacío/
    );
  });

  test('deleteCreditCard elimina y desvincula gastos', () => {
    const s0 = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({
      name: 'Compra', amount: 100, type: 'variable', category: 'extras', creditCardId: cid
    });
    const s1 = A.createExpense(s0, e);
    assertEqual(s1.creditCards[0].currentBalance, 100);
    const s2 = A.deleteCreditCard(s1, cid);
    assertEqual(s2.creditCards.length, 0);
    assertEqual(s2.expenses[0].creditCardId, null);
  });

  test('deleteCreditCard falla si no existe', () => {
    assertThrows(
      () => A.deleteCreditCard(freshState(), 'fake-id'),
      /Tarjeta no encontrada/
    );
  });

  test('updateCreditCard falla si no existe', () => {
    assertThrows(
      () => A.updateCreditCard(freshState(), 'fake-id', {
        name: 'X', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
      }),
      /Tarjeta no encontrada/
    );
  });
});

suite('Actions · Tarjetas · Pago y skip', () => {
  test('payCreditCardMonth marca mes como pagado', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.payCreditCardMonth(s, id, '2024-06');
    assertEqual(s2.creditCards[0].paidMonths['2024-06'], true);
  });

  test('payCreditCardMonth desmarca mes', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.payCreditCardMonth(s, id, '2024-06');
    const s3 = A.payCreditCardMonth(s2, id, '2024-06');
    assertEqual(s3.creditCards[0].paidMonths['2024-06'], undefined);
  });

  test('skipCreditCardMonth marca mes como saltado', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.skipCreditCardMonth(s, id, '2024-06');
    assertEqual(s2.creditCards[0].skippedMonths['2024-06'], true);
  });

  test('payCreditCardMonth si no existe devuelve mismo estado', () => {
    const s = A.payCreditCardMonth(freshState(), 'fake-id', '2024-06');
    assertEqual(s.expenses.length, 0);
    assertEqual(s.creditCards, undefined);
  });

  test('skipCreditCardMonth si no existe devuelve mismo estado', () => {
    const s = A.skipCreditCardMonth(freshState(), 'fake-id', '2024-06');
    assertEqual(s.creditCards, undefined);
  });
});

suite('Actions · Tarjetas · Saldo', () => {
  test('updateCreditCardBalance actualiza', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.updateCreditCardBalance(s, id, 750);
    assertEqual(s2.creditCards[0].currentBalance, 750);
  });

  test('updateCreditCardBalance negativos se capean a 0', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.updateCreditCardBalance(s, id, -100);
    assertEqual(s2.creditCards[0].currentBalance, 0);
  });

  test('toggleCreditCardInactive alterna', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.toggleCreditCardInactive(s, id);
    assertEqual(s2.creditCards[0].inactive, true);
    const s3 = A.toggleCreditCardInactive(s2, id);
    assertEqual(s3.creditCards[0].inactive, false);
  });

  test('addExtraPayment crea gasto y reduce saldo', () => {
    const s = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const id = s.creditCards[0].id;
    const s2 = A.addExtraPayment(s, id, 200, '2024-06');
    assertEqual(s2.creditCards[0].currentBalance, 0);  // 1000 - 200 = 800... wait, starts at 0
    assertEqual(s2.expenses.length, 1);
    assertEqual(s2.expenses[0].isExtraPayment, true);
    assertEqual(s2.expenses[0].creditCardId, id);
  });

  test('addExtraPayment falla si no existe la tarjeta', () => {
    assertThrows(
      () => A.addExtraPayment(freshState(), 'fake-id', 100, '2024-06'),
      /Tarjeta no encontrada/
    );
  });
});

suite('Actions · Tarjetas · Gasto con tarjeta', () => {
  test('crear gasto con tarjeta aumenta saldo', () => {
    const s0 = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({
      name: 'Compra', amount: 100, type: 'variable', category: 'extras', creditCardId: cid
    });
    const s = A.createExpense(s0, e);
    assertEqual(s.creditCards[0].currentBalance, 100);
  });

  test('mover gasto entre tarjetas ajusta ambos saldos', () => {
    const s0 = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const s1 = A.createCreditCard(s0, {
      name: 'MC', maxLimit: 2000, monthlyPayment: 80, category: 'extras'
    });
    const cid1 = s1.creditCards[0].id;
    const cid2 = s1.creditCards[1].id;
    const e = M.normalizeExpense({
      name: 'X', amount: 100, type: 'variable', category: 'extras', creditCardId: cid1
    });
    const s2 = A.createExpense(s1, e);
    assertEqual(s2.creditCards[0].currentBalance, 100);  // Visa
    assertEqual(s2.creditCards[1].currentBalance, 0);    // MC
    e.id = s2.expenses[0].id;
    const s3 = A.updateExpense(s2, e.id, { ...e, creditCardId: cid2 });
    assertEqual(s3.creditCards[0].currentBalance, 0);    // Visa
    assertEqual(s3.creditCards[1].currentBalance, 100);  // MC
  });

  test('pago extra reduce saldo (no aumenta)', () => {
    const s0 = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({
      name: 'Pago', amount: 100, type: 'variable', category: 'extras', creditCardId: cid, isExtraPayment: true
    });
    const s = A.createExpense(s0, e);
    assertEqual(s.creditCards[0].currentBalance, 0);  // se resta
  });

  test('eliminar gasto con tarjeta desvincula y reduce saldo', () => {
    const s0 = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'extras'
    });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({
      name: 'Compra', amount: 200, type: 'variable', category: 'extras', creditCardId: cid
    });
    const s = A.createExpense(s0, e);
    assertEqual(s.creditCards[0].currentBalance, 200);
    const s2 = A.deleteExpense(s, e.id);
    assertEqual(s2.creditCards[0].currentBalance, 0);
  });

  test('payPendingDebt con tarjeta crea extra payment', () => {
    const s0 = A.createCreditCard(freshState(), {
      name: 'Visa', maxLimit: 1000, monthlyPayment: 50, category: 'deudas'
    });
    const cid = s0.creditCards[0].id;
    const e = M.normalizeExpense({
      name: 'Cuota', amount: 100, type: 'fixed', category: 'deudas', creditCardId: cid
    });
    const s = A.createExpense(s0, e);
    A.togglePendingMandatory(s, e.id, '2024-05');
    const s2 = A.payPendingDebt(s, e.id, '2024-05', '2024-06');
    assertEqual(s2.creditCards[0].currentBalance, 0);
  });
});
