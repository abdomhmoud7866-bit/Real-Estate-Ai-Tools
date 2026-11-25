import { listRecords, subscribeRecords } from './broker-store.js';
import { stageAiContext } from './ai-handoff.js';
import { analyzeDeal, numericDealContext, rankInventory } from './ai-local-model.js';
import { localIntelligenceCopy } from './ai-local-translations.js';

const currencies = new Set(['price', 'rent', 'expenses', 'annualNet', 'acquisitionCost', 'monthlyPayment', 'annualDebt', 'cashFlow', 'cashFlowChange', 'downPayment']);
const percentages = new Set(['fees', 'vacancy', 'rate', 'grossYield', 'netYield', 'maxVacancy']);
const resultMeasures = ['grossYield', 'netYield', 'annualNet', 'monthlyPayment', 'annualDebt', 'cashFlow', 'coverage', 'maxVacancy'];
const stressFields = { rentDrop: 10, vacancyRise: 5, expenseRise: 10, rateRise: 1 };
const dealDefaults = { price: '', rent: '', expenses: 0, fees: 0, vacancy: 0, downPayment: 0, rate: 0, years: 25 };
const riskDraft = Object.create(null);

function node(tag, className = '', text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function labeled(label, control) {
  const field = node('label', 'broker-field');
  field.append(node('span', '', label), control);
  return field;
}

function numberControl(name, { min = 0, max = 1e12, step = 0.01, value = '', required = false } = {}) {
  const input = node('input');
  Object.assign(input, { name, type: 'number', min, max, step, value, required, inputMode: step === 1 ? 'numeric' : 'decimal' });
  return input;
}

function checkControl(name, label, checked = false) {
  const input = node('input');
  Object.assign(input, { name, type: 'checkbox', checked });
  const wrapper = node('label', 'local-check');
  wrapper.append(input, node('span', '', label));
  return { input, wrapper };
}

function selectControl(name) {
  const select = node('select');
  select.name = name;
  return select;
}

function setChoices(select, empty, choices) {
  const selected = select.value;
  select.replaceChildren(...[['', empty], ...choices].map(([value, text]) => {
    const option = node('option', '', text);
    option.value = value;
    return option;
  }));
  if (choices.some(([value]) => value === selected)) select.value = selected;
}

function button(text, { kind = '', type = 'button' } = {}) {
  const element = node('button', ['broker-button', kind].filter(Boolean).join(' '), text);
  element.type = type;
  return element;
}

function link(text, route) {
  const element = node('a', 'broker-button secondary', text);
  element.href = '#' + route;
  return element;
}

function titlePanel(route, text) {
  const screen = node('section', 'broker-screen local-intelligence');
  const heading = node('header', 'broker-heading');
  const title = node('h1', '', text[route]);
  title.id = 'tool-title';
  title.tabIndex = -1;
  heading.append(title, node('p', '', text[route + 'Intro']));
  screen.setAttribute('aria-labelledby', title.id);
  screen.append(heading);
  return screen;
}

function listenFor(collections, signal, listener) {
  if (signal?.aborted) return;
  const unsubscribe = subscribeRecords(({ collections: changed }) => {
    if (changed.some(key => collections.includes(key))) listener();
  });
  signal?.addEventListener('abort', unsubscribe, { once: true });
}

function formatters(language) {
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  return {
    currency: new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED', maximumFractionDigits: 2, minimumFractionDigits: 0 }),
    number: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }),
  };
}

