const historyName = 'the-spider-dxb-ai-history:' + new URL('.', import.meta.url).pathname;
const storeName = 'conversations';
const tasks = new Set([
  'chat', 'analysis', 'coach', 'objection', 'negotiation',
  'marketing', 'listing', 'whatsapp', 'report', 'comparison',
]);
export const historyLimits = Object.freeze({ conversations: 50, messages: 24, user: 6000, assistant: 16000, title: 100 });
const listeners = new Set();
let opening;
let channel;

function historyError(code) {
  return Object.assign(new Error(code), { code });
}

function text(value, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum * 2 || Array.from(value).length > maximum) {
    throw historyError('invalidConversation');
  }
  return value;
}

function conversationId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw historyError('invalidConversation');
  return value;
}

function normalizeConversation(input) {
  if (!input || !tasks.has(input.task) || !['en', 'ar'].includes(input.language) ||
      !Array.isArray(input.messages) || !input.messages.length ||
      input.messages.length > historyLimits.messages || input.messages.length % 2 !== 0) {
    throw historyError('invalidConversation');
  }
  // Rebuild the stored shape to exclude API credentials, connection settings and raw metadata.
  const messages = Array.from(input.messages, (message, index) => {
    const role = index % 2 === 0 ? 'user' : 'assistant';
    if (message?.role !== role) throw historyError('invalidConversation');
    return { role, text: text(message.text, historyLimits[role]) };
  });
  const title = input.title === undefined
    ? Array.from(messages[0].text.trim().replace(/\s+/g, ' ')).slice(0, historyLimits.title).join('')
    : text(input.title, historyLimits.title).trim();
  return { task: input.task, language: input.language, title, messages };
}

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A subscriber failure cannot change the result of the committed write.
    }
  }
}

function changeChannel() {
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel === 'function') {
    try {
      channel = new BroadcastChannel(historyName);
      channel.addEventListener('message', ({ data }) => {
        if (data === 'change') notify();
      });
    } catch {
      // History remains available without cross-tab updates.
    }
  }
  return channel;
}

function publish() {
  notify();
  try {
    changeChannel()?.postMessage('change');
  } catch {
    // The committed change can still be read on refresh.
  }
}

export function subscribeConversations(listener) {
  changeChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function openHistory() {
  if (!opening) {
    const attempt = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(historyError('historyUnavailable'));
        return;
      }
      const request = indexedDB.open(historyName, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
      request.onblocked = () => {
        blocked = true;
        reject(historyError('historyUnavailable'));
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) {
          database.close();
          return;
        }
        const forget = () => {
          if (opening === attempt) opening = undefined;
        };
        database.onclose = forget;
        database.onversionchange = () => {
          database.close();
          forget();
        };
        resolve(database);
      };
    }).catch(error => {
      if (opening === attempt) opening = undefined;
      throw error;
    });
    opening = attempt;
  }
  return opening;
}

async function transaction(mode, start) {
  const database = await openHistory();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    let result;
    let failure;
    const setResult = value => { result = value; };
    const abort = error => { failure = error; tx.abort(); };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? historyError('historyUnavailable'));
    try {
      start(tx.objectStore(storeName), setResult, abort);
    } catch (error) {
      abort(error);
    }
  });
}

export async function listConversations() {
  return transaction('readonly', (store, setResult) => {
    const read = store.getAll();
    read.onsuccess = () => {
      setResult(read.result.sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)));
    };
  });
}

export async function saveConversation(input) {
  const snapshot = normalizeConversation(input);
  const editing = input.id !== undefined;
  const id = editing ? conversationId(input.id) : crypto.randomUUID();
  const record = await transaction('readwrite', (store, setResult, abort) => {
    function write(previous) {
      const now = new Date().toISOString();
      const updatedAt = previous && previous.updatedAt > now ? previous.updatedAt : now;
      const saved = { ...snapshot, id, createdAt: previous?.createdAt ?? now, updatedAt };
      if (editing) store.put(saved);
      else store.add(saved);
      setResult(saved);
    }

    if (editing) {
      const prior = store.get(id);
      prior.onsuccess = () => {
        if (prior.result) write(prior.result);
        else abort(historyError('conversationMissing'));
      };
    } else {
      const count = store.count();
      count.onsuccess = () => {
        if (count.result >= historyLimits.conversations) abort(historyError('historyFull'));
        else write();
      };
    }
  });
  publish();
  return record;
}

export async function deleteConversation(id) {
  await transaction('readwrite', store => store.delete(conversationId(id)));
  publish();
}

export async function clearConversations() {
  await transaction('readwrite', store => store.clear());
  publish();
}
