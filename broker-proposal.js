import { analyzeProposal, measurePlan, normalizePlan, planMaxRows, planPhases } from './broker-plans.js';
import { proposalTranslations } from './broker-proposal-translations.js';
import { deleteRecord, listRecords, saveRecord, subscribeRecords } from './broker-store.js';

const blankInstallment = { label: '', date: '', phase: 'booking', amount: '' };
const proposalDefaults = { propertyId: '', planId: '', rent: '', expenses: '0', fees: '0', vacancy: '0', mortgage: false, downPayment: '0', rate: '4.5', years: '25' };
const proposalDraft = { ...proposalDefaults };
let planDraft = null;

function node(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = content;
  return result;
}

function append(parent, tag, className, content) {
  const item = node(tag, className, content);
  parent.append(item);
  return item;
}

function labeledInput(parent, label, name, type, options) {
  const input = node('input');
  input.name = name;
  input.type = type;
  Object.assign(input, options);
  addLabel(parent, label, input);
  return input;
}

function addLabel(parent, title, input) {
  const label = append(parent, 'label', 'broker-field');
  append(label, 'span', '', title);
  label.append(input);
  return label;
}

function selectControl(parent, text, name, choices, chosen) {
  const select = node('select');
  select.name = name;
  replaceChoices(select, choices, chosen);
  addLabel(parent, text, select);
  return select;
}

function replaceChoices(select, choices, chosen) {
  select.replaceChildren(...choices.map(([key, text]) => {
    const option = node('option', '', text);
    option.value = key;
    return option;
  }));
  select.value = choices.some(([key]) => key === chosen) ? chosen : '';
}

function action(parent, label, kind = '', type = 'button') {
  const button = append(parent, 'button', ['broker-button', kind].filter(Boolean).join(' '), label);
  button.type = type;
  return button;
}

function fields(parent) {
  return append(parent, 'div', 'broker-fields');
}

function status(parent, id, isError = false) {
  const message = append(parent, 'p', isError ? 'broker-error' : 'proposal-status');
  message.id = id;
  message.setAttribute('role', isError ? 'alert' : 'status');
  return message;
}

function panel(route, description, ctx) {
  const screen = node('section', 'broker-screen proposal-screen');
  screen.setAttribute('aria-labelledby', 'tool-title');
  const heading = append(screen, 'header', 'broker-heading proposal-screen-heading');
  const title = append(heading, 'h1', '', ctx.text[route]);
  title.id = 'tool-title';
  title.tabIndex = -1;
  append(heading, 'p', '', ctx.text[description]);
  return screen;
}

function numberFields(parent, definitions, state, ctx) {
  for (const [name, max, min = 0, step = 'any'] of definitions) {
    labeledInput(parent, ctx.text[name], name, 'number', {
      min, max, step, required: true, value: state[name], inputMode: step === '1' ? 'numeric' : 'decimal',
    });
  }
}

function onRecords(collections, signal, listener) {
  if (signal?.aborted) return;
  const unsubscribe = subscribeRecords(({ collections: changed }) => {
    if (changed.some(key => collections.includes(key))) listener();
  });
  signal?.addEventListener('abort', unsubscribe, { once: true });
}

function planMessage(error, ctx) {
  const message = ctx.text[error.code + 'Error'] || ctx.text.storageError;
  return error.row ? `${ctx.text.rowError} ${ctx.number.format(error.row)}. ${message}` : message;
}