function matchingRow(entry, rank, text, fmt) {
  const { property, score, matchesLocation, matchesUnit, keywordsMatched } = entry;
  const item = node('li', 'local-match');
  const name = node('h3', '', property.project);
  name.dir = 'auto';
  const caption = node('p', 'local-help', [property.developer, property.location, property.unitType].join(' · '));
  caption.dir = 'auto';
  const figures = node('p', 'local-match-figures');
  const price = node('strong', '', fmt.currency.format(property.price));
  price.dir = 'auto';
  figures.append(price, node('span', '', fmt.number.format(property.size) + ' ' + text.areaUnit), node('span', 'local-badge', text[property.availability]));
  const details = node('ul', 'local-match-details');
  if (rank.applicable.location && matchesLocation) details.append(node('li', '', text.locationMatch));
  if (rank.applicable.unitType && matchesUnit) details.append(node('li', '', text.unitMatch));
  if (rank.applicable.keywords) details.append(node('li', '', text.keywordsMatch + ' ' + fmt.number.format(keywordsMatched) + '/' + fmt.number.format(rank.keywordCount)));
  const scoreLabel = score === null ? text.noPreferenceScore : text.matchScore + ' ' + fmt.percent.format(score / 100);
  item.append(name, caption, figures, node('div', 'local-score', scoreLabel));
  if (details.childElementCount) item.append(details);
  return item;
}

function renderMatching(text, fmt, signal) {
  const screen = titlePanel('matching', text);
  const layout = node('div', 'broker-grid');
  const form = node('form', 'broker-card');
  form.id = 'matching-form';
  form.noValidate = true;
  const heading = node('h2', '', text.matchingCriteria);
  const client = selectControl('client');
  setChoices(client, text.manual, []);
  const clientHint = node('small', '', text.clientHint);
  const clientField = labeled(text.client, client);
  clientField.append(clientHint);

  const budgetMin = numberControl('budgetMin');
  const budgetMax = numberControl('budgetMax');
  const minimumSize = numberControl('minimumSize', { max: 1e8 });
  const location = selectControl('location');
  const unitType = selectControl('unitType');
  setChoices(location, text.any, []);
  setChoices(unitType, text.any, []);
  const keywords = node('textarea');
  Object.assign(keywords, { name: 'keywords', rows: 2, maxLength: 1000, dir: 'auto', autocomplete: 'off' });
  const keywordField = labeled(text.keywords, keywords);
  keywordField.append(node('small', '', text.keywordHelp));
  const { input: reserved, wrapper: reservedField } = checkControl('includeReserved', text.includeReserved);
  const fields = node('div', 'broker-fields');
  fields.append(labeled(text.budgetMin, budgetMin), labeled(text.budgetMax, budgetMax), labeled(text.minimumSize, minimumSize),
    labeled(text.location, location), labeled(text.unitType, unitType), keywordField);
  const error = node('p', 'broker-error');
  error.setAttribute('role', 'alert');
  const actions = node('div', 'broker-actions');
  actions.append(button(text.rankButton, { type: 'submit' }));
  form.append(heading, clientField, fields, reservedField, error, actions);

  const results = node('section', 'broker-card');
  results.id = 'matching-results';
  const resultTitle = node('h2', '', text.ranked);
  const notice = node('p', 'broker-notice', text.loading);
  notice.setAttribute('role', 'status');
  const cards = node('ul', 'local-match-list');
  const method = node('details', 'local-method');
  method.append(node('summary', '', text.methodology), node('p', 'local-help', text.matchingMethod));
  results.append(resultTitle, notice, cards, method);
  layout.append(form, results);
  screen.append(layout);

  let properties = [];
  let clients = new Map();
  let loaded = false;
  let readVersion = 0;
  const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b)).map(value => [value, value]);

  function clearClientCriteria() {
    budgetMin.value = '';
    budgetMax.value = '';
    keywords.value = '';
  }

  function rank() {
    if (!loaded) return;
    error.textContent = '';
    notice.replaceChildren();
    cards.replaceChildren();
    if (!properties.length) {
      notice.append(document.createTextNode(text.noInventory + ' '), link(text.openInventory, 'inventory'));
      return;
    }
    try {
      if (form.querySelector('input:invalid')) throw new RangeError('criteria');
      const readNumber = input => input.value === '' ? null : input.valueAsNumber;
      const ranked = rankInventory(properties, {
        budgetMin: readNumber(budgetMin),
        budgetMax: readNumber(budgetMax),
        minimumSize: readNumber(minimumSize),
        location: location.value,
        unitType: unitType.value,
        keywords: keywords.value,
        includeReserved: reserved.checked,
      });
      if (!ranked.rows.length) {
        notice.textContent = text.noMatch;
        return;
      }
      notice.textContent = fmt.number.format(ranked.rows.length) + ' · ' + (ranked.rows.length > 20 ? text.limitedResults : text.ranked);
      cards.append(...ranked.rows.slice(0, 20).map(entry => matchingRow(entry, ranked, text, fmt)));
    } catch (problem) {
      if (!(problem instanceof RangeError)) throw problem;
      error.textContent = text.criteriaError;
      notice.textContent = '';
    }
  }

  async function refreshRecords() {
    const version = ++readVersion;
    try {
      const [inventory, savedClients] = await Promise.all([listRecords('properties'), listRecords('clients')]);
      if (signal?.aborted || version !== readVersion) return;
      properties = inventory;
      clients = new Map(savedClients.map(value => [value.id, value]));
      if (client.value && !clients.has(client.value)) clearClientCriteria();
      setChoices(client, text.manual, savedClients.map(value => [value.id, value.name]));
      setChoices(location, text.any, unique(inventory.map(value => value.location)));
      setChoices(unitType, text.any, unique(inventory.map(value => value.unitType)));
      loaded = true;
      rank();
    } catch {
      if (signal?.aborted || version !== readVersion) return;
      loaded = false;
      cards.replaceChildren();
      notice.textContent = text.unreadable;
    }
  }

  client.addEventListener('change', () => {
    const selected = clients.get(client.value);
    if (selected) {
      budgetMin.value = selected.budgetMin ?? '';
      budgetMax.value = selected.budgetMax ?? '';
      keywords.value = selected.preferences;
    } else {
      clearClientCriteria();
    }
    rank();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    rank();
  });
  listenFor(['clients', 'properties'], signal, refreshRecords);
  refreshRecords();
  return screen;
}

