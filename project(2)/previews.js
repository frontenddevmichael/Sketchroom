// Room canvas mini-previews — hand-composed SVG "snapshots" of collaborative work.
// Dark-theme tuned.

window.PREVIEWS = {
  moodboard: `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="oklch(0.22 0.02 320)"/>
    <g transform="translate(24 22)">
      <rect x="0" y="0" width="86" height="60" rx="4" fill="oklch(0.65 0.14 30)"/>
      <rect x="94" y="8" width="70" height="52" rx="4" fill="oklch(0.72 0.13 65)"/>
      <rect x="172" y="0" width="60" height="80" rx="4" fill="oklch(0.5 0.14 260)"/>
      <rect x="240" y="14" width="90" height="66" rx="4" fill="oklch(0.62 0.16 20)"/>
      <rect x="0" y="88" width="70" height="90" rx="4" fill="oklch(0.32 0.06 260)"/>
      <rect x="78" y="96" width="94" height="72" rx="4" fill="oklch(0.6 0.13 145)"/>
      <rect x="180" y="88" width="70" height="90" rx="4" fill="oklch(0.78 0.1 90)"/>
      <rect x="258" y="96" width="72" height="76" rx="4" fill="oklch(0.55 0.16 340)"/>
    </g>
    <circle cx="336" cy="188" r="9" fill="oklch(0.65 0.14 30)" stroke="oklch(0.20 0.006 260)" stroke-width="2"/>
    <circle cx="350" cy="188" r="9" fill="oklch(0.5 0.14 260)" stroke="oklch(0.20 0.006 260)" stroke-width="2"/>
  </svg>`,

  flowchart: `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="oklch(0.22 0.025 220)"/>
    <defs>
      <pattern id="dots1" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="oklch(0.35 0.02 220)"/>
      </pattern>
    </defs>
    <rect width="400" height="225" fill="url(#dots1)" opacity="0.7"/>
    <g stroke="oklch(0.7 0.04 220)" stroke-width="1.2" fill="none" stroke-linecap="round">
      <path d="M90 60 L 150 60"/>
      <path d="M210 60 L 270 60"/>
      <path d="M180 88 L 180 120"/>
      <path d="M120 148 L 240 148"/>
      <polyline points="145,57 152,60 145,63"/>
      <polyline points="265,57 272,60 265,63"/>
      <polyline points="177,115 180,122 183,115"/>
    </g>
    <g font-family="ui-monospace,monospace" font-size="8" fill="oklch(0.9 0.005 260)">
      <rect x="40" y="46" width="50" height="28" rx="4" fill="oklch(0.28 0.02 260)" stroke="oklch(0.5 0.04 260)"/>
      <text x="65" y="63" text-anchor="middle">START</text>
      <rect x="150" y="46" width="60" height="28" rx="4" fill="oklch(0.78 0.19 148)" stroke="oklch(0.16 0.03 148)"/>
      <text x="180" y="63" text-anchor="middle" fill="oklch(0.16 0.03 148)">SIGN UP</text>
      <rect x="270" y="46" width="60" height="28" rx="4" fill="oklch(0.28 0.02 260)" stroke="oklch(0.5 0.04 260)"/>
      <text x="300" y="63" text-anchor="middle">VERIFY</text>
      <polygon points="150,120 210,120 240,148 210,176 150,176 120,148" fill="oklch(0.28 0.02 260)" stroke="oklch(0.5 0.04 260)"/>
      <text x="180" y="146" text-anchor="middle">PAID?</text>
      <text x="180" y="158" text-anchor="middle" fill="oklch(0.6 0.03 260)">y/n</text>
    </g>
    <circle cx="80" cy="60" r="4" fill="oklch(0.78 0.19 148)"/>
    <circle cx="80" cy="60" r="8" fill="oklch(0.78 0.19 148)" opacity="0.3"/>
  </svg>`,

  wireframe: `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="oklch(0.22 0.02 85)"/>
    <g transform="translate(30 24)">
      <rect x="0" y="0" width="160" height="180" rx="8" fill="oklch(0.28 0.008 85)" stroke="oklch(0.4 0.008 85)"/>
      <rect x="12" y="12" width="60" height="8" rx="2" fill="oklch(0.65 0.008 85)"/>
      <rect x="12" y="28" width="136" height="60" rx="4" fill="oklch(0.35 0.008 85)"/>
      <circle cx="80" cy="58" r="14" fill="oklch(0.5 0.008 85)"/>
      <rect x="12" y="98" width="80" height="6" rx="2" fill="oklch(0.7 0.008 85)"/>
      <rect x="12" y="110" width="120" height="4" rx="2" fill="oklch(0.5 0.008 85)"/>
      <rect x="12" y="118" width="100" height="4" rx="2" fill="oklch(0.5 0.008 85)"/>
      <rect x="12" y="138" width="60" height="24" rx="6" fill="oklch(0.95 0.005 85)"/>
    </g>
    <g transform="translate(210 24)">
      <rect x="0" y="0" width="160" height="180" rx="8" fill="oklch(0.28 0.008 85)" stroke="oklch(0.4 0.008 85)"/>
      <rect x="12" y="12" width="80" height="8" rx="2" fill="oklch(0.65 0.008 85)"/>
      <rect x="12" y="28" width="136" height="18" rx="4" fill="oklch(0.35 0.008 85)"/>
      <rect x="12" y="52" width="136" height="18" rx="4" fill="oklch(0.35 0.008 85)"/>
      <rect x="12" y="76" width="136" height="18" rx="4" fill="oklch(0.78 0.19 148)"/>
      <rect x="12" y="100" width="136" height="18" rx="4" fill="oklch(0.35 0.008 85)"/>
      <rect x="12" y="138" width="60" height="24" rx="6" fill="oklch(0.95 0.005 85)"/>
      <rect x="80" y="138" width="60" height="24" rx="6" fill="none" stroke="oklch(0.6 0.008 85)"/>
    </g>
    <path d="M195 114 L 205 114" stroke="oklch(0.6 0.008 85)" stroke-width="1" stroke-dasharray="2 2"/>
    <polyline points="202,111 206,114 202,117" stroke="oklch(0.6 0.008 85)" fill="none"/>
  </svg>`,

  stickies: `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="oklch(0.22 0.02 85)"/>
    <g transform="translate(20 18)">
      <g transform="rotate(-3 40 40)">
        <rect x="10" y="10" width="72" height="68" fill="oklch(0.82 0.14 90)"/>
        <rect x="16" y="20" width="52" height="4" fill="oklch(0.35 0.08 90)" opacity="0.5"/>
        <rect x="16" y="28" width="60" height="4" fill="oklch(0.35 0.08 90)" opacity="0.5"/>
        <rect x="16" y="36" width="44" height="4" fill="oklch(0.35 0.08 90)" opacity="0.5"/>
      </g>
      <g transform="rotate(4 130 50)">
        <rect x="100" y="14" width="72" height="68" fill="oklch(0.75 0.15 25)"/>
        <rect x="106" y="24" width="60" height="4" fill="oklch(0.25 0.08 25)" opacity="0.5"/>
        <rect x="106" y="32" width="52" height="4" fill="oklch(0.25 0.08 25)" opacity="0.5"/>
      </g>
      <g transform="rotate(-2 220 40)">
        <rect x="190" y="10" width="72" height="68" fill="oklch(0.78 0.15 145)"/>
        <rect x="196" y="20" width="60" height="4" fill="oklch(0.25 0.08 145)" opacity="0.5"/>
        <rect x="196" y="28" width="46" height="4" fill="oklch(0.25 0.08 145)" opacity="0.5"/>
        <rect x="196" y="36" width="54" height="4" fill="oklch(0.25 0.08 145)" opacity="0.5"/>
      </g>
      <g transform="rotate(3 310 50)">
        <rect x="280" y="14" width="72" height="68" fill="oklch(0.75 0.15 250)"/>
        <rect x="286" y="24" width="54" height="4" fill="oklch(0.2 0.08 250)" opacity="0.5"/>
        <rect x="286" y="32" width="60" height="4" fill="oklch(0.2 0.08 250)" opacity="0.5"/>
      </g>
      <g transform="rotate(2 80 140)">
        <rect x="50" y="108" width="72" height="68" fill="oklch(0.78 0.15 320)"/>
        <rect x="56" y="118" width="60" height="4" fill="oklch(0.25 0.09 320)" opacity="0.5"/>
        <rect x="56" y="126" width="50" height="4" fill="oklch(0.25 0.09 320)" opacity="0.5"/>
      </g>
      <g transform="rotate(-3 170 140)">
        <rect x="140" y="108" width="72" height="68" fill="oklch(0.82 0.14 90)"/>
        <rect x="146" y="118" width="54" height="4" fill="oklch(0.35 0.08 90)" opacity="0.5"/>
        <rect x="146" y="126" width="60" height="4" fill="oklch(0.35 0.08 90)" opacity="0.5"/>
        <rect x="146" y="134" width="42" height="4" fill="oklch(0.35 0.08 90)" opacity="0.5"/>
      </g>
      <g transform="rotate(4 260 140)">
        <rect x="230" y="108" width="72" height="68" fill="oklch(0.78 0.15 145)"/>
        <rect x="236" y="118" width="52" height="4" fill="oklch(0.25 0.08 145)" opacity="0.5"/>
        <rect x="236" y="126" width="60" height="4" fill="oklch(0.25 0.08 145)" opacity="0.5"/>
      </g>
    </g>
  </svg>`,

  whiteboard: `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="oklch(0.20 0.006 260)"/>
    <g fill="none" stroke="oklch(0.85 0.008 260)" stroke-linecap="round" stroke-linejoin="round">
      <path d="M30 40 Q 60 20 100 50 T 190 40" stroke-width="1.5"/>
      <path d="M40 70 L 88 70 L 88 110 L 40 110 Z" stroke-width="1.3"/>
      <text x="50" y="93" font-family="ui-monospace,monospace" font-size="10" fill="oklch(0.9 0.005 260)" stroke="none">USER</text>
      <path d="M95 90 L 155 90" stroke-width="1.3"/>
      <polyline points="150,86 156,90 150,94" stroke-width="1.3"/>
      <circle cx="180" cy="90" r="24" stroke-width="1.3"/>
      <text x="180" y="94" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="oklch(0.9 0.005 260)" stroke="none">AUTH</text>
      <path d="M205 90 L 260 90" stroke-width="1.3"/>
      <polyline points="255,86 261,90 255,94" stroke-width="1.3"/>
      <path d="M262 70 L 340 70 L 340 110 L 262 110 Z" stroke-width="1.3"/>
      <text x="301" y="93" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="oklch(0.9 0.005 260)" stroke="none">SERVER</text>
      <path d="M60 130 Q 200 175 340 130" stroke-width="1.3" stroke-dasharray="3 3"/>
    </g>
    <g fill="oklch(0.78 0.19 148)" opacity="0.5">
      <path d="M64 90 L 84 90 L 84 100 L 64 100 Z"/>
    </g>
    <text x="200" y="200" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="oklch(0.55 0.008 260)">system diagram · draft 2</text>
  </svg>`,

  gantt: `<svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="225" fill="oklch(0.22 0.025 55)"/>
    <g font-family="ui-monospace,monospace" font-size="8" fill="oklch(0.65 0.03 55)">
      <text x="24" y="34">M</text><text x="72" y="34">T</text><text x="120" y="34">W</text><text x="168" y="34">T</text><text x="216" y="34">F</text><text x="264" y="34">S</text><text x="312" y="34">S</text>
    </g>
    <g stroke="oklch(0.35 0.02 55)" stroke-dasharray="2 3" stroke-width="0.5">
      <line x1="20" y1="42" x2="380" y2="42"/>
      <line x1="20" y1="72" x2="380" y2="72"/>
      <line x1="20" y1="102" x2="380" y2="102"/>
      <line x1="20" y1="132" x2="380" y2="132"/>
      <line x1="20" y1="162" x2="380" y2="162"/>
      <line x1="20" y1="192" x2="380" y2="192"/>
    </g>
    <g>
      <rect x="24" y="52" width="130" height="14" rx="3" fill="oklch(0.65 0.14 55)"/>
      <rect x="72" y="82" width="180" height="14" rx="3" fill="oklch(0.5 0.14 260)"/>
      <rect x="24" y="112" width="240" height="14" rx="3" fill="oklch(0.78 0.19 148)"/>
      <rect x="120" y="142" width="150" height="14" rx="3" fill="oklch(0.6 0.14 20)"/>
      <rect x="216" y="172" width="140" height="14" rx="3" fill="oklch(0.45 0.09 260)"/>
      <rect x="24" y="172" width="80" height="14" rx="3" fill="oklch(0.35 0.05 260)"/>
    </g>
    <line x1="176" y1="42" x2="176" y2="200" stroke="oklch(0.78 0.19 148)" stroke-width="1.5"/>
    <circle cx="176" cy="42" r="4" fill="oklch(0.78 0.19 148)"/>
  </svg>`,
};
