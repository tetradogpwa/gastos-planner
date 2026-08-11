/* ============================================
   app.js - Orchestrator
   - Inicializa el state desde storage
   - Wire-up de event handlers
   - Llama a actions (mutación de state) y ui (renderización)
   ============================================ */

(function () {
  'use strict';

  const M = window.Models;
  const A = window.Actions;
  const S = window.Storage;
  const UI = window.UI;

  let state = S.load();
  let currentMonth = M.todayMonthKey();
  let currentFilter = 'all';
  let modalEls = null;

  // ---------- Form payload builders (DOM reading) ----------
  function readExpenseForm() {
    const amount = parseFloat($('#expenseAmount').value);
    const type = $('#expenseTypeSeg .seg-active').dataset.type;
    return {
      name: $('#expenseName').value.trim(),
      amount,
      type,
      category: $('#expenseCategory').value,
      subcategoryId: $('#expenseSubcategory').value || null,
      budgetId: $('#expenseBudget').value || null,
      creditCardId: $('#expenseCreditCard').value || null,
      startDate: $('#expenseStartDate').value,
      endDate: $('#expenseEndDate').value || null,
      optional: $('#expenseOptional').checked,
      inactive: $('#expenseInactive').checked,
      notes: $('#expenseNotes').value.trim(),
      targetMonth: type === 'unico' ? $('#expenseMonth').value : null,
      amountHistory: readExpenseAmountHistory()
    };
  }

  function readExpenseAmountHistory() {
    const rows = $$('#expenseAmountHistory .amount-history-item');
    return rows.map((li) => ({
      fromDate: li.querySelector('.amount-history-date').textContent,
      amount: parseFloat(li.querySelector('.amount-history-amount').textContent.replace(',', '.'))
    }));
  }

  function readIncomeForm() {
    return {
      name: $('#incomeName').value.trim(),
      amount: parseFloat($('#incomeAmount').value),
      type: $('#incomeTypeSeg .seg-active').dataset.type,
      category: $('#incomeCategory').value,
      startDate: $('#incomeStartDate').value,
      endDate: $('#incomeEndDate').value || null,
      targetMonth: $('#incomeTypeSeg .seg-active').dataset.type === 'extra' ? $('#incomeMonth').value : null,
      amountHistory: readIncomeAmountHistory()
    };
  }

  function readIncomeAmountHistory() {
    const rows = $$('#incomeAmountHistory .amount-history-item');
    return rows.map((li) => ({
      fromDate: li.querySelector('.amount-history-date').textContent,
      amount: parseFloat(li.querySelector('.amount-history-amount').textContent.replace(',', '.'))
    }));
  }

  function readBudgetForm() {
    return {
      category: $('#budgetCategory').value,
      subcategoryId: $('#budgetSubcategory').value || null,
      amount: parseFloat($('#budgetAmount').value),
      icon: $('#budgetIconPreview').textContent.trim() || null,
      startDate: $('#budgetStartDate').value,
      endDate: $('#budgetEndDate').value || null,
      notes: $('#budgetNotes').value.trim()
    };
  }

  function readSubcategoryForm() {
    return {
      category: $('#subcategoryCategory').value,
      label: $('#subcategoryLabel').value.trim(),
      icon: $('#subcategoryIconPreview').textContent.trim() || '📦'
    };
  }

  function readCreditCardForm() {
    return {
      name: $('#creditCardName').value.trim(),
      maxLimit: parseFloat($('#creditCardMaxLimit').value),
      monthlyPayment: parseFloat($('#creditCardMonthlyPayment').value),
      category: $('#creditCardCategory').value,
      startDate: $('#creditCardStartDate').value
    };
  }

  function readSetBalanceForm() {
    return {
      monthKey: currentMonth,
      balance: parseFloat($('#setBalanceAmount').value)
    };
  }

  function readUpdateBalanceForm() {
    return {
      cardId: $('#updateBalanceCardId').value,
      balance: parseFloat($('#updateBalanceAmount').value)
    };
  }

  function readExtraPaymentForm() {
    return {
      cardId: $('#extraPaymentCardId').value,
      amount: parseFloat($('#extraPaymentAmount').value),
      monthKey: currentMonth
    };
  }

  // ---------- Form fill helpers (UI → UI) ----------
  function fillExpenseForm(item) {
    $('#expenseId').value = item.id;
    $('#expenseName').value = item.name;
    $('#expenseAmount').value = item.amount;
    $('#expenseCategory').value = item.category;
    $('#expenseSubcategory').value = item.subcategoryId || '';
    $('#expenseBudget').value = item.budgetId || '';
    $('#expenseCreditCard').value = item.creditCardId || '';
    $('#expenseStartDate').value = item.startDate || '';
    $('#expenseEndDate').value = item.endDate || '';
    $('#expenseOptional').checked = !!item.optional;
    $('#expenseInactive').checked = !!item.inactive;
    $('#expenseNotes').value = item.notes || '';
    $('#expenseMonth').value = item.targetMonth || '';
    UI.el.exposed_setExpenseType && UI.el.exposed_setExpenseType(item.type || 'fixed');
  }

  function fillIncomeForm(item) {
    $('#incomeId').value = item.id;
    $('#incomeName').value = item.name;
    $('#incomeAmount').value = item.amount;
    $('#incomeCategory').value = item.category;
    $('#incomeStartDate').value = item.startDate || '';
    $('#incomeEndDate').value = item.endDate || '';
    $('#incomeMonth').value = item.targetMonth || '';
    UI.el.exposed_setIncomeType && UI.el.exposed_setIncomeType(item.type || 'recurring');
  }

  function fillBudgetForm(b) {
    $('#budgetId').value = b.id;
    $('#budgetCategory').value = b.category;
    $('#budgetSubcategory').value = b.subcategoryId || '';
    $('#budgetAmount').value = b.amount;
    $('#budgetIconPreview').textContent = b.icon || '💼';
    $('#budgetStartDate').value = b.startDate || '';
    $('#budgetEndDate').value = b.endDate || '';
    $('#budgetNotes').value = b.notes || '';
  }

  function fillSubcategoryForm(s) {
    $('#subcategoryId').value = s.id;
    $('#subcategoryLabel').value = s.label;
    $('#subcategoryCategory').value = s.category;
    $('#subcategoryIconPreview').textContent = s.icon;
  }

  function fillCreditCardForm(c) {
    $('#creditCardId').value = c.id;
    $('#creditCardName').value = c.name;
    $('#creditCardMaxLimit').value = c.maxLimit;
    $('#creditCardMonthlyPayment').value = c.monthlyPayment;
    $('#creditCardCategory').value = c.category;
    $('#creditCardStartDate').value = c.startDate || '';
  }

  // ---------- Modal openers (DOM + state, but UI via UI, state via A) ----------
  function openExpenseForm(id = null) {
    const form = $('#formExpense');
    form.reset();
    $('#expenseId').value = '';
    $('#btnDeleteExpense').style.display = 'none';
    $('#btnConvertToBudget').style.display = 'none';
    $('#btnConvertToUnico').style.display = 'none';
    $('#expenseStartDate').value = M.toISODate(new Date());
    UI.el.exposed_fillExpenseCategorySelectors && UI.el.exposed_fillExpenseCategorySelectors('');
    UI.el.exposed_setExpenseType && UI.el.exposed_setExpenseType('fixed');

    if (id) {
      const item = state.expenses.find((e) => e.id === id);
      if (!item) return;
      $('#expenseTitle').textContent = 'Editar gasto';
      fillExpenseForm(item);
      $('#btnDeleteExpense').style.display = 'inline-flex';
      $('#btnConvertToBudget').style.display = 'inline-flex';
      $('#btnConvertToUnico').style.display = 'inline-flex';
    } else {
      $('#expenseTitle').textContent = 'Nuevo gasto';
    }
    UI.openModal('modalExpense');
    setTimeout(() => $('#expenseName').focus(), 60);
  }

  function openIncomeForm(id = null) {
    const form = $('#formIncome');
    form.reset();
    $('#incomeId').value = '';
    $('#btnDeleteIncome').style.display = 'none';
    $('#incomeStartDate').value = M.toISODate(new Date());
    UI.el.exposed_setIncomeType && UI.el.exposed_setIncomeType('recurring');

    if (id) {
      const item = state.income.find((i) => i.id === id);
      if (!item) return;
      $('#incomeTitle').textContent = 'Editar ingreso';
      fillIncomeForm(item);
      $('#btnDeleteIncome').style.display = 'inline-flex';
    } else {
      $('#incomeTitle').textContent = 'Nuevo ingreso';
    }
    UI.openModal('modalIncome');
    setTimeout(() => $('#incomeName').focus(), 60);
  }

  function openBudgetForm(id = null) {
    const form = $('#formBudget');
    form.reset();
    $('#budgetId').value = '';
    $('#btnDeleteBudget').style.display = 'none';
    $('#budgetStartDate').value = M.toISODate(new Date());
    $('#budgetIconPreview').textContent = '💼';

    if (id) {
      const item = state.budgets.find((b) => b.id === id);
      if (!item) return;
      $('#budgetTitle').textContent = 'Editar presupuesto';
      fillBudgetForm(item);
      $('#btnDeleteBudget').style.display = 'inline-flex';
    } else {
      $('#budgetTitle').textContent = 'Nuevo presupuesto';
    }
    UI.openModal('modalBudget');
    setTimeout(() => $('#budgetAmount').focus(), 60);
  }

  function openSubcategoryForm(id = null) {
    const form = $('#formSubcategory');
    form.reset();
    $('#subcategoryId').value = '';
    $('#btnDeleteSubcategory').style.display = 'none';
    $('#subcategoryIconPreview').textContent = '📦';

    if (id) {
      const item = state.subcategories.find((s) => s.id === id);
      if (!item) return;
      $('#subcategoryTitle').textContent = 'Editar subcategoría';
      fillSubcategoryForm(item);
      $('#btnDeleteSubcategory').style.display = 'inline-flex';
    } else {
      $('#subcategoryTitle').textContent = 'Nueva subcategoría';
    }
    UI.openModal('modalSubcategory');
    setTimeout(() => $('#subcategoryLabel').focus(), 60);
  }

  function openCreditCardForm(id = null) {
    const form = $('#formCreditCard');
    form.reset();
    $('#creditCardId').value = '';
    $('#btnDeleteCreditCard').style.display = 'none';
    $('#creditCardStartDate').value = M.toISODate(new Date());
    $('#creditCardIconPreview').textContent = '💳';

    if (id) {
      const item = state.creditCards.find((c) => c.id === id);
      if (!item) return;
      $('#creditCardTitle').textContent = 'Editar tarjeta';
      fillCreditCardForm(item);
      $('#btnDeleteCreditCard').style.display = 'inline-flex';
    } else {
      $('#creditCardTitle').textContent = 'Nueva tarjeta';
    }
    UI.openModal('modalCreditCard');
    setTimeout(() => $('#creditCardName').focus(), 60);
  }

  function openSetBalanceModal() {
    const latest = M.getLatestBalance(state, currentMonth);
    $('#setBalanceAmount').value = latest ? latest.balance : '';
    $('#setBalanceMonth').value = currentMonth;
    $('#setBalanceHint').textContent = `Mes actual: ${M.monthKeyToLabel(currentMonth)}.`;
    UI.openModal('modalSetBalance');
    setTimeout(() => $('#setBalanceAmount').focus(), 60);
  }

  function openUpdateBalanceModal(cardId) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return;
    $('#updateBalanceCardId').value = cardId;
    $('#updateBalanceAmount').value = card.currentBalance;
    $('#updateBalanceLabel').textContent = `Tarjeta: ${card.name}. Saldo actual: ${M.formatMoney(card.currentBalance)}`;
    UI.openModal('modalUpdateBalance');
    setTimeout(() => $('#updateBalanceAmount').focus(), 60);
  }

  function openExtraPaymentModal(cardId) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return;
    $('#extraPaymentCardId').value = cardId;
    $('#extraPaymentAmount').value = '';
    $('#extraPaymentLabel').textContent = `Tarjeta: ${card.name}. Saldo actual: ${M.formatMoney(card.currentBalance)}`;
    UI.openModal('modalExtraPayment');
    setTimeout(() => $('#extraPaymentAmount').focus(), 60);
  }

  function openConvertToBudget(expenseId) {
    if (!confirm('¿Convertir este gasto en presupuesto? Se eliminará el gasto.')) return;
    state = A.convertExpenseToBudget(state, expenseId, currentMonth);
    persist();
    closeModal('modalExpense');
    render();
    toast('Gasto convertido en presupuesto');
  }

  function openConvertToUnico(expenseId) {
    if (!confirm('¿Convertir este gasto en un pago único este mes? Dejará de repetirse.')) return;
    state = A.convertExpenseToUnico(state, expenseId, currentMonth);
    persist();
    closeModal('modalExpense');
    render();
    toast('Gasto convertido a único');
  }

  // ---------- Form submissions (DOM read → action → render) ----------
  function submitExpenseForm(e) {
    e.preventDefault();
    try {
      const id = $('#expenseId').value;
      const payload = readExpenseForm();
      state = id ? A.updateExpense(state, id, payload) : A.createExpense(state, payload);
      persist();
      closeModal('modalExpense');
      render();
      toast(id ? 'Gasto actualizado' : 'Gasto añadido');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitIncomeForm(e) {
    e.preventDefault();
    try {
      const id = $('#incomeId').value;
      const payload = readIncomeForm();
      state = id ? A.updateIncome(state, id, payload) : A.createIncome(state, payload);
      persist();
      closeModal('modalIncome');
      render();
      toast(id ? 'Ingreso actualizado' : 'Ingreso añadido');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitBudgetForm(e) {
    e.preventDefault();
    try {
      const id = $('#budgetId').value;
      const payload = readBudgetForm();
      state = id ? A.updateBudget(state, id, payload) : A.createBudget(state, payload);
      persist();
      closeModal('modalBudget');
      render();
      toast(id ? 'Presupuesto actualizado' : 'Presupuesto añadido');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitSubcategoryForm(e) {
    e.preventDefault();
    try {
      const id = $('#subcategoryId').value;
      const payload = readSubcategoryForm();
      state = id ? A.updateSubcategory(state, id, payload) : A.createSubcategory(state, payload);
      persist();
      closeModal('modalSubcategory');
      render();
      toast(id ? 'Subcategoría actualizada' : 'Subcategoría añadida');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitCreditCardForm(e) {
    e.preventDefault();
    try {
      const id = $('#creditCardId').value;
      const payload = readCreditCardForm();
      state = id ? A.updateCreditCard(state, id, payload) : A.createCreditCard(state, payload);
      persist();
      closeModal('modalCreditCard');
      render();
      toast(id ? 'Tarjeta actualizada' : 'Tarjeta añadida');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitSetBalance(e) {
    e.preventDefault();
    try {
      const payload = readSetBalanceForm();
      state = A.setBalance(state, payload.monthKey, payload.balance);
      persist();
      closeModal('modalSetBalance');
      render();
      toast('Saldo actualizado');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitUpdateBalance(e) {
    e.preventDefault();
    try {
      const payload = readUpdateBalanceForm();
      state = A.updateCreditCardBalance(state, payload.cardId, payload.balance);
      persist();
      closeModal('modalUpdateBalance');
      render();
      toast('Saldo actualizado');
    } catch (err) {
      toast(err.message);
    }
  }

  function submitExtraPayment(e) {
    e.preventDefault();
    try {
      const payload = readExtraPaymentForm();
      state = A.addExtraPayment(state, payload.cardId, payload.amount, payload.monthKey);
      persist();
      closeModal('modalExtraPayment');
      render();
      toast('Pago extra registrado');
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- Item-level state actions (called from UI handlers) ----------
  function togglePaid(item, monthKey) {
    const wasPaid = !!(item.paidMonths && item.paidMonths[monthKey]);
    state = A.togglePaid(state, item.id, monthKey);
    persist();
    render();
    toast(wasPaid ? 'Marcado como pendiente' : 'Marcado como pagado');
  }

  function toggleSkipped(item, monthKey) {
    state = A.toggleSkipped(state, item.id, monthKey);
    persist();
    render();
  }

  function togglePending(item, monthKey) {
    const wasPending = !!(item.pendingMonths && item.pendingMonths[monthKey]);
    state = A.togglePendingMandatory(state, item.id, monthKey);
    persist();
    render();
    toast(wasPending ? 'Pendiente anulado' : 'Marcado como pendiente (deuda)');
  }

  function toggleInactive(itemId) {
    const item = state.expenses.find((e) => e.id === itemId);
    if (!item) return;
    state = A.toggleInactive(state, itemId);
    persist();
    render();
    toast(item.inactive ? 'Gasto reactivado' : 'Gasto desactivado');
  }

  function togglePayCC(cardId) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return;
    const wasPaid = !!(card.paidMonths && card.paidMonths[currentMonth]);
    state = A.payCreditCardMonth(state, cardId, currentMonth);
    persist();
    render();
    toast(wasPaid ? 'Cuota desmarcada' : 'Cuota marcada como pagada');
  }

  function toggleSkipCC(cardId) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return;
    const wasSkipped = !!(card.skippedMonths && card.skippedMonths[currentMonth]);
    state = A.skipCreditCardMonth(state, cardId, currentMonth);
    persist();
    render();
    toast(wasSkipped ? 'Cuota desmarcada' : 'Cuota saltada este mes');
  }

  function toggleInactiveCC(cardId) {
    const card = state.creditCards.find((c) => c.id === cardId);
    if (!card) return;
    state = A.toggleCreditCardInactive(state, cardId);
    persist();
    render();
    toast(card.inactive ? 'Tarjeta reactivada' : 'Tarjeta desactivada');
  }

  function editItem(item) {
    if (item._kind === 'expense') openExpenseForm(item.id);
    else openIncomeForm(item.id);
  }

  function payPendingDebt(itemId, monthKey) {
    state = A.payPendingDebt(state, itemId, monthKey, currentMonth);
    persist();
    render();
    toast('Pago realizado');
  }

  function editCreditCard(id) {
    openCreditCardForm(id);
  }

  function updateCCBalance(id) {
    openUpdateBalanceModal(id);
  }

  function addExtraPayment(id) {
    openExtraPaymentModal(id);
  }

  function editSubcategory(id) {
    openSubcategoryForm(id);
  }

  // ---------- Render ----------
  function render() {
    updateMonthLabel();
    renderSummary();
    renderBudgets();
    renderPending();
    renderMonthItems();
    renderAllExpenses();
    renderAllIncome();
    renderTimeline();
    renderInactiveExpenses();
    renderCreditCardsView();
    renderBalanceSection();
    renderSubcategoriesView();
  }

  function updateMonthLabel() {
    const el = $('#currentMonthLabel');
    if (el) el.textContent = M.monthKeyToLabel(currentMonth);
  }

  function renderSummary() {
    const container = $('#summaryCards');
    if (!container) return;
    container.innerHTML = '';
    const cards = UI.buildSummaryCards(state, currentMonth);
    cards.forEach((c) => container.appendChild(c));
  }

  function renderBalanceSection() {
    const section = $('#balanceSection');
    if (!section) return;
    const newSection = UI.buildBalanceSection(state, currentMonth);
    section.innerHTML = '';
    section.appendChild(newSection.querySelector('.section-header'));
    section.appendChild(newSection.querySelector('p.section-hint'));
    section.appendChild(newSection.querySelector('.balance-card'));
  }

  function renderBudgets() {
    const list = $('#budgetList');
    if (!list) return;
    list.innerHTML = '';
    UI.buildBudgetSection(state, currentMonth).querySelector('.items-list').childNodes.forEach((c) => {
      list.appendChild(c);
    });
    // Actually, buildBudgetSection returns a wrapper. Let me just rebuild fully.
    const section = document.getElementById('budgetSection');
    if (!section) return;
    section.innerHTML = '';
    const newS = UI.buildBudgetSection(state, currentMonth);
    while (newS.firstChild) section.appendChild(newS.firstChild);
  }

  function renderPending() {
    const section = document.getElementById('pendingOptionalSection');
    if (!section) return;
    section.innerHTML = '';
    const newS = UI.buildPendingSection(state, currentMonth);
    while (newS.firstChild) section.appendChild(newS.firstChild);
  }

  function renderMonthItems() {
    const section = document.getElementById('monthItemsSection');
    if (!section) return;
    section.innerHTML = '';
    const newS = UI.buildMonthItemsSection(state, currentMonth);
    while (newS.firstChild) section.appendChild(newS.firstChild);
  }

  function renderAllExpenses() {
    const list = $('#allExpensesList');
    if (!list) return;
    list.innerHTML = '';
    UI.buildAllExpensesSection(state).querySelector('.items-list').childNodes.forEach((c) => list.appendChild(c));
  }

  function renderAllIncome() {
    const list = $('#allIncomeList');
    if (!list) return;
    list.innerHTML = '';
    UI.buildAllIncomeSection(state).querySelector('.items-list').childNodes.forEach((c) => list.appendChild(c));
  }

  function renderTimeline() {
    const list = $('#timelineList');
    if (!list) return;
    list.innerHTML = '';
    UI.buildTimelineSection(state).querySelector('.items-list').childNodes.forEach((c) => list.appendChild(c));
  }

  function renderInactiveExpenses() {
    const list = $('#inactiveExpensesList');
    if (!list) return;
    list.innerHTML = '';
    UI.buildInactiveExpensesSection(state).querySelector('.items-list').childNodes.forEach((c) => list.appendChild(c));
  }

  function renderCreditCardsView() {
    const section = document.getElementById('creditCardsSection');
    if (!section) return;
    section.innerHTML = '';
    const newS = UI.buildCreditCardSection(state);
    while (newS.firstChild) section.appendChild(newS.firstChild);
  }

  function renderSubcategoriesView() {
    const section = document.getElementById('subcategoriesSection');
    if (!section) return;
    section.innerHTML = '';
    const newS = UI.buildSubcategoriesSection(state);
    while (newS.firstChild) section.appendChild(newS.firstChild);
  }

  // ---------- Persistence ----------
  function persist() {
    S.save(state);
  }

  // ---------- App version ----------
  function applyAppVersion() {
    const v = (typeof self !== 'undefined' && self.APP_VERSION)
      || (typeof window !== 'undefined' && window.APP_VERSION)
      || '';
    if (!v) return;
    document.querySelectorAll('[data-app-version]').forEach((el) => {
      el.textContent = v;
    });
  }

  // ---------- Settings ----------
  function bindSettings() {
    const startDay = $('#settingStartDay');
    for (let d = 1; d <= 28; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      startDay.appendChild(opt);
    }
    $('#settingCurrency').value = state.settings.currency;
    $('#settingTheme').value = state.settings.theme;
    $('#settingStartDay').value = state.settings.startDayOfMonth;
    $('#settingCurrency').addEventListener('change', (e) => {
      state = A.updateSettings(state, { currency: e.target.value });
      persist();
      render();
    });
    $('#settingTheme').addEventListener('change', (e) => {
      state = A.updateSettings(state, { theme: e.target.value });
      persist();
      applyTheme();
    });
    $('#settingStartDay').addEventListener('change', (e) => {
      state = A.updateSettings(state, { startDayOfMonth: parseInt(e.target.value, 10) });
      persist();
    });
  }

  function applyTheme() {
    const theme = state.settings.theme;
    const root = document.documentElement;
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      root.dataset.theme = mq.matches ? 'dark' : 'light';
    } else {
      root.dataset.theme = theme;
    }
  }

  // ---------- Utilities ----------
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.from(document.querySelectorAll(s)); }
  function toast(msg, dur = 2200) {
    const c = $('#toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      setTimeout(() => t.remove(), 300);
    }, dur);
  }
  function closeModal(id) { UI.closeModal(id); }
  function changeMonth(delta) {
    currentMonth = M.addMonths(currentMonth, delta);
    updateMonthLabel();
    render();
  }

  // ---------- Event wiring ----------
  function bindEvents() {
    document.querySelectorAll('.nav-item').forEach((n) => {
      n.addEventListener('click', () => setView(n.dataset.nav));
    });
    $('#btnPrevMonth').addEventListener('click', () => changeMonth(-1));
    $('#btnNextMonth').addEventListener('click', () => changeMonth(1));
    $('#currentMonthPill').addEventListener('click', () => {
      currentMonth = M.todayMonthKey();
      updateMonthLabel();
      render();
    });
    $('#fabAdd').addEventListener('click', () => openExpenseForm());

    $('#btnNewExpense').addEventListener('click', () => openExpenseForm());
    $('#btnNewIncome').addEventListener('click', () => openIncomeForm());
    $('#btnNewBudget').addEventListener('click', () => openBudgetForm());
    $('#btnNewSubcategory').addEventListener('click', () => openSubcategoryForm());
    $('#btnNewCreditCard').addEventListener('click', () => openCreditCardForm());

    $('#formExpense').addEventListener('submit', submitExpenseForm);
    $('#formIncome').addEventListener('submit', submitIncomeForm);
    $('#formBudget').addEventListener('submit', submitBudgetForm);
    $('#formSubcategory').addEventListener('submit', submitSubcategoryForm);
    $('#formCreditCard').addEventListener('submit', submitCreditCardForm);

    $('#btnDeleteExpense').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (id && confirm('¿Eliminar este gasto?')) {
        try { state = A.deleteExpense(state, id); persist(); closeModal('modalExpense'); render(); toast('Gasto eliminado'); }
        catch (e) { toast(e.message); }
      }
    });
    $('#btnConvertToBudget').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (id) openConvertToBudget(id);
    });
    $('#btnConvertToUnico').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (id) openConvertToUnico(id);
    });
    $('#btnDeleteIncome').addEventListener('click', () => {
      const id = $('#incomeId').value;
      if (id && confirm('¿Eliminar este ingreso?')) {
        try { state = A.deleteIncome(state, id); persist(); closeModal('modalIncome'); render(); toast('Ingreso eliminado'); }
        catch (e) { toast(e.message); }
      }
    });
    $('#btnDeleteBudget').addEventListener('click', () => {
      const id = $('#budgetId').value;
      if (id && confirm('¿Eliminar este presupuesto?')) {
        try { state = A.deleteBudget(state, id); persist(); closeModal('modalBudget'); render(); toast('Presupuesto eliminado'); }
        catch (e) { toast(e.message); }
      }
    });
    $('#btnDeleteSubcategory').addEventListener('click', () => {
      const id = $('#subcategoryId').value;
      if (id) {
        const counts = M.deleteSubcategory(state, id);
        const total = counts.expenseCount + counts.incomeCount + counts.budgetCount;
        const msg = total > 0
          ? `Esta subcategoría está usada en ${total} movimiento(s). Se desvinculará pero no se borrarán. ¿Continuar?`
          : '¿Eliminar esta subcategoría?';
        if (confirm(msg)) {
          try { state = A.deleteSubcategory(state, id, true); persist(); closeModal('modalSubcategory'); render(); toast('Subcategoría eliminada'); }
          catch (e) { toast(e.message); }
        }
      }
    });
    $('#btnDeleteCreditCard').addEventListener('click', () => {
      const id = $('#creditCardId').value;
      if (id && confirm('¿Eliminar esta tarjeta? También se desvincularán los gastos.')) {
        try { state = A.deleteCreditCard(state, id); persist(); closeModal('modalCreditCard'); render(); toast('Tarjeta eliminada'); }
        catch (e) { toast(e.message); }
      }
    });

    // Filtros
    $$('#expenseFilters .chip').forEach((c) => {
      c.addEventListener('click', () => {
        $$('#expenseFilters .chip').forEach((x) => x.classList.remove('chip-active'));
        c.classList.add('chip-active');
        currentFilter = c.dataset.filter;
        renderAllExpenses();
      });
    });

    // Saldo
    $('#btnUpdateBalance').addEventListener('click', openSetBalanceModal);
    $('#formSetBalance').addEventListener('submit', submitSetBalance);
    $('#formUpdateBalance').addEventListener('submit', submitUpdateBalance);
    $('#formExtraPayment').addEventListener('submit', submitExtraPayment);

    // Icon picker
    $('#btnBudgetIcon').addEventListener('click', () => openIconPicker('budget'));
    $('#btnSubcategoryIcon').addEventListener('click', () => openIconPicker('subcategory'));
    $('#btnCreditCardIcon').addEventListener('click', () => openIconPicker('creditcard'));

    // Datos
    $('#btnExport').addEventListener('click', () => { S.exportJSON(state); toast('Exportado'); });
    $('#btnImport').addEventListener('click', () => {
      $('#fileImport').value = '';
      $('#fileImport').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (!confirm('¿Reemplazar todos los datos actuales?')) return;
          const newState = await S.importJSON(parsed);
          state = newState;
          persist();
          render();
          toast('Importado');
        } catch (err) {
          toast('Error: ' + err.message);
        }
      };
      $('#fileImport').click();
    });
    $('#btnSeed').addEventListener('click', () => {
      if (!confirm('Esto añadirá datos de ejemplo. ¿Continuar?')) return;
      try { state = A.seedExampleData(state); persist(); render(); toast('Datos cargados'); }
      catch (e) { toast(e.message); }
    });
    $('#btnReset').addEventListener('click', () => {
      if (!confirm('¿Borrar TODOS los datos?')) return;
      if (!confirm('¿Seguro? Se perderán gastos, ingresos, etc.')) return;
      try { state = A.resetState(); persist(); render(); toast('Datos borrados'); }
      catch (e) { toast(e.message); }
    });

    // Modal close (backdrop)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-close]');
      if (!btn) return;
      const modal = btn.closest('.modal');
      if (modal) UI.closeModal(modal.id);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = $$('.modal.modal-open');
        if (open.length) UI.closeModal(open[open.length - 1].id);
      }
    });
  }

  function openIconPicker(context) {
    const preview = $('#' + context + 'IconPreview');
    const current = preview.textContent.trim();
    UI.el.exposed_openIconPicker && UI.el.exposed_openIconPicker(current, (icon) => {
      preview.textContent = icon;
    });
  }

  // ---------- Views ----------
  function setView(name) {
    $$('.view').forEach((v) => v.classList.toggle('view-active', v.dataset.view === name));
    $$('.nav-item').forEach((n) => n.classList.toggle('nav-active', n.dataset.nav === name));
    const fab = $('#fabAdd');
    if (fab) fab.style.display = (name === 'resumen') ? '' : 'none';
    if (name === 'categorias') renderSubcategoriesView();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Init ----------
  function init() {
    applyAppVersion();
    applyTheme();
    bindEvents();
    bindSettings();
    updateMonthLabel();
    render();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
