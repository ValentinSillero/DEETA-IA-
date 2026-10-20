// Con el teclado abierto la barra inferior se oculta. Si un botón fijo abajo
// le quitara el foco al campo al presionarse, la barra reaparecería y el botón
// se movería antes de soltar el dedo. Evitando el cambio de foco en
// `mousedown`, el toque llega siempre al botón.
export function keepFocusOnPress(event: { preventDefault: () => void }) {
  event.preventDefault();
}

// Después de la acción, se cierra el teclado.
export function releaseFocus() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