function renderPlanEditor(ctx) {
  const { text, money, date, number, signal } = ctx;
  const screen = panel('custom-plans', 'planDescription', ctx);
  const layout = append(screen, 'div', 'plan-layout');
  const form = append(layout, 'form', 'broker-card plan-editor');
  form.id = 'custom-plans-form';
  form.noValidate = true;
  const formTitle = append(form, 'h2', '', text.newPlan);
  const basics = fields(form);
  const name = labeledInput(basics, text.planName, 'planName', 'text', { maxLength: 120, required: true, dir: 'auto' });
  const price = labeledInput(basics, text.planPrice, 'planPrice', 'number', {
    min: 1, max: 1e12, step: '0.01', required: true, inputMode: 'decimal',
  });
  append(form, 'h3', '', text.planRows);
  const rows = append(form, 'div', 'installment-list');
  rows.id = 'plan-row-list';
  const balance = append(form, 'p', 'broker-notice plan-summary');
  balance.id = 'plan-balance';
  const controls = append(form, 'div', 'broker-actions');
  const add = action(controls, text.addInstallment, 'secondary');
  add.id = 'add-installment';
  const save = action(controls, text.savePlan, '', 'submit');
  const cancel = action(controls, text.cancel, 'secondary');
  const error = status(form, 'plan-error', true);
  const feedback = status(form, 'plan-status');
  const library = append(layout, 'section', 'broker-card plan-library');
  append(library, 'h2', '', text.savedPlans);
  const saved = append(library, 'div', 'plan-saved-list');
  saved.id = 'saved-plan-list';
  append(saved, 'p', 'broker-empty', text.loading);
  let currentId;
  let saving = false;
  let readVersion = 0;

  const rowValues = () => Array.from(rows.children, (row) => ({
    label: row.querySelector('[name="installmentLabel"]').value,
    date: row.querySelector('[name="installmentDate"]').value,
    phase: row.querySelector('[name="installmentPhase"]').value,
    amount: row.querySelector('[name="installmentAmount"]').value,
  }));

  function retainDraft() {
    planDraft = { id: currentId, name: name.value, price: price.value, installments: rowValues() };
  }

  function refreshBalance() {
    retainDraft();
    try {
      const { assigned, remaining } = measurePlan(price.valueAsNumber, rowValues().map(row => Number(row.amount)));
      balance.replaceChildren(
        node('span', '', `${text.assigned} ${money.format(assigned)}`),
        node('strong', '', `${text[remaining < 0 ? 'over' : 'remaining']} ${money.format(Math.abs(remaining))}`),
      );
    } catch {
      balance.replaceChildren();
    }
    balance.hidden = !balance.childElementCount;
  }

  function setRows(installments) {
    rows.replaceChildren();
    installationsOf(installments);
    add.disabled = installments.length >= planMaxRows;
    refreshBalance();
  }

  function installationsOf(installments) {
    installments.forEach((entry, index) => {
      const group = append(rows, 'fieldset', 'installment-row');
      append(group, 'legend', '', `${text.installment} ${number.format(index + 1)}`);
      const rowFields = fields(group);
      labeledInput(rowFields, text.installmentLabel, 'installmentLabel', 'text', {
        value: entry.label, maxLength: 100, required: true, dir: 'auto',
      });
      labeledInput(rowFields, text.installmentDate, 'installmentDate', 'date', {
        value: entry.date, min: '1900-01-01', max: '9999-12-31', required: true,
      });
      selectControl(rowFields, text.installmentPhase, 'installmentPhase', planPhases.map(phase => [phase, text[phase]]), entry.phase);
      labeledInput(rowFields, text.installmentAmount, 'installmentAmount', 'number', {
        value: entry.amount, min: 0.01, max: 1e12, step: '0.01', inputMode: 'decimal', required: true,
      });
      const remove = action(group, text.removeInstallment, 'secondary');
      remove.disabled = installments.length === 1;
      remove.addEventListener('click', () => {
        const remaining = rowValues();
        remaining.splice(index, 1);
        setRows(remaining);
        rows.children[Math.min(index, remaining.length - 1)].querySelector('input').focus();
      });
    });
  }

  function edit(record = {}) {
    currentId = record.id;
    name.value = record.name ?? '';
    price.value = record.price ?? '';
    formTitle.textContent = currentId ? text.editPlanTitle : text.newPlan;
    cancel.hidden = !currentId;
    error.textContent = '';
    setRows(record.installments ?? [blankInstallment]);
  }

  async function refreshPlans() {
    const version = ++readVersion;
    try {
      const plans = await listRecords('plans');
      if (signal?.aborted || version !== readVersion) return;
      if (currentId && !plans.some(plan => plan.id === currentId)) edit();
      saved.replaceChildren();
      if (!plans.length) append(saved, 'p', 'broker-empty', text.noPlans);
      for (const plan of plans) {
        const entry = append(saved, 'article', 'plan-saved-entry');
        append(append(entry, 'h3'), 'bdi', '', plan.name);
        append(entry, 'p', '', money.format(plan.price));
        append(entry, 'p', 'proposal-muted', `${date(plan.installments[0].date)} – ${date(plan.installments.at(-1).date)}`);
        const buttons = append(entry, 'div', 'broker-actions');
        action(buttons, text.editPlan, 'secondary').addEventListener('click', () => {
          if (saving) return;
          edit(plan);
          feedback.textContent = '';
          name.focus();
        });
        action(buttons, text.deletePlan, 'danger').addEventListener('click', async () => {
          if (saving || !window.confirm(text.deleteConfirmation)) return;
          try {
            await deleteRecord('plans', plan.id);
            if (signal?.aborted) return;
            feedback.textContent = text.planDeleted;
          } catch (problem) {
            error.textContent = planMessage(problem, ctx);
          }
        });
      }
    } catch {
      if (!signal?.aborted && version === readVersion) saved.replaceChildren(node('p', 'broker-error', text.storageError));
    }
  }

  form.addEventListener('input', () => {
    error.textContent = '';
    feedback.textContent = '';
    form.querySelectorAll('[aria-invalid]').forEach(control => control.removeAttribute('aria-invalid'));
    refreshBalance();
  });
  add.addEventListener('click', () => {
    setRows([...rowValues(), blankInstallment]);
    rows.lastElementChild.querySelector('input').focus();
  });
  cancel.addEventListener('click', () => {
    edit();
    name.focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    error.textContent = '';
    feedback.textContent = '';
    let record;
    try {
      record = normalizePlan({
        name: name.value, price: price.valueAsNumber,
        installments: rowValues().map(row => ({ ...row, amount: Number(row.amount) })),
      });
    } catch (problem) {
      error.textContent = planMessage(problem, ctx);
      const row = problem.row ? rows.children[problem.row - 1] : form;
      const input = row.querySelector(`[name="${problem.code}"]`);
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
      return;
    }
    saving = save.disabled = true;
    try {
      const result = await saveRecord('plans', { ...record, ...(currentId ? { id: currentId } : {}) });
      if (signal?.aborted) return;
      edit(result);
      feedback.textContent = text.planSaved;
    } catch (problem) {
      if (!signal?.aborted) error.textContent = planMessage(problem, ctx);
    } finally {
      saving = save.disabled = false;
    }
  });

  edit(planDraft ?? {});
  onRecords(['plans'], signal, refreshPlans);
  refreshPlans();
  return screen;
}

