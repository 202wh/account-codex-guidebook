import { counterFor, generateTotp, parseOtpInput, remainingFor } from './totp-core.js?v=1.0.0';

const HISTORY_KEY = 'local_totp_history_v1';
const MAX_HISTORY = 50;

const $ = (selector) => document.querySelector(selector);
const elements = {
  secret: $('#secretInput'),
  label: $('#labelInput'),
  saveHistory: $('#saveHistoryInput'),
  generate: $('#generateButton'),
  clearInput: $('#clearInputButton'),
  toggleSecret: $('#toggleSecretButton'),
  error: $('#errorMessage'),
  placeholder: $('#codePlaceholder'),
  result: $('#codeResult'),
  code: $('#codeValue'),
  copyCode: $('#copyCodeButton'),
  seconds: $('#secondsValue'),
  progress: $('#progressBar'),
  timerHint: $('#timerHint'),
  accountLabel: $('#accountLabel'),
  algorithm: $('#algorithmValue'),
  digits: $('#digitsValue'),
  period: $('#periodValue'),
  history: $('#historyList'),
  emptyHistory: $('#emptyHistory'),
  clearHistory: $('#clearHistoryButton'),
  toast: $('#toast'),
};

let activeConfig = null;
let activeHistoryId = null;
let renderedCounter = null;
let renderRevision = 0;
let timerId = null;
let toastId = null;

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

function writeHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function maskSecret(secret) {
  if (secret.length <= 10) return `${secret.slice(0, 2)}••••${secret.slice(-2)}`;
  return `${secret.slice(0, 5)}••••••${secret.slice(-5)}`;
}

