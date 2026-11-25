import React from 'react';
import TheoryCards from './TheoryCards.jsx';
import TheoryIllustration from './TheoryIllustration.jsx';
import TheoryCallout from './TheoryCallout.jsx';

export default function TheorySection() {
  return (
    <section className="section wrap" id="teoria">
      <div className="section-head">
        <span className="eyebrow">Fundamentos</span>
        <h2>¿Cómo funciona MLQ?</h2>
        <p>Cinco preguntas para entender el algoritmo antes de simularlo.</p>
      </div>

      <div className="theory-grid">
        <TheoryCards />
        <TheoryIllustration />
      </div>

    </section>
  );
}