function asList(parent, items, className = '') {
  const list = append(parent, 'dl', className);
  for (const [label, value] of items) {
    const entry = append(list, 'div', '');
    append(entry, 'dt', '', label);
    append(append(entry, 'dd'), 'bdi', '', value);
  }
  return list;
}

function financialMetrics(parent, heading, items) {
  const group = append(parent, 'section', 'proposal-report-section');
  append(group, 'h3', '', heading);
  const metrics = asList(group, items, 'broker-metrics');
  for (const entry of metrics.children) entry.className = 'broker-metric';
  return group;
}

function scheduleTable(parent, schedule, ctx) {
  const { text, date, money, pct } = ctx;
  const scroll = append(parent, 'div', 'broker-table-wrap proposal-schedule-table');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', text.schedule);
  const table = append(scroll, 'table', 'broker-table');
  append(table, 'caption', 'proposal-sr-only', text.schedule);
  const headers = append(append(table, 'thead'), 'tr');
  for (const key of ['installmentDate', 'payment', 'phase', 'amount', 'share', 'cumulative']) {
    append(headers, 'th', '', text[key]).scope = 'col';
  }
  const body = append(table, 'tbody');
  for (const row of schedule) {
    const line = append(body, 'tr');
    append(line, 'td', '', date(row.date));
    const label = append(line, 'th');
    label.scope = 'row';
    append(label, 'bdi', '', row.label);
    for (const value of [text[row.phase], money.format(row.amount), pct.format(row.share / 100), money.format(row.cumulative)]) {
      append(line, 'td', '', value);
    }
  }
}

