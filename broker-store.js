import { normalizePlan } from './broker-plans.js';

export const clientStages = Object.freeze(['new', 'qualified', 'viewing', 'offer', 'won', 'lost']);
export const propertyStatuses = Object.freeze(['available', 'reserved', 'sold']);
export const MAX_BACKUP_BYTES = 30 * 1024 * 1024;
const limits = { clients: 1000, properties: 1000, plans: 100, targets: 1200 };
const collections = Object.keys(limits);
const backupFormat = 'the-spider-dxb-workspace';
const backupVersion = 1;
const databaseName = 'the-spider-dxb:' + new URL('.', import.meta.url).pathname;
const listeners = new Set();
let opening;
let channel;

function invalid(code, field) {
  return Object.assign(new RangeError(code), { code, field });
}

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('record');
  return value;
}

function inputText(value, field, max, { required = false, multiline = false } = {}) {
  if (typeof value !== 'string') throw invalid('field', field);
  const text = value.trim();
  // Keep notes usable across operating systems while rejecting embedded control characters.
  const clean = multiline ? text.replace(/[\t\r\n]/g, '') : text;
  if (text.length > max || (required && !text) || /[\x00-\x1f\x7f]/.test(clean)) throw invalid('field', field);
  return text;
}

function numeric(value, field, { min = 0, max = 1e12, decimals = 2, optional = false } = {}) {
  if (optional && (value === null || value === undefined)) return null;
  if (!Number.isFinite(value) || value < min || value > max || Number(value.toFixed(decimals)) !== value) {
    throw invalid('field', field);
  }
  return value;
}

function date(value, field, required = false) {
  if (value === '' && !required) return '';
  if (typeof value !== 'string' || !/^(?:19\d\d|[2-9]\d{3})-\d\d-\d\d$/.test(value)) throw invalid('field', field);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalid('field', field);
  return value;
}

const uaeCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function workspaceDate(now = new Date()) {
  const parts = Object.fromEntries(uaeCalendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timestamp(value, field) {
  if (typeof value !== 'string') throw invalid('field', field);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw invalid('field', field);
  return value;
}

function member(value, choices, field) {
  if (!choices.includes(value)) throw invalid('field', field);
  return value;
}

export function normalizeClient(input) {
  const record = object(input);
  const stage = member(record.stage, clientStages, 'stage');
  const budgetMin = numeric(record.budgetMin, 'budgetMin', { optional: true });
  const budgetMax = numeric(record.budgetMax, 'budgetMax', { optional: true });
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) throw invalid('budgetRange', 'budgetMax');
  const email = inputText(record.email ?? '', 'email', 254);
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) throw invalid('field', 'email');
  return {
    name: inputText(record.name, 'name', 120, { required: true }),
    phone: inputText(record.phone ?? '', 'phone', 40),
    email,
    stage,
    budgetMin,
    budgetMax,
    preferences: inputText(record.preferences ?? '', 'preferences', 1000, { multiline: true }),
    followUp: date(record.followUp ?? '', 'followUp'),
    notes: inputText(record.notes ?? '', 'notes', 4000, { multiline: true }),
    closedAt: stage === 'won' || stage === 'lost' ? date(record.closedAt ?? '', 'closedAt') : '',
    grossCommission: stage === 'won' ? numeric(record.grossCommission ?? 0, 'grossCommission') : 0,
  };
}

export function normalizeProperty(input) {
  const record = object(input);
  return {
    developer: inputText(record.developer, 'developer', 120, { required: true }),
    project: inputText(record.project, 'project', 120, { required: true }),
    location: inputText(record.location, 'location', 160, { required: true }),
    unitType: inputText(record.unitType, 'unitType', 100, { required: true }),
    size: numeric(record.size, 'size', { min: 0.01, max: 1e8 }),
    price: numeric(record.price, 'price', { min: 1 }),
    availability: member(record.availability, propertyStatuses, 'availability'),
    handover: date(record.handover ?? '', 'handover'),
  };
}

