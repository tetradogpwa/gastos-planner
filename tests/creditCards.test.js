/* ============================================
   tests/creditCards.test.js - Tests para tarjetas de crédito
   ============================================ */

suite('Models · Tarjetas de crédito · Normalización', () => {

  test('normalizeCreditCard con defaults', () => {
    const c = M.normalizeCreditCard({
      name: 'Visa Oro',
      maxLimit: 3000,
      monthlyPayment: 100
    });
    assertEqual(c.name, 'Visa Oro');
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
});

suite('Models · Tarjetas de crédito · Reglas de proyección', () => {

  function card(overrides) {
    return M.normalizeCreditCard(Object.assign({
      name: 'Visa', maxLimit: 3000, monthlyPayment: 100,
      startDate: '2024-01-01'
    }, overrides));
  }

  test('appliesCreditCardToMonth activa entre startDate y hoy', () => {
    assertEqual(M.appliesCreditCardToMonth(card(), '2024-06'), true);
  });

  test('appliesCreditCardToMonth no activa antes de startDate', () => {
    assertEqual(M.appliesCreditCardToMonth(card({ startDate: '2024-06-01' }), '2024-05'), false);
  });

  test('appliesCreditCardToMonth inactive nunca aplica', () => {
    assertEqual(M.appliesCreditCardToMonth(card({ inactive: true }), '2024-06'), false);
  });

  test('appliesCreditCardToMonth con installments termina después del número de cuotas', () => {
    const c = card({
      startDate: '2024-01-01',
      installmentStartMonth: '2024-02',
      installments: 12
    });
    assertEqual(M.appliesCreditCardToMonth(c, '2024-01'), false);
    assertEqual(M.appliesCreditCardToMonth(c, '2024-02'), true);
    assertEqual(M.appliesCreditCardToMonth(c, '2025-01'), true);
    assertEqual(M.appliesCreditCardToMonth(c, '2025-02'), false);
  });

  test('getCreditCardsForMonth filtra inactivas', () => {
    const c1 = card();
    const c2 = card({ inactive: true });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [], creditCards: [c1, c2], settings: M.normalizeSettings({}) };
    const result = M.getCreditCardsForMonth(state, '2024-06');
    assertEqual(result.length, 1);
    assertEqual(result[0].id, c1.id);
  });

  test('getCreditCardsForMonth calcula availableCredit', () => {
    const c = card({ currentBalance: 500 });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [], creditCards: [c], settings: M.normalizeSettings({}) };
    const result = M.getCreditCardsForMonth(state, '2024-06');
    assertEqual(result[0].availableCredit, 2500);
  });

  test('getCreditCardProgress marca como pagado', () => {
    const c = card({ paidMonths: { '2024-06': true } });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [], creditCards: [c], settings: M.normalizeSettings({}) };
    const p = M.getCreditCardProgress(state, c.id, '2024-06');
    assertEqual(p.isPaid, true);
    assertEqual(p.isSkipped, false);
  });

  test('summarizeCreditCards suma límites y balances', () => {
    const c1 = card({ maxLimit: 3000, currentBalance: 500 });
    const c2 = card({ maxLimit: 1000, currentBalance: 200 });
    const c3 = card({ maxLimit: 500, currentBalance: 0, inactive: true });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [], creditCards: [c1, c2, c3], settings: M.normalizeSettings({}) };
    const s = M.summarizeCreditCards(state);
    assertEqual(s.count, 2);
    assertEqual(s.totalLimit, 4000);
    assertEqual(s.totalBalance, 700);
    assertEqual(s.totalAvailable, 3300);
  });
});