function shareControls(parent, values, model, propertyPrice, ctx) {
  const { text, money, pct, number } = ctx;
  const formatPct = value => pct.format(value / 100);
  const lines = [
    text.shareHeader,
    `${text.price} · ${money.format(propertyPrice)}`,
    `${text.rent} · ${money.format(values.rent)}`,
    `${text.grossYield} · ${formatPct(model.rental.grossYield)}`,
    `${text.netYield} · ${formatPct(model.rental.netYield)}`,
    `${text.annualNet} · ${money.format(model.rental.net)}`,
  ];
  if (model.schedule) lines.push(`${text.installmentCount} · ${number.format(model.schedule.length)}`);
  if (model.financing) lines.push(`${text.monthlyPayment} · ${money.format(model.financing.monthlyPayment)}`);
  lines.push(text.reportNote);
  const message = lines.join('\n');
  const group = append(parent, 'div', 'proposal-share');
  const toggle = action(group, text.sharePreview, 'secondary');
  toggle.id = 'proposal-share-toggle';
  toggle.setAttribute('aria-controls', 'proposal-sharing');
  toggle.setAttribute('aria-expanded', 'false');
  const preview = append(group, 'section', 'proposal-share-box');
  preview.id = 'proposal-sharing';
  preview.hidden = true;
  append(preview, 'p', 'broker-notice', text.sharePrivacy);
  const textarea = node('textarea');
  textarea.id = 'proposal-share-preview';
  textarea.value = message;
  textarea.readOnly = true;
  textarea.rows = 8;
  addLabel(preview, text.shareMessage, textarea);
  const controls = append(preview, 'div', 'broker-actions');
  const copy = action(controls, text.copySummary, 'secondary');
  const open = append(controls, 'a', 'broker-button', text.openWhatsApp);
  open.id = 'proposal-whatsapp';
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  const copied = status(preview, 'proposal-copy-status');

  toggle.addEventListener('click', () => {
    preview.hidden = !preview.hidden;
    toggle.setAttribute('aria-expanded', String(!preview.hidden));
    toggle.textContent = preview.hidden ? text.sharePreview : text.closePreview;
    if (preview.hidden) open.removeAttribute('href');
    else open.href = 'https://wa.me/?text=' + encodeURIComponent(message);
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message);
      copied.textContent = text.copied;
    } catch {
      textarea.focus();
      textarea.select();
      copied.textContent = text.copyFailed;
    }
  });
}

function renderReport(report, property, plan, values, model, ctx) {
  const { text, money, date, pct, number } = ctx;
  const formatPct = value => pct.format(value / 100);
  const { rental, financing, schedule } = model;
  report.replaceChildren();
  const header = append(report, 'header', 'proposal-report-header');
  append(append(header, 'h2'), 'bdi', '', property.project);
  append(header, 'p', '', text.report);
  const propertySection = append(report, 'section', 'proposal-report-section');
  append(propertySection, 'h3', '', text.propertyDetails);
  asList(propertySection, [
    [text.developer, property.developer], [text.location, property.location], [text.unitType, property.unitType],
    [text.size, `${number.format(property.size)} ${text.sqft}`], [text.price, money.format(property.price)],
    [text.availability, text[property.availability]], [text.handoverDate, property.handover ? date(property.handover) : text.unknown],
  ], 'proposal-detail-list');
  const rentalSection = financialMetrics(report, text.incomeEstimate, [
    [text.grossYield, formatPct(rental.grossYield)], [text.netYield, formatPct(rental.netYield)],
    [text.effectiveRent, money.format(rental.effectiveRent)], [text.annualNet, money.format(rental.net)],
    [text.monthlyNet, money.format(rental.monthlyNet)], [text.acquisitionCost, money.format(rental.total)],
  ]);
  append(rentalSection, 'p', 'proposal-method', text.rentalNote);
  const assumptions = append(report, 'section', 'proposal-report-section');
  append(assumptions, 'h3', '', text.assumptions);
  const items = [
    [text.rent, money.format(values.rent)], [text.expenses, money.format(values.expenses)],
    [text.fees, formatPct(values.fees)], [text.acquisitionFees, money.format(model.rentalCosts)],
    [text.vacancy, formatPct(values.vacancy)],
  ];
  if (values.loan) {
    items.push([text.downPayment, money.format(values.loan.downPayment)], [text.rate, formatPct(values.loan.rate)], [text.years, number.format(values.loan.years)]);
  }
  asList(assumptions, items, 'proposal-detail-list');
  const paymentSection = append(report, 'section', 'proposal-report-section');
  append(paymentSection, 'h3', '', text.schedule);
  append(append(paymentSection, 'p', 'proposal-method'), 'bdi', '', plan?.name || text.noSchedule);
  if (schedule) scheduleTable(paymentSection, schedule, ctx);
  if (financing) {
    const financialSection = financialMetrics(report, text.scenario, [
      [text.principal, money.format(financing.principal)], [text.loanToValue, formatPct(financing.loanToValue)],
      [text.monthlyPayment, money.format(financing.monthlyPayment)], [text.totalInterest, money.format(financing.totalInterest)],
      [text.totalPaid, money.format(financing.totalPaid)],
      [text.initialCash, money.format(financing.initialCash)], [text.annualCashFlow, money.format(financing.annualCashFlow)],
      [text.cashOnCash, financing.cashOnCash === null ? text.undefinedReturn : formatPct(financing.cashOnCash)],
    ]);
    append(financialSection, 'p', 'proposal-method', text.financingNote);
    append(financialSection, 'p', 'proposal-method', text.debtNote);
  }
  append(report, 'p', 'proposal-report-note', text.reportNote);
  append(report, 'p', 'proposal-print-hint proposal-method', text.printHelp);
  shareControls(report, values, model, property.price, ctx);
}

