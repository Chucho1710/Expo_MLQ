import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function TheoryCards() {
  const { lang } = useLanguage();
  const en = lang === 'en';

  return (
    <div className="theory-cards">
      <article className="card">
        <h3><span className="num">1</span> {en ? 'What is MLQ?' : '¿Qué es MLQ?'}</h3>
        <p>
          {en ? (
            <>
              It is a scheduling algorithm that maintains <strong>multiple ready queues</strong>, one per category.
              A process is assigned to a queue upon creation and <strong>remains in it for its entire lifetime</strong>.
            </>
          ) : (
            <>
              Es un algoritmo de planificación que mantiene <strong>varias colas de procesos listos</strong>, una por categoría.
              Un proceso se asigna a una cola cuando se crea y <strong>permanece en ella toda su vida</strong>.
            </>
          )}
        </p>
      </article>
      <article className="card">
        <h3><span className="num">2</span> {en ? 'Why multiple queues?' : '¿Por qué varias colas?'}</h3>
        <p>
          {en
            ? 'Because not all processes have the same needs: a system service demands immediate response, an interactive app needs smoothness, and a batch job simply needs to finish.'
            : 'Porque no todos los procesos tienen las mismas necesidades: un servicio del sistema exige respuesta inmediata, una aplicación interactiva exige fluidez y un trabajo por lotes solo necesita terminar.'}
        </p>
      </article>
      <article className="card">
        <h3><span className="num">3</span> {en ? 'How are they classified?' : '¿Cómo se clasifican?'}</h3>
        <p>
          {en ? (
            <>
              By their nature: <strong>System</strong> (essential OS processes), <strong>Interactive</strong> (user applications), and <strong>Batch</strong> (batch and background tasks).
            </>
          ) : (
            <>
              Por su naturaleza: <strong>Sistema</strong> (procesos esenciales del SO), <strong>Interactiva</strong> (aplicaciones del usuario) y <strong>Batch</strong> (tareas por lotes y segundo plano).
            </>
          )}
        </p>
      </article>
      <article className="card">
        <h3><span className="num">4</span> {en ? 'What differentiates the queues?' : '¿Qué diferencia a las colas?'}</h3>
        <p>
          {en ? (
            <>
              Their <strong>priority</strong> (fixed) and their <strong>internal algorithm</strong>: for example, Round Robin for interactive queues and FCFS for batch queues.
            </>
          ) : (
            <>
              Su <strong>prioridad</strong> (fija) y su <strong>algoritmo interno</strong>: por ejemplo, Round Robin en las colas con usuarios y FCFS en la de lotes.
            </>
          )}
        </p>
      </article>
      <article className="card">
        <h3><span className="num">5</span> {en ? 'Which queue uses the CPU?' : '¿Qué cola usa la CPU?'}</h3>
        <p>
          {en ? (
            <>
              The <strong>highest-priority queue with ready processes</strong>. System &gt; Interactive &gt; Batch.
              If a process arrives in a higher-priority queue, it preempts the currently running process.
            </>
          ) : (
            <>
              La de <strong>mayor prioridad con procesos listos</strong>. Sistema &gt; Interactiva &gt; Batch.
              Si llega un proceso a una cola superior, interrumpe al que está ejecutando.
            </>
          )}
        </p>
      </article>
    </div>
  );
}
