import React from 'react';
import { Chip, SectionHeader } from '../../ds';
import { REVEAL_SPEEDS, revealDurationLabel, useRevealSpeed } from '../../../lib/revealSpeed';

export default function PreferencesSection() {
  const [speed, chooseSpeed] = useRevealSpeed();

  return (
    <div className="space-y-6">
      {/* Geschwindigkeit der Animation nach dem Anmelden: drei feste Stufen */}
      <section className="space-y-3" aria-labelledby="settings-reveal-title">
        <SectionHeader title="Animation nach dem Anmelden" />
        <p className="text-body text-secondary">
          Wie schnell sich die Wörter FOCUS und FLOW in die Mitte ziehen und die App sich öffnet. Die Einstellung gilt für dieses Gerät.
        </p>
        <div role="radiogroup" aria-labelledby="settings-reveal-title" className="flex flex-wrap gap-2">
          <span id="settings-reveal-title" className="sr-only">Geschwindigkeit der Animation</span>
          {REVEAL_SPEEDS.map((choice) => (
            <Chip
              key={choice.value}
              role="radio"
              aria-checked={speed === choice.value}
              selected={speed === choice.value}
              leadingIcon={choice.icon}
              onClick={() => chooseSpeed(choice.value)}
            >
              {choice.label}
              <span className="text-caption text-tertiary">{revealDurationLabel(choice.value)}</span>
            </Chip>
          ))}
        </div>
        <p className="text-caption text-tertiary">
          Ist in deinem System „Bewegung reduzieren“ aktiv, entfällt die Animation.
        </p>
      </section>
    </div>
  );
}
