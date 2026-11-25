import { calculateCommission, calculatePerformance, reportingMonth } from './broker-metrics.js';
import { salesTranslations } from './broker-sales-translations.js';
import { deleteRecord, listRecords, saveRecord, subscribeRecords } from './broker-store.js';

const maxAed = 1_000_000_000_000;
const commissionFields = {
  price: { min: 1, max: maxAed, step: 0.01, unit: 'AED' },
  rate: { min: 0, max: 100, step: 0.0001, unit: '%' },
  referral: { min: 0, max: 100, step: 0.0001, unit: '%' },
  coBroker: { min: 0, max: 100, step: 0.0001, unit: '%' },
  agent: { min: 0, max: 100, step: 0.0001, unit: '%' },
};
const commissionValues = { price: '', rate: '', referral: '0', coBroker: '0', agent: '0' };
const monthPattern = /^(?:19\d\d|[2-9]\d{3})-(?:0[1-9]|1[0-2])$/;
let selectedMonth = reportingMonth();

function element(tag, classes, text) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text !== undefined) node.textContent = text;
  return node;
}

function screen(title, description) {
  const content = element('section', 'broker-screen sales-screen');
  const header = element('header', 'broker-heading');
  const heading = element('h1', '', title);
  heading.id = 'tool-title';
  heading.tabIndex = -1;
  header.append(heading, element('p', '', description));
  content.setAttribute('aria-labelledby', heading.id);
  content.append(header);
  return content;
}

function card(tag, headline) {
  const content = element(tag, 'broker-card');
  content.append(element('h2', '', headline));
  return content;
}

function button(title, kind = '', type = 'button') {
  const node = element('button', `broker-button ${kind}`.trim(), title);
  node.type = type;
  return node;
}

function numberField(name, title, { min, max, step, unit }, value) {
  const label = element('label', 'broker-field');
  const input = element('input');
  input.type = 'number';
  input.name = name;
  input.min = min;
  input.max = max;
  input.step = step;
  input.inputMode = step === 1 ? 'numeric' : 'decimal';
  input.required = true;
  input.value = value;
  label.append(element('span', '', unit ? `${title} (${unit})` : title), input);
  return { label, input };
}

function message(content, role = 'status') {
  const node = element('p', role === 'alert' ? 'broker-error' : 'broker-notice', content);
  node.setAttribute('role', role);
  node.hidden = !content;
  return node;
}

function updateMessage(node, text) {
  node.textContent = text;
  node.hidden = !text;
}

function formatters(language) {
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  return {
    money: new Intl.NumberFormat(locale, {
      style: 'currency', currency: 'AED', minimumFractionDigits: 0, maximumFractionDigits: 2,
    }),
    count: new Intl.NumberFormat(locale),
    percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
  };
}

function metricGrid(entries) {
  const grid = element('dl', 'broker-metrics sales-metrics');
  for (const [key, label, value] of entries) {
    const tile = element('div', 'broker-metric');
    tile.dataset.metric = key;
    tile.append(element('dt', '', label), element('dd', '', value));
    grid.append(tile);
  }
  return grid;
}

function method(title, ...paragraphs) {
  const section = element('section', 'sales-method');
  section.append(element('h3', '', title), ...paragraphs.map((text) => element('p', '', text)));
  return section;
}

function renderCommission(text, { money }) {
  const panel = screen(text.commissionTitle, text.commissionDescription);
  const layout = element('div', 'broker-grid sales-commission-grid');
  const form = card('form', text.assumptions);
  form.id = 'commission-form';
  form.noValidate = true;
  const fields = element('div', 'broker-fields sales-fields');
  for (const [name, options] of Object.entries(commissionFields)) {
    const unit = options.unit === 'AED' ? text.aed : text.percentageUnit;
    fields.append(numberField(name, text[name], { ...options, unit }, commissionValues[name]).label);
  }
  const actions = element('div', 'broker-actions');
  const error = message('', 'alert');
  actions.append(button(text.calculate, '', 'submit'));
  form.append(fields, actions, error);

  const resultCard = card('section', text.commissionResults);
  const output = element('div');
  output.id = 'commission-results';
  output.append(element('p', 'broker-empty', text.commissionEmpty));
  const status = message();
  resultCard.append(output, status, method(text.calculation, text.commissionMethod, text.rounding));
  layout.append(form, resultCard);
  panel.append(layout);

  function calculate(interactive) {
    form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    const invalid = form.querySelector('input:invalid');
    if (invalid) {
      if (!interactive) return;
      invalid.setAttribute('aria-invalid', 'true');
      invalid.focus();
      output.replaceChildren(element('p', 'broker-empty', text.commissionEmpty));
      updateMessage(status, '');
      updateMessage(error, text.invalidCommission);
      return;
    }
    const values = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, Number(value)]));
    try {
      const result = calculateCommission(values);
      const metrics = Object.entries(result).map(([key, value]) => [key, text[key], money.format(value)]);
      output.replaceChildren(metricGrid(metrics));
      updateMessage(error, '');
      updateMessage(status, interactive ? text.updatedCommission : '');
    } catch (failure) {
      output.replaceChildren(element('p', 'broker-empty', text.commissionEmpty));
      updateMessage(status, '');
      updateMessage(error, failure.message === 'externalSplit' ? text.externalSplit : text.invalidCommission);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculate(true);
  });
  form.addEventListener('input', (event) => {
    const { name, value } = event.target;
    if (!Object.hasOwn(commissionValues, name)) return;
    commissionValues[name] = value;
    event.target.removeAttribute('aria-invalid');
    updateMessage(error, '');
    updateMessage(status, '');
    output.replaceChildren(element('p', 'broker-empty', text.commissionChanged));
  });
  calculate(false);
  return panel;
}

