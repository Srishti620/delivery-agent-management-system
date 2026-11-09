import { hash, initials } from '../lib/art.js';

// The art helpers only return static markup (see lib/art.js), so rendering it as HTML is safe.
export function Art({ html, className = '' }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Round badge with the agent's initials; the colour comes from the agent id so it stays the same. */
export function Monogram({ seed, name, size = 32 }) {
  return (
    <span
      className="monogram"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), '--h': hash(seed) % 360 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
