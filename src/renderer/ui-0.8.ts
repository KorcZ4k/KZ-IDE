// Small UI bridge used by the native-style menu without coupling it to React internals.
window.addEventListener('kz-clear-terminal', () => {
  document.querySelector<HTMLButtonElement>('.terminal-tool[title="Limpar terminal"]')?.click();
});
