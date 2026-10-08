// Placeholder page for a tool that is not built yet.
export function renderComingSoon(container, { title, description }) {
  const heading = document.createElement('h1');
  heading.textContent = title;

  const intro = document.createElement('p');
  intro.className = 'tool-description';
  intro.textContent = description;

  const badge = document.createElement('p');
  badge.className = 'coming-soon';
  badge.textContent = 'Bientôt disponible';

  container.replaceChildren(heading, intro, badge);
}
