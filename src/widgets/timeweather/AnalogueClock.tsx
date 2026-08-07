const SIZE = 160;
const CENTER = SIZE / 2;
const FACE_RADIUS = CENTER - 6;

function handPoint(angleDeg: number, length: number): { x: number; y: number } {
  // 0 degrees = 12 o'clock, clockwise - not the usual math convention
  // (0 = 3 o'clock, counter-clockwise), so angles are shifted -90 and
  // sign-flipped here rather than at every call site.
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + length * Math.cos(rad), y: CENTER + length * Math.sin(rad) };
}

/** A minimal, hollow-line analogue face (stroke only, no fills) matching
 * the rest of the dashboard's wireframe look (see the CS2 Analysis rating
 * radar) rather than a skeuomorphic clock face - just a ring, 12 tick
 * marks, and three hands, all themed off the existing CSS custom
 * properties so it follows whatever theme/preset is active. */
export function AnalogueClock({ now }: { now: Date }) {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;

  const hourHand = handPoint(hourAngle, FACE_RADIUS * 0.5);
  const minuteHand = handPoint(minuteAngle, FACE_RADIUS * 0.75);
  const secondHand = handPoint(secondAngle, FACE_RADIUS * 0.82);

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = i * 30;
    const outer = handPoint(angle, FACE_RADIUS);
    const inner = handPoint(angle, FACE_RADIUS - (i % 3 === 0 ? 12 : 6));
    return { key: i, x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
  });

  return (
    <svg
      className="timeweather__analogue"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      role="img"
      aria-label={now.toLocaleTimeString()}
    >
      <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={1.5} />
      {ticks.map((t) => (
        <line
          key={t.key}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="var(--color-border)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
      <line
        x1={CENTER}
        y1={CENTER}
        x2={hourHand.x}
        y2={hourHand.y}
        stroke="var(--color-text)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={CENTER}
        y1={CENTER}
        x2={minuteHand.x}
        y2={minuteHand.y}
        stroke="var(--color-text)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={CENTER}
        y1={CENTER}
        x2={secondHand.x}
        y2={secondHand.y}
        stroke="var(--color-accent)"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <circle cx={CENTER} cy={CENTER} r={3} fill="var(--color-accent)" />
    </svg>
  );
}