function dealEditor(prefix, title, text) {
  const card = node('fieldset', 'broker-card local-fieldset');
  card.append(node('legend', '', title));
  const inventory = selectControl(prefix + '-property');
  setChoices(inventory, text.manualPrice, []);
  card.append(labeled(text.useInventory, inventory));
  const numbers = {};
  const main = node('div', 'broker-fields');
  const loan = node('div', 'broker-fields');
  for (const [key, initial] of Object.entries(dealDefaults)) {
    const name = prefix + '-' + key;
    const monetary = currencies.has(key);
    const field = numberControl(name, {
      min: key === 'price' || key === 'years' ? 1 : 0,
      max: key === 'years' ? 50 : monetary ? 1e12 : 100,
      step: key === 'years' ? 1 : 0.01,
      required: true,
      value: riskDraft[name] ?? initial,
    });
    numbers[key] = field;
    const wrapped = labeled(text[key] + (monetary ? text.currencySuffix : ''), field);
    (['downPayment', 'rate', 'years'].includes(key) ? loan : main).append(wrapped);
  }

  const financedName = prefix + '-financed';
  const { input: financed, wrapper } = checkControl(financedName, text.financed, riskDraft[financedName]);
  card.append(main, wrapper, loan);

  function setActive(active) {
    card.hidden = !active;
    card.disabled = !active;
    loan.hidden = !financed.checked;
    for (const key of ['downPayment', 'rate', 'years']) numbers[key].disabled = loan.hidden;
  }

  function read() {
    const values = Object.fromEntries(Object.entries(numbers).map(([key, field]) => [key, field.valueAsNumber]));
    return { ...values, financed: financed.checked };
  }

  return { card, inventory, setActive, read, price: numbers.price };
}

function formatted(key, value, text, fmt) {
  if (value === null) return text.notDefined;
  if (key === 'maxVacancy' && value < 0) return text.breakEvenImpossible;
  if (currencies.has(key)) return fmt.currency.format(value);
  if (percentages.has(key)) return fmt.percent.format(value / 100);
  if (key === 'coverage') return fmt.number.format(value) + '×';
  return fmt.number.format(value);
}

