/*
 * PWA glue: service-worker registration, update prompt, install prompt,
 * offline indicator and manifest shortcut (?tab=) deep-links.
 * Vanilla DOM only so it can run independently of the main bundle.
 */

const TAB_BUTTONS = {
  species: '#btn-species',
  abilities: '#btn-abis',
  abis: '#btn-abis',
  moves: '#btn-moves',
  locations: '#btn-locations',
  trainers: '#btn-trainers',
};

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) {
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

function showToast({ message, actionLabel, onAction, timeout = 0, id }) {
  const host = getToastHost();
  if (id && host.querySelector(`[data-toast="${id}"]`)) return; // de-dupe
  const toast = el('div', { className: 'pwa-toast' });
  if (id) toast.dataset.toast = id;
  toast.append(el('span', { className: 'pwa-toast-msg' }, message));
  if (actionLabel) {
    toast.append(el('button', {
      className: 'pwa-toast-btn',
      type: 'button',
      onclick: () => { onAction?.(); toast.remove(); },
    }, actionLabel));
  }
  toast.append(el('button', {
    className: 'pwa-toast-close', type: 'button', title: 'Dismiss',
    'aria-label': 'Dismiss', onclick: () => toast.remove(),
  }, '×'));
  host.append(toast);
  requestAnimationFrame(() => toast.classList.add('pwa-toast-in'));
  if (timeout) setTimeout(() => toast.remove(), timeout);
  return toast;
}

let _host;
function getToastHost() {
  if (_host && document.body.contains(_host)) return _host;
  _host = el('div', { className: 'pwa-toast-host', id: 'pwa-toast-host' });
  document.body.append(_host);
  return _host;
}

/* ---- Service worker + update flow ---- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');

      // A waiting worker on first load means an update is ready.
      if (reg.waiting && navigator.serviceWorker.controller) {
        promptUpdate(reg.waiting);
      }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(sw);
          }
        });
      });

      // Reload once the new worker takes control.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (_e) {
      /* registration failures are non-fatal */
    }
  });
}

function promptUpdate(worker) {
  showToast({
    id: 'update',
    message: 'A new version is available.',
    actionLabel: 'Reload',
    onAction: () => worker.postMessage('SKIP_WAITING'),
  });
}

/* ---- Install prompt ---- */
function setupInstallPrompt() {
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    showToast({
      id: 'install',
      message: 'Install ER NextDex for offline, full-screen use.',
      actionLabel: 'Install',
      onAction: async () => {
        if (!deferred) return;
        deferred.prompt();
        await deferred.userChoice.catch(() => {});
        deferred = null;
      },
    });
  });
  window.addEventListener('appinstalled', () => {
    document.querySelector('[data-toast="install"]')?.remove();
  });
}

/* ---- Offline / online indicator ---- */
function setupConnectivity() {
  let banner;
  const update = () => {
    if (navigator.onLine) {
      banner?.remove();
      banner = null;
    } else if (!banner) {
      banner = showToast({
        id: 'offline',
        message: 'You are offline — showing cached data.',
        timeout: 0,
      });
    }
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

/* ---- Manifest shortcut deep-links (?tab=) ---- */
function applyTabParam() {
  let tab;
  try { tab = new URLSearchParams(window.location.search).get('tab'); }
  catch (_e) { return; }
  if (!tab) return;
  const selector = TAB_BUTTONS[tab.toLowerCase()];
  if (!selector) return;
  window.addEventListener('load', () => {
    // Panels are wired during boot; give them a tick, then activate.
    setTimeout(() => document.querySelector(selector)?.click(), 60);
  });
}

export function initPWA() {
  registerServiceWorker();
  setupInstallPrompt();
  setupConnectivity();
  applyTabParam();
}

initPWA();
