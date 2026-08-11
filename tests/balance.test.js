/* ============================================
   tests/balance.test.js - Tests para saldo a principios de mes
   ============================================ */

function freshState() {
  return M.newState();
}

suite('Models · Saldo de cuenta', () => {

  test('normalizeBalanceEntry con defaults', () => {
    const b = M.normalizeBalanceEntry({ monthKey: '2024-06', balance: 1500 });
    assertEqual(b.monthKey, '2024-06');
    assertEqual(b.balance, 1500);
    assert(typeof b.id === 'string' && b.id.length > 0);
    assert(typeof b.date === 'string' && b.date.length > 0);
  });

  test('normalizeBalanceEntry limpia balance inválido', () => {
    const b = M.normalizeBalanceEntry({ monthKey: '2024-06', balance: 'invalid' });
    assertEqual(b.balance, 0);
  });

  test('getLatestBalance filtra por mes', () => {
    const b1 = M.normalizeBalanceEntry({ monthKey: '2024-01', balance: 1000 });
    const b2 = M.normalizeBalanceEntry({ monthKey: '2024-06', balance: 1500 });
    const b3 = M.normalizeBalanceEntry({ monthKey: '2024-06', balance: 1700 });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [], creditCards: [], balanceEntries: [b1, b2, b3], settings: M.normalizeSettings({}) };
    const jun = M.getLatestBalance(state, '2024-06');
    assertEqual(jun.balance, 1700);
    const jan = M.getLatestBalance(state, '2024-01');
    assertEqual(jan.balance, 1000);
    const may = M.getLatestBalance(state, '2024-05');
    assertEqual(may, null);
  });

  test('getLatestBalance sin monthKey devuelve la última añadida', () => {
    const b1 = M.normalizeBalanceEntry({ monthKey: '2024-01', balance: 1000 });
    const b2 = M.normalizeBalanceEntry({ monthKey: '2024-06', balance: 1500 });
    const state = { version: 2, expenses: [], income: [], budgets: [], subcategories: [], creditCards: [], balanceEntries: [b1, b2], settings: M.normalizeSettings({}) };
    assertEqual(M.getLatestBalance(state).balance, 1500);
  });
});

suite('Actions · setBalance (saldo a principios de mes)', () => {

  test('setBalance añade la entrada al estado', () => {
    const s0 = freshState();
    const s1 = A.setBalance(s0, '2024-06', 1500);
    assertEqual(s1.balanceEntries.length, 1);
    assertEqual(s1.balanceEntries[0].balance, 1500);
  });

  test('setBalance NO añade un ingreso "Saldo" (es solo el saldo inicial)', () => {
    const s0 = freshState();
    const s1 = A.setBalance(s0, '2024-06', 1500);
    assertEqual(s1.income.length, 0);
  });

  test('setBalance NO crea "Ahorro" en el mes anterior', () => {
    const s0 = freshState();
    const s1 = A.setBalance(s0, '2024-06', 1500);
    const ahorro = s1.income.find((i) => i.name === 'Ahorro' || i.name === 'Desahorro');
    assertEqual(ahorro, undefined);
  });

  test('setBalance actualiza la entrada si ya existe para el mismo mes', () => {
    const s0 = freshState();
    const s1 = A.setBalance(s0, '2024-06', 1500);
    const s2 = A.setBalance(s1, '2024-06', 2000);
    assertEqual(s2.balanceEntries.length, 1);
    assertEqual(s2.balanceEntries[0].balance, 2000);
  });

  test('setBalance crea entradas separadas para meses distintos', () => {
    const s0 = freshState();
    const s1 = A.setBalance(s0, '2024-05', 1000);
    const s2 = A.setBalance(s1, '2024-06', 1500);
    assertEqual(s2.balanceEntries.length, 2);
  });

  test('setBalance elimina income "Saldo" preexistente (de la versión anterior)', () => {
    const oldIncome = M.normalizeIncome({
      name: 'Saldo',
      amount: 1000,
      type: 'extra',
      category: 'extras',
      targetMonth: '2024-06',
      startDate: '2024-06-01'
    });
    const state = { ...freshState(), income: [oldIncome] };
    const s1 = A.setBalance(state, '2024-06', 1500);
    assertEqual(s1.income.length, 0);
  });

  test('setBalance no muta el estado original', () => {
    const s0 = A.setBalance(freshState(), '2024-06', 1500);
    const snapshot = JSON.stringify(s0);
    A.setBalance(s0, '2024-06', 2000);
    assertEqual(JSON.stringify(s0), snapshot);
  });
});

