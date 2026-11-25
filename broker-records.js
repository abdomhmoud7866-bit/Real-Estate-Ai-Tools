import {
  MAX_BACKUP_BYTES, clearWorkspace, clientStages, createBackup, deleteRecord, listRecords,
  propertyStatuses, replaceFromBackup, saveRecord, subscribeRecords, validateBackup, workspaceDate,
} from './broker-store.js';
import { recordsTranslations } from './broker-record-translations.js';

const pageSize = 24;
let localeDraft;
const amount = { type: 'number', min: 0, max: 1e12, step: '0.01' };
const dateField = { type: 'date', min: '1900-01-01', max: '9999-12-31' };
const clientFields = {
  name: { maxLength: 120, required: true },
  stage: { options: clientStages },
  phone: { type: 'tel', maxLength: 40, dir: 'ltr' },
  email: { type: 'email', maxLength: 254, dir: 'ltr' },
  budgetMin: amount,
  budgetMax: amount,
  followUp: dateField,
  closedAt: dateField,
  grossCommission: amount,
  preferences: { multiline: true, maxLength: 1000 },
  notes: { multiline: true, maxLength: 4000 },
};
const inventoryFields = {
  developer: { maxLength: 120, required: true },
  project: { maxLength: 120, required: true },
  location: { maxLength: 160, required: true },
  unitType: { maxLength: 100, required: true },
  price: { ...amount, min: 1, required: true },
  size: { ...amount, min: 0.01, max: 1e8, required: true },
  availability: { options: propertyStatuses },
  handover: dateField,
};
const viewConfig = {
  clients: {
    collection: 'clients', fields: clientFields, status: 'stage',
    title: 'clientList', add: 'addClient', edit: 'editClient', save: 'saveClient',
    search: 'clientSearch', filter: 'allStages', empty: 'emptyClients', label: 'name',
    searchable: ['name', 'phone', 'email', 'preferences', 'notes'],
  },
  inventory: {
    collection: 'properties', fields: inventoryFields, status: 'availability',
    title: 'propertyList', add: 'addProperty', edit: 'editProperty', save: 'saveProperty',
    search: 'propertySearch', filter: 'allStatuses', empty: 'emptyProperties', label: 'project',
    searchable: ['project', 'developer', 'location', 'unitType'],
  },
};

