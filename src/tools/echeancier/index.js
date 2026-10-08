import { renderComingSoon } from '../../shared/coming-soon.js';

export default {
  id: 'echeancier',
  name: "Échéancier d'études",
  order: 20,
  mount(container) {
    renderComingSoon(container, {
      title: "Échéancier d'études",
      description:
        "Calculer toutes les échéances d'une étude, du premier RDV à la fidélisation, et les exporter vers un agenda.",
    });
  },
};
