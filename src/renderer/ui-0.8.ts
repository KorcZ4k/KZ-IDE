// UI bridge for controls that need to cross the React/native-style menu boundary.
const closeMenus = () => document.querySelector<HTMLElement>('.app')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
window.addEventListener('kz-clear-terminal', () => document.querySelector<HTMLButtonElement>('.terminal-tool[title="Limpar terminal"]')?.click());
window.addEventListener('click', event => {
  if ((event.target as HTMLElement | null)?.closest('.menu-item')) setTimeout(closeMenus, 0);
}, true);