function node(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function button(text, style, type = 'button') {
  const element = node('button', style ? 'broker-button ' + style : 'broker-button', text);
  element.type = type;
  return element;
}

function alertRegion() {
  const element = node('p', 'broker-error');
  element.setAttribute('role', 'alert');
  element.hidden = true;
  return element;
}

function showError(region, message) {
  region.textContent = message;
  region.hidden = !message;
}

function panelHeader(route, copy) {
  const panel = node('section', 'broker-screen records-screen');
  const heading = node('header', 'broker-heading');
  const title = node('h1', '', copy[route]);
  title.id = 'tool-title';
  title.tabIndex = -1;
  panel.setAttribute('aria-labelledby', title.id);
  heading.append(title, node('p', '', copy[route + 'Subtitle']));
  panel.append(heading);
  return panel;
}

function select(options, copy, all) {
  const control = node('select');
  if (all) {
    const option = node('option', '', all);
    option.value = '';
    control.append(option);
  }
  for (const value of options) {
    const option = node('option', '', copy[value]);
    option.value = value;
    control.append(option);
  }
  return control;
}

function createFields(definitions, copy) {
  const grid = node('div', 'broker-fields records-fields');
  for (const [name, definition] of Object.entries(definitions)) {
    const { options, multiline, ...attributes } = definition;
    const label = node('label', 'broker-field');
    const title = node('span', '', copy[name]);
    let input;
    if (options) {
      input = select(options, copy);
    } else {
      input = node(multiline ? 'textarea' : 'input');
      if (multiline) {
        label.classList.add('record-field-wide');
        input.rows = name === 'notes' ? 4 : 2;
      }
      Object.assign(input, attributes);
      if (input.type === 'number') input.inputMode = 'decimal';
    }
    input.name = name;
    label.append(title, input);
    if (name === 'grossCommission') {
      const hint = node('small', 'records-field-hint', copy.grossCommissionHint);
      hint.id = 'gross-commission-hint';
      input.setAttribute('aria-describedby', hint.id);
      label.append(hint);
    }
    grid.append(label);
  }
  return grid;
}

function dateLabel(value, formatter) {
  return formatter.format(new Date(value + 'T00:00:00Z'));
}

function appendDetail(list, label, value, long = false) {
  if (value === null || value === undefined || value === '') return;
  const row = node('div', long ? 'record-detail-long' : '');
  const description = node('dd', '', value);
  description.dir = 'auto';
  row.append(node('dt', '', label), description);
  list.append(row);
  return description;
}

function clientDetails(element, client, context) {
  const { copy, money, dateFormat } = context;
  const data = node('dl', 'record-details');
  if (client.budgetMin !== null && client.budgetMax !== null) {
    appendDetail(data, copy.budget, copy.betweenBudget(money.format(client.budgetMin), money.format(client.budgetMax)));
  } else if (client.budgetMin !== null) {
    appendDetail(data, copy.budget, copy.fromBudget(money.format(client.budgetMin)));
  } else if (client.budgetMax !== null) {
    appendDetail(data, copy.budget, copy.upToBudget(money.format(client.budgetMax)));
  }
  if (client.followUp) {
    const dueDate = appendDetail(data, copy.followUp, dateLabel(client.followUp, dateFormat));
    const today = workspaceDate();
    if (!['won', 'lost'].includes(client.stage) && client.followUp <= today) {
      dueDate.append(node('span', 'record-followup-flag', copy[client.followUp === today ? 'due' : 'overdue']));
    }
  }
  appendDetail(data, copy.phone, client.phone);
  appendDetail(data, copy.email, client.email);
  if (client.closedAt) appendDetail(data, copy.closedAt, dateLabel(client.closedAt, dateFormat));
  if (client.stage === 'won') appendDetail(data, copy.grossCommission, money.format(client.grossCommission));
  appendDetail(data, copy.preferences, client.preferences, true);
  appendDetail(data, copy.notes, client.notes, true);
  if (data.childElementCount) element.append(data);
}

function propertyDetails(element, property, context) {
  const { copy, money, number, dateFormat } = context;
  const data = node('dl', 'record-details');
  appendDetail(data, copy.price, money.format(property.price));
  appendDetail(data, copy.unitType, property.unitType);
  appendDetail(data, copy.location, property.location);
  appendDetail(data, copy.size, copy.sizeValue(number.format(property.size)));
  if (property.handover) appendDetail(data, copy.handover, dateLabel(property.handover, dateFormat));
  element.append(data);
}

function updatedFirst(a, b) {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function sortRecords(route, values) {
  if (route === 'inventory') return values.sort(updatedFirst);
  const today = workspaceDate();
  const dueDate = record => record.followUp && record.followUp <= today && !['won', 'lost'].includes(record.stage)
    ? record.followUp : '9999-12-31';
  return values.sort((a, b) => dueDate(a).localeCompare(dueDate(b)) || updatedFirst(a, b));
}

function downloadBackup(backup) {
  const data = JSON.stringify(backup, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = node('a');
  link.href = url;
  link.download = `the-spider-dxb-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function renderData(copy, signal, number) {
  const panel = panelHeader('data', copy);
  const cards = node('div', 'records-data-layout');
  const live = node('p', 'broker-notice');
  live.setAttribute('role', 'status');
  const error = alertRegion();
  const controls = [];
  let pendingBackup;
  let busy = false;

  const card = (title, description) => {
    const container = node('section', 'broker-card records-data-card');
    container.append(node('h2', '', copy[title]), node('p', '', copy[description]));
    cards.append(container);
    return container;
  };
  const action = (id, label, style) => {
    const control = button(copy[label], style);
    control.id = id;
    controls.push(control);
    return control;
  };
  const exportCard = card('backupTitle', 'backupBody');
  const exportButton = action('backup-export', 'export');
  exportCard.append(node('p', 'records-privacy', copy.privacyNote), exportButton);
  const restoreCard = card('restoreTitle', 'restoreBody');
  const label = node('label', 'broker-field records-file-field');
  const file = node('input');
  file.id = 'backup-file';
  file.type = 'file';
  file.accept = '.json,application/json';
  label.append(node('span', '', copy.backupFile), file);
  const review = action('backup-import', 'review', 'secondary');
  const preview = node('div', 'records-confirm');
  preview.hidden = true;
  const counts = node('dl', 'records-counts');
  const approve = action('backup-confirm-import', 'confirmImport', 'danger');
  const cancelImport = button(copy.cancel, 'secondary');
  const importActions = node('div', 'broker-actions');
  importActions.append(cancelImport, approve);
  preview.append(node('p', '', copy.previewImport), counts, importActions);
  restoreCard.append(label, review, preview);

  const eraseCard = card('eraseTitle', 'eraseBody');
  const erase = action('backup-erase', 'erase', 'danger');
  const confirmation = node('div', 'records-confirm');
  confirmation.hidden = true;
  const confirmErase = action('backup-confirm-erase', 'confirmErase', 'danger');
  const cancelErase = button(copy.cancel, 'secondary');
  const eraseActions = node('div', 'broker-actions');
  eraseActions.append(cancelErase, confirmErase);
  confirmation.append(node('p', '', copy.erasePrompt), eraseActions);
  eraseCard.append(erase, confirmation);
  panel.append(error, live, cards);

  function closePreview() {
    pendingBackup = undefined;
    counts.replaceChildren();
    preview.hidden = true;
  }
  function setBusy(state) {
    busy = state;
    for (const control of [...controls, file, cancelImport, cancelErase]) control.disabled = state;
  }
  async function process(task, success) {
    if (busy) return;
    setBusy(true);
    live.textContent = copy.inProgress;
    showError(error, '');
    try {
      await task();
      if (!signal?.aborted) live.textContent = success;
    } catch {
      if (!signal?.aborted) {
        live.textContent = '';
        showError(error, copy.storageError);
      }
    } finally {
      setBusy(false);
    }
  }
  exportButton.addEventListener('click', () => process(async () => {
    const backup = await createBackup();
    if (!signal?.aborted) downloadBackup(backup);
  }, copy.exported));
  file.addEventListener('change', () => {
    closePreview();
    showError(error, '');
  });
  review.addEventListener('click', async () => {
    if (busy) return;
    closePreview();
    confirmation.hidden = true;
    showError(error, '');
    const selected = file.files[0];
    if (!selected) {
      showError(error, copy.selectBackup);
      file.focus();
      return;
    }
    if (selected.size > MAX_BACKUP_BYTES) {
      showError(error, copy.largeBackup);
      file.focus();
      return;
    }
    setBusy(true);
    let valid = false;
    try {
      const contents = await selected.text();
      if (signal?.aborted) return;
      const backup = validateBackup(JSON.parse(contents));
      pendingBackup = backup;
      for (const [name, labelKey] of Object.entries({ clients: 'countClients', properties: 'countProperties', plans: 'countPlans', targets: 'countTargets' })) {
        const item = node('div');
        item.append(node('dt', '', copy[labelKey]), node('dd', '', number.format(backup.records[name].length)));
        counts.append(item);
      }
      preview.hidden = false;
      valid = true;
    } catch {
      if (!signal?.aborted) showError(error, copy.badBackup);
    } finally {
      setBusy(false);
    }
    (valid ? cancelImport : file).focus();
  });
  cancelImport.addEventListener('click', () => {
    closePreview();
    review.focus();
  });
  approve.addEventListener('click', async () => {
    if (!pendingBackup || busy) return;
    await process(async () => {
      await replaceFromBackup(pendingBackup);
      closePreview();
      file.value = '';
    }, copy.restored);
    if (!signal?.aborted && preview.hidden) review.focus();
  });
  erase.addEventListener('click', () => {
    closePreview();
    confirmation.hidden = false;
    cancelErase.focus();
  });
  cancelErase.addEventListener('click', () => {
    confirmation.hidden = true;
    erase.focus();
  });
  confirmErase.addEventListener('click', async () => {
    await process(async () => {
      await clearWorkspace();
      confirmation.hidden = true;
      file.value = '';
    }, copy.erased);
    if (!signal?.aborted && confirmation.hidden) erase.focus();
  });
  signal?.addEventListener('abort', () => {
    closePreview();
    file.value = '';
  }, { once: true });
  return panel;
}

function renderDirectory(route, context, signal) {
  const { copy, number } = context;
  const config = viewConfig[route];
  const panel = panelHeader(route, copy);
  const editor = node('section', 'broker-card records-editor');
  editor.hidden = true;
  const form = node('form', 'records-form');
  form.id = route + '-form';
  form.noValidate = true;
  form.autocomplete = 'off';
  const formTitle = node('h2', '', copy[config.add]);
  const fields = createFields(config.fields, copy);
  const formError = alertRegion();
  formError.id = route + '-form-error';
  const save = button(copy[config.save], '', 'submit');
  const close = button(copy.cancel, 'secondary');
  const editorActions = node('div', 'broker-actions');
  editorActions.append(save, close);
  form.append(formTitle, fields, formError, editorActions);
  editor.append(form);

  const directory = node('section', 'broker-card records-directory');
  const head = node('div', 'records-directory-head');
  const add = button(copy[config.add]);
  add.id = route + '-add';
  const listTitle = node('h2', '', copy[config.title]);
  listTitle.tabIndex = -1;
  head.append(listTitle, add);
  const controls = node('div', 'records-filters');
  const search = node('input');
  search.type = 'search';
  search.autocomplete = 'off';
  const searchLabel = node('label', 'broker-field');
  searchLabel.append(node('span', '', copy[config.search]), search);
  const filter = select(config.fields[config.status].options, copy, copy[config.filter]);
  const filterLabel = node('label', 'broker-field');
  filterLabel.append(node('span', '', copy[config.status]), filter);
  controls.append(searchLabel, filterLabel);
  const list = node('ul', 'records-list');
  const more = button(copy.more, 'secondary');
  const status = node('p', 'broker-notice');
  status.setAttribute('role', 'status');
  const summary = node('p', 'records-summary', copy.loading);
  const error = alertRegion();
  directory.append(head, controls, error, summary, list, more);
  panel.append(status, editor, directory);

  let records = [];
  let request = 0;
  let pendingDelete;
  let edited;
  let displayed = pageSize;
  let busy = false;
  let loaded = false;

  const control = name => form.elements.namedItem(name);

  function clearFormError() {
    showError(formError, '');
    for (const field of Object.keys(config.fields)) {
      const element = control(field);
      element.removeAttribute('aria-invalid');
      if (field === 'grossCommission') element.setAttribute('aria-describedby', 'gross-commission-hint');
      else element.removeAttribute('aria-describedby');
    }
  }
  function updateCloseFields() {
    if (route !== 'clients') return;
    const stage = control('stage').value;
    const closed = control('closedAt');
    const commission = control('grossCommission');
    closed.closest('label').hidden = closed.disabled = !['won', 'lost'].includes(stage);
    commission.closest('label').hidden = commission.disabled = stage !== 'won';
  }
  function closeEditor(focus) {
    edited = undefined;
    form.reset();
    clearFormError();
    editor.hidden = true;
    updateCloseFields();
    if (focus) add.focus();
  }
  function openEditor(record, focus = true) {
    if (busy) return;
    edited = record?.id;
    form.reset();
    clearFormError();
    editor.hidden = false;
    formTitle.textContent = copy[edited ? config.edit : config.add];
    if (record) {
      for (const field of Object.keys(config.fields)) control(field).value = record[field] ?? '';
    }
    updateCloseFields();
    if (focus) {
      control(config.label).focus();
      editor.scrollIntoView({ block: 'nearest' });
    }
  }
  function describeField(element, message) {
    if (element) {
      element.setAttribute('aria-invalid', 'true');
      element.setAttribute('aria-describedby', formError.id);
      element.focus();
    }
    showError(formError, message);
  }
  function readForm() {
    const values = {};
    for (const [field, definition] of Object.entries(config.fields)) {
      const input = control(field);
      if (input.disabled) continue;
      if (!input.validity.valid) {
        describeField(input, copy.invalidField(copy[field]));
        return;
      }
      values[field] = definition.type === 'number' ? (input.value ? input.valueAsNumber : null) : input.value;
    }
    if (edited) values.id = edited;
    if (values.stage === 'won' && values.grossCommission === null) values.grossCommission = 0;
    return values;
  }
  function displayRecord(record) {
    const entry = node('li', 'record-item');
    const header = node('div', 'record-item-head');
    const name = node('h3', '', record[config.label]);
    name.dir = 'auto';
    const label = node('div');
    label.append(name);
    if (route === 'inventory') {
      const developer = node('p', 'record-developer', record.developer);
      developer.dir = 'auto';
      label.append(developer);
    }
    const state = record[config.status];
    const badge = node('span', 'record-status', copy[state]);
    badge.dataset.state = state;
    header.append(label, badge);
    entry.append(header);
    (route === 'clients' ? clientDetails : propertyDetails)(entry, record, context);
    const actions = node('div', 'broker-actions record-actions');
    const edit = button(copy.edit, 'secondary');
    const remove = button(copy.delete, 'secondary');
    edit.addEventListener('click', () => openEditor(record));
    remove.addEventListener('click', () => {
      if (busy) return;
      pendingDelete = record.id;
      renderList();
      list.querySelector('.record-cancel-delete')?.focus();
    });
    actions.append(edit, remove);
    entry.append(actions);
    if (pendingDelete === record.id) {
      const confirmation = node('div', 'records-confirm');
      const cancel = button(copy.cancel, 'secondary record-cancel-delete');
      const confirm = button(copy.confirmDelete, 'danger');
      cancel.addEventListener('click', () => {
        pendingDelete = undefined;
        renderList();
        const previous = [...list.children].find(item => item.dataset.recordId === record.id);
        previous?.querySelector('.record-actions button:last-child')?.focus();
      });
      confirm.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        confirm.disabled = true;
        showError(error, '');
        try {
          await deleteRecord(config.collection, record.id);
          if (signal?.aborted) return;
          if (edited === record.id) closeEditor(false);
          pendingDelete = undefined;
          status.textContent = copy.deleted;
          await refresh();
          listTitle.focus();
        } catch {
          if (!signal?.aborted) showError(error, copy.storageError);
        } finally {
          busy = false;
          confirm.disabled = false;
        }
      });
      const confirmActions = node('div', 'broker-actions');
      confirmActions.append(cancel, confirm);
      confirmation.append(node('p', '', copy.confirmItem(record[config.label])), confirmActions);
      entry.append(confirmation);
    }
    entry.dataset.recordId = record.id;
    return entry;
  }
  function renderList() {
    if (signal?.aborted) return;
    const query = search.value.trim().toLocaleLowerCase();
    const filtered = records.filter(record => (
      (!filter.value || record[config.status] === filter.value)
      && (!query || config.searchable.some(field => record[field]?.toLocaleLowerCase().includes(query)))
    ));
    const items = filtered.slice(0, displayed);
    list.replaceChildren(...items.map(displayRecord));
    more.hidden = filtered.length <= displayed;
    if (items.length) summary.textContent = copy.showing(number.format(items.length), number.format(filtered.length));
    else if (loaded) summary.textContent = records.length ? copy.emptySearch : copy[config.empty];
  }
  async function refresh() {
    const current = ++request;
    try {
      const values = await listRecords(config.collection);
      if (signal?.aborted || current !== request) return;
      records = sortRecords(route, values);
      loaded = true;
      showError(error, '');
      add.disabled = false;
      if (edited && !records.some(record => record.id === edited)) closeEditor(false);
      renderList();
    } catch {
      if (signal?.aborted || current !== request) return;
      add.disabled = true;
      summary.textContent = '';
      showError(error, copy.storageError);
    }
  }
  const filterList = () => {
    displayed = pageSize;
    pendingDelete = undefined;
    renderList();
  };
  add.addEventListener('click', () => openEditor());
  close.addEventListener('click', () => { if (!busy) closeEditor(true); });
  search.addEventListener('input', filterList);
  filter.addEventListener('change', filterList);
  more.addEventListener('click', () => {
    const shown = list.children.length;
    displayed += pageSize;
    renderList();
    list.children[shown]?.querySelector('button')?.focus();
  });
  if (route === 'clients') control('stage').addEventListener('change', updateCloseFields);
  form.addEventListener('input', clearFormError);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    clearFormError();
    showError(error, '');
    const input = readForm();
    if (!input) return;
    busy = true;
    save.disabled = true;
    try {
      await saveRecord(config.collection, input);
      if (signal?.aborted) return;
      status.textContent = '';
      closeEditor(true);
      status.textContent = copy.saved;
      await refresh();
    } catch (exception) {
      if (signal?.aborted) return;
      if (exception.code === 'field') describeField(control(exception.field), copy.invalidField(copy[exception.field]));
      else if (exception.code === 'budgetRange') describeField(control('budgetMax'), copy.budgetRange);
      else showError(formError, copy[exception.code] ?? copy.storageError);
    } finally {
      busy = false;
      save.disabled = false;
    }
  });

  add.disabled = true;
  more.hidden = true;
  const unsubscribe = subscribeRecords(({ collections }) => {
    if (collections.includes(config.collection)) refresh();
  });
  if (localeDraft?.route === route) openEditor(localeDraft.input, false);
  localeDraft = undefined;
  signal?.addEventListener('abort', () => {
    if (signal.reason === 'locale-change' && !editor.hidden && !busy) {
      const fields = Object.keys(config.fields).map(name => [name, control(name).value]);
      localeDraft = { route, input: { ...Object.fromEntries(fields), id: edited } };
    }
    unsubscribe();
    records = [];
    search.value = '';
    closeEditor(false);
    list.replaceChildren();
  }, { once: true });
  refresh();
  return panel;
}

export function renderRecords(route, language, { signal } = {}) {
  const copy = recordsTranslations[language] ?? recordsTranslations.en;
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (route === 'data') return renderData(copy, signal, number);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  return renderDirectory(route, { copy, number, money, dateFormat }, signal);
}
