import { stageAiContext } from './ai-handoff.js';
import { cashFlow, investment, mortgage, paymentPlan, resale } from './finance.js';
import { toolTranslations } from './tool-translations.js';

const currency = { unit: 'aed', min: 0, max: 1e12 };
const percent = { unit: 'pct', min: 0, max: 100 };
const years = { unit: 'yearsUnit', min: 1, max: 50, step: 1 };
const months = { unit: 'monthsUnit', min: 1, max: 240, step: 1 };
const fields = {
  price: { ...currency, min: 1 }, rent: currency, expenses: currency,
  fees: percent, vacancy: percent,
  downPayment: currency, rate: percent, years, loanYears: years, projectionYears: years,
  rentGrowth: { ...percent, min: -100 }, expenseGrowth: { ...percent, min: -100 },
  booking: percent, construction: percent, handover: percent, post: percent, months, postMonths: months,
  appreciation: { ...percent, min: -100 }, sellingCosts: percent,
  annualNet: { ...currency, min: -1e12 },
};
const investmentExample = { price: 1000000, rent: 80000, expenses: 12000, fees: 4, vacancy: 5 };
const planA = { booking: 10, construction: 30, handover: 60, post: 0, months: 36, postMonths: 36 };
const planB = { booking: 20, construction: 20, handover: 20, post: 40, months: 36, postMonths: 48 };
const secondProperty = { price: 1250000, rent: 100000, expenses: 19000, fees: 4, vacancy: 8 };
const plans = [['a', 'planA', planA], ['b', 'planB', planB]];
const properties = [['a', 'propertyA', investmentExample], ['b', 'propertyB', secondProperty]];
const planSummaries = ['before', 'through', 'booking', 'construction', 'handover', 'post', 'monthly', 'postMonthly'];
const investmentMetrics = ['netYield', 'grossYield', 'net', 'monthlyNet', 'effectiveRent', 'total'];
const percentageMetrics = new Set(['netYield', 'grossYield', 'loanToValue', 'roi', 'cashOnCash']);
const states = new Map();

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function fieldName(prefix, key) {
  return prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key;
}

function addFields(parent, values, ctx, prefix = '') {
  const grid = element('div', 'field-grid');
  for (const [key, sample] of Object.entries(values)) {
    const { unit, min, max, step = 'any' } = fields[key];
    const name = key === 'years' && ctx.tool === 'resale' ? 'holdingPeriod' : key;
    const label = element('label', 'tool-field');
    label.append(element('span', 'field-label', ctx.text[name]));
    const box = element('span', 'field-input');
    const input = element('input');
    input.type = 'number';
    input.name = fieldName(prefix, key);
    input.required = true;
    input.min = min;
    input.max = max;
    input.step = step;
    input.inputMode = step === 1 ? 'numeric' : 'decimal';
    input.value = ctx.values[input.name] ?? sample;
    const suffix = element('span', 'field-unit', ctx.text[unit]);
    box.append(input, suffix);
    label.append(box);
    grid.append(label);
    ctx.defaults[input.name] = sample;
    ctx.labels[input.name] = ctx.text[name];
    ctx.units[input.name] = unit;
  }
  parent.append(grid);
}

function fieldset(parent, title) {
  const group = element('fieldset', 'field-group');
  group.append(element('legend', '', title));
  parent.append(group);
  return group;
}

function investmentInputs(form, ctx) {
  addFields(form, investmentExample, ctx);
  const group = fieldset(form, ctx.text.projectionAssumptions);
  group.append(element('p', 'field-note', ctx.text.projectionDescription));
  const label = element('label', 'tool-field financing-field');
  label.append(element('span', 'field-label', ctx.text.financing));
  const select = element('select');
  select.name = 'financing';
  for (const key of ['cash', 'loan']) {
    const option = element('option', '', ctx.text[key]);
    option.value = key;
    select.append(option);
  }
  select.value = ctx.values.financing ?? 'cash';
  ctx.defaults.financing = 'cash';
  ctx.labels.financing = ctx.text.financing;
  label.append(select);
  group.append(label);
  const loanFields = element('div', 'loan-fields');
  addFields(loanFields, { downPayment: 250000, rate: 4.5, loanYears: 25 }, ctx);
  group.append(loanFields);
  addFields(group, { projectionYears: 10, rentGrowth: 2, expenseGrowth: 2 }, ctx);
  const setFinancing = () => {
    loanFields.hidden = select.value === 'cash';
    for (const input of loanFields.querySelectorAll('input')) input.disabled = loanFields.hidden;
  };
  select.addEventListener('change', setFinancing);
  setFinancing();
}

