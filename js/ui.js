/* ============================================
   ui.js - Renderización pura
   Funciones de creación de DOM. Cada función toma state y devuelve
   elementos DOM. Sin estado mutable, sin event handlers directos.
   Para añadir interactividad, el caller añade onclick/handlers.
   ============================================ */

(function (global) {
  'use strict';

  const M = global.Models;

  // ---------- Helpers básicos ----------
  function _fmt(amount) {
    return M.formatMoney(amount, 1);  // currency inyectada por test
  }

  function _label(cat) {
    return (M.CATEGORIES[cat] && M.CATEGORIES[cat].label) || cat;
  }

  // Helper para crear elementos DOM (compatible con jsdom)
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'dataset') Object.assign(node.dataset, attrs[k]);
        else if (k === 'style' && typeof attrs[k] === 'object') Object.assign(node.style, attrs[k]);
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] === true) node.setAttribute(k, '');
        else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
      }
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // ---------- Render: items de gastos/ingresos ----------
  function buildItemElement(item, onClick) {
    const isExpense = item._kind === 'expense';
    const cat = M.CATEGORIES[item.category] || M.CATEGORIES.otros;
    const icon = item.effectiveIcon || cat.icon;
    const tag = isExpense ? M.EXPENSE_TYPES[item.type] : M.INCOME_TYPES[item.type];
    const tagClass = item.type;
    const wrap = el('div', {
      class: 'item item-' + item._kind,
      onclick: onClick
    });
    wrap.appendChild(el('div', { class: 'item-main' },
      el('div', { class: 'item-icon' }, icon),
      el('div', { class: 'item-body' },
        el('div', { class: 'item-line1' },
          el('span', { class: 'item-name' }, item.name),
          tag ? el('span', { class: 'item-tag tag-' + tagClass }, tag.tag) : null,
          item.optional ? el('span', { class: 'item-tag tag-optional' }, 'Opcional') : null,
          item.skippedMonths && item.skippedMonths[M.__currentMonthKey]
            ? el('span', { class: 'item-tag tag-skipped' }, 'Saltado')
            : null
        ),
        el('div', { class: 'item-line2' },
          el('span', { class: 'item-category' }, cat.icon + ' ' + _label(item.category))
        )
      )
    ));
    wrap.appendChild(el('div', { class: 'item-right' },
      el('div', { class: 'item-amount' }, _fmt(item.effectiveAmount)),
      _buildItemActions(item)
    ));
    return wrap;
  }

  function _buildItemActions(item) {
    const wrap = el('div', { class: 'item-actions-row' });
    if (item.optional) {
      const isPaid = !!(item.paidMonths && item.paidMonths[M.__currentMonthKey]);
      wrap.appendChild(el('button', {
        class: 'item-action item-action--check' + (isPaid ? ' is-checked' : ''),
        onclick: (e) => { e.stopPropagation(); M.__onTogglePaid(item, M.__currentMonthKey); }
      }, isPaid ? '✓' : '○'));
      wrap.appendChild(el('button', {
        class: 'item-action item-action--skip',
        onclick: (e) => { e.stopPropagation(); M.__onToggleSkipped(item, M.__currentMonthKey); }
      }, '✕'));
    }
    if (item._kind === 'expense' && (item.type === 'fixed' || item.type === 'temporary')) {
      wrap.appendChild(el('button', {
        class: 'item-action item-action--pending' +
          (item.pendingMonths && item.pendingMonths[M.__currentMonthKey] ? ' is-pending' : ''),
        onclick: (e) => { e.stopPropagation(); M.__onTogglePending(item, M.__currentMonthKey); }
      }, item.pendingMonths && item.pendingMonths[M.__currentMonthKey] ? '⌛' : '!⃝'));
    }
    return wrap;
  }

  // ---------- Render: summary ----------
  function buildSummaryCards(state, currentMonth) {
    const sum = M.summarize(state, currentMonth);
    const bsum = M.summarizeBudgets(state, currentMonth);
    const remainingBudget = bsum.totalAssigned - bsum.totalSpent;
    const free = remainingBudget;
    const balanceClass = sum.balance >= 0 ? 'summary-balance-positive' : 'summary-balance-negative';
    const freeClass = free >= 0 ? 'summary-free-positive' : 'summary-free-negative';
    return [
      el('div', { class: 'summary-card summary-income' },
        el('div', { class: 'summary-icon' }, '📈'),
        el('div', { class: 'summary-info' },
          el('span', { class: 'summary-label' }, 'Ingresos'),
          el('span', { class: 'summary-value' }, _fmt(sum.totalIncome))
        )
      ),
      el('div', { class: 'summary-card summary-expense' },
        el('div', { class: 'summary-icon' }, '📉'),
        el('div', { class: 'summary-info' },
          el('span', { class: 'summary-label' }, 'Gastos'),
          el('span', { class: 'summary-value' }, _fmt(sum.totalExpenses))
        )
      ),
      el('div', { class: 'summary-card ' + balanceClass, id: 'balanceCard' },
        el('div', { class: 'summary-icon' }, '💰'),
        el('div', { class: 'summary-info' },
          el('span', { class: 'summary-label' }, 'Balance'),
          el('span', { class: 'summary-value' }, _fmt(sum.balance))
        )
      ),
      el('div', { class: 'summary-card summary-budget' },
        el('div', { class: 'summary-icon' }, '🎯'),
        el('div', { class: 'summary-info' },
          el('span', { class: 'summary-label' }, 'Retenido'),
          el('span', { class: 'summary-value' }, _fmt(bsum.totalAssigned))
        )
      ),
      el('div', { class: 'summary-card summary-free ' + freeClass, id: 'freeCard' },
        el('div', { class: 'summary-icon' }, '🪙'),
        el('div', { class: 'summary-info' },
          el('span', { class: 'summary-label' }, 'Libre'),
          el('span', { class: 'summary-value' }, _fmt(free))
        )
      )
    ];
  }

  // ---------- Render: balance / saldo ----------
  function buildBalanceSection(state, currentMonth) {
    const monthBalance = M.getLatestBalance(state, currentMonth);
    const amountEl = el('div', { class: 'balance-amount' }, '');
    const infoEl = el('div', { class: 'balance-info' }, '');
    const card = el('div', { class: 'balance-card', id: 'balanceCard' }, amountEl, infoEl);
    _renderBalanceContent(state, currentMonth, monthBalance, amountEl, infoEl);
    const section = el('div', { class: 'section', id: 'balanceSection' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Resto del mes pasado'),
        el('button', { class: 'text-btn', id: 'btnUpdateBalance' },
          'Actualizar'
        )
      ),
      el('p', { class: 'section-hint' }, 'Saldo a principios de mes. En meses sin saldo se muestra el resto del mes anterior.'),
      card
    );
    return section;
  }

  function _renderBalanceContent(state, currentMonth, monthBalance, amountEl, infoEl) {
    if (monthBalance) {
      amountEl.textContent = _fmt(monthBalance.balance);
      infoEl.textContent = `Saldo a 1 de ${M.monthKeyToLabel(currentMonth).toLowerCase()}`;
      return;
    }
    const balanceEntries = (state.balanceEntries || [])
      .filter((b) => b.monthKey < currentMonth)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const lastEntry = balanceEntries[0];
    if (lastEntry) {
      const previousMonth = M.addMonths(currentMonth, -1);
      let running = lastEntry.balance;
      if (previousMonth > lastEntry.monthKey) {
        let m = M.addMonths(lastEntry.monthKey, 1);
        while (m <= previousMonth) {
          const monthSum = M.summarize(state, m);
          running += monthSum.totalIncome - monthSum.totalExpenses;
          m = M.addMonths(m, 1);
        }
      }
      amountEl.textContent = _fmt(running);
      infoEl.textContent = `Resto a fin de ${M.monthKeyToLabel(previousMonth).toLowerCase()}`;
      return;
    }
    amountEl.textContent = '—';
    infoEl.textContent = 'Sin registros';
  }

  // ---------- Render: budgets ----------
  function buildBudgetProgress(progress) {
    const { budget, spent, free, pct, over } = progress;
    const sub = budget.subcategoryId ? M.getSubcategory({}, budget.subcategoryId) : null;
    const cat = M.CATEGORIES[budget.category] || M.CATEGORIES.otros;
    const label = sub ? `${cat.label} · ${sub.icon} ${sub.label}` : `${cat.icon} ${cat.label}`;
    const fillClass = pct < 70 ? 'cc-bar-fill--ok' : pct < 90 ? 'cc-bar-fill--warn' : '';
    return el('div', { class: 'budget-item' + (over ? ' budget-item--over' : '') },
      el('div', { class: 'budget-item-head' },
        el('div', { class: 'budget-item-icon' }, budget.effectiveIcon),
        el('div', { class: 'budget-item-body' },
          el('div', { class: 'budget-item-name' }, label),
          el('div', { class: 'budget-item-validity' }, M.validityText(budget))
        ),
        el('div', { class: 'budget-item-right' },
          el('div', { class: 'budget-item-amount' }, `${_fmt(spent)} / ${_fmt(budget.amount)}`),
          el('div', { class: 'budget-item-pct' }, pct + '%')
        )
      ),
      el('div', { class: 'cc-bar' },
        el('div', { class: 'cc-bar-fill ' + fillClass, style: { width: Math.min(100, pct) + '%' } })
      ),
      el('div', { class: 'budget-item-foot' },
        el('span', { class: 'budget-item-free' },
          (over ? 'Excedido: ' : 'Libre: ') + _fmt(Math.abs(free))
        ),
        el('button', {
          class: 'item-action item-action--edit',
          onclick: () => M.__onEditBudget && M.__onEditBudget(budget.id)
        }, 'Editar')
      )
    );
  }

  function buildBudgetSection(state, currentMonth) {
    const list = el('div', { class: 'items-list', id: 'budgetList' });
    const progress = M.getBudgetProgress(state, currentMonth);
    if (progress.length === 0) {
      list.appendChild(el('div', { class: 'empty-state empty-state-mini' },
        el('p', {}, 'Aún no tienes presupuestos.'),
        el('p', { class: 'empty-hint' }, 'Crea uno para empezar a controlar el gasto por categoría.')
      ));
    } else {
      progress.forEach((p) => list.appendChild(buildBudgetProgress(p)));
    }
    return el('div', { class: 'section', id: 'budgetSection' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Presupuestos'),
        el('button', { class: 'text-btn', id: 'btnNewBudget' }, '+ Nuevo')
      ),
      el('p', { class: 'section-hint' }, 'Asigna una cantidad por categoría y se descontará automáticamente con cada gasto.'),
      list
    );
  }

  // ---------- Render: pending optional ----------
  function buildPendingSection(state, currentMonth) {
    const list = el('div', { class: 'items-list', id: 'pendingOptionalList' });
    const section = el('div', { class: 'section', id: 'pendingOptionalSection', style: { display: 'none' } },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Pendientes de confirmar'),
        el('span', { class: 'section-meta', id: 'pendingOptionalCount' }, '0')
      ),
      el('p', { class: 'section-hint' }, 'Estos gastos opcionales pueden aplicarse este mes. Confírmalos si los has pagado.'),
      list
    );
    const pending = state.expenses.filter((e) => M.isPendingOptional(e, currentMonth));
    if (pending.length === 0) {
      section.style.display = 'none';
    } else {
      section.style.display = '';
      const countEl = section.querySelector('#pendingOptionalCount');
      if (countEl) countEl.textContent = pending.length;
      pending.forEach((e) => {
        const enriched = { ...e, _kind: 'expense', effectiveAmount: M.effectiveAmountAt(e, currentMonth), effectiveIcon: M.effectiveIconFor(e, state) };
        list.appendChild(buildItemElement(enriched, () => M.__onEditExpense && M.__onEditExpense(e.id)));
      });
    }
    return section;
  }

  // ---------- Render: month items / timeline / all expenses / all income / inactive / cc ----------
  function buildMonthItemsSection(state, currentMonth) {
    const list = el('div', { class: 'items-list', id: 'monthItemsList' });
    const { all } = M.getItemsForMonth(state, currentMonth);
    if (all.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '📋'),
        el('p', {}, 'No hay movimientos para este mes.'),
        el('p', { class: 'empty-hint' }, 'Añade un gasto o ingreso para empezar.')
      ));
    } else {
      all.forEach((item) => list.appendChild(buildItemElement(item, () => {
        if (!item.id) return;
        if (item._kind === 'income') return M.__onEditIncome && M.__onEditIncome(item.id);
        // Tarjeta virtual: abrimos la edición de la tarjeta
        if (typeof item.id === 'string' && item.id.startsWith('cc-virtual-')) {
          const cid = item.id.slice('cc-virtual-'.length);
          return M.__onEditCreditCard && M.__onEditCreditCard(cid);
        }
        return M.__onEditExpense && M.__onEditExpense(item.id);
      })));
    }
    const ccVirtual = state.creditCards
      .filter((c) => !c.inactive && M.appliesCreditCardToMonth(c, currentMonth))
      .map((c) => ({
        _kind: 'expense', id: 'cc-virtual-' + c.id, name: c.name + ' (cuota)',
        amount: c.monthlyPayment, type: 'fixed', category: c.category,
        effectiveAmount: c.monthlyPayment, effectiveIcon: c.icon || '💳'
      }));
    ccVirtual.forEach((item) => list.appendChild(buildItemElement(item, () => {
      const cid = item.id.slice('cc-virtual-'.length);
      return M.__onEditCreditCard && M.__onEditCreditCard(cid);
    })));
    return el('div', { class: 'section' },
    el('div', { class: 'section-header' },
      el('h2', { class: 'section-title' }, 'Detalle del mes'),
      el('span', { class: 'section-meta', id: 'monthItemCount' }, '0 movimientos')
    ),
    list
  );
  }

  function buildTimelineSection(state) {
    const list = el('div', { class: 'items-list', id: 'timelineList' });
    const section = el('div', { class: 'section' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Línea de tiempo'),
        el('span', { class: 'section-meta', id: 'timelineCount' }, '0 meses')
      ),
      list
    );
    const t = M.getTimeline(state);
    if (t.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '📅'),
        el('p', {}, 'Añade gastos o ingresos para ver tu línea de tiempo.')
      ));
    } else {
      t.forEach((entry) => {
        const cls = entry.summary.balance >= 0 ? 'positive' : 'negative';
        list.appendChild(el('div', { class: 'timeline-item' },
          el('div', { class: 'timeline-month' }, M.monthKeyToShort(entry.monthKey)),
          el('div', { class: 'timeline-numbers' },
            el('span', { class: 'timeline-income' }, '+' + _fmt(entry.summary.totalIncome)),
            el('span', { class: 'timeline-expense' }, '-' + _fmt(entry.summary.totalExpenses)),
            el('span', { class: 'timeline-balance ' + cls }, _fmt(entry.summary.balance))
          )
        ));
      });
    }
    return section;
  }

  function buildAllExpensesSection(state) {
    const list = el('div', { class: 'items-list', id: 'allExpensesList' });
    let items = state.expenses.slice();
    if (M.__currentFilter && M.__currentFilter !== 'all') {
      items = items.filter((e) => e.type === M.__currentFilter);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '💸'),
        el('p', {}, 'No hay gastos con este filtro.')
      ));
    } else {
      items.forEach((e) => {
        const enriched = { ...e, _kind: 'expense', effectiveAmount: e.amount, effectiveIcon: M.effectiveIconFor(e, state) };
        list.appendChild(buildItemElement(enriched, () => M.__onEditExpense && M.__onEditExpense(e.id)));
      });
    }
    return el('div', { class: 'section' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Todos los gastos'),
        el('button', { class: 'text-btn', id: 'btnNewExpense' }, '+ Nuevo')
      ),
      el('div', { class: 'filter-chips', id: 'expenseFilters' },
        el('button', { class: 'chip chip-active', 'data-filter': 'all' }, 'Todos'),
        el('button', { class: 'chip', 'data-filter': 'fixed' }, 'Fijos'),
        el('button', { class: 'chip', 'data-filter': 'temporary' }, 'Temporales')
      ),
      list
    );
  }

  function buildAllIncomeSection(state) {
    const list = el('div', { class: 'items-list', id: 'allIncomeList' });
    const items = state.income.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '💰'),
        el('p', {}, 'No hay ingresos todavía.')
      ));
    } else {
      items.forEach((i) => {
        const enriched = { ...i, _kind: 'income', effectiveAmount: i.amount, effectiveIcon: M.effectiveIconFor(i, state) };
        list.appendChild(buildItemElement(enriched, () => M.__onEditIncome && M.__onEditIncome(i.id)));
      });
    }
    return el('div', { class: 'section' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Todos los ingresos'),
        el('button', { class: 'text-btn', id: 'btnNewIncome' }, '+ Nuevo')
      ),
      list
    );
  }

  function buildInactiveExpensesSection(state) {
    const list = el('div', { class: 'items-list', id: 'inactiveExpensesList' });
    const section = el('div', { class: 'section' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Gastos desactivados'),
        el('p', { class: 'section-hint' }, 'Gastos desactivados. Pulsa "Reactivar" para volver a verlos.')
      ),
      list
    );
    const inactive = state.expenses.filter((e) => e.inactive);
    if (inactive.length === 0) {
      list.appendChild(el('div', { class: 'empty-state empty-state-mini' },
        el('p', {}, 'No tienes gastos desactivados.')
      ));
      return section;
    }
    inactive.sort((a, b) => a.name.localeCompare(b.name));
    inactive.forEach((e) => {
      const enriched = { ...e, _kind: 'expense', effectiveAmount: e.amount, effectiveIcon: M.effectiveIconFor(e, state) };
      list.appendChild(buildItemElement(enriched, () => M.__onToggleInactive(e.id)));
    });
    return section;
  }

  function buildCreditCardSection(state) {
    const list = el('div', { class: 'items-list', id: 'creditCardsList' });
    const section = el('div', { class: 'section' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Mis tarjetas'),
        el('button', { class: 'text-btn', id: 'btnNewCreditCard' }, '+ Nueva')
      ),
      el('p', { class: 'section-hint' }, 'Tarjetas revolving. Controla el límite, saldo y cuota mensual.'),
      list
    );
    const cards = state.creditCards.slice().sort((a, b) => {
      if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    if (cards.length === 0) {
      list.appendChild(el('div', { class: 'empty-state empty-state-mini' },
        el('p', {}, 'No tienes tarjetas todavía.'),
        el('p', { class: 'empty-hint' }, 'Crea una para llevar el control de tu deuda.')
      ));
      return section;
    }
    cards.forEach((c) => {
      const icon = c.icon || '💳';
      const isPaid = !!(c.paidMonths && c.paidMonths[M.__currentMonthKey]);
      const isSkipped = !!(c.skippedMonths && c.skippedMonths[M.__currentMonthKey]);
      list.appendChild(el('div', { class: 'cc-item' + (c.inactive ? ' cc-item--inactive' : '') },
        el('div', { class: 'cc-item-head' },
          el('div', { class: 'cc-item-icon' }, icon),
          el('div', { class: 'cc-item-body' },
            el('div', { class: 'cc-item-name' }, c.name),
            el('div', { class: 'cc-item-meta' }, M.validityText(c))
          ),
          el('div', { class: 'cc-item-right' },
            el('div', { class: 'cc-item-amount' }, `${_fmt(c.currentBalance)} / ${_fmt(c.maxLimit)}`),
            el('div', { class: 'cc-item-pct' }, c.maxLimit > 0 ? Math.round(c.currentBalance * 100 / c.maxLimit) + '%' : '')
          )
        ),
        el('div', { class: 'cc-numbers' },
          el('span', { class: 'cc-numbers-label' }, 'Cuota ' + M.monthKeyToShort(M.__currentMonthKey) + ':'),
          el('span', { class: 'cc-numbers-value' }, _fmt(c.monthlyPayment))
        ),
        el('div', { class: 'cc-row-actions' },
          el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: (e) => { e.stopPropagation(); M.__onTogglePayCC(c.id); }
          }, isPaid ? '↺ Desmarcar' : '✓ Pagado'),
          el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: (e) => { e.stopPropagation(); M.__onToggleSkipCC(c.id); }
          }, isSkipped ? '↺ No saltar' : '✕ Saltar'),
          el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: () => M.__onUpdateCCBalance(c.id)
          }, '💰 Saldo'),
          el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: () => M.__onAddExtraPayment(c.id)
          }, '➕ Extra'),
          el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: () => M.__onToggleInactiveCC(c.id)
          }, c.inactive ? '🔓' : '🔒'),
          el('button', {
            class: 'btn btn-ghost btn-small',
            onclick: () => M.__onEditCreditCard(c.id)
          }, '✏️')
        )
      ));
    });
    return section;
  }

  function buildSubcategoryItem(sub) {
    const cat = M.CATEGORIES[sub.category] || M.CATEGORIES.otros;
    const used = sub._usedCount || 0;
    return el('div', { class: 'subcategory-item' },
      el('div', { class: 'subcategory-icon' }, sub.icon),
      el('div', { class: 'subcategory-body' },
        el('div', { class: 'subcategory-name' }, sub.label),
        el('div', { class: 'subcategory-meta' }, `${cat.icon} ${_label(sub.category)} · ${used} uso${used === 1 ? '' : 's'}`)
      ),
      el('button', { class: 'item-action item-action--edit', onclick: () => M.__onEditSubcategory(sub.id) }, 'Editar')
    );
  }

  function buildSubcategoriesSection(state) {
    const list = el('div', { class: 'items-list', id: 'subcategoriesList' });
    const section = el('div', { class: 'section' },
      el('div', { class: 'section-header' },
        el('h2', { class: 'section-title' }, 'Subcategorías'),
        el('button', { class: 'text-btn', id: 'btnNewSubcategory' }, '+ Nueva')
      ),
      el('p', { class: 'section-hint' }, 'Crea subcategorías con su propio icono. Aparecerán al añadir gastos y presupuestos.'),
      list
    );
    const subs = state.subcategories.slice().sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
    if (subs.length === 0) {
      list.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'empty-icon' }, '🏷️'),
        el('p', {}, 'No tienes subcategorías todavía.'),
        el('p', { class: 'empty-hint' }, 'Crea tu primera para organizar mejor los gastos de una categoría.')
      ));
      return section;
    }
    subs.forEach((s) => {
      s._usedCount = state.expenses.filter((e) => e.subcategoryId === s.id).length
        + state.income.filter((i) => i.subcategoryId === s.id).length
        + state.budgets.filter((b) => b.subcategoryId === s.id).length;
      list.appendChild(buildSubcategoryItem(s));
    });
    return section;
  }

  // ---------- Modal helpers ----------
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('modal-open');
    document.body.classList.add('modal-open-body');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('modal-open');
    if (!document.querySelector('.modal.modal-open')) {
      document.body.classList.remove('modal-open-body');
    }
  }

  // ---------- Form helpers (expuestos para app.js) ----------
  function _setActiveSeg(segContainer, type) {
    if (!segContainer) return;
    const segs = segContainer.querySelectorAll('.seg');
    segs.forEach((s) => {
      if (s.dataset.type === type) s.classList.add('seg-active');
      else s.classList.remove('seg-active');
    });
  }

  function exposed_setExpenseType(type) {
    const seg = document.getElementById('expenseTypeSeg');
    _setActiveSeg(seg, type);

    const dateWrap = document.getElementById('expenseDateWrap');
    const endWrap = document.getElementById('expenseEndWrap');
    const monthWrap = document.getElementById('expenseMonthWrap');
    const hint = document.getElementById('expenseTypeHint');

    if (type === 'unico') {
      if (dateWrap) dateWrap.style.display = 'none';
      if (endWrap) endWrap.style.display = 'none';
      if (monthWrap) monthWrap.style.display = '';
      if (hint) hint.textContent = 'Para gastos puntuales, como una compra concreta. Aparecerá sólo en el mes elegido.';
    } else {
      if (dateWrap) dateWrap.style.display = '';
      if (endWrap) endWrap.style.display = (type === 'temporary') ? '' : 'none';
      if (monthWrap) monthWrap.style.display = 'none';
      if (hint) hint.textContent = type === 'temporary'
        ? 'Se repite cada mes hasta la fecha de fin. Útil para gastos con fecha conocida de fin.'
        : 'Se repite cada mes hasta que lo elimines. Para compras del día a día vinculadas a un presupuesto, usa el botón "+".';
    }
  }

  function exposed_setIncomeType(type) {
    const seg = document.getElementById('incomeTypeSeg');
    _setActiveSeg(seg, type);

    const dateWrap = document.getElementById('incomeDateWrap');
    const endWrap = document.getElementById('incomeEndWrap');
    const monthWrap = document.getElementById('incomeMonthWrap');
    const hint = document.getElementById('incomeTypeHint');

    if (type === 'extra') {
      if (dateWrap) dateWrap.style.display = 'none';
      if (endWrap) endWrap.style.display = 'none';
      if (monthWrap) monthWrap.style.display = '';
      if (hint) hint.textContent = 'Ingreso puntual. Aparecerá solo en el mes elegido.';
    } else {
      if (dateWrap) dateWrap.style.display = '';
      if (endWrap) endWrap.style.display = 'none';
      if (monthWrap) monthWrap.style.display = 'none';
      if (hint) hint.textContent = 'Se repite cada mes hasta que lo elimines.';
    }
  }

  function exposed_fillExpenseCategorySelectors(category) {
    // Subcategorías: las que pertenezcan a la categoría seleccionada
    const subSelect = document.getElementById('expenseSubcategory');
    const subHint = document.getElementById('expenseSubcategoryHint');
    if (subSelect) {
      const previous = subSelect.value;
      subSelect.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Ninguna —';
      subSelect.appendChild(opt0);
      let count = 0;
      if (category && M.getSubcategoriesForCategory) {
        const subs = M.getSubcategoriesForCategory(window.__APP_STATE__ || { subcategories: [] }, category);
        subs.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.icon} ${s.label}`;
          subSelect.appendChild(opt);
          count++;
        });
      }
      if (subHint) {
        if (count === 0) {
          subHint.style.display = '';
          subHint.textContent = 'No tienes subcategorías para esta categoría. Crea una desde Categorías.';
        } else {
          subHint.style.display = 'none';
        }
      }
      // Restaurar valor si sigue siendo válido
      if (previous && Array.from(subSelect.options).some((o) => o.value === previous)) {
        subSelect.value = previous;
      }
    }

    // Presupuestos: los que pertenezcan a la categoría seleccionada
    const budgetSelect = document.getElementById('expenseBudget');
    if (budgetSelect) {
      const previous = budgetSelect.value;
      budgetSelect.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Sin asignar —';
      budgetSelect.appendChild(opt0);
      const state = window.__APP_STATE__ || { budgets: [] };
      state.budgets
        .filter((b) => !category || b.category === category)
        .forEach((b) => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = `${b.icon || '🎯'} ${_label(b.category)} — ${M.formatMoney(b.amount)}`;
          budgetSelect.appendChild(opt);
        });
      if (previous && Array.from(budgetSelect.options).some((o) => o.value === previous)) {
        budgetSelect.value = previous;
      }
    }

    // Tarjetas de crédito: todas (no se filtran por categoría)
    const ccSelect = document.getElementById('expenseCreditCard');
    if (ccSelect) {
      const previous = ccSelect.value;
      ccSelect.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Sin tarjeta —';
      ccSelect.appendChild(opt0);
      const state = window.__APP_STATE__ || { creditCards: [] };
      state.creditCards
        .filter((c) => !c.inactive)
        .forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.icon || '💳'} ${c.name}`;
          ccSelect.appendChild(opt);
        });
      if (previous && Array.from(ccSelect.options).some((o) => o.value === previous)) {
        ccSelect.value = previous;
      }
    }
  }

  function exposed_fillBudgetCategorySelectors(category) {
    const subSelect = document.getElementById('budgetSubcategory');
    if (subSelect) {
      const previous = subSelect.value;
      subSelect.innerHTML = '';
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Todas las de la categoría —';
      subSelect.appendChild(opt0);
      const state = window.__APP_STATE__ || { subcategories: [] };
      let count = 0;
      if (category && M.getSubcategoriesForCategory) {
        M.getSubcategoriesForCategory(state, category).forEach((s) => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.icon} ${s.label}`;
          subSelect.appendChild(opt);
          count++;
        });
      }
      if (count === 0 && previous) {
        subSelect.value = '';
      } else if (previous && Array.from(subSelect.options).some((o) => o.value === previous)) {
        subSelect.value = previous;
      }
    }
  }

  // ---------- Icon picker ----------
  let _iconPickerCallback = null;
  function exposed_openIconPicker(currentIcon, onSelect) {
    const body = document.getElementById('iconPickerBody');
    if (!body) return;
    _iconPickerCallback = onSelect || null;
    body.innerHTML = '';
    M.ICON_OPTIONS.forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'picker-group';
      const title = document.createElement('div');
      title.className = 'picker-group-title';
      title.textContent = group.group;
      groupEl.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'picker-grid';
      group.icons.forEach((ic) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'picker-cell' + (ic === currentIcon ? ' is-active' : '');
        cell.textContent = ic;
        cell.addEventListener('click', () => {
          if (_iconPickerCallback) _iconPickerCallback(ic);
          closeModal('iconPickerPopup');
        });
        grid.appendChild(cell);
      });
      groupEl.appendChild(grid);
      body.appendChild(groupEl);
    });
    openModal('iconPickerPopup');
  }

  // ---------- API pública ----------
  global.UI = {
    buildItemElement,
    buildSummaryCards,
    buildBalanceSection,
    buildBudgetSection,
    buildPendingSection,
    buildMonthItemsSection,
    buildTimelineSection,
    buildAllExpensesSection,
    buildAllIncomeSection,
    buildInactiveExpensesSection,
    buildCreditCardSection,
    buildSubcategoriesSection,
    openModal,
    closeModal,
    el,
    exposed_setExpenseType,
    exposed_setIncomeType,
    exposed_fillExpenseCategorySelectors,
    exposed_fillBudgetCategorySelectors,
    exposed_openIconPicker
  };
  // Aliases en UI.el para compatibilidad con código existente que usa UI.el.exposed_*
  global.UI.el = Object.assign({}, el, {
    exposed_setExpenseType,
    exposed_setIncomeType,
    exposed_fillExpenseCategorySelectors,
    exposed_fillBudgetCategorySelectors,
    exposed_openIconPicker
  });
})(window);
