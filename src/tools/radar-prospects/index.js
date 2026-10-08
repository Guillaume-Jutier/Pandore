import { renderComingSoon } from '../../shared/coming-soon.js';

export default {
  id: 'radar-prospects',
  name: 'Radar Prospects',
  order: 10,
  mount(container) {
    renderComingSoon(container, {
      title: 'Radar Prospects',
      description:
        "Trouver des entreprises qui ont probablement besoin d'une étude, et préparer un premier contact conforme.",
    });
  },
};