function buildInputs(key, form, ctx) {
  if (key === 'investment') investmentInputs(form, ctx);
  if (key === 'mortgage') addFields(form, { price: 1000000, downPayment: 250000, rate: 4.5, years: 25 }, ctx);
  if (key === 'payments') {
    addFields(form, { price: 1000000 }, ctx);
    for (const [prefix, title, values] of plans) addFields(fieldset(form, ctx.text[title]), values, ctx, prefix);
  }
  if (key === 'compare') {
    for (const [prefix, title, values] of properties) addFields(fieldset(form, ctx.text[title]), values, ctx, prefix);
  }
  if (key === 'resale') {
    addFields(form, { price: 1000000, fees: 4, appreciation: 3, years: 5, sellingCosts: 2, annualNet: 64000 }, ctx);
  }
}

function metricCards(parent, values, keys, ctx) {
  const group = element('dl', 'metric-grid');
  for (const key of keys) {
    const card = element('div', 'metric-card');
    card.append(element('dt', '', ctx.text[key]), element('dd', '', ctx.metric(key, values[key])));
    group.append(card);
  }
  parent.append(group);
}

function dataTable(title, headings, rows, ctx, options = {}) {
  const wrapper = element('div', 'table-scroll');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', title);
  const table = element('table', 'data-table');
  if (options.id) table.id = options.id;
  table.append(element('caption', 'tool-sr-only', title));
  const head = element('thead');
  const header = element('tr');
  for (const heading of headings) {
    const column = element('th', '', ctx.text[heading]);
    column.scope = 'col';
    header.append(column);
  }
  head.append(header);
  const body = element('tbody');
  for (const values of rows) {
    const row = element('tr');
    const [first, ...rest] = values;
    const label = element('th', '', first);
    label.scope = 'row';
    row.append(label, ...rest.map(value => element('td', '', value)));
    body.append(row);
  }
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

function expandable(name, title, content, ctx) {
  const details = element('details', 'tool-details');
  details.dataset.detailName = name;
  details.open = ctx.values[name] ?? false;
  details.addEventListener('toggle', () => { ctx.values[name] = details.open; });
  details.append(element('summary', '', title), content);
  return details;
}

function svgElement(tag, attributes, value) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, data] of Object.entries(attributes)) node.setAttribute(name, data);
  if (value !== undefined) node.textContent = value;
  return node;
}

function plotCashFlow(rows, ctx) {
  const figure = element('figure', 'cash-flow-chart');
  const label = element('figcaption', '', `${ctx.text.chartLabel} · ${ctx.text.aed}`);
  const svg = svgElement('svg', { viewBox: '0 0 440 190', 'aria-hidden': 'true', focusable: 'false' });
  const values = rows.map(row => row.cashFlow);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values) || (min === 0 ? 1 : 0);
  const x = index => rows.length === 1 ? 235 : 64 + index * 357 / (rows.length - 1);
  const y = value => 160 - (value - min) / (max - min) * 139;
  const points = values.map((value, index) => `${x(index)},${y(value)}`);
  for (const tick of new Set([max, (max + min) / 2, min, 0])) {
    const height = y(tick);
    svg.append(svgElement('line', { class: tick === 0 ? 'plot-baseline' : 'plot-grid', x1: 64, y1: height, x2: 421, y2: height }));
    svg.append(svgElement('text', { x: 57, y: height + 4, 'text-anchor': 'end' }, ctx.compact.format(tick)));
  }
  if (rows.length > 1) {
    svg.append(svgElement('path', { class: 'plot-area', d: `M${x(0)},${y(0)} L${points.join(' ')} L${x(rows.length - 1)},${y(0)} Z` }));
    svg.append(svgElement('polyline', { class: 'plot-line', points: points.join(' ') }));
  }
  const marker = svgElement('circle', { class: 'plot-marker', r: 5 });
  svg.append(marker);
  for (const index of new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])) {
    svg.append(svgElement('text', { x: x(index), y: 180, 'text-anchor': 'middle' }, ctx.number.format(index + 1)));
  }
  const selected = element('p', 'chart-selection');
  const control = element('label', 'year-control');
  const slider = element('input');
  slider.type = 'range';
  slider.min = 1;
  slider.max = rows.length;
  slider.value = Math.min(ctx.values.chartYear ?? 1, rows.length);
  const render = () => {
    const index = slider.valueAsNumber - 1;
    ctx.values.chartYear = index + 1;
    const row = rows[index];
    const value = `${ctx.text.year} ${ctx.number.format(row.year)} · ${ctx.money.format(row.cashFlow)}`;
    marker.setAttribute('cx', x(index));
    marker.setAttribute('cy', y(row.cashFlow));
    selected.textContent = value;
    slider.setAttribute('aria-valuetext', value);
  };
  slider.addEventListener('input', render);
  control.append(element('span', '', ctx.text.yearlyView), slider);
  figure.append(label, svg, selected);
  if (rows.length > 1) figure.append(control);
  render();
  return figure;
}

