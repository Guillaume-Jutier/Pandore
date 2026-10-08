import { describe, expect, it, vi } from 'vitest';
import { buildToolList, isValidTool } from '../src/renderer/tool-registry.js';

function makeTool(overrides = {}) {
  return { id: 'outil', name: 'Outil', order: 10, mount() {}, ...overrides };
}

// Same shape as the object returned by Vite's import.meta.glob.
function asModules(tools) {
  return Object.fromEntries(
    tools.map((tool, index) => [`../tools/outil-${index}/index.js`, { default: tool }]),
  );
}

describe('isValidTool', () => {
  it('accepte un outil complet', () => {
    expect(isValidTool(makeTool())).toBe(true);
  });

  it('refuse un outil incomplet', () => {
    expect(isValidTool(makeTool({ id: undefined }))).toBe(false);
    expect(isValidTool(makeTool({ id: '' }))).toBe(false);
    expect(isValidTool(makeTool({ name: undefined }))).toBe(false);
    expect(isValidTool(makeTool({ order: '10' }))).toBe(false);
    expect(isValidTool(makeTool({ mount: undefined }))).toBe(false);
    expect(isValidTool(null)).toBe(false);
  });
});

describe('buildToolList', () => {
  it('range les outils par ordre croissant', () => {
    const tools = buildToolList(
      asModules([
        makeTool({ id: 'echeancier', order: 20 }),
        makeTool({ id: 'radar-prospects', order: 10 }),
      ]),
    );
    expect(tools.map((tool) => tool.id)).toEqual(['radar-prospects', 'echeancier']);
  });

  it('ignore un outil invalide sans bloquer les autres', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tools = buildToolList(
      asModules([makeTool({ id: 'echeancier' }), makeTool({ id: undefined })]),
    );
    expect(tools.map((tool) => tool.id)).toEqual(['echeancier']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('ignore un module sans export par défaut', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tools = buildToolList({ '../tools/vide/index.js': {} });
    expect(tools).toEqual([]);
    warn.mockRestore();
  });

  it('ne garde qu’un seul outil par identifiant', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tools = buildToolList(
      asModules([makeTool({ id: 'echeancier' }), makeTool({ id: 'echeancier' })]),
    );
    expect(tools).toHaveLength(1);
    warn.mockRestore();
  });

  it('trouve les deux vrais outils de Pandore', async () => {
    const modules = {
      '../tools/radar-prospects/index.js': await import(
        '../src/tools/radar-prospects/index.js'
      ),
      '../tools/echeancier/index.js': await import('../src/tools/echeancier/index.js'),
    };
    expect(buildToolList(modules).map((tool) => tool.name)).toEqual([
      'Radar Prospects',
      "Échéancier d'études",
    ]);
  });
});
