import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function Footer() {
  const { lang } = useLanguage();
  const en = lang === 'en';

  return (
    <footer className="footer">
      <div className="wrap">
        <p>
          {en
            ? 'MLQ Simulator · Support material for CPU Process Scheduling — Operating Systems.'
            : 'Simulador MLQ · Material de apoyo para el tema de planificación de procesos — Sistemas Operativos.'}
        </p>
        <p className="small">
          {en
            ? 'Runs completely in the browser, offline with no external services.'
            : 'Funciona completamente en el navegador, sin conexión ni servicios externos.'}
        </p>
      </div>
    </footer>
  );
}