function comparisonTable(deals, text, fmt) {
  const heading = node('h3', '', text.comparisonHeading);
  const wrap = node('div', 'broker-table-wrap local-risk-table');
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', text.comparisonHeading);
  wrap.tabIndex = 0;
  const table = node('table', 'broker-table');
  const head = node('thead');
  const columns = node('tr');
  const measure = node('th', '', text.metric);
  measure.scope = 'col';
  columns.append(measure);
  for (const [index] of deals.entries()) {
    const name = text[index === 0 ? 'dealA' : 'dealB'];
    for (const variant of ['base', 'stress']) {
      const cell = node('th', '', name + ' · ' + text[variant]);
      cell.scope = 'col';
      columns.append(cell);
    }
  }
  head.append(columns);

  const body = node('tbody');
  for (const key of resultMeasures) {
    const row = node('tr');
    const label = node('th', '', text[key]);
    label.scope = 'row';
    row.append(label);
    for (const { base, downside } of deals) {
      for (const value of [base[key], downside[key]]) {
        const cell = node('td', '', formatted(key, value, text, fmt));
        cell.dir = 'auto';
        row.append(cell);
      }
    }
    body.append(row);
  }
  table.append(head, body);
  wrap.append(table);
  return [heading, wrap];
}

const signalGroups = {
  strengths: ['baseCovered', 'stressCovered'],
  weaknesses: ['baseDeficit', 'noRent'],
  risks: ['stressDeficit', 'thinCoverage'],
  opportunities: ['verifyInputs'],
};

function summaryForDeal(deal, index, text, fmt) {
  const card = node('section', 'local-deal-summary');
  card.append(node('h3', '', text[index === 0 ? 'dealA' : 'dealB']));
  const assumptions = node('dl', 'local-assumptions');
  const items = [
    ['fundingLabel', deal.inputs.financed ? text.funding : text.noFunding],
    ...['price', 'rent', 'expenses', 'fees', 'vacancy'].map(key => [key, formatted(key, deal.inputs[key], text, fmt)]),
    ['acquisitionCost', formatted('acquisitionCost', deal.base.acquisitionCost, text, fmt)],
  ];
  if (deal.inputs.financed) {
    for (const key of ['downPayment', 'rate', 'years']) items.push([key, formatted(key, deal.inputs[key], text, fmt)]);
  }
  items.push(['cashFlowChange', formatted('cashFlowChange', deal.cashFlowChange, text, fmt)]);
  for (const [key, value] of items) {
    const pair = node('div');
    const definition = node('dd', '', value);
    definition.dir = 'auto';
    pair.append(node('dt', '', text[key]), definition);
    assumptions.append(pair);
  }
  card.append(node('h4', '', text.inputsHeading), assumptions);
  const signals = node('dl', 'local-signals');
  for (const [group, candidates] of Object.entries(signalGroups)) {
    const pair = node('div');
    const lines = candidates.filter(key => deal.signals.includes(key)).map(key => text[key]);
    pair.append(node('dt', '', text[group]), node('dd', '', lines.join(' ') || text.noSignal));
    signals.append(pair);
  }
  card.append(signals);
  return card;
}