suite('Saldo · Cálculo del resto del mes pasado', () => {
  // Lógica del renderBalanceSection (mismo algoritmo que en app.js)
  function calcRestoMesPasado(state, currentMonthKey) {
    const balanceEntries = (state.balanceEntries || [])
      .filter((b) => b.monthKey < currentMonthKey)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const lastEntry = balanceEntries[0];
    if (!lastEntry) return null;
    const previousMonth = M.addMonths(currentMonthKey, -1);
    let running = lastEntry.balance;
    if (previousMonth > lastEntry.monthKey) {
      let m = M.addMonths(lastEntry.monthKey, 1);
      while (m <= previousMonth) {
        const monthSum = M.summarize(state, m);
        running += monthSum.totalIncome - monthSum.totalExpenses;
        m = M.addMonths(m, 1);
      }
    }
    return running;
  }

  test('Saldo de cuenta en el mes siguiente al del Saldo es el Saldo (no incluye actividad del mes del Saldo)', () => {
    // Saldo de agosto = 20€, income 100 en agosto (no se incluye en Saldo de cuenta de sept)
    // En septiembre → Saldo de cuenta = 20€ (solo el Saldo)
    const s0 = A.setBalance(freshState(), '2024-08', 20);
    const ingresoAgosto = M.normalizeIncome({
      name: 'Sueldo', amount: 100, type: 'recurring', category: 'nomina', startDate: '2024-08-15'
    });
    const s1 = { ...s0, income: [...s0.income, ingresoAgosto] };
    const result = calcRestoMesPasado(s1, '2024-09');
    assertEqual(result, 20);
  });

  test('Saldo de cuenta dos meses después incluye actividad de los meses intermedios', () => {
    // Saldo de agosto = 20€
    // Income en septiembre = 200
    // Running de septiembre = 20 + 200 = 220
    // En octubre → Saldo de cuenta = 220€ (Saldo Aug + actividad de sept, NO la de octubre)
    const s0 = A.setBalance(freshState(), '2024-08', 20);
    const ingresoSept = M.normalizeIncome({
      name: 'Sueldo', amount: 200, type: 'recurring', category: 'nomina', startDate: '2024-09-15'
    });
    const s1 = { ...s0, income: [...s0.income, ingresoSept] };
    const result = calcRestoMesPasado(s1, '2024-10');
    assertEqual(result, 220);
  });

  test('Saldo de cuenta tres meses después acumula todas las actividades intermedias', () => {
    // Saldo de agosto = 20€
    // Income en septiembre = 200, income en octubre = 300
    // Running de octubre = 20 + 200 + 300 = 720
    // En noviembre → Saldo de cuenta = 720€ (running de octubre, NO incluye la actividad de noviembre)
    const s0 = A.setBalance(freshState(), '2024-08', 20);
    const ingresoSept = M.normalizeIncome({
      name: 'Sueldo', amount: 200, type: 'recurring', category: 'nomina', startDate: '2024-09-15'
    });
    const ingresoOct = M.normalizeIncome({
      name: 'Sueldo', amount: 300, type: 'recurring', category: 'nomina', startDate: '2024-10-15'
    });
    const s1 = { ...s0, income: [...s0.income, ingresoSept, ingresoOct] };
    const result = calcRestoMesPasado(s1, '2024-11');
    assertEqual(result, 720);
  });
});
