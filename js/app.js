/* ============================================
   app.js - Lógica de UI de "Mis Gastos"
   ============================================ */

(function () {
  'use strict';

  const M = window.Models;
  const S = window.Storage;

  // ---------- Estado ----------
  let state = S.load();
  let currentMonth = M.todayMonthKey();
  let currentFilter = 'all';
  let iconPickerCallback = null;
  let pendingConvertExpense = null;
  let pendingConvertBudget = null;

  // ---------- Helpers DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'dataset') Object.assign(node.dataset, attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(node.style, attrs[k]);
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (attrs[k] === true) node.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fmt(amount) {
    return M.formatMoney(amount, state.settings.currency);
  }

  function persist() {
    S.save(state);
  }

  // ---------- Toast ----------
  function toast(message, duration = 2200) {
    const container = $('#toastContainer');
    const t = el('div', { class: 'toast' }, message);
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  // ---------- Tema ----------
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

  // ---------- Navegación ----------
  function setView(name) {
    $$('.view').forEach((v) => v.classList.toggle('view-active', v.dataset.view === name));
    $$('.nav-item').forEach((n) => n.classList.toggle('nav-active', n.dataset.nav === name));
    const fab = $('#fabAdd');
    if (fab) fab.style.display = (name === 'resumen') ? '' : 'none';
    if (name === 'categorias') renderSubcategoriesView();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ---------- Header / Mes ----------
  function updateMonthLabel() {
    $('#currentMonthLabel').textContent = M.monthKeyToLabel(currentMonth);
    $('#headerSubtitle').textContent = (currentMonth === M.todayMonthKey())
      ? 'Mes actual'
      : M.monthKeyToLabel(currentMonth);
  }

  function changeMonth(delta) {
    currentMonth = M.addMonths(currentMonth, delta);
    updateMonthLabel();
    render();
  }

  // ---------- Icon picker ----------
  function openIconPicker(currentIcon, onPick) {
    iconPickerCallback = onPick;
    const body = $('#iconPickerBody');
    body.innerHTML = '';
    M.ICON_OPTIONS.forEach((group) => {
      const groupEl = el('div', { class: 'picker-group' });
      groupEl.appendChild(el('div', { class: 'picker-group-title' }, group.group));
      const grid = el('div', { class: 'picker-grid' });
      group.icons.forEach((icon) => {
        const btn = el('button', {
          type: 'button',
          class: 'picker-icon' + (icon === currentIcon ? ' picker-icon-active' : ''),
          onClick: () => pickIcon(icon)
        }, icon);
        grid.appendChild(btn);
      });
      groupEl.appendChild(grid);
      body.appendChild(groupEl);
    });
    openModal('iconPickerPopup');
  }

  function pickIcon(icon) {
    if (iconPickerCallback) iconPickerCallback(icon);
    iconPickerCallback = null;
    closeModal('iconPickerPopup');
  }

  // ---------- Modales ----------
  function openModal(id) {
    const m = $('#' + id);
    if (!m) return;
    m.classList.add('modal-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open-body');
  }

  function closeModal(id) {
    const m = $('#' + id);
    if (!m) return;
    m.classList.remove('modal-open');
    m.setAttribute('aria-hidden', 'true');
    if (!$$('.modal.modal-open').length) {
      document.body.classList.remove('modal-open-body');
    }
  }

  function bindModalCloseButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-close]');
      if (!btn) return;
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal.id);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = $$('.modal.modal-open');
        if (open.length) closeModal(open[open.length - 1].id);
      }
    });
  }

  // ---------- Catálogo de categorías en select ----------
  function fillCategorySelect(select, includeIncome = false) {
    select.innerHTML = '';
    Object.entries(M.CATEGORIES).forEach(([key, cat]) => {
      if (!includeIncome && (key === 'nomina' || key === 'freelance' || key === 'alquiler' || key === 'inversiones')) return;
      if (includeIncome && (key === 'hogar' || key === 'suscripciones' || key === 'transporte' || key === 'comida' || key === 'salud' || key === 'ocio' || key === 'educacion' || key === 'seguros' || key === 'deudas' || key === 'regalos' || key === 'extras' || key === 'otros')) return;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${cat.icon} ${cat.label}`;
      select.appendChild(opt);
    });
  }

  // ---------- Subcategorías: poblar select ----------
  function fillSubcategorySelect(select, categoryKey, selectedId = '', context = 'expense') {
    select.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    if (!categoryKey) {
      noneOpt.textContent = '— Primero elige categoría —';
    } else if (context === 'budget') {
      noneOpt.textContent = '— Todas las de la categoría —';
    } else {
      noneOpt.textContent = '— Ninguna —';
    }
    select.appendChild(noneOpt);
    if (!categoryKey) return;
    const subs = M.getSubcategoriesForCategory(state, categoryKey);
    subs.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.icon} ${s.label}`;
      if (s.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function updateSubcategoryControls() {
    const cat = $('#expenseCategory').value;
    const prevSelected = $('#expenseSubcategory').dataset.selected || '';
    fillSubcategorySelect($('#expenseSubcategory'), cat, prevSelected);
    autoSelectSubcategoryForCategory(cat, prevSelected);
    updateSubcategoryHint(cat);
  }

  function updateBudgetSubcategoryControls() {
    const cat = $('#budgetCategory').value;
    fillSubcategorySelect($('#budgetSubcategory'), cat, $('#budgetSubcategory').dataset.selected || '', 'budget');
  }

  function fillBudgetSelect(select, selectedId = '') {
    select.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— Sin asignar —';
    select.appendChild(none);
    const today = M.todayMonthKey();
    state.budgets
      .filter((b) => M.appliesBudgetToMonth(b, today))
      .sort((a, b) => a.category.localeCompare(b.category) || a.amount - b.amount)
      .forEach((b) => {
        const sub = b.subcategoryId ? M.getSubcategory(state, b.subcategoryId) : null;
        const label = sub
          ? `${M.CATEGORIES[b.category].label} · ${sub.label} (${fmt(b.amount)})`
          : `${M.CATEGORIES[b.category].label} (${fmt(b.amount)})`;
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.effectiveIcon || M.CATEGORIES[b.category].icon} ${label}`;
        if (b.id === selectedId) opt.selected = true;
        select.appendChild(opt);
      });
  }

  function autoSelectSubcategoryForCategory(categoryKey, prevSelected) {
    if (prevSelected) return;
    const subSel = $('#expenseSubcategory');
    const budget = state.budgets.find((b) => b.category === categoryKey && b.subcategoryId);
    if (budget) {
      const hasMultiple = state.budgets.filter((b) => b.category === categoryKey && b.subcategoryId).length > 1;
      if (!hasMultiple) {
        subSel.value = budget.subcategoryId;
      }
    }
  }

  function updateSubcategoryHint(categoryKey) {
    const hint = $('#expenseSubcategoryHint');
    if (!hint) return;
    const categoryBudgets = state.budgets.filter((b) => b.category === categoryKey && b.subcategoryId);
    if (categoryBudgets.length === 0) {
      hint.style.display = 'none';
      return;
    }
    const subSel = $('#expenseSubcategory');
    const names = categoryBudgets.map((b) => {
      const sub = M.getSubcategory(state, b.subcategoryId);
      return sub ? `${sub.icon} ${sub.label}` : '?';
    }).join(', ');
    if (subSel.value) {
      const matched = categoryBudgets.find((b) => b.subcategoryId === subSel.value);
      hint.textContent = matched
        ? '✓ Este gasto contará en el presupuesto de esa subcategoría.'
        : `Hay presupuesto(s) para: ${names}. Cámbialo si quieres que cuente.`;
    } else {
      hint.textContent = `Tienes presupuesto(s) para: ${names}. Elige una subcategoría para que el gasto se contabilice.`;
    }
    hint.style.display = '';
  }

  // ---------- Compra rápida ----------
  function openPurchaseModal() {
    $('#formPurchase').reset();
    $('#purchaseDate').value = M.toISODate(new Date());
    const budgets = M.getBudgetsForMonth(state, currentMonth);
    const sel = $('#purchaseBudget');
    sel.innerHTML = '';
    if (budgets.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— No hay presupuestos —';
      sel.appendChild(opt);
      sel.disabled = true;
      $('#purchaseNoBudgetHint').style.display = '';
    } else {
      sel.disabled = false;
      $('#purchaseNoBudgetHint').style.display = 'none';
      const def = document.createElement('option');
      def.value = '';
      def.textContent = '— Selecciona presupuesto —';
      sel.appendChild(def);
      budgets.forEach((b) => {
        const sub = b.subcategoryId ? M.getSubcategory(state, b.subcategoryId) : null;
        const label = sub
          ? `${b.effectiveIcon} ${M.CATEGORIES[b.category].label} · ${sub.label}`
          : `${b.effectiveIcon} ${M.CATEGORIES[b.category].label}`;
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${label} (${fmt(b.amount)})`;
        sel.appendChild(opt);
      });
    }
    $('#purchaseTitle').textContent = 'Añadir gasto';
    openModal('modalPurchase');
    setTimeout(() => $('#purchaseName').focus(), 60);
  }

  function submitPurchaseForm(e) {
    e.preventDefault();
    const budgetId = $('#purchaseBudget').value;
    if (!budgetId) { toast('Selecciona un presupuesto'); return; }
    const budget = state.budgets.find((b) => b.id === budgetId);
    if (!budget) { toast('Presupuesto no válido'); return; }
    const name = $('#purchaseName').value.trim();
    const amount = parseFloat($('#purchaseAmount').value);
    const date = $('#purchaseDate').value || M.toISODate(new Date());
    if (!name) { toast('Concepto vacío'); return; }
    if (!amount || amount <= 0) { toast('Importe no válido'); return; }

    const targetMonth = date.slice(0, 7);
    const expense = M.normalizeExpense({
      name,
      amount,
      type: 'variable',
      category: budget.category,
      subcategoryId: budget.subcategoryId,
      budgetId: budget.id,
      targetMonth,
      startDate: date,
      notes: ''
    });
    state.expenses.push(expense);
    persist();
    closeModal('modalPurchase');
    toast('Gasto añadido');
    render();
  }

  // ---------- Gasto (fijo / temporal) ----------
  function openExpenseForm(id = null) {
    const form = $('#formExpense');
    form.reset();
    $('#expenseId').value = '';
    $('#btnDeleteExpense').style.display = 'none';
    $('#btnConvertToBudget').style.display = 'none';
    $('#expenseMonthWrap').style.display = 'none';
    $('#expenseEndWrap').style.display = '';
    $('#expenseStartDate').value = M.toISODate(new Date());
    $('#expenseSubcategory').dataset.selected = '';
    fillCategorySelect($('#expenseCategory'));
    fillSubcategorySelect($('#expenseSubcategory'), $('#expenseCategory').value);
    autoSelectSubcategoryForCategory($('#expenseCategory').value, '');
    updateSubcategoryHint($('#expenseCategory').value);
    setExpenseType('fixed');

    if (id) {
      const item = state.expenses.find((e) => e.id === id);
      if (!item) return;
      $('#expenseTitle').textContent = 'Editar gasto';
      $('#expenseId').value = item.id;
      $('#expenseName').value = item.name;
      $('#expenseAmount').value = item.amount;
      $('#expenseCategory').value = item.category;
      $('#expenseSubcategory').dataset.selected = item.subcategoryId || '';
      fillSubcategorySelect($('#expenseSubcategory'), item.category, item.subcategoryId || '');
      fillBudgetSelect($('#expenseBudget'), item.budgetId || '');
      const itemType = ['fixed', 'temporary', 'unico'].includes(item.type) ? item.type : 'fixed';
      setExpenseType(itemType);
      $('#expenseStartDate').value = item.startDate || M.toISODate(new Date());
      $('#expenseEndDate').value = item.endDate || '';
      $('#expenseMonth').value = item.targetMonth || currentMonth;
      $('#expenseOptional').checked = !!item.optional;
      $('#expenseInactive').checked = !!item.inactive;
      $('#expenseNotes').value = item.notes || '';
      $('#btnDeleteExpense').style.display = 'inline-flex';
      $('#btnConvertToBudget').style.display = 'inline-flex';
      $('#btnConvertToUnico').style.display = ['fixed', 'temporary'].includes(item.type) ? 'inline-flex' : 'none';
      renderAmountHistory('expense', item.amountHistory || []);
      updateSubcategoryHint(item.category);
    } else {
      $('#expenseTitle').textContent = 'Nuevo gasto';
      $('#expenseInactive').checked = false;
      $('#expenseMonth').value = currentMonth;
      fillBudgetSelect($('#expenseBudget'), '');
      renderAmountHistory('expense', []);
    }
    openModal('modalExpense');
    setTimeout(() => $('#expenseName').focus(), 60);
  }

  function setExpenseType(type) {
    $$('#expenseTypeSeg .seg').forEach((b) => {
      b.classList.toggle('seg-active', b.dataset.type === type);
    });
    const isFixed = (type === 'fixed');
    const isUnico = (type === 'unico');
    $('#expenseEndWrap').style.display = isFixed || isUnico ? 'none' : '';
    $('#expenseMonthWrap').style.display = isUnico ? '' : 'none';
    $('#expenseOptionalWrap').style.display = isUnico ? 'none' : '';
    $('#expenseDateWrap').style.display = isUnico ? 'none' : '';
    if (isUnico) {
      $('#expenseTypeHint').textContent = 'Un pago puntual que solo cuenta en el mes elegido. Útil para compras que haces una vez o pasaron a la app como fijas.';
    } else if (isFixed) {
      $('#expenseTypeHint').textContent = 'Se repite cada mes hasta que lo elimines. Para compras del día a día vinculadas a un presupuesto, usa el botón "+".';
    } else {
      $('#expenseTypeHint').textContent = 'Se repite cada mes hasta la fecha de fin. Útil para gastos puntuales que duran unos meses.';
    }
  }

  function renderAmountHistory(kind, history) {
    const ul = $('#' + kind + 'AmountHistory');
    ul.innerHTML = '';
    if (!history.length) {
      ul.appendChild(el('li', { class: 'amount-history-empty' }, 'Sin cambios aún.'));
      return;
    }
    history.forEach((entry, idx) => {
      const li = el('li', { class: 'amount-history-item' },
        el('span', { class: 'amount-history-date' }, M.formatShortDate(entry.fromDate)),
        el('span', { class: 'amount-history-amount' }, fmt(entry.amount)),
        el('button', {
          type: 'button',
          class: 'amount-history-remove',
          'aria-label': 'Eliminar',
          onClick: () => {
            history.splice(idx, 1);
            renderAmountHistory(kind, history);
          }
        }, '×')
      );
      ul.appendChild(li);
    });
  }

  function addAmountHistoryEntry(kind) {
    const date = prompt('¿Desde qué fecha? (YYYY-MM-DD)');
    if (!date) return;
    const amountStr = prompt('¿Nuevo importe?');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (!amount || amount < 0) { toast('Importe no válido'); return; }
    const ul = $('#' + kind + 'AmountHistory');
    let history = [];
    ul.querySelectorAll('.amount-history-item').forEach((li) => {
      history.push({
        fromDate: li.querySelector('.amount-history-date').textContent,
        amount: parseFloat(li.querySelector('.amount-history-amount').textContent.replace(/[^\d,.-]/g, '').replace(',', '.'))
      });
    });
    history.push({ fromDate: date, amount });
    history.sort((a, b) => a.fromDate.localeCompare(b.fromDate));
    renderAmountHistory(kind, history);
  }

  function submitExpenseForm(e) {
    e.preventDefault();
    const id = $('#expenseId').value;
    const type = $('#expenseTypeSeg .seg-active').dataset.type;
    const name = $('#expenseName').value.trim();
    const amount = parseFloat($('#expenseAmount').value);
    const category = $('#expenseCategory').value;
    const subcategoryId = $('#expenseSubcategory').value || null;
    const budgetId = $('#expenseBudget').value || null;
    const startDate = $('#expenseStartDate').value;
    const endDate = $('#expenseEndDate').value || null;
    const optional = $('#expenseOptional').checked;
    const inactive = $('#expenseInactive').checked;
    const notes = $('#expenseNotes').value.trim();
    const targetMonth = type === 'unico' ? ($('#expenseMonth').value || currentMonth) : null;

    if (!name) { toast('Concepto vacío'); return; }
    if (!amount || amount < 0) { toast('Importe no válido'); return; }

    const history = [];
    $$('#expenseAmountHistory .amount-history-item').forEach((li) => {
      history.push({
        fromDate: li.querySelector('.amount-history-date').textContent,
        amount: parseFloat(li.querySelector('.amount-history-amount').textContent.replace(/[^\d,.-]/g, '').replace(',', '.'))
      });
    });

    const payload = {
      name, amount, type, category, subcategoryId, budgetId, startDate, endDate, optional, inactive, notes,
      targetMonth,
      amountHistory: history
    };

    if (id) {
      const item = state.expenses.find((e) => e.id === id);
      if (!item) return;
      Object.assign(item, payload, { updatedAt: new Date().toISOString() });
      toast('Gasto actualizado');
    } else {
      const expense = M.normalizeExpense(payload);
      state.expenses.push(expense);
      toast('Gasto añadido');
    }
    persist();
    closeModal('modalExpense');
    render();
  }

  function deleteExpense(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    state.expenses = state.expenses.filter((e) => e.id !== id);
    persist();
    closeModal('modalExpense');
    toast('Gasto eliminado');
    render();
  }

  function convertExpenseToUnico(id) {
    const original = state.expenses.find((e) => e.id === id);
    if (!original) return;
    if (!confirm('¿Convertir este gasto a un pago único este mes? Dejará de repetirse.')) return;
    const today = M.toISODate(new Date());
    original.type = 'unico';
    original.targetMonth = currentMonth;
    original.startDate = today;
    original.endDate = null;
    original.oneTime = true;
    original.optional = false;
    original.paidMonths = {};
    original.skippedMonths = {};
    original.pendingMonths = {};
    original.updatedAt = new Date().toISOString();
    persist();
    closeModal('modalExpense');
    render();
    toast('Convertido a gasto único');
  }

  // ---------- Convertir gasto en presupuesto ----------
  function convertExpenseToBudget(expenseId) {
    const expense = state.expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    if (expense.type !== 'fixed' && expense.type !== 'temporary') return;
    const conflict = M.findConflictingBudget(
      state,
      expense.category,
      expense.subcategoryId,
      expense.startDate,
      expense.endDate
    );
    pendingConvertExpense = expense;
    pendingConvertBudget = conflict;
    if (conflict) {
      const sub = expense.subcategoryId ? M.getSubcategory(state, expense.subcategoryId) : null;
      const catLabel = M.CATEGORIES[expense.category].label;
      const subLabel = sub ? ` / ${sub.label}` : '';
      $('#conflictInfo').textContent = `Ya hay un presupuesto para ${catLabel}${subLabel} en ese rango (${fmt(conflict.amount)}). ¿Qué prefieres hacer con los ${fmt(expense.amount)} del gasto?`;
      openModal('modalBudgetConflict');
    } else {
      doConvert('replace');
    }
  }

  function doConvert(mode) {
    const expense = pendingConvertExpense;
    const conflict = pendingConvertBudget;
    if (!expense) return;
    if (conflict) {
      if (mode === 'replace') {
        conflict.amount = expense.amount;
        conflict.icon = expense.icon || conflict.icon;
        conflict.notes = expense.notes || conflict.notes;
        conflict.subcategoryId = expense.subcategoryId || conflict.subcategoryId;
        conflict.updatedAt = new Date().toISOString();
      } else if (mode === 'sum') {
        conflict.amount = (conflict.amount || 0) + expense.amount;
        conflict.updatedAt = new Date().toISOString();
      }
    } else if (mode === 'replace') {
      const budget = M.normalizeBudget({
        category: expense.category,
        subcategoryId: expense.subcategoryId,
        amount: expense.amount,
        icon: expense.icon || null,
        startDate: expense.startDate,
        endDate: expense.endDate,
        notes: expense.notes || ''
      });
      state.budgets.push(budget);
    }
    state.expenses = state.expenses.filter((e) => e.id !== expense.id);
    persist();
    closeModal('modalExpense');
    closeModal('modalBudgetConflict');
    pendingConvertExpense = null;
    pendingConvertBudget = null;
    toast('Convertido en presupuesto');
    render();
  }

  // ---------- Ingreso ----------
  function openIncomeForm(id = null) {
    const form = $('#formIncome');
    form.reset();
    $('#incomeId').value = '';
    $('#btnDeleteIncome').style.display = 'none';
    $('#incomeMonthWrap').style.display = 'none';
    $('#incomeEndWrap').style.display = 'none';
    $('#incomeStartDate').value = M.toISODate(new Date());
    setIncomeType('recurring');

    if (id) {
      const item = state.income.find((i) => i.id === id);
      if (!item) return;
      $('#incomeTitle').textContent = 'Editar ingreso';
      $('#incomeId').value = item.id;
      $('#incomeName').value = item.name;
      $('#incomeAmount').value = item.amount;
      setIncomeType(['recurring', 'extra'].includes(item.type) ? item.type : 'recurring');
      $('#incomeStartDate').value = item.startDate || M.toISODate(new Date());
      $('#incomeEndDate').value = item.endDate || '';
      $('#incomeNotes').value = item.notes || '';
      $('#btnDeleteIncome').style.display = 'inline-flex';
      renderAmountHistory('income', item.amountHistory || []);
    } else {
      $('#incomeTitle').textContent = 'Nuevo ingreso';
      renderAmountHistory('income', []);
    }
    openModal('modalIncome');
    setTimeout(() => $('#incomeName').focus(), 60);
  }

  function setIncomeType(type) {
    $$('#incomeTypeSeg .seg').forEach((b) => {
      b.classList.toggle('seg-active', b.dataset.type === type);
    });
    const isRecurring = (type === 'recurring');
    $('#incomeEndWrap').style.display = isRecurring ? '' : 'none';
    $('#incomeMonthWrap').style.display = isRecurring ? 'none' : '';
    $('#incomeTypeHint').textContent = isRecurring
      ? 'Se repite cada mes hasta que lo elimines.'
      : 'Aparece solo en el mes que indiques.';
  }

  function submitIncomeForm(e) {
    e.preventDefault();
    const id = $('#incomeId').value;
    const type = $('#incomeTypeSeg .seg-active').dataset.type;
    const name = $('#incomeName').value.trim();
    const amount = parseFloat($('#incomeAmount').value);
    const startDate = $('#incomeStartDate').value;
    const endDate = $('#incomeEndDate').value || null;
    const month = $('#incomeMonth').value || null;
    const notes = $('#incomeNotes').value.trim();

    if (!name) { toast('Concepto vacío'); return; }
    if (!amount || amount < 0) { toast('Importe no válido'); return; }

    const history = [];
    $$('#incomeAmountHistory .amount-history-item').forEach((li) => {
      history.push({
        fromDate: li.querySelector('.amount-history-date').textContent,
        amount: parseFloat(li.querySelector('.amount-history-amount').textContent.replace(/[^\d,.-]/g, '').replace(',', '.'))
      });
    });

    const payload = {
      name, amount, type, category: 'nomina', startDate, endDate, notes,
      targetMonth: type === 'extra' ? month : null,
      amountHistory: history
    };

    if (id) {
      const item = state.income.find((i) => i.id === id);
      if (!item) return;
      Object.assign(item, payload, { updatedAt: new Date().toISOString() });
      toast('Ingreso actualizado');
    } else {
      const income = M.normalizeIncome(payload);
      state.income.push(income);
      toast('Ingreso añadido');
    }
    persist();
    closeModal('modalIncome');
    render();
  }

  function deleteIncome(id) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    state.income = state.income.filter((i) => i.id !== id);
    persist();
    closeModal('modalIncome');
    toast('Ingreso eliminado');
    render();
  }

  // ---------- Presupuesto ----------
  function openBudgetForm(id = null) {
    const form = $('#formBudget');
    form.reset();
    $('#budgetId').value = '';
    $('#btnDeleteBudget').style.display = 'none';
    $('#budgetSubcategory').dataset.selected = '';
    fillCategorySelect($('#budgetCategory'));
    fillSubcategorySelect($('#budgetSubcategory'), $('#budgetCategory').value, '', 'budget');
    $('#budgetStartDate').value = M.toISODate(new Date());
    $('#budgetStartDate').value = M.toISODate(new Date());
    $('#budgetEndDate').value = '';
    $('#budgetIconPreview').textContent = '💼';

    if (id) {
      const item = state.budgets.find((b) => b.id === id);
      if (!item) return;
      $('#budgetTitle').textContent = 'Editar presupuesto';
      $('#budgetId').value = item.id;
      $('#budgetAmount').value = item.amount;
      $('#budgetCategory').value = item.category;
      $('#budgetSubcategory').dataset.selected = item.subcategoryId || '';
      fillSubcategorySelect($('#budgetSubcategory'), item.category, item.subcategoryId || '', 'budget');
      $('#budgetStartDate').value = item.startDate || M.toISODate(new Date());
      $('#budgetEndDate').value = item.endDate || '';
      $('#budgetNotes').value = item.notes || '';
      $('#budgetIconPreview').textContent = item.icon || M.CATEGORIES[item.category].icon;
      $('#btnDeleteBudget').style.display = 'inline-flex';
    } else {
      $('#budgetTitle').textContent = 'Nuevo presupuesto';
    }
    openModal('modalBudget');
    setTimeout(() => $('#budgetAmount').focus(), 60);
  }

  function submitBudgetForm(e) {
    e.preventDefault();
    const id = $('#budgetId').value;
    const amount = parseFloat($('#budgetAmount').value);
    const category = $('#budgetCategory').value;
    const subcategoryId = $('#budgetSubcategory').value || null;
    const startDate = $('#budgetStartDate').value;
    const endDate = $('#budgetEndDate').value || null;
    const icon = $('#budgetIconPreview').textContent.trim() || null;
    const notes = $('#budgetNotes').value.trim();

    if (!amount || amount < 0) { toast('Importe no válido'); return; }

    const payload = { amount, category, subcategoryId, startDate, endDate, icon, notes };
    if (id) {
      const item = state.budgets.find((b) => b.id === id);
      if (!item) return;
      Object.assign(item, payload, { updatedAt: new Date().toISOString() });
      toast('Presupuesto actualizado');
    } else {
      const budget = M.normalizeBudget(payload);
      state.budgets.push(budget);
      toast('Presupuesto añadido');
    }
    persist();
    closeModal('modalBudget');
    render();
  }

  function deleteBudget(id) {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    state.budgets = state.budgets.filter((b) => b.id !== id);
    state.expenses.forEach((e) => { if (e.budgetId === id) e.budgetId = null; });
    persist();
    closeModal('modalBudget');
    toast('Presupuesto eliminado');
    render();
  }

  // ---------- Subcategoría ----------
  function openSubcategoryForm(id = null) {
    const form = $('#formSubcategory');
    form.reset();
    $('#subcategoryId').value = '';
    $('#btnDeleteSubcategory').style.display = 'none';
    fillCategorySelect($('#subcategoryCategory'));
    $('#subcategoryIconPreview').textContent = '📦';

    if (id) {
      const item = state.subcategories.find((s) => s.id === id);
      if (!item) return;
      $('#subcategoryTitle').textContent = 'Editar subcategoría';
      $('#subcategoryId').value = item.id;
      $('#subcategoryLabel').value = item.label;
      $('#subcategoryCategory').value = item.category;
      $('#subcategoryIconPreview').textContent = item.icon;
      $('#btnDeleteSubcategory').style.display = 'inline-flex';
    } else {
      $('#subcategoryTitle').textContent = 'Nueva subcategoría';
    }
    openModal('modalSubcategory');
    setTimeout(() => $('#subcategoryLabel').focus(), 60);
  }

  function submitSubcategoryForm(e) {
    e.preventDefault();
    const id = $('#subcategoryId').value;
    const label = $('#subcategoryLabel').value.trim();
    const category = $('#subcategoryCategory').value;
    const icon = $('#subcategoryIconPreview').textContent.trim() || '📦';

    if (!label) { toast('Nombre vacío'); return; }

    const payload = { label, category, icon };
    if (id) {
      const item = state.subcategories.find((s) => s.id === id);
      if (!item) return;
      Object.assign(item, payload, { updatedAt: new Date().toISOString() });
      toast('Subcategoría actualizada');
    } else {
      const sub = M.normalizeSubcategory(payload);
      state.subcategories.push(sub);
      toast('Subcategoría añadida');
    }
    persist();
    closeModal('modalSubcategory');
    render();
  }

  function deleteSubcategory(id) {
    const counts = M.deleteSubcategory(state, id);
    const total = counts.expenseCount + counts.incomeCount + counts.budgetCount;
    if (total > 0) {
      if (!confirm(`Esta subcategoría está usada en ${total} movimiento(s). Se desvinculará pero no se borrarán. ¿Continuar?`)) return;
      state.expenses.forEach((e) => { if (e.subcategoryId === id) e.subcategoryId = null; });
      state.income.forEach((i) => { if (i.subcategoryId === id) i.subcategoryId = null; });
      state.budgets.forEach((b) => { if (b.subcategoryId === id) b.subcategoryId = null; });
    } else {
      if (!confirm('¿Eliminar esta subcategoría?')) return;
    }
    state.subcategories = state.subcategories.filter((s) => s.id !== id);
    persist();
    closeModal('modalSubcategory');
    toast('Subcategoría eliminada');
    render();
  }

  // ---------- Render: items (líneas) ----------
  function buildItemElement(item, opts = {}) {
    const isExpense = item._kind === 'expense';
    const cat = M.CATEGORIES[item.category] || M.CATEGORIES.otros;
    const icon = item.effectiveIcon || cat.icon;
    const tag = isExpense ? M.EXPENSE_TYPES[item.type] : M.INCOME_TYPES[item.type];
    const tagClass = item.type;

    const wrap = el('div', { class: 'item item-' + item._kind });

    const main = el('div', { class: 'item-main' },
      el('div', { class: 'item-icon' }, icon),
      el('div', { class: 'item-body' },
        el('div', { class: 'item-line1' },
          el('span', { class: 'item-name' }, item.name),
          (tag ? el('span', { class: 'item-tag tag-' + tagClass }, tag.tag) : null),
          (item.optional ? el('span', { class: 'item-tag tag-optional' }, 'Opcional') : null),
          (item.skippedMonths && item.skippedMonths[currentMonth] ? el('span', { class: 'item-tag tag-skipped' }, 'Saltado') : null)
        ),
        el('div', { class: 'item-line2' },
          el('span', { class: 'item-category' }, `${cat.icon} ${cat.label}`),
          (item.subcategoryId ? (() => {
            const sub = M.getSubcategory(state, item.subcategoryId);
            return sub ? el('span', { class: 'item-subcategory' }, ` · ${sub.icon} ${sub.label}`) : null;
          })() : null),
          el('span', { class: 'item-validity' }, ' · ' + M.validityText(item))
        )
      )
    );
    wrap.appendChild(main);

    const right = el('div', { class: 'item-right' });
    const amount = el('div', { class: 'item-amount' }, fmt(item.effectiveAmount));
    right.appendChild(amount);

    if (item.optional) {
      const isPaid = !!(item.paidMonths && item.paidMonths[currentMonth]);
      const isSkipped = !!(item.skippedMonths && item.skippedMonths[currentMonth]);
      const actions = el('div', { class: 'item-actions-row' });

      const paidBtn = el('button', {
        type: 'button',
        class: 'item-action item-action--check' + (isPaid ? ' is-checked' : ''),
        'aria-label': isPaid ? 'Quitar del mes' : 'Añadir al mes',
        title: isPaid ? 'Quitar del mes' : 'Añadir al mes',
        onClick: (e) => {
          e.stopPropagation();
          togglePaid(item, currentMonth);
        }
      }, isPaid ? '✓' : '○');
      actions.appendChild(paidBtn);

      const skipBtn = el('button', {
        type: 'button',
        class: 'item-action item-action--skip' + (isSkipped ? ' is-skipped' : ''),
        'aria-label': isSkipped ? 'Reactivar para este mes' : 'Saltar este mes',
        title: isSkipped ? 'Reactivar para este mes' : 'Saltar este mes',
        onClick: (e) => {
          e.stopPropagation();
          toggleSkipped(item, currentMonth);
        }
      }, isSkipped ? '⊘' : '✕');
      actions.appendChild(skipBtn);

      right.appendChild(actions);
    }
    wrap.appendChild(right);

    wrap.addEventListener('click', () => {
      if (isExpense) openExpenseForm(item.id);
      else openIncomeForm(item.id);
    });

    if (isExpense && (item.type === 'fixed' || item.type === 'temporary')) {
      const isPending = !!(item.pendingMonths && item.pendingMonths[currentMonth]);
      const pendingBtn = el('button', {
        type: 'button',
        class: 'item-action item-action--pending' + (isPending ? ' is-pending' : ''),
        'aria-label': isPending ? 'Quitar pendiente' : 'Marcar como pendiente (deuda)',
        title: isPending ? 'Quitar pendiente' : 'Marcar como pendiente (deuda)',
        onClick: (e) => {
          e.stopPropagation();
          togglePendingMandatory(item, currentMonth);
        }
      }, isPending ? '⌛' : '!⃝');
      right.appendChild(pendingBtn);

      wrap.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        convertExpenseToBudget(item.id);
      });
    }

    return wrap;
  }

  function togglePaid(item, monthKey) {
    const original = state.expenses.find((e) => e.id === item.id);
    if (!original) return;
    original.paidMonths = M.togglePaidMonth(original, monthKey, !(original.paidMonths && original.paidMonths[monthKey]));
    original.updatedAt = new Date().toISOString();
    persist();
    render();
  }

  function toggleSkipped(item, monthKey) {
    const original = state.expenses.find((e) => e.id === item.id);
    if (!original) return;
    original.skippedMonths = M.toggleSkippedMonth(original, monthKey, !(original.skippedMonths && original.skippedMonths[monthKey]));
    original.updatedAt = new Date().toISOString();
    persist();
    render();
  }

  function togglePendingMandatory(item, monthKey) {
    const original = state.expenses.find((e) => e.id === item.id);
    if (!original) return;
    const wasPending = !!(original.pendingMonths && original.pendingMonths[monthKey]);
    original.pendingMonths = M.togglePendingMonth(original, monthKey, !wasPending);
    if (!wasPending) {
      // Si se marca como pendiente, quitar de paidMonths
      if (original.paidMonths && original.paidMonths[monthKey]) {
        const pm = { ...original.paidMonths };
        delete pm[monthKey];
        original.paidMonths = pm;
      }
    }
    original.updatedAt = new Date().toISOString();
    persist();
    render();
    toast(wasPending ? 'Pendiente anulado' : 'Marcado como pendiente (deuda)');
  }

  function toggleInactive(itemId) {
    const original = state.expenses.find((e) => e.id === itemId);
    if (!original) return;
    original.inactive = !original.inactive;
    original.updatedAt = new Date().toISOString();
    persist();
    render();
    toast(original.inactive ? 'Gasto desactivado' : 'Gasto reactivado');
  }

  function payPendingDebt(itemId, monthKey) {
    const original = state.expenses.find((e) => e.id === itemId);
    if (!original) return;
    const amount = M.effectiveAmountAt(original, monthKey);
    const pm = { ...(original.paidMonths || {}) };
    pm[monthKey] = true;
    original.paidMonths = pm;
    const pd = { ...(original.pendingMonths || {}) };
    delete pd[monthKey];
    original.pendingMonths = pd;
    // Crear gasto de "pago de deuda" en el mes actual
    const catchUp = M.normalizeExpense({
      name: original.name + ' (pago de ' + M.monthKeyToShort(monthKey) + ')',
      amount,
      type: 'variable',
      category: original.category,
      subcategoryId: original.subcategoryId,
      budgetId: original.budgetId,
      targetMonth: currentMonth,
      startDate: M.toISODate(new Date()),
      notes: 'Liquidación de deuda pendiente'
    });
    state.expenses.push(catchUp);
    original.updatedAt = new Date().toISOString();
    persist();
    render();
    toast('Pago realizado');
  }

  // ---------- Render: presupuestos ----------
  function buildBudgetElement(progress) {
    const { budget, spent, free, pct, over } = progress;
    const sub = budget.subcategoryId ? M.getSubcategory(state, budget.subcategoryId) : null;
    const cat = M.CATEGORIES[budget.category] || M.CATEGORIES.otros;
    const label = sub ? `${cat.label} · ${sub.icon} ${sub.label}` : `${cat.icon} ${cat.label}`;
    const valid = M.validityText(budget);
    const linkedCount = state.expenses.filter((e) => e.budgetId === budget.id).length;

    const wrap = el('div', { class: 'budget-item' + (over ? ' budget-item--over' : '') });
    const head = el('div', { class: 'budget-item-head' },
      el('div', { class: 'budget-item-icon' }, budget.effectiveIcon),
      el('div', { class: 'budget-item-body' },
        el('div', { class: 'budget-item-name' }, label),
        el('div', { class: 'budget-item-validity' }, valid + (linkedCount > 0 ? ' · ' + linkedCount + ' gasto' + (linkedCount === 1 ? '' : 's') : ''))
      ),
      el('div', { class: 'budget-item-right' },
        el('div', { class: 'budget-item-amount' }, `${fmt(spent)} / ${fmt(budget.amount)}`),
        el('div', { class: 'budget-item-pct' }, pct + '%')
      )
    );
    wrap.appendChild(head);

    const bar = el('div', { class: 'budget-progress' },
      el('div', {
        class: 'budget-progress-bar' + (over ? ' budget-progress-bar--over' : ''),
        style: { width: Math.min(100, pct) + '%' }
      })
    );
    wrap.appendChild(bar);

    const foot = el('div', { class: 'budget-item-foot' },
      el('span', { class: 'budget-item-free' }, (over ? 'Excedido' : 'Libre') + ': ' + fmt(Math.abs(free))),
      el('button', {
        type: 'button',
        class: 'item-action item-action--edit',
        'aria-label': 'Editar',
        onClick: (e) => { e.stopPropagation(); openBudgetForm(budget.id); }
      }, 'Editar')
    );
    wrap.appendChild(foot);

    wrap.addEventListener('click', () => openBudgetForm(budget.id));
    return wrap;
  }

  // ---------- Render: subcategorías ----------
  function buildSubcategoryElement(sub) {
    const cat = M.CATEGORIES[sub.category] || M.CATEGORIES.otros;
    const useCount = state.expenses.filter((e) => e.subcategoryId === sub.id).length
      + state.income.filter((i) => i.subcategoryId === sub.id).length
      + state.budgets.filter((b) => b.subcategoryId === sub.id).length;

    const wrap = el('div', { class: 'subcategory-item' },
      el('div', { class: 'subcategory-icon' }, sub.icon),
      el('div', { class: 'subcategory-body' },
        el('div', { class: 'subcategory-label' }, sub.label),
        el('div', { class: 'subcategory-meta' }, `${cat.icon} ${cat.label} · ${useCount} uso${useCount === 1 ? '' : 's'}`)
      ),
      el('button', {
        type: 'button',
        class: 'item-action item-action--edit',
        onClick: (e) => { e.stopPropagation(); openSubcategoryForm(sub.id); }
      }, 'Editar')
    );
    wrap.addEventListener('click', () => openSubcategoryForm(sub.id));
    return wrap;
  }

  // ---------- Render: histórico ----------
  function buildTimelineElement(entry) {
    const balanceClass = entry.summary.balance >= 0 ? 'positive' : 'negative';
    return el('div', { class: 'timeline-item' },
      el('div', { class: 'timeline-month' }, M.monthKeyToShort(entry.monthKey)),
      el('div', { class: 'timeline-numbers' },
        el('span', { class: 'timeline-income' }, '+' + fmt(entry.summary.totalIncome)),
        el('span', { class: 'timeline-expense' }, '-' + fmt(entry.summary.totalExpenses)),
        el('span', { class: 'timeline-balance ' + balanceClass }, fmt(entry.summary.balance))
      )
    );
  }

  // ---------- Render principal ----------
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
  }

  function renderSummary() {
    const sum = M.summarize(state, currentMonth);
    const bsum = M.summarizeBudgets(state, currentMonth);
    $('#sumIncome').textContent = fmt(sum.totalIncome);
    $('#sumExpense').textContent = fmt(sum.totalExpenses);
    $('#sumBalance').textContent = fmt(sum.balance);
    const balCard = $('#balanceCard');
    balCard.classList.toggle('summary-balance-negative', sum.balance < 0);
    balCard.classList.toggle('summary-balance-positive', sum.balance >= 0);
    $('#sumBudget').textContent = fmt(bsum.totalAssigned);
    const remainingBudget = bsum.totalAssigned - bsum.totalSpent;
    const free = sum.balance - remainingBudget;
    $('#sumFree').textContent = fmt(free);
    const freeCard = $('#freeCard');
    freeCard.classList.toggle('summary-free-negative', free < 0);
  }

  function renderBudgets() {
    const list = $('#budgetList');
    list.innerHTML = '';
    const progress = M.getBudgetProgress(state, currentMonth);
    if (progress.length === 0) {
      list.appendChild(el('div', { class: 'empty-state empty-state-mini' },
        el('p', {}, 'Aún no tienes presupuestos.'),
        el('p', { class: 'empty-hint' }, 'Crea uno para empezar a controlar el gasto por categoría.')
      ));
      return;
    }
    progress.forEach((p) => list.appendChild(buildBudgetElement(p)));
  }

  function renderPending() {
    const section = $('#pendingOptionalSection');
    const list = $('#pendingOptionalList');
    list.innerHTML = '';
    const pending = state.expenses.filter((e) => M.isPendingOptional(e, currentMonth));
    if (pending.length === 0) {
      section.style.display = 'none';
    } else {
      section.style.display = '';
      $('#pendingOptionalCount').textContent = pending.length;
      pending.forEach((e) => {
        const enriched = {
          ...e,
          _kind: 'expense',
          effectiveAmount: M.effectiveAmountAt(e, currentMonth),
          effectiveIcon: M.effectiveIconFor(e, state)
        };
        list.appendChild(buildItemElement(enriched));
      });
    }
    renderPendingMandatory();
  }

  function renderPendingMandatory() {
    const section = $('#pendingMandatorySection');
    const list = $('#pendingMandatoryList');
    list.innerHTML = '';
    const pending = M.getPendingMandatory(state, currentMonth);
    if (pending.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    $('#pendingMandatoryCount').textContent = pending.length;
    pending.forEach((p) => {
      const item = p.item;
      const cat = M.CATEGORIES[item.category] || M.CATEGORIES.otros;
      const wrap = el('div', { class: 'pending-mandatory-item' },
        el('div', { class: 'pending-mandatory-icon' }, M.effectiveIconFor(item, state)),
        el('div', { class: 'pending-mandatory-body' },
          el('div', { class: 'pending-mandatory-name' }, item.name),
          el('div', { class: 'pending-mandatory-meta' }, `${cat.icon} ${cat.label} · ${M.monthKeyToShort(p.monthKey)}`)
        ),
        el('div', { class: 'pending-mandatory-right' },
          el('div', { class: 'pending-mandatory-amount' }, fmt(p.amount)),
          el('button', {
            type: 'button',
            class: 'btn btn-primary btn-small',
            onClick: () => payPendingDebt(item.id, p.monthKey)
          }, 'Pagar')
        )
      );
      list.appendChild(wrap);
    });
  }

  function renderMonthItems() {
    const list = $('#monthItemsList');
    list.innerHTML = '';
    const { all } = M.getItemsForMonth(state, currentMonth);
    if (all.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '📋'),
        el('p', {}, 'No hay movimientos para este mes.'),
        el('p', { class: 'empty-hint' }, 'Añade un gasto o ingreso para empezar.')
      ));
      $('#monthItemCount').textContent = '0 movimientos';
      return;
    }
    all.forEach((item) => list.appendChild(buildItemElement(item)));
    $('#monthItemCount').textContent = all.length + (all.length === 1 ? ' movimiento' : ' movimientos');
  }

  function renderAllExpenses() {
    const list = $('#allExpensesList');
    list.innerHTML = '';
    let items = state.expenses.slice();
    if (currentFilter !== 'all') {
      items = items.filter((e) => e.type === currentFilter);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '💸'),
        el('p', {}, 'No hay gastos con este filtro.')
      ));
      return;
    }
    items.forEach((e) => {
      const enriched = { ...e, _kind: 'expense', effectiveAmount: e.amount, effectiveIcon: M.effectiveIconFor(e, state) };
      list.appendChild(buildItemElement(enriched));
    });
  }

  function renderAllIncome() {
    const list = $('#allIncomeList');
    list.innerHTML = '';
    const items = state.income.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '💰'),
        el('p', {}, 'No hay ingresos todavía.')
      ));
      return;
    }
    items.forEach((i) => {
      const enriched = { ...i, _kind: 'income', effectiveAmount: i.amount, effectiveIcon: M.effectiveIconFor(i, state) };
      list.appendChild(buildItemElement(enriched));
    });
  }

  function renderTimeline() {
    const list = $('#timelineList');
    list.innerHTML = '';
    const t = M.getTimeline(state);
    if (t.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '📅'),
        el('p', {}, 'Añade gastos o ingresos para ver tu línea de tiempo.')
      ));
      $('#timelineCount').textContent = '0 meses';
      return;
    }
    t.forEach((entry) => list.appendChild(buildTimelineElement(entry)));
    $('#timelineCount').textContent = t.length + (t.length === 1 ? ' mes' : ' meses');
  }

  function renderSubcategoriesView() {
    const list = $('#subcategoriesList');
    list.innerHTML = '';
    const subs = state.subcategories.slice().sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
    if (subs.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '🏷️'),
        el('p', {}, 'No tienes subcategorías todavía.'),
        el('p', { class: 'empty-hint' }, 'Crea tu primera para organizar mejor los gastos de una categoría.')
      ));
      return;
    }
    subs.forEach((s) => list.appendChild(buildSubcategoryElement(s)));
  }

  function renderInactiveExpenses() {
    const list = $('#inactiveExpensesList');
    if (!list) return;
    list.innerHTML = '';
    const inactive = state.expenses.filter((e) => e.inactive);
    if (inactive.length === 0) {
      list.appendChild(el('div', { class: 'empty-state-mini' },
        el('p', {}, 'No tienes gastos desactivados.')
      ));
      return;
    }
    inactive.sort((a, b) => a.name.localeCompare(b.name));
    inactive.forEach((e) => {
      const cat = M.CATEGORIES[e.category] || M.CATEGORIES.otros;
      const icon = M.effectiveIconFor(e, state);
      const sub = e.subcategoryId ? M.getSubcategory(state, e.subcategoryId) : null;
      const subLabel = sub ? ` · ${sub.icon} ${sub.label}` : '';
      const wrap = el('div', { class: 'inactive-item' },
        el('div', { class: 'inactive-item-icon' }, icon),
        el('div', { class: 'inactive-item-body' },
          el('div', { class: 'inactive-item-name' }, e.name),
          el('div', { class: 'inactive-item-meta' }, `${cat.icon} ${cat.label}${subLabel} · ${fmt(e.amount)}`)
        ),
        el('button', {
          type: 'button',
          class: 'item-action item-action--edit',
          onClick: () => toggleInactive(e.id)
        }, 'Reactivar')
      );
      list.appendChild(wrap);
    });
  }

  // ---------- Ajustes ----------
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
      state.settings.currency = e.target.value;
      persist();
      render();
    });
    $('#settingTheme').addEventListener('change', (e) => {
      state.settings.theme = e.target.value;
      persist();
      applyTheme();
    });
    $('#settingStartDay').addEventListener('change', (e) => {
      state.settings.startDayOfMonth = parseInt(e.target.value, 10);
      persist();
    });
  }

  // ---------- Seed / Reset / Import / Export ----------
  function seedExampleData() {
    if (!confirm('Esto añadirá datos de ejemplo. ¿Continuar?')) return;
    const today = M.toISODate(new Date());
    const subMap = {};
    const createSub = (category, label, icon) => {
      const sub = M.normalizeSubcategory({ category, label, icon });
      state.subcategories.push(sub);
      subMap[label] = sub.id;
      return sub.id;
    };
    createSub('hogar', 'Comida del hogar', '🍽️');
    createSub('hogar', 'Limpieza', '🧹');
    createSub('transporte', 'Gasolina', '⛽');
    createSub('comida', 'Supermercado', '🛒');
    createSub('ocio', 'Streaming', '🎬');

    const addExpense = (payload) => { state.expenses.push(M.normalizeExpense(payload)); };
    addExpense({ name: 'Alquiler', amount: 750, type: 'fixed', category: 'hogar', subcategoryId: subMap['Comida del hogar'], startDate: today });
    addExpense({ name: 'Luz', amount: 60, type: 'fixed', category: 'hogar', subcategoryId: subMap['Limpieza'], startDate: today });
    addExpense({ name: 'Netflix', amount: 12.99, type: 'fixed', category: 'suscripciones', startDate: today });
    addExpense({ name: 'Spotify', amount: 9.99, type: 'fixed', category: 'suscripciones', startDate: today });
    addExpense({ name: 'Seguro coche', amount: 45, type: 'temporary', category: 'seguros', startDate: today, endDate: M.toISODate(new Date(new Date().setMonth(new Date().getMonth() + 6))) });
    addExpense({ name: 'Gimnasio', amount: 35, type: 'fixed', category: 'salud', optional: true, startDate: today });

    const addIncome = (payload) => { state.income.push(M.normalizeIncome(payload)); };
    addIncome({ name: 'Nómina', amount: 1800, type: 'recurring', category: 'nomina', startDate: today });
    addIncome({ name: 'Freelance web', amount: 400, type: 'recurring', category: 'freelance', startDate: today });

    const addBudget = (payload) => { state.budgets.push(M.normalizeBudget(payload)); };
    addBudget({ category: 'comida', subcategoryId: subMap['Supermercado'], amount: 300, startDate: today });
    addBudget({ category: 'ocio', subcategoryId: subMap['Streaming'], amount: 30, startDate: today });
    addBudget({ category: 'transporte', subcategoryId: subMap['Gasolina'], amount: 90, startDate: today });

    persist();
    toast('Datos de ejemplo cargados');
    render();
  }

  function resetAll() {
    if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
    if (!confirm('¿Seguro seguro? Se perderán gastos, ingresos, presupuestos y subcategorías.')) return;
    S.clear();
    state = S.load();
    persist();
    render();
    toast('Datos borrados');
  }

  function exportData() {
    S.exportJSON(state);
    toast('Exportado');
  }

  function importData() {
    const input = $('#fileImport');
    input.value = '';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const newState = await S.importFromFile(file, 'replace');
        state = newState;
        persist();
        render();
        toast('Importado');
      } catch (err) {
        toast('Error: ' + err.message);
      }
    };
    input.click();
  }

  // ---------- Bindings ----------
  function bindEvents() {
    // Navegación
    $$('.nav-item').forEach((n) => {
      n.addEventListener('click', () => setView(n.dataset.nav));
    });

    // Header
    $('#btnPrevMonth').addEventListener('click', () => changeMonth(-1));
    $('#btnNextMonth').addEventListener('click', () => changeMonth(1));
    $('#currentMonthPill').addEventListener('click', () => {
      currentMonth = M.todayMonthKey();
      updateMonthLabel();
      render();
    });

    // FAB → compra rápida
    $('#fabAdd').addEventListener('click', openPurchaseModal);

    // Quick actions
    $$('[data-add]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.add === 'expense') openExpenseForm();
        else openIncomeForm();
      });
    });

    // Botones "Nuevo"
    $('#btnNewExpense').addEventListener('click', () => openExpenseForm());
    $('#btnNewIncome').addEventListener('click', () => openIncomeForm());
    $('#btnNewBudget').addEventListener('click', () => openBudgetForm());
    $('#btnNewSubcategory').addEventListener('click', () => openSubcategoryForm());

    // Segmented tipo gasto
    $$('#expenseTypeSeg .seg').forEach((b) => {
      b.addEventListener('click', () => setExpenseType(b.dataset.type));
    });
    $$('#incomeTypeSeg .seg').forEach((b) => {
      b.addEventListener('click', () => setIncomeType(b.dataset.type));
    });

    // Categoría → repoblar subcategorías
    $('#expenseCategory').addEventListener('change', () => {
      $('#expenseSubcategory').dataset.selected = '';
      updateSubcategoryControls();
    });
    $('#expenseSubcategory').addEventListener('change', () => {
      updateSubcategoryHint($('#expenseCategory').value);
    });
    $('#budgetCategory').addEventListener('change', () => {
      $('#budgetSubcategory').dataset.selected = '';
      updateBudgetSubcategoryControls();
    });

    // Forms
    $('#formExpense').addEventListener('submit', submitExpenseForm);
    $('#formIncome').addEventListener('submit', submitIncomeForm);
    $('#formPurchase').addEventListener('submit', submitPurchaseForm);
    $('#formBudget').addEventListener('submit', submitBudgetForm);
    $('#formSubcategory').addEventListener('submit', submitSubcategoryForm);

    // Botones delete
    $('#btnDeleteExpense').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (id) deleteExpense(id);
    });
    $('#btnDeleteIncome').addEventListener('click', () => {
      const id = $('#incomeId').value;
      if (id) deleteIncome(id);
    });
    $('#btnDeleteBudget').addEventListener('click', () => {
      const id = $('#budgetId').value;
      if (id) deleteBudget(id);
    });
    $('#btnDeleteSubcategory').addEventListener('click', () => {
      const id = $('#subcategoryId').value;
      if (id) deleteSubcategory(id);
    });

    // Convertir en presupuesto
    $('#btnConvertToBudget').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (id) convertExpenseToBudget(id);
    });
    $('#btnConvertToUnico').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (id) convertExpenseToUnico(id);
    });

    // Conflicto conversión
    $('#conflictReplace').addEventListener('click', () => doConvert('replace'));
    $('#conflictSum').addEventListener('click', () => doConvert('sum'));
    $('#conflictCancel').addEventListener('click', () => {
      pendingConvertExpense = null;
      pendingConvertBudget = null;
      closeModal('modalBudgetConflict');
    });

    // Icon picker
    $('#btnBudgetIcon').addEventListener('click', () => {
      const cur = $('#budgetIconPreview').textContent.trim();
      openIconPicker(cur, (icon) => { $('#budgetIconPreview').textContent = icon; });
    });
    $('#btnSubcategoryIcon').addEventListener('click', () => {
      const cur = $('#subcategoryIconPreview').textContent.trim();
      openIconPicker(cur, (icon) => { $('#subcategoryIconPreview').textContent = icon; });
    });

    // Historial importes
    $('#btnAddExpenseAmountChange').addEventListener('click', () => addAmountHistoryEntry('expense'));
    $('#btnAddIncomeAmountChange').addEventListener('click', () => addAmountHistoryEntry('income'));

    // Filtros
    $$('#expenseFilters .chip').forEach((c) => {
      c.addEventListener('click', () => {
        $$('#expenseFilters .chip').forEach((x) => x.classList.remove('chip-active'));
        c.classList.add('chip-active');
        currentFilter = c.dataset.filter;
        renderAllExpenses();
      });
    });

    // Ajustes
    $('#btnExport').addEventListener('click', exportData);
    $('#btnImport').addEventListener('click', importData);
    $('#btnSeed').addEventListener('click', seedExampleData);
    $('#btnReset').addEventListener('click', resetAll);

    // Modales
    bindModalCloseButtons();
  }

  // ---------- Service Worker ----------
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  }

  // ---------- Init ----------
  function init() {
    applyTheme();
    bindEvents();
    bindSettings();
    updateMonthLabel();
    render();
    registerSW();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