function progressGroup(text, result, target, { money, count, percent }) {
  const grid = element('div', 'sales-progress-group');
  const items = [
    ['targetWon', result.won, target?.deals, count],
    ['targetCommission', result.grossCommission, target?.commission, money],
  ];
  for (const [key, actual, goal, formatter] of items) {
    const item = element('div', 'sales-progress-item');
    const label = element('span', 'sales-progress-label', text[key]);
    if (goal > 0) {
      const progress = element('progress');
      progress.max = goal;
      progress.value = Math.min(actual, goal);
      label.id = `performance-progress-${key}`;
      progress.setAttribute('aria-labelledby', label.id);
      progress.setAttribute('aria-valuetext', text.ratio(formatter.format(actual), formatter.format(goal)));
      item.append(
        label, progress,
        element('p', 'sales-progress-value', text.ratio(formatter.format(actual), formatter.format(goal))),
        element('p', 'sales-progress-percent', percent.format(actual / goal)),
      );
    } else {
      item.append(element('p', 'sales-progress-label', text[key]), element('p', 'broker-notice', text.noGoal));
    }
    grid.append(item);
  }
  return grid;
}

function pipeline(text, { stages, openLeads }, count) {
  const list = element('dl', 'sales-pipeline');
  for (const key of ['new', 'qualified', 'viewing', 'offer']) {
    const row = element('div', 'sales-pipeline-row');
    const tally = element('dd', '', count.format(stages[key]));
    const bar = element('meter');
    const barContainer = element('dd', 'sales-pipeline-bar');
    barContainer.setAttribute('aria-hidden', 'true');
    bar.max = openLeads || 1;
    bar.value = stages[key];
    barContainer.append(bar);
    row.append(element('dt', '', text[key]), tally, barContainer);
    list.append(row);
  }
  return list;
}

