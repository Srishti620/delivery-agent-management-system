import { hash, initials } from '../lib/art.js';
export function Art({ html, className = '' }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

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
