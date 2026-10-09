// Small form helpers shared by the Radar tabs.
import { el } from '../../../shared/dom.js';

let fieldCount = 0;
const nextId = () => `rad-field-${++fieldCount}`;

// <label> + <input>. `props` are passed to the input (type, value, placeholder…).
export function inputField(label, props = {}, hint) {
  const id = nextId();
  const input = el('input', { id, type: 'text', ...props });
  const field = el(
    'div',
    { className: 'rad-field' },
    el('label', { htmlFor: id }, label),
    input,
    hint ? el('span', { className: 'rad-hint' }, hint) : null,
  );
  return { field, input };
}

// options: [[value, label], …]
export function selectField(label, options, value = '') {
  const id = nextId();
  const select = el(
    'select',
    { id },
    options.map(([optionValue, optionLabel]) =>
      el(
        'option',
        { value: optionValue, selected: optionValue === value },
        optionLabel,
      ),
    ),
  );
  const field = el(
    'div',
    { className: 'rad-field' },
    el('label', { htmlFor: id }, label),
    select,
  );
  return { field, select };
}

export function checkboxField(label, checked = false) {
  const input = el('input', { type: 'checkbox', checked });
  const field = el('label', { className: 'rad-check' }, input, label);
  return { field, input };
}

export function alertBox(level, ...content) {
  return el('div', { className: `rad-alert rad-alert-${level}` }, ...content);
}
