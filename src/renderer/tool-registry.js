// Builds the list of tools shown in the side menu.
//
// Each tool lives in src/tools/<tool>/index.js and default-exports:
//   { id: 'echeancier', name: "Échéancier d'études", order: 20, mount(container) {} }
//
// `modules` is the object returned by Vite's import.meta.glob:
//   { '../tools/echeancier/index.js': { default: { ... } }, ... }

export function isValidTool(tool) {
  return (
    tool !== null &&
    typeof tool === 'object' &&
    typeof tool.id === 'string' &&
    tool.id.length > 0 &&
    typeof tool.name === 'string' &&
    tool.name.length > 0 &&
    typeof tool.order === 'number' &&
    typeof tool.mount === 'function'
  );
}

export function buildToolList(modules) {
  const tools = [];
  const seenIds = new Set();

  for (const [filePath, module] of Object.entries(modules)) {
    const tool = module?.default;
    if (!isValidTool(tool)) {
      console.warn(`Outil ignoré (format invalide) : ${filePath}`);
      continue;
    }
    if (seenIds.has(tool.id)) {
      console.warn(`Outil ignoré (identifiant en double « ${tool.id} ») : ${filePath}`);
      continue;
    }
    seenIds.add(tool.id);
    tools.push(tool);
  }

  return tools.sort((a, b) => a.order - b.order);
}
