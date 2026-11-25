import React from 'react';

export default function Topbar() {
  return (
    <header className="topbar">
      <a className="brand" href="#inicio">
        <span className="brand-mark" aria-hidden="true">MLQ</span>
        <span>Simulador de planificación</span>
      </a>
      <nav aria-label="Secciones">
        <a href="#teoria">Teoría</a>
        <a href="#simulador">Simulador</a>
        <a href="#resultados">Resultados</a>
      </nav>
    </header>
  );
}