function normalizeTarget(input) {
  const record = object(input);
  const month = record.month;
  if (typeof month !== 'string' || !/^(?:19\d\d|[2-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(month)) throw invalid('field', 'month');
  return {
    month,
    deals: numeric(record.deals, 'deals', { max: 1e6, decimals: 0 }),
    commission: numeric(record.commission, 'commission'),
  };
}

const normalizers = { clients: normalizeClient, properties: normalizeProperty, plans: normalizePlan, targets: normalizeTarget };

function requireCollection(collection) {
  if (!Object.hasOwn(limits, collection)) throw invalid('collection');
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw invalid('identifier', 'id');
  return value;
}

function newId() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function notify(changed) {
  for (const listener of listeners) {
    try {
      listener({ collections: changed });
    } catch (error) {
      globalThis.reportError?.(error);
    }
  }
}

function connectChannel() {
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel === 'function') {
    try {
      channel = new BroadcastChannel(databaseName);
      channel.addEventListener('message', ({ data }) => {
        if (Array.isArray(data) && data.every(name => Object.hasOwn(limits, name))) notify(data);
      });
    } catch {
      // Tabs can still use the database when broadcast notifications are unavailable.
    }
  }
}

function publish(changed) {
  connectChannel();
  notify(changed);
  try {
    channel?.postMessage(changed);
  } catch {
    // The committed local change is still available to other tabs on refresh.
  }
}

export function subscribeRecords(listener) {
  connectChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function openWorkspace() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('IndexedDB is unavailable.'));
        return;
      }
      const request = indexedDB.open(databaseName, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        for (const name of collections) request.result.createObjectStore(name, { keyPath: 'id' });
      };
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Close another tab using the workspace and retry.'));
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          opening = undefined;
        };
        database.onclose = () => { opening = undefined; };
        resolve(database);
      };
    }).catch(error => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

async function transaction(names, mode, handler) {
  const database = await openWorkspace();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(names, mode);
    let result;
    let failure;
    const setResult = value => { result = value; };
    const abort = error => {
      failure = error;
      tx.abort();
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Workspace transaction was cancelled.'));
    try {
      handler(tx, setResult, abort);
    } catch (error) {
      abort(error);
    }
  });
}

export async function listRecords(collection) {
  requireCollection(collection);
  return transaction([collection], 'readonly', (tx, setResult) => {
    const request = tx.objectStore(collection).getAll();
    request.onsuccess = () => setResult(request.result);
  });
}

export async function saveRecord(collection, input) {
  requireCollection(collection);
  const normalized = normalizers[collection](object(input));
  const editing = input.id !== undefined;
  const id = collection === 'targets' ? normalized.month : editing ? identifier(input.id) : newId();
  const result = await transaction([collection], 'readwrite', (tx, setResult, abort) => {
    const store = tx.objectStore(collection);
    const existing = store.get(id);
    existing.onsuccess = () => {
      const prior = existing.result;
      if (editing && collection !== 'targets' && !prior) {
        abort(invalid('missing'));
        return;
      }
      const write = () => {
        const now = new Date();
        const updatedAt = [now.toISOString(), prior?.updatedAt ?? ''].sort().at(-1);
        const record = { ...normalized, id, createdAt: prior?.createdAt ?? updatedAt, updatedAt };
        if (collection === 'clients' && (record.stage === 'won' || record.stage === 'lost') && !record.closedAt) {
          record.closedAt = prior?.closedAt || workspaceDate(now);
        }
        store.put(record);
        setResult(record);
      };
      if (prior) {
        write();
        return;
      }
      const count = store.count();
      count.onsuccess = () => {
        if (count.result >= limits[collection]) abort(invalid('limit'));
        else write();
      };
    };
  });
  publish([collection]);
  return result;
}

export async function deleteRecord(collection, id) {
  requireCollection(collection);
  await transaction([collection], 'readwrite', tx => tx.objectStore(collection).delete(identifier(id)));
  publish([collection]);
}

export async function createBackup() {
  const records = await transaction(collections, 'readonly', (tx, setResult) => {
    const data = {};
    setResult(data);
    for (const name of collections) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { data[name] = request.result; };
    }
  });
  return { format: backupFormat, version: backupVersion, exportedAt: new Date().toISOString(), records };
}

export function validateBackup(payload) {
  const backup = object(payload);
  if (backup.format !== backupFormat || backup.version !== backupVersion) throw invalid('version');
  const source = object(backup.records);
  if (Object.keys(source).length !== collections.length) throw invalid('collection');
  const records = Object.fromEntries(collections.map(name => {
    const input = source[name];
    if (!Array.isArray(input) || input.length > limits[name]) throw invalid('collection', name);
    const ids = new Set();
    const entries = input.map(item => {
      const raw = object(item);
      const record = normalizers[name](raw);
      const id = identifier(raw.id);
      if (ids.has(id) || (name === 'targets' && id !== record.month)) throw invalid('duplicate', name);
      if (name === 'clients' && (record.stage === 'won' || record.stage === 'lost') && !record.closedAt) {
        throw invalid('field', 'closedAt');
      }
      ids.add(id);
      const createdAt = timestamp(raw.createdAt, 'createdAt');
      const updatedAt = timestamp(raw.updatedAt, 'updatedAt');
      if (updatedAt < createdAt) throw invalid('field', 'updatedAt');
      return { ...record, id, createdAt, updatedAt };
    });
    return [name, entries];
  }));
  return { format: backupFormat, version: backupVersion, exportedAt: timestamp(backup.exportedAt, 'exportedAt'), records };
}

export async function replaceFromBackup(payload) {
  const { records } = validateBackup(payload);
  await transaction(collections, 'readwrite', tx => {
    for (const name of collections) {
      const store = tx.objectStore(name);
      store.clear();
      for (const record of records[name]) store.add(record);
    }
  });
  publish(collections);
}

export async function clearWorkspace() {
  await transaction(collections, 'readwrite', tx => {
    for (const name of collections) tx.objectStore(name).clear();
  });
  publish(collections);
}