suite('Actions · Tarjetas de crédito', () => {

  function freshState() {
    return M.newState();
  }

  function card(overrides) {
    return M.normalizeCreditCard(Object.assign({
      name: 'Visa', maxLimit: 3000, monthlyPayment: 100
    }, overrides));
  }

  test('createCreditCard añade', () => {
    const s0 = freshState();
    const s1 = A.createCreditCard(s0, { name: 'Visa', maxLimit: 3000, monthlyPayment: 100 });
    assertEqual(s1.creditCards.length, 1);
    assertEqual(s1.creditCards[0].name, 'Visa');
  });

  test('updateCreditCard modifica campos', () => {
    const c = card();
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.updateCreditCard(s0, c.id, { monthlyPayment: 200, currentBalance: 800 });
    assertEqual(s1.creditCards[0].monthlyPayment, 200);
    assertEqual(s1.creditCards[0].currentBalance, 800);
  });

  test('deleteCreditCard elimina tarjeta y gastos asociados', () => {
    const c = card();
    const e = M.normalizeExpense({ name: 'pago mensual', amount: 100, type: 'fixed', category: 'deudas', creditCardId: c.id, startDate: '2024-01-01' });
    const eOther = M.normalizeExpense({ name: 'otro', amount: 50, type: 'fixed', category: 'comida', startDate: '2024-01-01' });
    const s0 = { ...freshState(), creditCards: [c], expenses: [e, eOther] };
    const s1 = A.deleteCreditCard(s0, c.id);
    assertEqual(s1.creditCards.length, 0);
    assertEqual(s1.expenses.length, 1);
    assertEqual(s1.expenses[0].id, eOther.id);
  });

  test('payCreditCardMonth marca mes como pagado', () => {
    const c = card();
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.payCreditCardMonth(s0, c.id, '2024-06');
    assertEqual(s1.creditCards[0].paidMonths['2024-06'], true);
  });

  test('skipCreditCardMonth marca mes como saltado', () => {
    const c = card();
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.skipCreditCardMonth(s0, c.id, '2024-06');
    assertEqual(s1.creditCards[0].skippedMonths['2024-06'], true);
  });

  test('updateCreditCardBalance cambia saldo', () => {
    const c = card({ currentBalance: 500 });
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.updateCreditCardBalance(s0, c.id, 1200);
    assertEqual(s1.creditCards[0].currentBalance, 1200);
  });

  test('toggleCreditCardInactive alterna', () => {
    const c = card();
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.toggleCreditCardInactive(s0, c.id);
    assertEqual(s1.creditCards[0].inactive, true);
    const s2 = A.toggleCreditCardInactive(s1, c.id);
    assertEqual(s2.creditCards[0].inactive, false);
  });

  test('addExtraPayment crea gasto y reduce saldo', () => {
    const c = card({ currentBalance: 500 });
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.addExtraPayment(s0, c.id, 200, '2024-06');
    assertEqual(s1.expenses.length, 1);
    assertEqual(s1.expenses[0].type, 'variable');
    assertEqual(s1.expenses[0].creditCardId, c.id);
    assertEqual(s1.expenses[0].isExtraPayment, true);
    assertEqual(s1.expenses[0].amount, 200);
    assertEqual(s1.creditCards[0].currentBalance, 300);
  });

  test('addExtraPayment nunca deja saldo negativo', () => {
    const c = card({ currentBalance: 100 });
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.addExtraPayment(s0, c.id, 500, '2024-06');
    assertEqual(s1.creditCards[0].currentBalance, 0);
  });

  test('createExpense con creditCardId sube el saldo de la tarjeta', () => {
    const c = card({ currentBalance: 100 });
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.createExpense(s0, {
      name: 'Compra Amazon', amount: 50, type: 'variable', category: 'extras', creditCardId: c.id, targetMonth: '2024-06'
    });
    assertEqual(s1.expenses[0].creditCardId, c.id);
    assertEqual(s1.creditCards[0].currentBalance, 150);
  });

  test('createExpense sin creditCardId no toca tarjetas', () => {
    const c = card({ currentBalance: 100 });
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.createExpense(s0, {
      name: 'Comida', amount: 30, type: 'variable', category: 'comida', targetMonth: '2024-06'
    });
    assertEqual(s1.creditCards[0].currentBalance, 100);
  });

  test('updateExpense cambiando creditCardId ajusta ambos saldos', () => {
    const c1 = card({ name: 'Visa', currentBalance: 100, maxLimit: 1000 });
    const c2 = card({ name: 'Amex', currentBalance: 200, maxLimit: 1000 });
    const s0 = { ...freshState(), creditCards: [c1, c2] };
    const s1 = A.createExpense(s0, {
      name: 'Compra', amount: 50, type: 'variable', category: 'extras', creditCardId: c1.id, targetMonth: '2024-06'
    });
    assertEqual(s1.creditCards.find(c => c.id === c1.id).currentBalance, 150);
    assertEqual(s1.creditCards.find(c => c.id === c2.id).currentBalance, 200);
    // Cambiar de Visa a Amex: Visa -50, Amex +50
    const s2 = A.updateExpense(s1, s1.expenses[0].id, { creditCardId: c2.id });
    assertEqual(s2.creditCards.find(c => c.id === c1.id).currentBalance, 100);
    assertEqual(s2.creditCards.find(c => c.id === c2.id).currentBalance, 250);
  });

  test('deleteExpense con creditCardId baja el saldo de la tarjeta', () => {
    const c = card({ currentBalance: 100 });
    const s0 = { ...freshState(), creditCards: [c] };
    const s1 = A.createExpense(s0, {
      name: 'Compra', amount: 50, type: 'variable', category: 'extras', creditCardId: c.id, targetMonth: '2024-06'
    });
    assertEqual(s1.creditCards[0].currentBalance, 150);
    const s2 = A.deleteExpense(s1, s1.expenses[0].id);
    assertEqual(s2.creditCards[0].currentBalance, 100);
  });

  test('ninguna acción muta el estado original', () => {
    const c = card();
    const s0 = { ...freshState(), creditCards: [c] };
    const snapshot = JSON.stringify(s0);
    A.createCreditCard(s0, { name: 'Y', maxLimit: 100, monthlyPayment: 10 });
    A.updateCreditCard(s0, c.id, { monthlyPayment: 999 });
    A.deleteCreditCard(s0, c.id);
    A.payCreditCardMonth(s0, c.id, '2024-06');
    A.skipCreditCardMonth(s0, c.id, '2024-06');
    A.updateCreditCardBalance(s0, c.id, 999);
    A.toggleCreditCardInactive(s0, c.id);
    A.addExtraPayment(s0, c.id, 50, '2024-06');
    assertEqual(JSON.stringify(s0), snapshot);
  });
});
