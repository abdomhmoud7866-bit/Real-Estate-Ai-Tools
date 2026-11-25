import { aiConnection, connectAi, countAiCharacters, disconnectAi, generateAi } from './ai-client.js';
import { takeAiContext } from './ai-handoff.js';
import { clearConversations, deleteConversation, listConversations, saveConversation, subscribeConversations } from './ai-history.js';
import { intelligenceCopy } from './ai-translations.js';

const tasks = ['chat', 'analysis', 'coach', 'objection', 'negotiation', 'marketing', 'listing', 'whatsapp', 'report', 'comparison'];
const formats = ['marketingListing', 'social', 'video', 'campaign'];
const percentMetrics = new Set(['fees', 'vacancy', 'grossYield', 'netYield', 'interestRate', 'roi']);
const emailPattern = /^[^@]+@[^@]+\.[a-z\u0600-\u06ff]{2,}/iu;
const credentialPattern = /(?:^|[^A-Za-z0-9_-])(?:sk-[A-Za-z0-9_-]{16,}|dxb_[A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/u;
const phonePattern = /(?:^|[^0-9])(?:\+971|00971|05)[\s().-]*(?:[0-9][\s().-]*){7,9}(?![0-9])/u;
const invalidCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
let localeDraft = null;

function node(parent, tag, className = '', content = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.textContent = content;
  parent.append(element);
  return element;
}

function label(parent, text, input) {
  const column = node(parent, 'label', 'broker-field');
  node(column, 'span', '', text);
  column.append(input);
  return column;
}

function control(parent, text, tag, attributes) {
  const input = document.createElement(tag);
  Object.assign(input, attributes);
  label(parent, text, input);
  return input;
}

function check(parent, text, id) {
  const wrapper = node(parent, 'label', 'ai-check');
  const input = node(wrapper, 'input');
  input.type = 'checkbox';
  input.id = id;
  node(wrapper, 'span', '', text);
  return input;
}

function action(parent, title, id = '', variant = '', type = 'button') {
  const button = node(parent, 'button', ['broker-button', variant].filter(Boolean).join(' '), title);
  if (id) button.id = id;
  button.type = type;
  return button;
}

function options(select, values, copy) {
  for (const value of values) {
    node(select, 'option', '', copy[value]).value = value;
  }
}

function live(parent, id, error = false) {
  const message = node(parent, 'p', error ? 'broker-error ai-feedback' : 'ai-feedback');
  message.id = id;
  message.setAttribute('role', error ? 'alert' : 'status');
  return message;
}

function scenarioTable(parent, context, copy, locale) {
  if (!context?.length) return;
  const section = node(parent, 'section', 'ai-calculator-context');
  node(section, 'h3', '', copy.calculatorContext);
  node(section, 'p', 'ai-note', copy.calculatorResultNote);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'AED', maximumFractionDigits: 2 });
  const percentage = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  for (const [index, row] of context.entries()) {
    node(section, 'h4', '', copy.scenario + ' ' + number.format(index + 1));
    const metrics = node(section, 'dl', 'ai-input-metrics');
    for (const [key, value] of Object.entries(row)) {
      const item = node(metrics, 'div');
      node(item, 'dt', '', copy[key]);
      const formatted = percentMetrics.has(key)
        ? percentage.format(value / 100)
        : key === 'termYears' ? number.format(value) : money.format(value);
      node(item, 'dd', '', formatted).dir = 'auto';
    }
  }
}

