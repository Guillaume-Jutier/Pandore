// Tiny helper to build page elements without innerHTML.
// Text is always inserted as text, never interpreted as HTML: safe by default.
//
//   el('button', { className: 'primary', on: { click: save } }, 'Enregistrer')
//   el('input', { type: 'date', value: '2026-10-09', id: 'rdv' })

export function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === 'on') {
      for (const [eventName, handler] of Object.entries(value)) {
        element.addEventListener(eventName, handler);
      }
    } else if (key === 'dataset') {
      Object.assign(element.dataset, value);
    } else if (key === 'attrs') {
      for (const [name, attrValue] of Object.entries(value)) {
        element.setAttribute(name, attrValue);
      }
    } else {
      element[key] = value; // className, type, value, checked, htmlFor, title…
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

// "relance propale 1" -> "Relance propale 1"
export function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
