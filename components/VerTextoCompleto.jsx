'use client';
import { useEffect } from 'react';

// Muchos nombres y descripciones no entran en una línea y terminan en "…".
// Hasta ahora no había forma de leerlos enteros dentro del app. Con esto,
// tocar cualquiera de esos textos lo despliega completo, y volver a tocarlo
// lo pliega otra vez.
//
// Funciona en todos los paneles a la vez: se escucha un solo clic en toda la
// página y se actúa únicamente si el texto tocado está realmente cortado.
// Si no está cortado, no pasa nada y el toque sigue su camino normal
// (abrir el detalle, marcar como pagado, etc.).

const SELECTOR = '.cat, .sub, .mas-section-sub';

export default function VerTextoCompleto() {
  useEffect(() => {
    function alTocar(e) {
      const el = e.target.closest?.(SELECTOR);
      if (!el) return;
      const desplegado = el.classList.contains('desplegado');
      // Cortado = el texto ocupa más ancho del que se ve.
      if (!desplegado && el.scrollWidth <= el.clientWidth + 1) return;
      e.preventDefault();
      e.stopPropagation();
      el.classList.toggle('desplegado');
    }
    // En captura, para llegar antes que el clic de la fila.
    document.addEventListener('click', alTocar, true);
    return () => document.removeEventListener('click', alTocar, true);
  }, []);
  return null;
}