function historyPanel(parent, copy, locale, signal, invalidateSave) {
  const section = node(parent, 'section', 'broker-card ai-history');
  node(section, 'h2', '', copy.history);
  node(section, 'p', 'ai-note', copy.historyNote);
  const list = node(section, 'div', 'ai-history-list');
  list.id = 'ai-history-list';
  const actions = node(section, 'div', 'broker-actions');
  const clear = action(actions, copy.eraseHistory, 'ai-history-clear', 'danger');
  const confirmClear = action(actions, copy.confirmClear, 'ai-history-confirm-clear', 'danger');
  const cancelClear = action(actions, copy.dismiss, '', 'secondary');
  confirmClear.hidden = cancelClear.hidden = true;
  const status = live(section, 'ai-history-status');
  const error = live(section, 'ai-history-error', true);
  let request = 0;

  function finishClear() {
    confirmClear.hidden = cancelClear.hidden = true;
    clear.hidden = false;
  }

  async function refresh() {
    const index = ++request;
    const opened = new Set(Array.from(list.querySelectorAll('details[open]'), (entry) => entry.dataset.conversation));
    try {
      const records = await listConversations();
      if (signal?.aborted || index !== request) return;
      const time = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
      list.replaceChildren();
      clear.disabled = records.length === 0;
      if (!records.length) node(list, 'p', 'broker-empty', copy.noHistory);
      for (const record of records) {
        const item = node(list, 'details', 'ai-history-entry');
        item.open = opened.has(record.id);
        item.dataset.conversation = record.id;
        const summary = node(item, 'summary');
        node(summary, 'span', 'ai-history-title', record.title).dir = 'auto';
        node(summary, 'small', '', copy[record.task] + ' · ' + time.format(new Date(record.updatedAt)));
        const messages = node(item, 'div', 'ai-history-messages');
        for (const message of record.messages) {
          node(messages, 'h3', '', copy[message.role === 'user' ? 'roleUser' : 'roleAssistant']);
          node(messages, 'p', 'ai-wrapped', message.text).dir = 'auto';
        }
        const actions = node(messages, 'div', 'broker-actions');
        const remove = action(actions, copy.remove, '', 'danger');
        remove.dataset.conversationDelete = record.id;
        const confirm = action(actions, copy.confirmDelete, '', 'danger');
        confirm.dataset.conversationConfirmDelete = record.id;
        const cancel = action(actions, copy.dismiss, '', 'secondary');
        confirm.hidden = cancel.hidden = true;
        remove.addEventListener('click', () => {
          remove.hidden = true;
          confirm.hidden = cancel.hidden = false;
          confirm.focus();
        });
        cancel.addEventListener('click', () => {
          confirm.hidden = cancel.hidden = true;
          remove.hidden = false;
          remove.focus();
        });
        confirm.addEventListener('click', async () => {
          confirm.disabled = true;
          try {
            await deleteConversation(record.id);
            if (!signal?.aborted) status.textContent = copy.deleted;
          } catch {
            if (!signal?.aborted) error.textContent = copy.historyUnavailable;
          } finally {
            confirm.disabled = false;
          }
        });
      }
      error.textContent = '';
    } catch {
      if (!signal?.aborted && index === request) {
        list.replaceChildren();
        clear.disabled = true;
        error.textContent = copy.historyUnavailable;
      }
    }
  }

  clear.addEventListener('click', () => {
    clear.hidden = true;
    confirmClear.hidden = cancelClear.hidden = false;
    confirmClear.focus();
  });
  cancelClear.addEventListener('click', () => {
    finishClear();
    clear.focus();
  });
  confirmClear.addEventListener('click', async () => {
    invalidateSave();
    confirmClear.disabled = cancelClear.disabled = true;
    try {
      await clearConversations();
      if (!signal?.aborted) status.textContent = copy.deleted;
    } catch {
      if (!signal?.aborted) error.textContent = copy.historyUnavailable;
    } finally {
      confirmClear.disabled = cancelClear.disabled = false;
      finishClear();
    }
  });
  const unsubscribe = subscribeConversations(() => {
    invalidateSave();
    refresh();
  });
  signal?.addEventListener('abort', unsubscribe, { once: true });
  clear.disabled = true;
  refresh();
}

