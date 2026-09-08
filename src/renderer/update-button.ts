declare global {
  interface Window {
    kz: typeof window.kz;
  }
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
  button.style.fontFamily = 'inherit';
  button.style.fontSize = '12px';
  button.style.fontWeight = '700';
  button.style.cursor = 'pointer';

  const setState = (label: string, title: string) => {
    button.textContent = label;
    button.title = title;
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
        setState('×', 'Atualizações indisponíveis no modo de desenvolvimento');
      } else if (status.state === 'error') {
        setState('!', 'Falha ao consultar GitHub Releases');
        window.setTimeout(() => setState('↻', 'Buscar atualização no GitHub Releases'), 3000);
      } else {
        setState('↓', 'Atualização encontrada; acompanhe o download');
      }
    } catch {
      setState('!', 'Falha ao consultar GitHub Releases');
      window.setTimeout(() => setState('↻', 'Buscar atualização no GitHub Releases'), 3000);
    } finally {
      button.disabled = false;
    }
  });

  actions.insertBefore(button, actions.firstChild);
  installed = true;
  return true;
}

const observer = new MutationObserver(() => {
  if (installUpdateButton()) observer.disconnect();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.setTimeout(installUpdateButton, 250);