function renderCashFlow(parent, values, ctx) {
  const projections = cashFlow({
    ...values, years: values.projectionYears,
    downPayment: values.financing === 'cash' ? values.price : values.downPayment,
    rate: values.rate ?? 0, loanYears: values.loanYears ?? 1,
  });
  const section = element('section', 'output-section');
  section.append(element('h3', '', ctx.text.projection));
  metricCards(section, projections, ['annualCashFlow', 'cashOnCash', 'initialCash', 'cumulativeCashFlow'], ctx);
  section.append(plotCashFlow(projections.rows, ctx));
  const headers = ['year', 'effectiveRent', 'expenses', 'net', 'debtService', 'cashFlow', 'cumulativeCashFlow'];
  const rows = projections.rows.map(row => [
    ctx.number.format(row.year), ...['effectiveRent', 'expenses', 'netOperatingIncome', 'debtService', 'cashFlow', 'cumulativeCashFlow']
      .map(key => ctx.money.format(row[key])),
  ]);
  const screenTable = dataTable(ctx.text.projection, headers, rows, ctx, { id: 'cash-flow-table' });
  const details = expandable('cashFlowDetails', ctx.text.projectionTable, screenTable, ctx);
  details.classList.add('cash-flow-details');
  const reportTable = dataTable(ctx.text.projection, headers, rows, ctx);
  reportTable.classList.add('tool-print-only');
  section.append(details, reportTable);
  section.append(element('p', 'tool-method-copy', ctx.text.projectionMethod));
  parent.append(section);
}

function renderMortgage(parent, values, ctx) {
  const result = mortgage(values);
  metricCards(parent, result, ['monthlyPayment', 'totalInterest', 'principal', 'loanToValue', 'totalPaid'], ctx);
  if (!result.schedule.length) return;
  const rows = result.schedule.map(row => [
    ctx.number.format(row.month), ...['payment', 'principal', 'interest', 'balance'].map(key => ctx.money.format(row[key])),
  ]);
  const headers = ['month', 'payment', 'principalPaid', 'interest', 'balance'];
  parent.append(expandable('mortgageDetails', ctx.text.viewAmortization,
    dataTable(ctx.text.amortization, headers, rows, ctx, { id: 'mortgage-table' }), ctx));
}

function prefixedValues(values, prefix, defaults) {
  return Object.fromEntries(Object.keys(defaults).map(key => [key, values[fieldName(prefix, key)]]));
}

