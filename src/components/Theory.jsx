import React from 'react';

export default function Theory() {
  return (
    <section className="section wrap" id="teoria">
      <div className="section-head">
        <span className="eyebrow">Fundamentos</span>
        <h2>¿Cómo funciona MLQ?</h2>
        <p>Cinco preguntas para entender el algoritmo antes de simularlo.</p>
      </div>

      <div className="theory-grid">
        <div className="theory-cards">
          <article className="card">
            <h3><span className="num">1</span> ¿Qué es MLQ?</h3>
            <p>
              Es un algoritmo de planificación que mantiene <strong>varias colas de procesos listos</strong>, una por categoría.
              Un proceso se asigna a una cola cuando se crea y <strong>permanece en ella toda su vida</strong>.
            </p>
          </article>
          <article className="card">
            <h3><span className="num">2</span> ¿Por qué varias colas?</h3>
            <p>
              Porque no todos los procesos tienen las mismas necesidades: un servicio del sistema exige respuesta inmediata,
              una aplicación interactiva exige fluidez y un trabajo por lotes solo necesita terminar.
            </p>
          </article>
          <article className="card">
            <h3><span className="num">3</span> ¿Cómo se clasifican?</h3>
            <p>
              Por su naturaleza: <strong>Sistema</strong> (procesos esenciales del SO), <strong>Interactiva</strong> (aplicaciones del usuario) y <strong>Batch</strong> (tareas por lotes y segundo plano).
            </p>
          </article>
          <article className="card">
            <h3><span className="num">4</span> ¿Qué diferencia a las colas?</h3>
            <p>
              Su <strong>prioridad</strong> (fija) y su <strong>algoritmo interno</strong>: por ejemplo, Round Robin en las colas con usuarios y FCFS en la de lotes.
            </p>
          </article>
          <article className="card">
            <h3><span className="num">5</span> ¿Qué cola usa la CPU?</h3>
            <p>
              La de <strong>mayor prioridad con procesos listos</strong>. Sistema &gt; Interactiva &gt; Batch.
              Si llega un proceso a una cola superior, interrumpe al que está ejecutando.
            </p>
          </article>
        </div>

        <figure className="illustration" aria-label="Ilustración: procesos distribuidos en tres colas que convergen hacia una CPU">
          <svg viewBox="0 0 640 380" role="img" aria-labelledby="ilTitle ilDesc">
            <title id="ilTitle">Tres colas de prioridad que convergen a una CPU</title>
            <desc id="ilDesc">
              Tres colas horizontales, Sistema, Interactiva y Batch, con procesos esperando. Flechas de cada cola llegan a la CPU. La prioridad disminuye de arriba hacia abajo.
            </desc>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#7A0C1E" />
              </marker>
              <marker id="arrY" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#1E293B" />
              </marker>
              <marker id="arrG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#6B7280" />
              </marker>
            </defs>
            {/* Prioridad */}
            <line x1="22" y1="40" x2="22" y2="340" stroke="#7A0C1E" strokeWidth="2" markerEnd="url(#arr)" />
            <text x="12" y="200" transform="rotate(-90 12 200)" textAnchor="middle" fontSize="12" fill="#6B7280" fontWeight="600">
              PRIORIDAD ALTA → BAJA
            </text>
            {/* Cola Sistema */}
            <rect x="46" y="36" width="340" height="82" rx="14" fill="#F8E7EA" stroke="#7A0C1E" strokeWidth="2" />
            <text x="62" y="58" fontSize="13" fontWeight="700" fill="#7A0C1E">Cola 1 · Sistema</text>
            <text x="374" y="58" textAnchor="end" fontSize="12" fill="#7A0C1E">RR · q = 2</text>
            <circle cx="338" cy="92" r="17" fill="#7A0C1E" />
            <text x="338" y="97" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">P1</text>
            <circle cx="296" cy="92" r="17" fill="#9A1B30" />
            <text x="296" y="97" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">P4</text>
            <circle cx="254" cy="92" r="17" fill="#B33246" />
            <text x="254" y="97" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">P7</text>

            {/* Cola Interactiva */}
            <rect x="46" y="150" width="340" height="82" rx="14" fill="#E8ECF2" stroke="#1E293B" strokeWidth="2" />
            <text x="62" y="172" fontSize="13" fontWeight="700" fill="#1E293B">Cola 2 · Interactiva</text>
            <text x="374" y="172" textAnchor="end" fontSize="12" fill="#1E293B">RR · q = 4</text>
            <circle cx="338" cy="206" r="17" fill="#1E293B" />
            <text x="338" y="211" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">P2</text>
            <circle cx="296" cy="206" r="17" fill="#475569" />
            <text x="296" y="211" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff">P5</text>

            {/* Cola Batch */}
            <rect x="46" y="264" width="340" height="82" rx="14" fill="#EEF0F3" stroke="#6B7280" strokeWidth="2" />
            <text x="62" y="286" fontSize="13" fontWeight="700" fill="#374151">Cola 3 · Batch</text>
            <text x="374" y="286" textAnchor="end" fontSize="12" fill="#374151">FCFS</text>
            <circle cx="338" cy="320" r="17" fill="#6B7280" />
            <text x="338" y="325" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">P3</text>
            <circle cx="296" cy="320" r="17" fill="#9CA3AF" />
            <text x="296" y="325" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">P6</text>

            {/* Flechas */}
            <path d="M388 77 C440 77 450 160 486 172" fill="none" stroke="#7A0C1E" strokeWidth="3" markerEnd="url(#arr)" />
            <path d="M388 191 C430 191 450 191 486 191" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeDasharray="6 4" markerEnd="url(#arrY)" />
            <path d="M388 305 C440 305 450 222 486 210" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeDasharray="3 5" markerEnd="url(#arrG)" />

            {/* CPU */}
            <rect x="490" y="128" width="130" height="126" rx="18" fill="#7A0C1E" />
            <rect x="506" y="144" width="98" height="94" rx="10" fill="none" stroke="#ffffff" strokeWidth="2.5" />
            <text x="555" y="198" textAnchor="middle" fontSize="26" fontWeight="800" fill="#ffffff">CPU</text>
            <text x="555" y="222" textAnchor="middle" fontSize="11" fill="#F8E7EA">1 a la vez</text>
            <text x="555" y="112" textAnchor="middle" fontSize="11" fill="#6B7280" fontWeight="600">Planificación entre colas:</text>
            <text x="555" y="126" textAnchor="middle" fontSize="11" fill="#6B7280" fontWeight="600">prioridad fija</text>
            <text x="555" y="278" textAnchor="middle" fontSize="11" fill="#6B7280">Dentro de cada cola</text>
            <text x="555" y="292" textAnchor="middle" fontSize="11" fill="#6B7280">manda su propio algoritmo</text>
          </svg>
          <figcaption>
            Dos niveles de decisión: <strong>(1)</strong> entre colas, por prioridad fija; <strong>(2)</strong> dentro de la cola elegida, con su algoritmo.
          </figcaption>
        </figure>
      </div>

      <div className="callout">
        <strong>Regla de oro:</strong> la cola Interactiva solo usa la CPU si Sistema está vacía, y Batch solo si Sistema e Interactiva están vacías.
        Un proceso interrumpido <em>conserva su tiempo restante</em> y sigue en su cola; no se mueve a otra. (MLQ no es MLFQ: aquí los procesos nunca cambian de cola.)
      </div>
    </section>
  );
}
