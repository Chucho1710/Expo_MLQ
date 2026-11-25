import React from 'react';

export default function TheoryCards() {
  return (
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
  );
}
