/** Keep the workspace credential in module memory. It is never a model credential. */
const workerHost = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.workers\.dev$/;
const workspaceToken = /^dxb_[A-Za-z0-9_-]{43}$/;
const maximumResponseBytes = 48 * 1024;
const generationTimeout = 35_000;
const connectionTimeout = 10_000;
let connection;
let connectionAttempt = 0;

export class AiClientError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AiClientError';
    this.code = code;
  }
}

export function workerOrigin(value, pageLocation = globalThis.location) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AiClientError('invalidEndpoint');
  }
  const worker = url.protocol === 'https:' && workerHost.test(url.hostname) && url.port === '';
  const localHosts = ['localhost', '127.0.0.1'];
  const loopback = url.protocol === 'http:' && localHosts.includes(url.hostname)
    && pageLocation?.protocol === 'http:' && localHosts.includes(pageLocation.hostname);
  if ((!worker && !loopback) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new AiClientError('invalidEndpoint');
  }
  return url.origin;
}

export function aiConnection() {
  if (!connection) return null;
  const { endpoint, provider, checkedAt } = connection;
  return { endpoint, provider, checkedAt };
}

export function disconnectAi() {
  connectionAttempt += 1;
  connection = undefined;
}

async function limitedJson(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType) || !response.body) throw new AiClientError('invalidResponse');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumResponseBytes) {
        await reader.cancel();
        throw new AiClientError('invalidResponse');
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof AiClientError) throw error;
    throw new AiClientError('invalidResponse');
  } finally {
    reader.releaseLock();
  }
}

function responseError(response) {
  if (response.status === 401 || response.status === 403) return 'authorization';
  if (response.status === 429) return 'rateLimited';
  if (response.status === 400 || response.status === 413 || response.status === 422) return 'requestRejected';
  if (response.status === 502 || response.status === 503) return 'providerUnavailable';
  return 'requestFailed';
}

async function workerRequest(endpoint, token, path, options) {
  const { data, signal, timeout } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new AiClientError('cancelled');
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  try {
    const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token };
    if (data) headers['Content-Type'] = 'application/json';
    const response = await fetch(endpoint + path, {
      method: data ? 'POST' : 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new AiClientError(responseError(response));
    return await limitedJson(response);
  } catch (error) {
    if (timedOut) throw new AiClientError('timedOut');
    if (signal?.aborted) throw new AiClientError('cancelled');
    if (error instanceof AiClientError) throw error;
    throw new AiClientError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function connectAi(value, credential, signal) {
  disconnectAi();
  const attempt = connectionAttempt;
  const endpoint = workerOrigin(value);
  const token = credential.trim();
  if (!workspaceToken.test(token)) throw new AiClientError('invalidToken');
  const status = await workerRequest(endpoint, token, '/v1/status', { signal, timeout: connectionTimeout });
  if (signal?.aborted || attempt !== connectionAttempt) throw new AiClientError('cancelled');
  if (!status || status.ready !== true || typeof status.provider !== 'string' || !/^[a-z0-9-]{1,32}$/i.test(status.provider)) {
    throw new AiClientError('providerUnavailable');
  }
  connection = { endpoint, token, provider: status.provider, checkedAt: new Date() };
  return aiConnection();
}

export function countAiCharacters(text) {
  return Array.from(text).length;
}

function validText(value, limit) {
  return typeof value === 'string' && !!value.trim() && countAiCharacters(value) <= limit;
}

export async function generateAi(payload, signal) {
  const active = connection;
  if (!active) throw new AiClientError('notConnected');
  let result;
  try {
    result = await workerRequest(active.endpoint, active.token, '/v1/generate', { data: payload, signal, timeout: generationTimeout });
  } catch (error) {
    if (connection === active && ['authorization', 'network', 'providerUnavailable', 'timedOut'].includes(error.code)) disconnectAi();
    throw error;
  }
  if (connection !== active || signal?.aborted) throw new AiClientError('cancelled');
  if (payload.task === 'listing') {
    if (!result || !validText(result.title, 50) || !validText(result.description, 2000)) throw new AiClientError('invalidResponse');
    return { title: result.title.trim(), description: result.description.trim() };
  }
  if (!result || !validText(result.text, 12000)) throw new AiClientError('invalidResponse');
  return { text: result.text.trim() };
}
