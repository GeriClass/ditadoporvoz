// Suporte a PWA: registro do service worker e prompt de instalação.

export function setupInstall(button, onInstalled) {
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    button.classList.remove('hidden');
  });

  button.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    button.classList.add('hidden');
    if (outcome === 'accepted') onInstalled?.();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    button.classList.add('hidden');
  });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // registro do SW falhou (ex.: sem HTTPS) — app segue funcionando sem offline
    });
  });
}
