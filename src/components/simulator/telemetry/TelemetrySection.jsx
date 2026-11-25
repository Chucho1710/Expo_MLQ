import React from 'react';
import ExplainPanel from './ExplainPanel.jsx';
import LogPanel from './LogPanel.jsx';

export default function TelemetrySection({ currentSnapshot, simResult, cursor }) {
  const events =
    simResult && cursor >= 0
      ? simResult.snapshots.slice(0, cursor + 1).flatMap((s) => s.events)
      : [];

  return (
    <div className="two-col">
      <ExplainPanel currentSnapshot={currentSnapshot} />
      <LogPanel events={events} />
    </div>
  );
}
