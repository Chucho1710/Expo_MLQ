import React from 'react';
import TheoryCards from './TheoryCards.jsx';
import TheoryIllustration from './TheoryIllustration.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function TheorySection() {
  const { lang } = useLanguage();
  const en = lang === 'en';

  return (
    <section className="section wrap" id="teoria">
      <div className="section-head">
        <span className="eyebrow">{en ? 'Fundamentals' : 'Fundamentos'}</span>
        <h2>{en ? 'How does MLQ work?' : '¿Cómo funciona MLQ?'}</h2>
        <p>
          {en
            ? 'Five key questions to understand the algorithm before simulating it.'
            : 'Cinco preguntas para entender el algoritmo antes de simularlo.'}
        </p>
      </div>

      <div className="theory-grid">
        <TheoryCards />
        <TheoryIllustration />
      </div>
    </section>
  );
}
