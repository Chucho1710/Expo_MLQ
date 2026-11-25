import React from 'react';

export default function TheoryCallout() {
  return (
    <div className="callout">
      <strong>Regla de oro:</strong> la cola Interactiva solo usa la CPU si Sistema está vacía, y Batch solo si Sistema e Interactiva están vacías.
      Un proceso interrumpido <em>conserva su tiempo restante</em> y sigue en su cola; no se mueve a otra. (MLQ no es MLFQ: aquí los procesos nunca cambian de cola.)
    </div>
  );
}