function renderPayments(parent, values, ctx) {
  const reports = plans.map(([prefix, , defaults]) => paymentPlan({ price: values.price, ...prefixedValues(values, prefix, defaults) }));
  const summaries = planSummaries.map(key => [ctx.text[key], ...reports.map(report => ctx.metric(key, report[key]))]);
  parent.append(dataTable(ctx.text.payments, ['metric', 'planA', 'planB'], summaries, ctx));
  const schedules = element('section', 'output-section');
  schedules.append(element('h3', '', ctx.text.planSchedule));
  const chooser = element('div', 'schedule-switch');
  const schedule = element('div', 'schedule-content');
  const buttons = [];
  const showSchedule = selected => {
    ctx.values.paymentPlan = selected;
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', index === selected));
    const [, title] = plans[selected];
    const rows = reports[selected].schedule.map(row => [
      ctx.number.format(row.month), ctx.text[row.phase], ctx.money.format(row.amount), ctx.money.format(row.cumulative),
    ]);
    schedule.replaceChildren(element('h4', 'tool-print-only', ctx.text[title]), dataTable(
      ctx.text[title], ['month', 'phase', 'amount', 'cumulative'], rows, ctx, { id: 'payments-table' },
    ));
  };
  for (const [index, [, title]] of plans.entries()) {
    const button = element('button', 'schedule-button', ctx.text[title]);
    button.type = 'button';
    button.addEventListener('click', () => showSchedule(index));
    buttons.push(button);
    chooser.append(button);
  }
  schedules.append(chooser, schedule);
  showSchedule(ctx.values.paymentPlan ?? 0);
  parent.append(schedules);
}

function renderComparison(parent, values, ctx) {
  const inputs = properties.map(([prefix, , defaults]) => prefixedValues(values, prefix, defaults));
  const reports = inputs.map(input => ({ ...input, ...investment(input) }));
  const rows = ['price', ...investmentMetrics].map(key => [ctx.text[key], ...reports.map(item => ctx.metric(key, item[key]))]);
  parent.append(dataTable(ctx.text.compare, ['metric', 'propertyA', 'propertyB'], rows, ctx, { id: 'compare-table' }));
}

function renderResults(key, target, values, ctx) {
  if (key === 'investment') {
    metricCards(target, investment(values), investmentMetrics, ctx);
    renderCashFlow(target, values, ctx);
  }
  if (key === 'mortgage') renderMortgage(target, values, ctx);
  if (key === 'payments') renderPayments(target, values, ctx);
  if (key === 'compare') renderComparison(target, values, ctx);
  if (key === 'resale') {
    const result = resale(values);
    metricCards(target, result, ['profit', 'roi', 'salePrice', 'netSale', 'sellingFees', 'initialCost', 'totalRentalIncome'], ctx);
  }
}

function formatAssumption(name, value, ctx) {
  if (name === 'financing') return ctx.text[value];
  const unit = ctx.units[name];
  if (unit === 'aed') return ctx.money.format(value);
  if (unit === 'pct') return ctx.pct.format(value / 100);
  return `${ctx.number.format(value)} ${ctx.text[unit]}`;
}

function renderReportInputs(target, key, values, ctx) {
  const section = element('section', 'tool-print-only report-assumptions');
  const items = element('dl');
  const sets = key === 'compare' ? properties : plans;
  for (const [name, value] of Object.entries(values)) {
    const set = sets.find(([prefix, , defaults]) => Object.keys(defaults).some(k => fieldName(prefix, k) === name));
    const label = set ? `${ctx.text[set[1]]} · ${ctx.labels[name]}` : ctx.labels[name];
    const item = element('div');
    item.append(element('dt', '', label), element('dd', '', formatAssumption(name, value, ctx)));
    items.append(item);
  }
  section.append(element('h3', '', ctx.text.assumptions), items);
  target.append(section);
}

function rentalScenario(values) {
  const { price, rent, expenses, fees, vacancy } = values;
  const result = investment(values);
  return {
    price, rent, expenses, fees, vacancy,
    grossYield: result.grossYield, netYield: result.netYield,
    annualNet: result.net, monthlyNet: result.monthlyNet, acquisitionCost: result.total,
  };
}

function addAiHandoff(parent, key, values, ctx) {
  if (key !== 'investment' && key !== 'compare') return;
  const link = element('button', 'broker-button secondary finance-ai-handoff', ctx.text.aiHandoff);
  link.type = 'button';
  link.addEventListener('click', () => {
    const scenarios = key === 'investment' ? [values] : properties.map(([prefix, , defaults]) => prefixedValues(values, prefix, defaults));
    stageAiContext(key === 'compare' ? 'comparison' : 'report', scenarios.map(rentalScenario));
    location.hash = 'intelligence';
  });
  parent.append(link);
}