function outputSection(parent, copy, locale) {
  const section = node(parent, 'section', 'broker-card ai-result');
  node(section, 'h2', '', copy.resultHeading);
  const disclaimer = node(section, 'p', 'ai-note', copy.disclaimer);
  disclaimer.hidden = true;
  const output = node(section, 'div', 'ai-output');
  output.id = 'ai-output';
  node(output, 'p', 'broker-empty', copy.resultEmpty);

  function render(result, payload) {
    disclaimer.hidden = false;
    output.replaceChildren();
    const printable = ['report', 'comparison'].includes(payload.task);
    if (printable) {
      scenarioTable(output, payload.context, copy, locale);
      node(output, 'p', 'ai-note', copy.reportInputNote);
    }
    let copyText = result.text;
    if (payload.task === 'listing') {
      for (const [key, heading, maximum] of [['title', 'listingTitle', 50], ['description', 'listingDescription', 2000]]) {
        node(output, 'h3', '', copy[heading]);
        const content = node(output, 'p', 'ai-output-text', result[key]);
        content.id = 'ai-listing-' + key;
        content.dir = 'auto';
        node(output, 'p', 'ai-note ai-length', countAiCharacters(result[key]) + ' / ' + maximum + ' ' + copy.characters);
      }
      copyText = result.title + '\n\n' + result.description;
    } else {
      node(output, 'p', 'ai-output-text', result.text).dir = 'auto';
    }
    const actions = node(output, 'div', 'broker-actions ai-result-actions');
    const copyButton = action(actions, copy.copy, 'ai-copy-output', 'secondary');
    const status = live(actions, 'ai-copy-status');
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyText);
        status.textContent = copy.copied;
      } catch {
        status.textContent = copy.copyFailed;
      }
    });
    if (printable && payload.context?.length) {
      section.dataset.aiPrintReady = 'true';
      const print = action(actions, copy.print, 'ai-print-report');
      print.addEventListener('click', () => window.print());
    } else {
      delete section.dataset.aiPrintReady;
    }
    return copyText;
  }

  function reset() {
    delete section.dataset.aiPrintReady;
    disclaimer.hidden = true;
    output.replaceChildren();
    node(output, 'p', 'broker-empty', copy.resultEmpty);
  }

  return { render, reset };
}

