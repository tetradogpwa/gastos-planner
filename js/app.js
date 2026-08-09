/* ============================================
   app.js - Lógica de la PWA Mis Gastos
   ============================================ */

(function () {
  'use strict';

  // ---------- Estado ----------
  let state = Storage.load();
  let currentMonth = Models.todayMonthKey();
  let currentView = 'resumen';
  let currentExpenseFilter = 'all';

  // ---------- Atajos DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    applyTheme(state.settings.theme);
    bindNavigation();
    bindHeader();
    bindQuickActions();
    bindModals();
    bindSettings();
    bindDataActions();
    registerSW();
    render();
  }

  // ---------- Tema ----------
  function applyTheme(theme) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const effective = theme === 'auto' ? (mql.matches ? 'dark' : 'light') : theme;
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.style.colorScheme = effective;
  }

  // ---------- Navegación tabs ----------
  function bindNavigation() {
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.nav;
        switchView(view);
      });
    });
  }

  function switchView(view) {
    if (currentView === view) return;
    currentView = view;
    $$('.nav-item').forEach((b) => b.classList.toggle('nav-active', b.dataset.nav === view));
    $$('.view').forEach((v) => v.classList.toggle('view-active', v.dataset.view === view));
    // El FAB solo aparece en resumen
    const fab = $('#fabAdd');
    fab.hidden = view !== 'resumen';
    // Re-render por si la vista necesita data
    if (view === 'gastos') renderExpensesList();
    else if (view === 'ingresos') renderIncomeList();
    else if (view === 'historico') renderTimeline();
    // Scroll arriba al cambiar
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Header (cambio de mes) ----------
  function bindHeader() {
    $('#btnPrevMonth').addEventListener('click', () => {
      currentMonth = Models.addMonths(currentMonth, -1);
      render();
    });
    $('#btnNextMonth').addEventListener('click', () => {
      currentMonth = Models.addMonths(currentMonth, 1);
      render();
    });
    $('#currentMonthPill').addEventListener('click', () => {
      currentMonth = Models.todayMonthKey();
      render();
    });
  }

  // ---------- Quick actions + FAB ----------
  function bindQuickActions() {
    $$('[data-add]').forEach((b) => {
      b.addEventListener('click', () => openModal(b.dataset.add));
    });
    $('#fabAdd').addEventListener('click', () => {
      // Si el mes actual no es el de hoy, preguntar: ¿añadir aquí o general?
      openModal('expense');
    });
  }

  // ---------- Modales ----------
  function bindModals() {
    // Cerrar con backdrop o botón
    $$('.modal').forEach((modal) => {
      modal.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => closeModal(modal));
      });
    });
    // Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') $$('.modal.is-open').forEach(closeModal);
    });

    // Form de gasto
    bindExpenseForm();
    // Form de ingreso
    bindIncomeForm();

    // Botón "Nuevo" en las listas
    $('#btnNewExpense').addEventListener('click', () => openModal('expense'));
    $('#btnNewIncome').addEventListener('click', () => openModal('income'));
  }

  function openModal(kind, id) {
    const modal = kind === 'expense' ? $('#modalExpense') : $('#modalIncome');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (kind === 'expense') {
      setupExpenseForm(id);
    } else {
      setupIncomeForm(id);
    }
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ---------- Form: Gasto ----------
  function bindExpenseForm() {
    const form = $('#formExpense');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitExpenseForm();
    });

    // Segmented de tipo
    $$('#expenseTypeSeg .seg').forEach((b) => {
      b.addEventListener('click', () => {
        $$('#expenseTypeSeg .seg').forEach((x) => x.classList.remove('seg-active'));
        b.classList.add('seg-active');
        updateExpenseTypeUI(b.dataset.type);
      });
    });

    // Eliminar
    $('#btnDeleteExpense').addEventListener('click', () => {
      const id = $('#expenseId').value;
      if (!id) return;
      if (confirm('¿Eliminar este gasto?')) {
        state.expenses = state.expenses.filter((x) => x.id !== id);
        Storage.save(state);
        closeModal($('#modalExpense'));
        render();
        toast('Gasto eliminado', 'success');
      }
    });
  }

  function setupExpenseForm(id) {
    const today = Models.toISODate(new Date());
    if (id) {
      const item = state.expenses.find((x) => x.id === id);
      if (!item) return;
      $('#expenseTitle').textContent = 'Editar gasto';
      $('#expenseId').value = item.id;
      $('#expenseName').value = item.name;
      $('#expenseAmount').value = item.amount;
      $('#expenseCategory').value = item.category;
      $('#expenseStartDate').value = item.startDate;
      $('#expenseEndDate').value = item.endDate || '';
      $('#expenseMonth').value = item.targetMonth || '';
      $('#expenseNotes').value = item.notes || '';
      // Seg
      $$('#expenseTypeSeg .seg').forEach((x) => {
        x.classList.toggle('seg-active', x.dataset.type === item.type);
      });
      updateExpenseTypeUI(item.type);
      $('#btnDeleteExpense').style.display = 'inline-flex';
    } else {
      $('#expenseTitle').textContent = 'Nuevo gasto';
      $('#expenseId').value = '';
      $('#expenseName').value = '';
      $('#expenseAmount').value = '';
      $('#expenseCategory').value = 'suscripciones';
      $('#expenseStartDate').value = today;
      $('#expenseEndDate').value = '';
      $('#expenseMonth').value = currentMonth;
      $('#expenseNotes').value = '';
      $$('#expenseTypeSeg .seg').forEach((x) => {
        x.classList.toggle('seg-active', x.dataset.type === 'fixed');
      });
      updateExpenseTypeUI('fixed');
      $('#btnDeleteExpense').style.display = 'none';
    }
  }

  function updateExpenseTypeUI(type) {
    const startWrap = $('#expenseDateWrap');
    const endWrap = $('#expenseEndWrap');
    const monthWrap = $('#expenseMonthWrap');
    const hint = $('#expenseTypeHint');

    if (type === 'fixed') {
      startWrap.style.display = 'flex';
      endWrap.style.display = 'none';
      monthWrap.style.display = 'none';
      hint.textContent = 'Se repite cada mes hasta que lo elimines.';
    } else if (type === 'temporary') {
      startWrap.style.display = 'flex';
      endWrap.style.display = 'flex';
      monthWrap.style.display = 'none';
      hint.textContent = 'Se repite desde la fecha de inicio hasta la fecha de fin.';
    } else if (type === 'variable') {
      startWrap.style.display = 'none';
      endWrap.style.display = 'none';
      monthWrap.style.display = 'flex';
      hint.textContent = 'Aparece solo en el mes seleccionado (puntual).';
    }
  }

  function submitExpenseForm() {
    const type = $('#expenseTypeSeg .seg-active').dataset.type;
    const data = {
      id: $('#expenseId').value || undefined,
      name: $('#expenseName').value.trim(),
      amount: parseFloat($('#expenseAmount').value),
      type,
      category: $('#expenseCategory').value,
      startDate: $('#expenseStartDate').value || '',
      endDate: $('#expenseEndDate').value || null,
      targetMonth: $('#expenseMonth').value || null,
      notes: $('#expenseNotes').value.trim()
    };

    if (!data.name) { toast('Escribe un concepto', 'error'); return; }
    if (!(data.amount >= 0)) { toast('Importe inválido', 'error'); return; }
    if (data.type === 'temporary' && data.endDate && data.startDate && data.endDate < data.startDate) {
      toast('La fecha de fin es anterior a la de inicio', 'error');
      return;
    }
    if (data.type === 'variable' && !data.targetMonth) {
      toast('Selecciona el mes del gasto variable', 'error');
      return;
    }

    const normalized = Models.normalizeExpense(data);

    if (data.id) {
      const idx = state.expenses.findIndex((x) => x.id === data.id);
      if (idx >= 0) {
        state.expenses[idx] = { ...state.expenses[idx], ...normalized, updatedAt: new Date().toISOString() };
      }
      toast('Gasto actualizado', 'success');
    } else {
      state.expenses.push(normalized);
      toast('Gasto añadido', 'success');
    }

    Storage.save(state);
    closeModal($('#modalExpense'));
    render();
  }

  // ---------- Form: Ingreso ----------
  function bindIncomeForm() {
    const form = $('#formIncome');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitIncomeForm();
    });

    $$('#incomeTypeSeg .seg').forEach((b) => {
      b.addEventListener('click', () => {
        $$('#incomeTypeSeg .seg').forEach((x) => x.classList.remove('seg-active'));
        b.classList.add('seg-active');
        updateIncomeTypeUI(b.dataset.type);
      });
    });

    $('#btnDeleteIncome').addEventListener('click', () => {
      const id = $('#incomeId').value;
      if (!id) return;
      if (confirm('¿Eliminar este ingreso?')) {
        state.income = state.income.filter((x) => x.id !== id);
        Storage.save(state);
        closeModal($('#modalIncome'));
        render();
        toast('Ingreso eliminado', 'success');
      }
    });
  }

  function setupIncomeForm(id) {
    const today = Models.toISODate(new Date());
    if (id) {
      const item = state.income.find((x) => x.id === id);
      if (!item) return;
      $('#incomeTitle').textContent = 'Editar ingreso';
      $('#incomeId').value = item.id;
      $('#incomeName').value = item.name;
      $('#incomeAmount').value = item.amount;
      $('#incomeCategory').value = item.category;
      $('#incomeStartDate').value = item.startDate;
      $('#incomeEndDate').value = item.endDate || '';
      $('#incomeMonth').value = item.targetMonth || '';
      $('#incomeNotes').value = item.notes || '';
      $$('#incomeTypeSeg .seg').forEach((x) => {
        x.classList.toggle('seg-active', x.dataset.type === item.type);
      });
      updateIncomeTypeUI(item.type);
      $('#btnDeleteIncome').style.display = 'inline-flex';
    } else {
      $('#incomeTitle').textContent = 'Nuevo ingreso';
      $('#incomeId').value = '';
      $('#incomeName').value = '';
      $('#incomeAmount').value = '';
      $('#incomeCategory').value = 'nomina';
      $('#incomeStartDate').value = today;
      $('#incomeEndDate').value = '';
      $('#incomeMonth').value = currentMonth;
      $('#incomeNotes').value = '';
      $$('#incomeTypeSeg .seg').forEach((x) => {
        x.classList.toggle('seg-active', x.dataset.type === 'recurring');
      });
      updateIncomeTypeUI('recurring');
      $('#btnDeleteIncome').style.display = 'none';
    }
  }

  function updateIncomeTypeUI(type) {
    const startWrap = $('#incomeDateWrap');
    const endWrap = $('#incomeEndWrap');
    const monthWrap = $('#incomeMonthWrap');
    const hint = $('#incomeTypeHint');

    if (type === 'recurring') {
      startWrap.style.display = 'flex';
      endWrap.style.display = 'none';
      monthWrap.style.display = 'none';
      hint.textContent = 'Se repite cada mes hasta que lo elimines.';
    } else if (type === 'extra') {
      startWrap.style.display = 'none';
      endWrap.style.display = 'none';
      monthWrap.style.display = 'flex';
      hint.textContent = 'Aparece solo en el mes seleccionado (extra puntual).';
    }
  }

  function submitIncomeForm() {
    const type = $('#incomeTypeSeg .seg-active').dataset.type;
    const data = {
      id: $('#incomeId').value || undefined,
      name: $('#incomeName').value.trim(),
      amount: parseFloat($('#incomeAmount').value),
      type,
      category: $('#incomeCategory').value,
      startDate: $('#incomeStartDate').value || '',
      endDate: $('#incomeEndDate').value || null,
      targetMonth: $('#incomeMonth').value || null,
      notes: $('#incomeNotes').value.trim()
    };

    if (!data.name) { toast('Escribe un concepto', 'error'); return; }
    if (!(data.amount >= 0)) { toast('Importe inválido', 'error'); return; }
    if (data.type === 'extra' && !data.targetMonth) {
      toast('Selecciona el mes del ingreso extra', 'error');
      return;
    }

    const normalized = Models.normalizeIncome(data);

    if (data.id) {
      const idx = state.income.findIndex((x) => x.id === data.id);
      if (idx >= 0) {
        state.income[idx] = { ...state.income[idx], ...normalized, updatedAt: new Date().toISOString() };
      }
      toast('Ingreso actualizado', 'success');
    } else {
      state.income.push(normalized);
      toast('Ingreso añadido', 'success');
    }

    Storage.save(state);
    closeModal($('#modalIncome'));
    render();
  }

  // ---------- Ajustes ----------
  function bindSettings() {
    const selCurr = $('#settingCurrency');
    const selTheme = $('#settingTheme');
    const selStart = $('#settingStartDay');

    // Llenar opciones de día
    for (let d = 1; d <= 28; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `Día ${d}`;
      selStart.appendChild(opt);
    }

    selCurr.value = state.settings.currency;
    selTheme.value = state.settings.theme;
    selStart.value = state.settings.startDayOfMonth;

    selCurr.addEventListener('change', () => {
      state.settings.currency = selCurr.value;
      Storage.save(state);
      render();
      toast('Moneda actualizada', 'success');
    });
    selTheme.addEventListener('change', () => {
      state.settings.theme = selTheme.value;
      Storage.save(state);
      applyTheme(state.settings.theme);
      toast('Tema actualizado', 'success');
    });
    selStart.addEventListener('change', () => {
      state.settings.startDayOfMonth = parseInt(selStart.value, 10);
      Storage.save(state);
      toast('Día de inicio guardado', 'success');
    });
  }

  // ---------- Acciones de datos ----------
  function bindDataActions() {
    $('#btnExport').addEventListener('click', () => {
      const res = Storage.exportJSON(state);
      toast(`Exportado: ${res.count} movimientos`, 'success');
    });

    $('#btnImport').addEventListener('click', () => $('#fileImport').click());

    $('#fileImport').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const mode = confirm('Aceptar = REEMPLAZAR todos los datos.\nCancelar = COMBINAR con los actuales.') ? 'replace' : 'merge';
        const newState = await Storage.importFromFile(file, mode);
        state = newState;
        Storage.save(state);
        applyTheme(state.settings.theme);
        // refrescar inputs
        $('#settingCurrency').value = state.settings.currency;
        $('#settingTheme').value = state.settings.theme;
        $('#settingStartDay').value = state.settings.startDayOfMonth;
        render();
        toast('Datos importados correctamente', 'success');
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      }
      e.target.value = '';
    });

    $('#btnSeed').addEventListener('click', () => {
      if (state.expenses.length || state.income.length) {
        if (!confirm('Ya tienes datos. ¿Añadir igualmente datos de ejemplo?')) return;
      }
      seedExampleData();
      Storage.save(state);
      render();
      toast('Datos de ejemplo añadidos', 'success');
    });

    $('#btnReset').addEventListener('click', () => {
      if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
      if (!confirm('¿Seguro? Se perderán todos los gastos e ingresos.')) return;
      state = Models.newState();
      Storage.clear();
      Storage.save(state);
      applyTheme(state.settings.theme);
      $('#settingCurrency').value = state.settings.currency;
      $('#settingTheme').value = state.settings.theme;
      $('#settingStartDay').value = state.settings.startDayOfMonth;
      render();
      toast('Todos los datos borrados', 'success');
    });
  }

  function seedExampleData() {
    const today = new Date();
    const ymd = (d) => Models.toISODate(d);
    const monthKey = (offset) => {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const inFiveMonths = new Date(today.getFullYear(), today.getMonth() + 5, 0);

    const ex = (data) => Models.normalizeExpense(data);
    const inc = (data) => Models.normalizeIncome(data);

    state.expenses.push(
      ex({ name: 'Alquiler', amount: 750, type: 'fixed', category: 'hogar', startDate: ymd(startOfYear) }),
      ex({ name: 'Luz y agua', amount: 85, type: 'fixed', category: 'hogar', startDate: ymd(startOfYear) }),
      ex({ name: 'Netflix', amount: 12.99, type: 'fixed', category: 'suscripciones', startDate: ymd(startOfYear) }),
      ex({ name: 'Spotify', amount: 9.99, type: 'fixed', category: 'suscripciones', startDate: ymd(startOfYear) }),
      ex({ name: 'Gimnasio', amount: 39, type: 'fixed', category: 'salud', startDate: ymd(startOfYear) }),
      ex({ name: 'Préstamo coche', amount: 220, type: 'temporary', category: 'deudas', startDate: ymd(startOfYear), endDate: ymd(inFiveMonths) }),
      ex({ name: 'IA Premium (prueba)', amount: 20, type: 'temporary', category: 'suscripciones', startDate: ymd(today), endDate: ymd(new Date(today.getFullYear(), today.getMonth() + 3, 0)) }),
      ex({ name: 'Cena con amigos', amount: 45, type: 'variable', category: 'ocio', targetMonth: monthKey(0) }),
      ex({ name: 'Reparación lavadora', amount: 120, type: 'variable', category: 'hogar', targetMonth: monthKey(1) })
    );

    state.income.push(
      inc({ name: 'Nómina', amount: 1850, type: 'recurring', category: 'nomina', startDate: ymd(startOfYear) }),
      inc({ name: 'Alquiler local', amount: 320, type: 'recurring', category: 'alquiler', startDate: ymd(startOfYear) }),
      inc({ name: 'Proyecto freelance', amount: 450, type: 'extra', category: 'freelance', targetMonth: monthKey(0) }),
      inc({ name: 'Venta segunda mano', amount: 80, type: 'extra', category: 'extras', targetMonth: monthKey(2) })
    );
  }

  // ---------- Render ----------
  function render() {
    renderHeader();
    renderSummary();
    renderMonthItems();
    if (currentView === 'gastos') renderExpensesList();
    else if (currentView === 'ingresos') renderIncomeList();
    else if (currentView === 'historico') renderTimeline();
  }

  function renderHeader() {
    const today = Models.todayMonthKey();
    const isCurrent = currentMonth === today;
    const isPast = Models.compareMonthKeys(currentMonth, today) < 0;
    let subtitle = 'Mes actual';
    if (isPast) subtitle = 'Mes pasado';
    else if (!isCurrent) subtitle = 'Mes proyectado';
    $('#headerSubtitle').textContent = subtitle;
    $('#currentMonthLabel').textContent = Models.monthKeyToLabel(currentMonth);
  }

  function renderSummary() {
    const s = Models.summarize(state, currentMonth);
    $('#sumIncome').textContent = Models.formatMoney(s.totalIncome, state.settings.currency);
    $('#sumExpense').textContent = Models.formatMoney(s.totalExpenses, state.settings.currency);
    $('#sumBalance').textContent = Models.formatMoney(s.balance, state.settings.currency);

    const balanceCard = $('#balanceCard');
    balanceCard.classList.toggle('is-positive', s.balance > 0);
    balanceCard.classList.toggle('is-negative', s.balance < 0);
  }

  function renderMonthItems() {
    const { all } = Models.getItemsForMonth(state, currentMonth);
    const list = $('#monthItemsList');
    $('#monthItemCount').textContent = `${all.length} movimiento${all.length === 1 ? '' : 's'}`;

    if (all.length === 0) {
      const hasAny = state.expenses.length > 0 || state.income.length > 0;
      const isFuture = Models.compareMonthKeys(currentMonth, Models.todayMonthKey()) > 0;
      const isPast = Models.compareMonthKeys(currentMonth, Models.todayMonthKey()) < 0;
      let hint = 'Añade un gasto o ingreso para empezar.';
      if (isFuture) hint = 'No hay nada previsto para este mes. Los items con fecha de fin anterior ya no cuentan.';
      else if (isPast) hint = 'No había movimientos registrados en este mes.';
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No hay movimientos para este mes.</p>
          <p class="empty-hint">${hint}</p>
          ${!hasAny ? '<button class="btn btn-primary" id="emptyLoadExample" style="margin-top:16px;display:inline-flex">Cargar datos de ejemplo</button>' : ''}
        </div>`;
      const btn = $('#emptyLoadExample');
      if (btn) {
        btn.addEventListener('click', () => {
          if (confirm('¿Añadir datos de ejemplo? (No afecta a lo que ya tengas)')) {
            seedExampleData();
            Storage.save(state);
            render();
            toast('Datos de ejemplo añadidos', 'success');
          }
        });
      }
      return;
    }

    list.innerHTML = '';
    all.forEach((item) => list.appendChild(buildItemElement(item)));
  }

  function buildItemElement(item) {
    const cat = Models.CATEGORIES[item.category] || Models.CATEGORIES.otros;
    const isExpense = item._kind === 'expense';
    const typeTag = isExpense ? Models.EXPENSE_TYPES[item.type] : Models.INCOME_TYPES[item.type];
    const tagClass = isExpense ? `tag-${item.type}` : `tag-${item.type}`;
    const validity = Models.validityText(item);
    const endSoon = Models.isEndingSoon(item);

    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div class="item-icon" style="background:${isExpense ? 'var(--danger-soft)' : 'var(--success-soft)'};color:${isExpense ? 'var(--danger)' : 'var(--success)'}">
        ${cat.icon}
      </div>
      <div class="item-content">
        <div class="item-name">
          <span>${escapeHTML(item.name)}</span>
          <span class="item-tag ${tagClass}">${typeTag.tag}</span>
          ${endSoon ? '<span class="item-tag tag-endsoon">Termina pronto</span>' : ''}
        </div>
        <div class="item-meta">
          <span>${cat.label}</span>
          <span class="dot"></span>
          <span>${validity}</span>
        </div>
      </div>
      <div class="item-amount ${isExpense ? 'is-expense' : 'is-income'}">
        ${isExpense ? '-' : '+'}${Models.formatMoney(item.amount, state.settings.currency)}
      </div>
      <button class="item-action" data-edit="${item.id}" data-kind="${item._kind}" aria-label="Editar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    `;
    el.querySelector('[data-edit]').addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.edit;
      const kind = e.currentTarget.dataset.kind;
      openModal(kind, id);
    });
    return el;
  }

  function renderExpensesList() {
    const list = $('#allExpensesList');
    let items = [...state.expenses].map((e) => ({ ...e, _kind: 'expense' }));
    if (currentExpenseFilter !== 'all') {
      items = items.filter((x) => x.type === currentExpenseFilter);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));

    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💸</div>
          <p>No hay gastos ${currentExpenseFilter !== 'all' ? 'en este filtro' : 'todavía'}.</p>
        </div>`;
      return;
    }
    list.innerHTML = '';
    items.forEach((item) => list.appendChild(buildItemElement(item)));

    // Filtro chips
    $$('#expenseFilters .chip').forEach((c) => {
      c.classList.toggle('chip-active', c.dataset.filter === currentExpenseFilter);
      c.onclick = () => {
        currentExpenseFilter = c.dataset.filter;
        renderExpensesList();
      };
    });
  }

  function renderIncomeList() {
    const list = $('#allIncomeList');
    const items = [...state.income].map((i) => ({ ...i, _kind: 'income' }));
    items.sort((a, b) => a.name.localeCompare(b.name));

    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <p>No hay ingresos todavía.</p>
        </div>`;
      return;
    }
    list.innerHTML = '';
    items.forEach((item) => list.appendChild(buildItemElement(item)));
  }

  function renderTimeline() {
    const list = $('#timelineList');
    const timeline = Models.getTimeline(state);
    const todayKey = Models.todayMonthKey();
    $('#timelineCount').textContent = `${timeline.length} meses`;

    if (timeline.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>Añade gastos o ingresos para ver tu línea de tiempo.</p>
        </div>`;
      return;
    }

    list.innerHTML = '';
    timeline.forEach((entry) => {
      const isPast = Models.compareMonthKeys(entry.monthKey, todayKey) < 0;
      const isCurrent = entry.monthKey === todayKey;
      const isFuture = !isPast && !isCurrent;
      const badgeClass = isPast ? 'is-past' : isCurrent ? 'is-current' : 'is-future';
      const badgeText = isPast ? 'Pasado' : isCurrent ? 'Actual' : 'Proyectado';
      const balClass = entry.summary.balance > 0 ? 'is-positive' : entry.summary.balance < 0 ? 'is-negative' : '';
      const maxBar = Math.max(entry.summary.totalIncome, entry.summary.totalExpenses, 1);
      const incPct = (entry.summary.totalIncome / maxBar) * 100;
      const expPct = (entry.summary.totalExpenses / maxBar) * 100;

      const el = document.createElement('div');
      el.className = 'timeline-month';
      el.innerHTML = `
        <div class="timeline-month-header">
          <div class="timeline-month-title">
            <span class="timeline-month-name">${Models.monthKeyToLabel(entry.monthKey)}</span>
            <span class="timeline-month-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="timeline-balance ${balClass}">
            ${Models.formatMoney(entry.summary.balance, state.settings.currency)}
          </div>
        </div>
        <div class="timeline-bar" title="Ingresos vs Gastos">
          <div class="timeline-bar-fill-income" style="width:${incPct}%"></div>
          <div class="timeline-bar-fill-expense" style="width:${expPct}%"></div>
        </div>
        <div class="timeline-stats">
          <div class="timeline-stat is-income">
            Ingresos
            <strong>+${Models.formatMoney(entry.summary.totalIncome, state.settings.currency)}</strong>
          </div>
          <div class="timeline-stat is-expense">
            Gastos
            <strong>-${Models.formatMoney(entry.summary.totalExpenses, state.settings.currency)}</strong>
          </div>
          <div class="timeline-stat is-balance">
            Balance
            <strong class="${balClass}">${Models.formatMoney(entry.summary.balance, state.settings.currency)}</strong>
          </div>
        </div>
      `;
      el.addEventListener('click', () => {
        currentMonth = entry.monthKey;
        switchView('resumen');
        render();
        toast(`Viendo ${Models.monthKeyToLabel(entry.monthKey)}`, 'info');
      });
      list.appendChild(el);
    });
  }

  // ---------- Toast ----------
  function toast(message, type = 'info') {
    const container = $('#toastContainer');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 250);
    }, 2200);
  }

  // ---------- Helpers ----------
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  // ---------- Service Worker ----------
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch((err) => {
          console.warn('[sw] Registro falló:', err);
        });
      });
    }
  }
})();