function reportError(key, values, ctx) {
  if (values.downPayment > values.price) return ctx.text.downPaymentLimit;
  if (key === 'payments') {
    for (const [prefix, title] of plans) {
      const complete = ['booking', 'construction', 'handover', 'post'].reduce((total, name) => total + values[fieldName(prefix, name)], 0);
      if (Math.abs(complete - 100) > 1e-6) return `${ctx.text.invalidPlan} ${ctx.text[title]}.`;
    }
  }
  return '';
}

export function renderTool(key, language = 'en') {
  const text = toolTranslations[language] ?? toolTranslations.en;
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  if (!states.has(key)) states.set(key, {});
  const ctx = {
    tool: key, text, money, number, pct, compact, values: states.get(key), defaults: {}, labels: {}, units: {},
    metric: (name, value) => {
      if (value === null) return text.na;
      return percentageMetrics.has(name) ? pct.format(value / 100) : money.format(value);
    },
  };

  const panel = element('section', 'finance-tool');
  const heading = element('header', 'finance-heading');
  const title = element('h1', '', text[key]);
  title.id = 'tool-title';
  title.tabIndex = -1;
  panel.setAttribute('aria-labelledby', title.id);
  heading.append(title, element('p', '', text[`${key}Description`]));
  const layout = element('div', `tool-layout tool-layout-${key}`);
  const form = element('form', 'tool-card tool-form');
  form.id = `${key}-form`;
  form.noValidate = true;
  form.append(element('h2', '', text.assumptions));
  buildInputs(key, form, ctx);
  const error = element('p', 'tool-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const action = element('button', 'tool-action', text[`${key}Run`]);
  action.type = 'submit';
  const status = element('p', 'tool-status');
  status.setAttribute('role', 'status');
  form.append(error, action, status);

  const results = element('section', 'tool-card tool-results');
  results.id = `${key}-results`;
  const resultHeading = element('h2', '', text.results);
  const provenance = element('p', 'tool-provenance');
  const output = element('div', 'tool-output');
  const method = element('section', 'tool-method');
  method.append(element('h3', '', text.methodology), element('p', '', text[`${key}Method`]));
  results.append(resultHeading, provenance, output, method);
  layout.append(form, results);
  panel.append(heading, layout);

  const fail = message => {
    form.dataset.valid = 'false';
    error.textContent = message;
    error.hidden = false;
    status.textContent = '';
    output.replaceChildren();
    provenance.hidden = true;
  };
  const calculate = event => {
    event?.preventDefault();
    for (const detail of output.querySelectorAll('details[data-detail-name]')) {
      ctx.values[detail.dataset.detailName] = detail.open;
    }
    error.hidden = true;
    const invalid = form.querySelector('input:invalid');
    if (invalid) {
      invalid.setAttribute('aria-invalid', 'true');
      if (event) invalid.focus();
      fail(`${text.invalid} ${ctx.labels[invalid.name]}.`);
      return;
    }
    const values = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, name === 'financing' ? value : Number(value)]));
    const message = reportError(key, values, ctx);
    if (message) {
      fail(message);
      return;
    }
    const content = document.createDocumentFragment();
    try {
      renderReportInputs(content, key, values, ctx);
      renderResults(key, content, values, ctx);
      addAiHandoff(content, key, values, ctx);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      fail(text.invalidCalc);
      return;
    }
    const sample = Object.entries(values).every(([name, value]) => value === ctx.defaults[name]);
    provenance.textContent = `${sample ? text.sample : text.user} · ${text.provenance}`;
    provenance.hidden = false;
    output.replaceChildren(content);
    form.dataset.valid = 'true';
    status.textContent = event ? text.updated : '';
  };
  form.addEventListener('submit', calculate);
  form.addEventListener('input', event => {
    const { name, value } = event.target;
    if (!name) return;
    ctx.values[name] = value;
    event.target.removeAttribute('aria-invalid');
    form.dataset.valid = 'false';
    const handoff = output.querySelector('.finance-ai-handoff');
    if (handoff) handoff.disabled = true;
    status.textContent = text.changed;
  });
  calculate();
  return panel;
}