function renderRisk(text, fmt, signal) {
  const screen = titlePanel('risk', text);
  const form = node('form', 'local-risk-form');
  form.id = 'risk-form';
  form.noValidate = true;
  const { input: compare, wrapper: compareControl } = checkControl('compare', text.compare, riskDraft.compare);
  const editA = dealEditor('a', text.dealA, text);
  const editB = dealEditor('b', text.dealB, text);
  const editors = node('div', 'local-deal-grid');
  editors.append(editA.card, editB.card);

  const stress = node('fieldset', 'broker-card local-fieldset');
  stress.append(node('legend', '', text.shockTitle), node('p', 'local-help', text.shockIntro));
  const fields = node('div', 'broker-fields');
  const control = {};
  for (const [key, initial] of Object.entries(stressFields)) {
    control[key] = numberControl(key, { max: 100, value: riskDraft[key] ?? initial, required: true });
    fields.append(labeled(text[key], control[key]));
  }
  stress.append(fields);
  const error = node('p', 'broker-error');
  error.setAttribute('role', 'alert');
  const actions = node('div', 'broker-actions');
  actions.append(button(text.calculate, { type: 'submit' }));
  form.append(compareControl, editors, stress, error, actions);

  const results = node('section', 'broker-card local-risk-report');
  results.id = 'risk-results';
  const title = node('h2', '', text.riskResults);
  const status = node('p', 'local-help local-live', text.pending);
  status.setAttribute('role', 'status');
  const report = node('div', 'local-report-body');
  results.append(title, status, report);
  screen.append(form, results);
  let inventory = new Map();

  function updateControls() {
    editA.setActive(true);
    editB.setActive(compare.checked);
  }

  function invalidate() {
    form.dataset.valid = 'false';
    report.replaceChildren();
    status.textContent = text.pending;
    error.textContent = '';
  }

  function storeDraft() {
    for (const input of form.querySelectorAll('input')) {
      riskDraft[input.name] = input.type === 'checkbox' ? input.checked : input.value;
    }
  }

  for (const editor of [editA, editB]) {
    editor.inventory.addEventListener('change', () => {
      const item = inventory.get(editor.inventory.value);
      if (item) editor.price.value = item.price;
      storeDraft();
      invalidate();
    });
  }

  form.addEventListener('input', () => {
    storeDraft();
    updateControls();
    invalidate();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    invalidate();
    const invalid = form.querySelector('input:invalid');
    if (invalid) {
      error.textContent = text.resultError;
      invalid.focus();
      return;
    }
    try {
      const shocks = Object.fromEntries(Object.entries(control).map(([key, input]) => [key, input.valueAsNumber]));
      const editors = compare.checked ? [editA, editB] : [editA];
      const deals = editors.map(editor => analyzeDeal(editor.read(), shocks));
      const summaries = node('div', 'local-summary-grid');
      summaries.append(...deals.map((deal, index) => summaryForDeal(deal, index, text, fmt)));
      const notes = node('div', 'local-risk-notes');
      notes.append(
        node('p', '', Object.entries(shocks).map(([key, value]) => text[key] + ' ' + fmt.number.format(value)).join(' · ')),
        node('p', '', text.riskMethod),
        node('p', '', text.shockMethod),
        node('p', '', text.sourceNote),
      );
      const commentary = node('div', 'local-risk-handoff');
      const action = button(text.handoff, { kind: 'secondary' });
      action.id = 'risk-ai-handoff';
      action.addEventListener('click', () => {
        const task = deals.length === 1 ? 'report' : 'comparison';
        stageAiContext(task, deals.map(numericDealContext));
        window.location.hash = 'intelligence';
      });
      commentary.append(action, node('p', 'local-help', text.handoffHelp));
      report.append(...comparisonTable(deals, text, fmt), summaries, notes, commentary);
      form.dataset.valid = 'true';
      status.textContent = text.status;
    } catch (problem) {
      if (!(problem instanceof RangeError)) throw problem;
      error.textContent = problem.field === 'expenses' ? text.expensesStressError : text.resultError;
    }
  });

  async function readInventory() {
    try {
      const items = await listRecords('properties');
      if (signal?.aborted) return;
      inventory = new Map(items.map(item => [item.id, item]));
      const options = items.map(item => [item.id, item.project + ' · ' + item.unitType]);
      for (const editor of [editA, editB]) setChoices(editor.inventory, text.manualPrice, options);
    } catch {
      // Manual entry remains available when local inventory cannot be read.
    }
  }

  updateControls();
  listenFor(['properties'], signal, readInventory);
  readInventory();
  return screen;
}

export function renderLocalIntelligence(route, language = 'en', { signal } = {}) {
  const text = localIntelligenceCopy[language] ?? localIntelligenceCopy.en;
  const fmt = formatters(language);
  return route === 'matching' ? renderMatching(text, fmt, signal) : renderRisk(text, fmt, signal);
}
