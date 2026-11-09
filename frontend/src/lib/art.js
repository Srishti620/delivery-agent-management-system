// Small flat illustrations. Colours come from the page's CSS variables, so they follow the theme.
// Everything here is a static string, never built from user-typed text.

export const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const initials = (name) =>
  String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

export const logoSvg = () => `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<rect width="28" height="28" rx="6" style="fill:var(--accent)"/>
<g fill="none" style="stroke:var(--on-accent)" stroke-width="1.700" stroke-linejoin="round" stroke-linecap="round">
<path d="M7.500 10.500 14 7l6.500 3.500v7L14 21l-6.500-3.500z"/><path d="M7.500 10.500 14 14l6.500-3.500M14 14v7"/></g>
</svg>`;

/* A courier on a scooter, used beside the form and on error pages. */
export const riderSvg = () => `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Courier on a scooter">
<path d="M16 186H344" style="stroke:var(--line)" stroke-width="2" stroke-linecap="round"/>
<path d="M300 186V92" style="stroke:var(--line)" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/>
<path d="M300 94c-9-10-15-18-15-26a15 15 0 0 1 30 0c0 8-6 16-15 26z" style="fill:var(--accent)"/>
<circle cx="300" cy="68" r="5.500" style="fill:var(--surface)"/>
<g transform="translate(60 48) scale(1.15)">
<rect x="6" y="32" width="46" height="38" rx="4" fill="#d9a441"/>
<rect x="26" y="32" width="7" height="38" fill="#a97a22"/>
<path d="M34 98C34 74 52 66 76 66H110C124 66 130 80 136 98z" style="fill:var(--ink)"/>
<rect x="96" y="88" width="50" height="8" rx="4" style="fill:var(--muted)"/>
<path d="M140 92L156 36" style="stroke:var(--ink)" stroke-width="6" stroke-linecap="round"/>
<path d="M150 36H168" style="stroke:var(--ink)" stroke-width="6" stroke-linecap="round"/>
<circle cx="159" cy="52" r="5.500" fill="#f2d675"/>
<rect x="70" y="14" width="30" height="54" rx="15" style="fill:var(--accent)" transform="rotate(12 85 41)"/>
<path d="M82 62L102 88L124 86" fill="none" stroke="#3b4652" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M96 30L128 37L152 35" fill="none" style="stroke:var(--accent)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="153" cy="35" r="5" fill="#f0c9a6"/>
<circle cx="96" cy="4" r="12" fill="#f0c9a6"/>
<path d="M83 4a13 13 0 0 1 26 0z" style="fill:var(--surface);stroke:var(--ink)" stroke-width="2" stroke-linejoin="round"/>
<rect x="92" y="2" width="18" height="5" rx="2.500" style="fill:var(--ink)" opacity=".5"/>
<g style="fill:var(--ink)"><circle cx="58" cy="100" r="18"/><circle cx="152" cy="100" r="18"/></g>
<g style="fill:var(--surface)"><circle cx="58" cy="100" r="8"/><circle cx="152" cy="100" r="8"/></g>
<g style="fill:var(--ink)"><circle cx="58" cy="100" r="3"/><circle cx="152" cy="100" r="3"/></g>
</g>
</svg>`;

/* Empty table / not found. */
export const emptySvg = () => `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<path d="M22 32 60 19l38 13v32L60 77 22 64z" style="fill:var(--accent-soft);stroke:var(--accent)" stroke-width="2" stroke-linejoin="round"/>
<path d="M22 32l38 13 38-13M60 45v32" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round"/>
</svg>`;
