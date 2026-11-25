import React from 'react';

export default function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="wrap hero-inner">
        <span className="tag">
          <span className="dot" /> Simulador interactivo
        </span>
        <h1>MLQ — Planificación por Colas Multinivel</h1>
        <p className="subtitle">
          Comprende cómo los sistemas operativos clasifican y planifican procesos mediante múltiples colas de prioridad.
        </p>
        <p className="hero-desc">
          MLQ (<em>Multilevel Queue Scheduling</em>) divide los procesos listos en varias colas permanentes según su tipo.
          Cada cola tiene una prioridad fija y su propio algoritmo de planificación interno; la CPU siempre se entrega
          a la cola de mayor prioridad que tenga trabajo pendiente.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#simulador">
            Ir al simulador
          </a>
          <a className="btn btn-ghost" href="#teoria">
            Ver la teoría
          </a>
        </div>
      </div>
    </section>
  );
}
