import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function TheoryCallout() {
  const { lang } = useLanguage();
  const en = lang === 'en';

  return (
    <div className="callout">
      {en ? (
        <>
          <strong>Golden rule:</strong> the Interactive queue only uses the CPU if System is empty, and Batch only if System and Interactive are empty.
          A preempted process <em>keeps its remaining time</em> and stays in its queue; it does not move to another queue. (MLQ is not MLFQ: processes never switch queues.)
        </>
      ) : (
        <>
          <strong>Regla de oro:</strong> la cola Interactiva solo usa la CPU si Sistema está vacía, y Batch solo si Sistema e Interactiva están vacías.
          Un proceso interrumpido <em>conserva su tiempo restante</em> y sigue en su cola; no se mueve a otra. (MLQ no es MLFQ: aquí los procesos nunca cambian de cola.)
        </>
      )}
    </div>
  );
}