function escapeText(value) {
  return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function showToast(message) {
  clearTimeout(toastId);
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  toastId = setTimeout(() => elements.toast.classList.remove('visible'), 1900);
}

function setError(message = '') {
  elements.error.textContent = message;
}

function historyId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveCurrentHistory(config) {
  const now = Date.now();
  const entries = readHistory();
  const existingIndex = entries.findIndex((entry) => entry.secret === config.secret
    && entry.algorithm === config.algorithm && entry.digits === config.digits && entry.period === config.period);
  const previous = existingIndex >= 0 ? entries.splice(existingIndex, 1)[0] : null;
  const entry = {
    id: previous?.id || historyId(),
    label: elements.label.value.trim() || config.label,
    secret: config.secret,
    algorithm: config.algorithm,
    digits: config.digits,
    period: config.period,
    createdAt: previous?.createdAt || now,
    lastUsedAt: now,
  };
  entries.unshift(entry);
  writeHistory(entries);
  activeHistoryId = entry.id;
  renderHistory();
}

function renderHistory() {
  const entries = readHistory();
  elements.history.replaceChildren();
  elements.emptyHistory.classList.toggle('hidden', entries.length > 0);
  elements.clearHistory.disabled = entries.length === 0;

  for (const entry of entries) {
    const item = document.createElement('article');
    item.className = 'history-item';
    item.dataset.id = entry.id;
    const usedAt = new Date(entry.lastUsedAt || entry.createdAt || Date.now());
    const timeText = Number.isNaN(usedAt.getTime()) ? '' : usedAt.toLocaleString('zh-CN', { hour12: false });
    item.innerHTML = `
      <div>
        <p class="history-name">${escapeText(entry.label || '未命名账户')}</p>
        <div class="history-meta">
          <span>${escapeText(maskSecret(entry.secret || ''))}</span>
          <span>·</span><span>${escapeText(entry.algorithm || 'SHA1')}</span>
          <span>·</span><span>${Number(entry.digits) || 6} 位 / ${Number(entry.period) || 30} 秒</span>
          ${timeText ? `<span>·</span><span>${escapeText(timeText)}</span>` : ''}
        </div>
      </div>
      <div class="history-actions">
        <button class="use-button" type="button" data-action="use">使用</button>
        <button class="delete-button" type="button" data-action="delete" aria-label="删除历史">×</button>
      </div>`;
    elements.history.append(item);
  }
}

async function renderCode(force = false) {
  if (!activeConfig) return;
  const revision = ++renderRevision;
  const now = Date.now();
  const counter = counterFor(now, activeConfig.period);
  if (force || counter !== renderedCounter) {
    const code = await generateTotp(activeConfig, now);
    if (revision !== renderRevision) return;
    renderedCounter = counter;
    elements.code.textContent = code;
  }

  const remaining = remainingFor(Date.now(), activeConfig.period);
  const wholeSeconds = Math.max(1, Math.ceil(remaining));
  elements.seconds.textContent = String(wholeSeconds);
  elements.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, remaining / activeConfig.period))})`;
  elements.progress.classList.toggle('warning', wholeSeconds <= 5);
  elements.timerHint.textContent = wholeSeconds <= 5
    ? '即将刷新，复制时会自动获取下一组最新验证码'
    : '验证码会按标准时间自动更新';
}

function startTicker() {
  clearTimeout(timerId);
  const tick = async () => {
    try { await renderCode(); } catch (error) { setError(error.message || '验证码刷新失败'); }
    timerId = setTimeout(tick, 200);
  };
  void tick();
}

async function activate(rawValue, labelValue, save = false) {
  setError();
  try {
    const config = parseOtpInput(rawValue, labelValue);
    activeConfig = config;
    renderedCounter = null;
    elements.placeholder.classList.add('hidden');
    elements.result.classList.remove('hidden');
    elements.accountLabel.textContent = labelValue.trim() || config.label;
    elements.algorithm.textContent = config.algorithm;
    elements.digits.textContent = `${config.digits} 位`;
    elements.period.textContent = `${config.period} 秒周期`;
    await renderCode(true);
    startTicker();
    if (save) saveCurrentHistory(config);
    return true;
  } catch (error) {
    setError(error.message || '无法生成验证码');
    return false;
  }
}

async function copyLatestCode() {
  if (!activeConfig) return;
  let now = Date.now();
  let remaining = remainingFor(now, activeConfig.period);
  if (remaining <= 2.2) {
    showToast('临近刷新，正在获取下一组验证码…');
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(remaining * 1000) + 100));
    now = Date.now();
  }
  const code = await generateTotp(activeConfig, now);
  renderedCounter = null;
  await renderCode(true);
  await navigator.clipboard.writeText(code);
  showToast(`已复制最新验证码 ${code}`);
}

elements.generate.addEventListener('click', () => {
  void activate(elements.secret.value, elements.label.value, elements.saveHistory.checked);
});

elements.secret.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void activate(elements.secret.value, elements.label.value, elements.saveHistory.checked);
});

elements.copyCode.addEventListener('click', () => {
  void copyLatestCode().catch((error) => setError(error.message || '复制失败'));
});

elements.clearInput.addEventListener('click', () => {
  elements.secret.value = '';
  elements.label.value = '';
  elements.secret.focus();
  setError();
});

elements.toggleSecret.addEventListener('click', () => {
  const reveal = elements.secret.type === 'password';
  elements.secret.type = reveal ? 'text' : 'password';
  elements.toggleSecret.setAttribute('aria-label', reveal ? '隐藏密钥' : '显示密钥');
});

elements.history.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = button.closest('.history-item');
  const entries = readHistory();
  const entry = entries.find((value) => value.id === item?.dataset.id);
  if (!entry) return;

  if (button.dataset.action === 'delete') {
    writeHistory(entries.filter((value) => value.id !== entry.id));
    if (activeHistoryId === entry.id) activeHistoryId = null;
    renderHistory();
    showToast('历史记录已删除');
    return;
  }

  elements.secret.value = entry.secret;
  elements.label.value = entry.label || '';
  activeHistoryId = entry.id;
  void activate(entry.secret, entry.label || '', false).then((ok) => {
    if (!ok) return;
    entry.lastUsedAt = Date.now();
    writeHistory([entry, ...entries.filter((value) => value.id !== entry.id)]);
    renderHistory();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

elements.clearHistory.addEventListener('click', () => {
  if (!readHistory().length) return;
  if (!window.confirm('确定清空此浏览器保存的全部 2FA 历史记录吗？')) return;
  localStorage.removeItem(HISTORY_KEY);
  activeHistoryId = null;
  renderHistory();
  showToast('浏览器历史已清空');
});

const resync = () => {
  if (!activeConfig) return;
  renderedCounter = null;
  void renderCode(true);
};
window.addEventListener('focus', resync);
window.addEventListener('pageshow', resync);
document.addEventListener('visibilitychange', () => { if (!document.hidden) resync(); });

renderHistory();
elements.secret.focus();
