declare global {
  interface Window { kz: typeof window.kz; }
}

let installed = false;

function installUpdateButton() {
  if (installed) return true;
  const head = document.querySelector('.sidebar-head');
  if (!head) return false;
  const actions = head.querySelector('div');
  if (!actions) return false;

  const button = document.createElement('button');
  button.type = 'button';
  button.title = 'Buscar atualização no GitHub Releases';
  button.textContent = '↻';
  button.dataset.kzUpdate = 'true';
  button.setAttribute('aria-label', 'Atualizar KZ-IDE');

  const setState = (label: string, title: string) => {
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    setState('…', 'Consultando GitHub Releases');
    try {
      const status = await window.kz.update.check();
      if (status.state === 'not-available') {
        setState('✓', 'KZ-IDE já está atualizado');
        window.setTimeout(() => setState('↻', 'Buscar atualização no GitHub Releases'), 2500);
      } else if (status.state === 'disabled') {
        setState('×', 'Atualizações indisponíveis neste modo');
      } else if (status.state === 'error') {
        setState('!', 'Falha ao consultar GitHub Releases');
        window.setTimeout(() => setState('↻', 'Buscar atualização no GitHub Releases'), 3000);
      } else {
        setState('↓', 'Atualização encontrada; o download será iniciado');
      }
    } catch {
      setState('!', 'Falha ao consultar GitHub Releases');
      window.setTimeout(() => setState('↻', 'Buscar atualização no GitHub Releases'), 3000);
    } finally {
      button.disabled = false;
    }
  });

  actions.appendChild(button);
  installed = true;
  return true;
}

const observer = new MutationObserver(() => {
  if (installUpdateButton()) observer.disconnect();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.setTimeout(installUpdateButton, 250);
