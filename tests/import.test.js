/* ============================================
   tests/import.test.js - Tests con JSON real del usuario
   Usa /home/gabriel/Descargas/mis-gastos-2026-08-10 (6).json
   ============================================ */

const path = require('path');
const fs = require('fs');

suite('Import/Export · Datos reales del usuario', () => {
  const FILE = path.join('/home/gabriel/Descargas', 'mis-gastos-2026-08-10 (6).json');

  function loadUserJson() {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  }

  test('el JSON del usuario se carga correctamente', () => {
    const data = loadUserJson();
    assert(data.app === 'Mis Gastos');
    assert(data.schemaVersion === 2);
    assert(typeof data.exportedAt === 'string');
    assert(Array.isArray(data.expenses));
    assert(data.expenses.length === 20);
    assert(Array.isArray(data.income));
    assert(data.income.length === 4);
    assert(Array.isArray(data.budgets));
    assert(data.budgets.length === 2);
    assert(Array.isArray(data.subcategories));
    assert(data.subcategories.length === 2);
    assert(Array.isArray(data.creditCards));
    assert(data.creditCards.length === 1);
    assert(Array.isArray(data.balanceEntries));
    assert(data.balanceEntries.length === 1);
  });

  test('los expenses del JSON se normalizan correctamente', () => {
    const data = loadUserJson();
    data.expenses.forEach((e) => {
      const norm = M.normalizeExpense(e);
      assertEqual(norm.name, e.name.trim());
      assertEqual(norm.amount, Number(e.amount) || 0);
      assert(typeof norm.id === 'string' && norm.id.length > 0);
      assert(typeof norm.startDate === 'string');
      assertEqual(norm.optional, !!e.optional);
      assertEqual(norm.inactive, !!e.inactive);
      assertEqual(norm.oneTime, !!e.oneTime);
    });
  });

  test('los income del JSON se normalizan correctamente', () => {
    const data = loadUserJson();
    data.income.forEach((i) => {
      const norm = M.normalizeIncome(i);
      assertEqual(norm.name, i.name.trim());
      assertEqual(norm.amount, Number(i.amount) || 0);
      assert(typeof norm.id === 'string' && norm.id.length > 0);
    });
  });

  test('los budgets del JSON se normalizan correctamente', () => {
    const data = loadUserJson();
    data.budgets.forEach((b) => {
      const norm = M.normalizeBudget(b);
      assertEqual(norm.category, b.category);
      assertEqual(norm.amount, Number(b.amount) || 0);
      assert(typeof norm.id === 'string' && norm.id.length > 0);
    });
  });

  test('los creditCards del JSON se normalizan correctamente', () => {
    const data = loadUserJson();
    data.creditCards.forEach((c) => {
      const norm = M.normalizeCreditCard(c);
      assertEqual(norm.name, c.name.trim());
      assertEqual(norm.maxLimit, Number(c.maxLimit) || 0);
      assertEqual(norm.monthlyPayment, Number(c.monthlyPayment) || 0);
      assertEqual(norm.currentBalance, Number(c.currentBalance) || 0);
    });
  });

  test('appliesCreditCardToMonth funciona con los datos reales', () => {
    const data = loadUserJson();
    data.creditCards.forEach((c) => {
      const norm = M.normalizeCreditCard(c);
      const ahora = M.todayMonthKey();
      assertEqual(M.appliesCreditCardToMonth(norm, ahora), true);
    });
  });

  test('exportJSON produce un JSON válido que se puede importar', () => {
    const data = loadUserJson();
    // Crear state a partir de los datos
    const initial = JSON.parse(JSON.stringify(data));
    delete initial.app;
    delete initial.schemaVersion;
    delete initial.exportedAt;
    // Exportar
    const exported = S.exportJSON(initial);
    assert(typeof exported === 'object');
    assert(exported.ok === true);
    assert(typeof exported.filename === 'string');
    assert(exported.count === initial.expenses.length + initial.income.length);
  });

  test('importJSON carga los datos reales correctamente', () => {
    const data = loadUserJson();
    const initial = JSON.parse(JSON.stringify(data));
    delete initial.app;
    delete initial.schemaVersion;
    delete initial.exportedAt;
    return S.importJSON(initial).then((newState) => {
      assert(newState.expenses.length === data.expenses.length);
      assert(newState.income.length === data.income.length);
      assert(newState.budgets.length === data.budgets.length);
      assert(newState.subcategories.length === data.subcategories.length);
      assert(newState.creditCards.length === data.creditCards.length);
      assert(newState.balanceEntries.length === data.balanceEntries.length);
      // Verificar que un expense específico se importó correctamente
      const primerExpense = data.expenses[0];
      const expenseImportado = newState.expenses.find((e) => e.id === primerExpense.id);
      assert(expenseImportado);
      assertEqual(expenseImportado.name, primerExpense.name);
      assertEqual(expenseImportado.amount, primerExpense.amount);
      assertEqual(expenseImportado.type, primerExpense.type);
      assertEqual(expenseImportado.category, primerExpense.category);
    });
  });

  test('getItemsForMonth filtra correctamente los expenses del JSON', () => {
    const data = loadUserJson();
    const initial = JSON.parse(JSON.stringify(data));
    delete initial.app;
    delete initial.schemaVersion;
    delete initial.exportedAt;
    const state = S.importJSON(initial);
    return state.then((s) => {
      // Para el mes de exportAt (2026-08), debería haber varios items
      const items = M.getItemsForMonth(s, '2026-08');
      assert(items.expenses.length > 0 || items.income.length > 0);
      // Verificar que un expense temporal (Muebles) está en su mes correcto
      const muebles = s.expenses.find((e) => e.name === 'Muebles');
      if (muebles && muebles.startDate) {
        const startMonth = muebles.startDate.slice(0, 7);
        const itemsWithMuebles = M.getItemsForMonth(s, startMonth);
        assert(itemsWithMuebles.expenses.some((e) => e.name === 'Muebles'));
      }
    });
  });

  test('summarize calcula correctamente con los datos reales', () => {
    const data = loadUserJson();
    const initial = JSON.parse(JSON.stringify(data));
    delete initial.app;
    delete initial.schemaVersion;
    delete initial.exportedAt;
    const state = S.importJSON(initial);
    return state.then((s) => {
      // Para el mes de exportAt (agosto 2026)
      const sum = M.summarize(s, '2026-08');
      // El balance = totalIncome - totalExpenses (sin contar el saldo de presupuesto)
      // Como hay un expense de 600.88 (Muebles) en agosto (startDate 2026-08-05)
      // Y un income que puede aplicar
      assert(typeof sum.totalIncome === 'number');
      assert(typeof sum.totalExpenses === 'number');
      assert(typeof sum.balance === 'number');
      assert(sum.balance === sum.totalIncome - sum.totalExpenses);
    });
  });
});