function renderProposalEditor(ctx) {
  const { text, money, signal } = ctx;
  const screen = panel('proposals', 'proposalDescription', ctx);
  const layout = append(screen, 'div', 'proposal-layout');
  const form = append(layout, 'form', 'broker-card proposal-input');
  form.id = 'proposals-form';
  form.noValidate = true;
  append(form, 'h2', '', text.details);
  const propertyFields = fields(form);
  const propertiesSelect = selectControl(propertyFields, text.property, 'propertyId', [['', text.chooseProperty]], '');
  propertiesSelect.required = true;
  propertiesSelect.disabled = true;
  const plansSelect = selectControl(propertyFields, text.plan, 'planId', [['', text.noSchedule]], '');
  plansSelect.disabled = true;
  const guide = append(form, 'p', 'proposal-method', text.planGuide);
  guide.id = 'proposal-plan-guide';
  plansSelect.setAttribute('aria-describedby', guide.id);
  const empty = append(form, 'p', 'broker-notice', text.loading);
  const rental = append(form, 'fieldset', 'proposal-fieldset');
  append(rental, 'legend', '', text.rental);
  numberFields(fields(rental), [['rent', 1e12], ['expenses', 1e12], ['fees', 100], ['vacancy', 100]], proposalDraft, ctx);
  const useLoan = node('input');
  useLoan.type = 'checkbox';
  useLoan.name = 'includeMortgage';
  useLoan.checked = proposalDraft.mortgage;
  const mortgage = append(form, 'fieldset', 'proposal-fieldset');
  append(mortgage, 'legend', '', text.mortgage);
  const loanLabel = addLabel(mortgage, text.includeMortgage, useLoan);
  loanLabel.classList.add('proposal-check');
  const loanFields = append(mortgage, 'div', 'proposal-loan-fields');
  numberFields(fields(loanFields), [['downPayment', 1e12], ['rate', 100], ['years', 50, 1, '1']], proposalDraft, ctx);
  const controls = append(form, 'div', 'broker-actions');
  const generate = action(controls, text.generate, '', 'submit');
  generate.disabled = true;
  const error = status(form, 'proposal-error', true);
  const feedback = status(form, 'proposal-status');
  const report = append(layout, 'article', 'broker-card proposal-report');
  report.id = 'proposal-report';
  report.hidden = true;
  let properties = new Map();
  let plans = [];
  let readVersion = 0;

  function setLoanState() {
    loanFields.hidden = !useLoan.checked;
    for (const input of loanFields.querySelectorAll('input')) input.disabled = loanFields.hidden;
    proposalDraft.mortgage = useLoan.checked;
  }

  function updatePlans() {
    const selected = properties.get(propertiesSelect.value);
    const options = [['', text.noSchedule]];
    if (selected) {
      for (const item of plans) {
        if (item.price === selected.price) options.push([item.id, item.name]);
      }
    }
    replaceChoices(plansSelect, options, proposalDraft.planId);
    plansSelect.disabled = options.length < 2;
    proposalDraft.planId = plansSelect.value;
  }

  function invalidateReport() {
    const previouslyGenerated = form.dataset.valid === 'true';
    form.dataset.valid = 'false';
    report.hidden = true;
    report.replaceChildren();
    if (previouslyGenerated) feedback.textContent = text.recalculate;
  }

  async function refreshRecords() {
    const version = ++readVersion;
    invalidateReport();
    properties = new Map();
    plans = [];
    propertiesSelect.disabled = plansSelect.disabled = generate.disabled = true;
    try {
      const [items, schedules] = await Promise.all([listRecords('properties'), listRecords('plans')]);
      if (signal?.aborted || version !== readVersion) return;
      properties = new Map(items.map(property => [property.id, property]));
      plans = schedules;
      replaceChoices(propertiesSelect, [['', text.chooseProperty], ...items.map(item => [
        item.id, `${item.project} · ${item.unitType} · ${money.format(item.price)}`,
      ])], proposalDraft.propertyId);
      proposalDraft.propertyId = propertiesSelect.value;
      propertiesSelect.disabled = !items.length;
      generate.disabled = !items.length;
      empty.hidden = !!items.length;
      empty.replaceChildren();
      if (!items.length) {
        empty.append(document.createTextNode(text.noProperties + ' '));
        append(empty, 'a', '', text.addProperty).href = '#inventory';
      }
      updatePlans();
    } catch {
      if (signal?.aborted || version !== readVersion) return;
      error.textContent = text.storageError;
      empty.hidden = true;
    }
  }

  function fail(message, input) {
    invalidateReport();
    error.textContent = message;
    feedback.textContent = '';
    if (input && !input.disabled) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
  }

  propertiesSelect.addEventListener('change', () => {
    proposalDraft.propertyId = propertiesSelect.value;
    updatePlans();
  });
  useLoan.addEventListener('change', setLoanState);
  form.addEventListener('input', ({ target }) => {
    error.textContent = '';
    target.removeAttribute('aria-invalid');
    if (Object.hasOwn(proposalDraft, target.name)) proposalDraft[target.name] = target.value;
    invalidateReport();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    form.dataset.valid = 'false';
    error.textContent = '';
    const property = properties.get(propertiesSelect.value);
    if (!property) return fail(text.needProperty, propertiesSelect);
    const invalid = form.querySelector('input:invalid');
    if (invalid) return fail(`${text.invalidField} ${text[invalid.name]}.`, invalid);
    const values = {};
    for (const name of ['rent', 'expenses', 'fees', 'vacancy']) {
      values[name] = form.elements.namedItem(name).valueAsNumber;
    }
    if (useLoan.checked) {
      values.loan = {};
      for (const name of ['downPayment', 'rate', 'years']) {
        values.loan[name] = form.elements.namedItem(name).valueAsNumber;
      }
      if (values.loan.downPayment > property.price) return fail(text.invalidLoan, form.elements.namedItem('downPayment'));
    }
    const plan = plans.find(item => item.id === plansSelect.value);
    try {
      const model = analyzeProposal({ price: property.price, ...values, plan });
      renderReport(report, property, plan, values, model, ctx);
      report.hidden = false;
      form.dataset.valid = 'true';
      feedback.textContent = text.proposalGenerated;
    } catch (problem) {
      fail(text[problem.code + 'Error'] || text.calculationError);
    }
  });

  setLoanState();
  onRecords(['plans', 'properties'], signal, refreshRecords);
  refreshRecords();
  return screen;
}

export function renderProposal(route, language, { signal } = {}) {
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC', calendar: 'gregory' });
  const ctx = {
    text: proposalTranslations[language] ?? proposalTranslations.en,
    money: new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED', maximumFractionDigits: 2, minimumFractionDigits: 0 }),
    pct: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2, minimumFractionDigits: 2 }),
    number: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    date: value => date.format(new Date(value + 'T00:00:00Z')),
    signal,
  };
  return route === 'custom-plans' ? renderPlanEditor(ctx) : renderProposalEditor(ctx);
}
