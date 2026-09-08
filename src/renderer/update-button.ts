declare global {
  interface Window { kz: typeof window.kz; }
}

let installed = false;
let checking = false;

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
  button.setAttribute('aria-label', 'Atualizar Aurora');

  const setState = (label: string, title: string) => {
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
  };

  const reset = (delay = 3000) => window.setTimeout(() => setState('↻', 'Buscar atualização no GitHub Releases'), delay);

  button.addEventListener('click', async () => {
    if (checking) return;
    checking = true;
    button.disabled = true;
    setState('…', 'Buscando a versão mais recente no GitHub Releases');
    try {
      let status = await window.kz.update.check();
      if (status.state === 'available') {
        setState('↓', `Baixando Aurora ${status.version ?? ''}`.trim());
        status = await window.kz.update.download();
      }
      if (status.state === 'not-available') {
        setState('✓', 'Aurora já está na versão mais recente');
        reset();
      } else if (status.state === 'downloaded') {
        setState('↻', 'Atualização pronta — reiniciando Aurora');
        window.kz.update.install();
      } else if (status.state === 'downloading' || status.state === 'available') {
        setState('↓', `Baixando atualização${status.percent == null ? '' : ` — ${Math.round(status.percent)}%`}`);
      } else if (status.state === 'disabled') {
        setState('×', 'Atualizações disponíveis apenas no Aurora instalado');
        reset(4000);
      } else {
        setState('!', status.message || 'Falha ao consultar GitHub Releases');
        reset(4000);
      }
    } catch (error) {
      setState('!', error instanceof Error ? error.message : 'Falha ao atualizar Aurora');
      reset(4000);
    } finally {
      checking = false;
      button.disabled = false;
    }
  });

  window.kz.update.onStatus(status => {
    if (!checking) return;
    if (status.state === 'checking') setState('…', 'Buscando a versão mais recente no GitHub Releases');
    else if (status.state === 'downloading') setState('↓', `Baixando atualização — ${Math.round(status.percent ?? 0)}%`);
    else if (status.state === 'downloaded') setState('↻', 'Atualização pronta — reiniciando Aurora');
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