function renderPerformance(text, formats, signal) {
  const panel = screen(text.performanceTitle, text.performanceDescription);
  const period = element('div', 'sales-period');
  const label = element('label', 'broker-field', text.period);
  const month = element('input');
  month.id = 'performance-month';
  month.type = 'month';
  month.value = selectedMonth;
  month.required = true;
  month.placeholder = 'YYYY-MM';
  month.setAttribute('aria-describedby', 'performance-month-note');
  label.append(month);
  const periodNote = element('p', 'sales-hint', text.periodNote);
  periodNote.id = 'performance-month-note';
  period.append(label, periodNote);

  const status = message(text.loading);
  const error = message('', 'alert');
  const monthly = card('section', text.performanceMetrics);
  const metrics = element('div');
  metrics.id = 'performance-metrics';
  const empty = element('p', 'broker-empty', text.metricsUnavailable);
  empty.hidden = true;
  monthly.append(metrics, empty, method(text.calculation, text.performanceMethod));

  const secondary = element('div', 'broker-grid sales-secondary-grid');
  const salesPipeline = card('section', text.pipelineHeading);
  const stageOutput = element('div');
  const crmLink = element('a', 'broker-button secondary sales-crm-link', text.crmLink);
  crmLink.href = '#clients';
  salesPipeline.append(element('p', 'sales-hint', text.pipelineNote), stageOutput, crmLink);

  const targets = card('section', text.targetProgress);
  const progressOutput = element('div');
  progressOutput.id = 'performance-targets';
  const targetForm = element('form', 'sales-target-form');
  targetForm.id = 'target-form';
  targetForm.noValidate = true;
  targetForm.append(element('h3', '', text.targetSetup), element('p', 'sales-hint', text.targetDescription));
  const controls = element('div', 'broker-fields sales-fields');
  const deals = numberField('deals', text.dealsGoal, { min: 0, max: 1_000_000, step: 1 }, '');
  const commission = numberField('commission', text.commissionGoal, { min: 0, max: maxAed, step: 0.01, unit: text.aed }, '');
  controls.append(deals.label, commission.label);
  const actions = element('div', 'broker-actions');
  const save = button(text.saveTargets, '', 'submit');
  const remove = button(text.clearTargets, 'secondary');
  remove.hidden = true;
  actions.append(save, remove);
  const targetStatus = message();
  const targetError = message('', 'alert');
  targetForm.append(controls, actions, targetStatus, targetError);
  targets.append(progressOutput, targetForm);
  secondary.append(salesPipeline, targets);
  panel.append(period, status, error, monthly, secondary);

  let refreshVersion = 0;
  let target;
  let busy = false;
  let dirty = false;
  let ready = false;

  function setControls() {
    month.disabled = busy;
    const disabled = !ready || busy;
    for (const control of [deals.input, commission.input, save, remove]) control.disabled = disabled;
    remove.hidden = !target || !ready;
  }

  async function refresh(reset = false) {
    const version = ++refreshVersion;
    const reportMonth = month.value;
    if (!monthPattern.test(reportMonth)) {
      ready = false;
      metrics.replaceChildren();
      stageOutput.replaceChildren();
      progressOutput.replaceChildren();
      empty.hidden = true;
      updateMessage(status, '');
      updateMessage(error, text.invalidMonth);
      month.setAttribute('aria-invalid', 'true');
      setControls();
      return;
    }

    if (reset) {
      ready = false;
      setControls();
      updateMessage(status, text.loading);
      updateMessage(error, '');
    }
    try {
      const [clients, targetRecords] = await Promise.all([listRecords('clients'), listRecords('targets')]);
      if (version !== refreshVersion || signal?.aborted) return;
      const result = calculatePerformance(clients, reportMonth);
      target = targetRecords.find((record) => record.month === reportMonth);
      if (reset || !dirty) {
        deals.input.value = target?.deals ?? '0';
        commission.input.value = target?.commission ?? '0';
        dirty = false;
      }
      const { count, money, percent } = formats;
      const formatMetrics = {
        newLeads: count.format(result.newLeads),
        won: count.format(result.won),
        lost: count.format(result.lost),
        conversion: result.conversion === null ? text.noConversion : percent.format(result.conversion),
        grossCommission: money.format(result.grossCommission),
        openLeads: count.format(result.openLeads),
      };
      metrics.replaceChildren(metricGrid(Object.entries(formatMetrics).map(([key, value]) => [key, text[key], value])));
      empty.hidden = clients.length > 0;
      stageOutput.replaceChildren(pipeline(text, result, count));
      progressOutput.replaceChildren(progressGroup(text, result, target, formats));
      updateMessage(status, '');
      updateMessage(error, '');
      ready = true;
    } catch {
      if (version !== refreshVersion || signal?.aborted) return;
      metrics.replaceChildren();
      stageOutput.replaceChildren();
      progressOutput.replaceChildren();
      empty.hidden = true;
      updateMessage(status, '');
      updateMessage(error, text.readFailure);
      ready = false;
    }
    setControls();
  }

  function changeMonth() {
    month.removeAttribute('aria-invalid');
    if (monthPattern.test(month.value)) selectedMonth = month.value;
    updateMessage(targetStatus, '');
    updateMessage(targetError, '');
    void refresh(true);
  }

  async function updateTargets(operation, success) {
    if (!ready || busy) return;
    busy = true;
    setControls();
    updateMessage(targetError, '');
    updateMessage(targetStatus, '');
    try {
      await operation();
      if (signal?.aborted) return;
      await refresh(true);
      if (ready && !signal?.aborted) updateMessage(targetStatus, success);
    } catch {
      if (!signal?.aborted) updateMessage(targetError, text.writeFailure);
    } finally {
      busy = false;
      if (!signal?.aborted) setControls();
    }
  }

  month.addEventListener('change', changeMonth);
  targetForm.addEventListener('input', (event) => {
    dirty = true;
    event.target.removeAttribute('aria-invalid');
    updateMessage(targetError, '');
    updateMessage(targetStatus, '');
  });
  targetForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const invalid = targetForm.querySelector('input:invalid');
    if (invalid) {
      invalid.setAttribute('aria-invalid', 'true');
      invalid.focus();
      updateMessage(targetError, text.invalidTarget);
      return;
    }
    const data = { month: month.value, deals: deals.input.valueAsNumber, commission: commission.input.valueAsNumber };
    void updateTargets(() => saveRecord('targets', data), text.targetSaved);
  });
  remove.addEventListener('click', () => {
    if (!target || !window.confirm(text.clearConfirm)) return;
    void updateTargets(() => deleteRecord('targets', target.id), text.targetCleared);
  });

  setControls();
  const listen = ({ collections }) => {
    if (!busy && !signal?.aborted && collections.some((name) => name === 'clients' || name === 'targets')) void refresh();
  };
  const unsubscribe = subscribeRecords(listen);
  signal?.addEventListener('abort', unsubscribe, { once: true });
  void refresh(true);
  return panel;
}

export function renderSales(route, language = 'en', { signal } = {}) {
  const text = salesTranslations[language] ?? salesTranslations.en;
  const formats = formatters(language);
  return route === 'commission' ? renderCommission(text, formats) : renderPerformance(text, formats, signal);
}
