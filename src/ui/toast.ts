/**
 * In-app messages.
 *
 * The previous tool used `alert()` and `confirm()` for everything, including a
 * blocking `confirm()` fired on page load to offer autosave recovery — before
 * a first-time visitor had seen what the site even was. Nothing here blocks.
 */

import { CLS } from '../render/classes';

export type Tone = 'info' | 'success' | 'warning' | 'error';

function container(): HTMLElement {
  let el = document.querySelector<HTMLElement>(`.${CLS.toastContainer}`);
  if (!el) {
    el = document.createElement('div');
    el.className = CLS.toastContainer;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message: string, tone: Tone = 'info', durationMs = 3000): void {
  const el = document.createElement('div');
  el.className = CLS.toast;
  el.dataset.tone = tone;
  el.textContent = message;
  container().appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}

export interface Action {
  label: string;
  onSelect: () => void;
}

/**
 * A message that offers a choice and waits — without blocking the page.
 * Used for autosave recovery.
 */
export function prompt(message: string, actions: readonly Action[]): void {
  const el = document.createElement('div');
  el.className = CLS.toast;
  el.dataset.tone = 'info';
  el.appendChild(document.createTextNode(message));

  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      el.remove();
      action.onSelect();
    });
    el.appendChild(button);
  }

  container().appendChild(el);
}
