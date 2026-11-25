import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function Hero() {
  const { lang } = useLanguage();
  const en = lang === 'en';

  return (
    <section className="hero" id="inicio">
      <div className="wrap hero-inner">
        <span className="tag">
          <span className="dot" /> {en ? 'Interactive Simulator' : 'Simulador interactivo'}
        </span>
        <h1>
          {en ? 'MLQ — Multilevel Queue Scheduling' : 'MLQ — Planificación por Colas Multinivel'}
        </h1>
        <p className="subtitle">
          {en
            ? 'Understand how operating systems classify and schedule processes across multiple priority queues.'
            : 'Comprende cómo los sistemas operativos clasifican y planifican procesos mediante múltiples colas de prioridad.'}
        </p>
        <p className="hero-desc">
          {en ? (
            <>
              MLQ (<em>Multilevel Queue Scheduling</em>) partitions ready processes into several permanent queues
              according to their type. Each queue has a fixed priority and its own internal scheduling algorithm;
              the CPU is always given to the highest-priority queue that has pending work.
            </>
          ) : (
            <>
              MLQ (<em>Multilevel Queue Scheduling</em>) divide los procesos listos en varias colas permanentes según su tipo.
              Cada cola tiene una prioridad fija y su propio algoritmo de planificación interno; la CPU siempre se entrega
              a la cola de mayor prioridad que tenga trabajo pendiente.
            </>
          )}
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#simulador">
            {en ? 'Go to simulator' : 'Ir al simulador'}
          </a>
          <a className="btn btn-ghost" href="#teoria">
            {en ? 'View theory' : 'Ver la teoría'}
          </a>
        </div>
      </div>
    </section>
  );
}