export function renderIntelligence(_route, language, { signal } = {}) {
  const locale = language === 'ar' ? 'ar-AE' : 'en-AE';
  const copy = intelligenceCopy[language] || intelligenceCopy.en;
  const root = document.createElement('section');
  root.className = 'broker-screen ai-screen';
  root.setAttribute('aria-labelledby', 'tool-title');
  const header = node(root, 'header', 'broker-heading ai-heading');
  const title = node(header, 'h1', '', copy.title);
  title.id = 'tool-title';
  title.tabIndex = -1;
  node(header, 'p', '', copy.intro);

  const settings = node(root, 'section', 'broker-card ai-settings');
  const settingsHeading = node(settings, 'div', 'ai-settings-heading');
  node(settingsHeading, 'h2', '', copy.connection);
  const connectionStatus = live(settingsHeading, 'ai-connection-status');
  connectionStatus.classList.add('ai-connection-status');
  node(settings, 'p', 'ai-note', copy.connectionBody);
  const form = node(settings, 'form', 'ai-connection-form');
  form.id = 'ai-connection-form';
  form.autocomplete = 'off';
  const settingsFields = node(form, 'div', 'broker-fields');
  const endpoint = control(settingsFields, copy.endpoint, 'input', {
    name: 'endpoint', type: 'url', required: true, placeholder: 'https://spider-ai.account.workers.dev', dir: 'ltr', spellcheck: false,
    value: aiConnection()?.endpoint || '', maxLength: 200, autocomplete: 'off',
  });
  const credential = control(settingsFields, copy.accessToken, 'input', {
    name: 'accessToken', type: 'password', required: true, dir: 'ltr', minLength: 47, maxLength: 47, autocomplete: 'off',
  });
  const settingsActions = node(form, 'div', 'broker-actions');
  const connect = action(settingsActions, copy.check, 'ai-connect', '', 'submit');
  const disconnect = action(settingsActions, copy.disconnect, 'ai-disconnect', 'secondary');
  const connectionError = live(settings, 'ai-connection-error', true);
  const checked = node(settings, 'p', 'ai-note', copy.checked);
  const offline = node(settings, 'a', 'ai-offline-link', copy.calculatorLink);
  offline.href = '#risk';

  const layout = node(root, 'div', 'ai-layout');
  const work = node(layout, 'div', 'ai-work');
  const composer = node(work, 'section', 'broker-card ai-composer');
  node(composer, 'h2', '', copy.taskHeading);
  const choice = control(composer, copy.taskLabel, 'select', { id: 'ai-task', name: 'task' });
  options(choice, tasks, copy);
  const firstDraft = takeAiContext() || localeDraft;
  localeDraft = null;
  choice.value = tasks.includes(firstDraft?.task) ? firstDraft.task : 'chat';
  let context = firstDraft?.context || null;
  const guide = node(composer, 'p', 'ai-task-guide', copy[choice.value + 'Guide']);
  guide.id = 'ai-task-guide';
  const format = control(composer, copy.marketingFormat, 'select', { id: 'ai-marketing-format', name: 'format' });
  options(format, formats, copy);
  if (formats.includes(firstDraft?.format)) format.value = firstDraft.format;
  const briefTip = node(composer, 'p', 'ai-note', copy.briefHint);
  briefTip.id = 'ai-brief-tip';
  const brief = control(composer, copy.brief, 'textarea', {
    id: 'ai-brief', name: 'brief', rows: 6, maxLength: 12000, value: firstDraft?.brief || '', dir: 'auto', spellcheck: false, autocomplete: 'off',
  });
  brief.setAttribute('aria-describedby', 'ai-task-guide ai-brief-tip');
  const recent = check(composer, copy.includeRecent, 'ai-use-recent');
  const attachment = node(composer, 'div', 'ai-attachment');
  const reviewActions = node(composer, 'div', 'broker-actions');
  const review = action(reviewActions, copy.review, 'ai-review');
  const composerError = live(composer, 'ai-composer-error', true);
  const preview = node(composer, 'section', 'ai-preview');
  preview.id = 'ai-preview';
  preview.hidden = true;
  node(preview, 'h3', '', copy.preview);
  node(preview, 'p', 'ai-note', copy.previewHint);
  const recipient = node(preview, 'p', 'ai-note ai-recipient');
  const serialized = node(preview, 'pre', 'ai-payload');
  serialized.dir = 'ltr';
  const consent = check(preview, copy.consent, 'ai-consent');
  const save = check(preview, copy.save, 'ai-save-history');
  const sendActions = node(preview, 'div', 'broker-actions');
  const send = action(sendActions, copy.send, 'ai-send');
  const resultStatus = live(composer, 'ai-request-status');
  const cancel = action(composer, copy.cancel, 'ai-cancel', 'secondary');
  cancel.hidden = true;
  const result = outputSection(work, copy, locale);
  let historyRevision = 0;
  historyPanel(layout, copy, locale, signal, () => { historyRevision += 1; });

  let checkedPayload = null;
  let latestChat = null;
  let requestController = null;
  let connectionController = null;

  function updateButtons() {
    send.disabled = !checkedPayload || !consent.checked || !aiConnection() || !navigator.onLine || Boolean(requestController);
    cancel.hidden = !requestController;
    for (const control of [choice, brief, format, recent, review, attachment.querySelector('button')]) {
      if (control) control.disabled = Boolean(requestController);
    }
  }

  function updateConnection() {
    const online = navigator.onLine;
    const active = aiConnection();
    connectionStatus.textContent = !online ? copy.offline : connectionController ? copy.checking : active ? copy.connected : copy.disconnected;
    connectionStatus.dataset.connected = String(Boolean(active && online && !connectionController));
    disconnect.hidden = !active;
    checked.hidden = !active;
    connect.disabled = !online || Boolean(connectionController);
    updateButtons();
  }

  function invalidateReview() {
    checkedPayload = null;
    preview.hidden = true;
    serialized.replaceChildren();
    consent.checked = false;
    save.checked = false;
    composerError.textContent = '';
    updateButtons();
  }

  function updateTask() {
    guide.textContent = copy[choice.value + 'Guide'];
    format.parentElement.hidden = choice.value !== 'marketing';
    recent.parentElement.hidden = choice.value !== 'chat' || !latestChat;
    attachment.replaceChildren();
    attachment.hidden = !context?.length;
    if (context?.length) {
      node(attachment, 'p', 'ai-note', copy.contextReady);
      const remove = action(attachment, copy.removeContext, 'ai-remove-context', 'secondary');
      remove.addEventListener('click', () => {
        context = null;
        invalidateReview();
        updateTask();
        brief.focus();
      });
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!navigator.onLine || connectionController) return;
    requestController?.abort();
    const controller = new AbortController();
    connectionController = controller;
    const value = credential.value;
    credential.value = '';
    connectionError.textContent = '';
    invalidateReview();
    updateConnection();
    try {
      const active = await connectAi(endpoint.value, value, controller.signal);
      if (!signal?.aborted) endpoint.value = active.endpoint;
    } catch (error) {
      if (!signal?.aborted && error.code !== 'cancelled') connectionError.textContent = copy[error.code] || copy.requestFailed;
    } finally {
      if (connectionController === controller) connectionController = null;
      if (!signal?.aborted) updateConnection();
    }
  });
  disconnect.addEventListener('click', () => {
    requestController?.abort();
    disconnectAi();
    connectionError.textContent = '';
    invalidateReview();
    updateConnection();
  });
  choice.addEventListener('change', () => {
    if (!['report', 'comparison', 'analysis'].includes(choice.value)) context = null;
    recent.checked = false;
    invalidateReview();
    result.reset();
    updateTask();
  });
  for (const element of [brief, format, recent]) {
    element.addEventListener('input', invalidateReview);
  }
  consent.addEventListener('change', updateButtons);

  review.addEventListener('click', () => {
    invalidateReview();
    const text = brief.value.trim();
    if (!text) {
      composerError.textContent = copy.limit;
      brief.focus();
      return;
    }
    const parts = [];
    if (choice.value === 'marketing') parts.push(copy.marketingFormat + ' · ' + copy[format.value]);
    if (choice.value === 'chat' && recent.checked && latestChat) {
      parts.push(copy.roleUser + '\n' + latestChat.brief, copy.roleAssistant + '\n' + latestChat.answer);
    }
    parts.push(text);
    const requestBrief = parts.join('\n\n');
    if (countAiCharacters(requestBrief) > 6000 || invalidCharacters.test(requestBrief)) {
      composerError.textContent = copy.limit;
      brief.focus();
      return;
    }
    const normalized = requestBrief.replace(/[٠-٩۰-۹]/gu, digit => String(digit.codePointAt(0) & 15));
    const email = normalized.includes('@') && normalized.split(/[\s<>(),;:]+/u).some(part => emailPattern.test(part));
    if (email || phonePattern.test(normalized) || credentialPattern.test(normalized)) {
      composerError.textContent = copy.personal;
      brief.focus();
      return;
    }
    checkedPayload = { task: choice.value, language, brief: requestBrief };
    if (context?.length) checkedPayload.context = context;
    const gateway = aiConnection();
    recipient.textContent = gateway ? gateway.endpoint + ' · ' + gateway.provider : copy.disconnected;
    recipient.dir = gateway ? 'ltr' : 'auto';
    serialized.textContent = JSON.stringify(checkedPayload, null, 2);
    preview.hidden = false;
    consent.focus();
    updateButtons();
  });

  cancel.addEventListener('click', () => requestController?.abort());
  send.addEventListener('click', async () => {
    if (send.disabled || !checkedPayload || !consent.checked) return;
    const payload = checkedPayload;
    const enteredBrief = brief.value.trim();
    const controller = new AbortController();
    requestController = controller;
    const revision = historyRevision;
    const saveLocally = save.checked;
    invalidateReview();
    result.reset();
    resultStatus.textContent = copy.progress;

    try {
      const response = await generateAi(payload, controller.signal);
      if (signal?.aborted) return;
      const answer = result.render(response, payload);
      resultStatus.textContent = copy.complete;
      if (payload.task === 'chat') {
        latestChat = { brief: enteredBrief, answer: Array.from(answer).slice(0, 1800).join('') };
        recent.checked = false;
        updateTask();
      }
      if (saveLocally && historyRevision === revision) {
        try {
          await saveConversation({
            task: payload.task, language: payload.language,
            messages: [{ role: 'user', text: payload.brief }, { role: 'assistant', text: answer }],
          });
        } catch (error) {
          if (!signal?.aborted) composerError.textContent = copy[error.code] || copy.historyUnavailable;
        }
      }
    } catch (error) {
      if (!signal?.aborted) {
        resultStatus.textContent = error.code === 'cancelled' ? copy.requestCancelled : '';
        if (error.code !== 'cancelled') composerError.textContent = copy[error.code] || copy.requestFailed;
      }
    } finally {
      if (requestController === controller) requestController = null;
      if (!signal?.aborted) updateConnection();
    }
  });

  signal?.addEventListener('abort', () => {
    if (signal.reason === 'locale-change') {
      localeDraft = { task: choice.value, context, brief: brief.value, format: format.value };
    }
    requestController?.abort();
    connectionController?.abort();
  }, { once: true });
  window.addEventListener('online', updateConnection, { signal });
  window.addEventListener('offline', updateConnection, { signal });
  updateTask();
  updateConnection();
  return root;
}
