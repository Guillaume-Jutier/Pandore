// Builds the side menu and shows the selected tool.
// Tools are discovered automatically: adding a folder in src/tools/ is enough.
import { buildToolList } from './tool-registry.js';

const toolModules = import.meta.glob('../tools/*/index.js', { eager: true });
const tools = buildToolList(toolModules);

const menu = document.getElementById('tool-menu');
const content = document.getElementById('tool-content');

function showTool(tool) {
  for (const button of menu.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.toolId === tool.id);
  }
  content.replaceChildren();
  tool.mount(content);
}

for (const tool of tools) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = tool.name;
  button.dataset.toolId = tool.id;
  button.addEventListener('click', () => showTool(tool));
  menu.append(button);
}

if (tools.length > 0) {
  showTool(tools[0]);
} else {
  content.textContent = 'Aucun outil trouvé.';
}
