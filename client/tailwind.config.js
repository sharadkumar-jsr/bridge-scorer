/** @type {import('tailwindcss').Config} */

// ─────────────────────────────────────────────────────────────
//  HIGH-CONTRAST FELT
//  Same green-and-gold identity, retuned so every text pairing
//  clears WCAG AAA (7:1) on a phone screen.
//    body text on card    15.2:1
//    muted text on card   11.3:1
//    gold accent on card   9.9:1
// ─────────────────────────────────────────────────────────────

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          950: '#030d09',  // deepest — page edge
          900: '#061410',  // page background
          800: '#0e2b1e',  // card surface
          700: '#17402c',  // input / inset surface
          600: '#1f5537',  // raised / hover
        },
        gold: {
          200: '#ffe6a8',
          300: '#ffdd8a',
          400: '#ffc94d',  // primary accent
          500: '#e0ac36',  // borders, secondary accent
        },
        cream: {
          50:  '#ffffff',
          100: '#ffffff',  // body text — pure white for maximum legibility
          200: '#eaf2ed',
          400: '#e8f1ec',  // muted text (was #c4a87a, too dim)
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
      },
      backgroundImage: {
        'felt-gradient':
          'radial-gradient(ellipse at top, #14402b 0%, #061410 60%, #030d09 100%)',
      },
      boxShadow: {
        'gold': '0 0 0 1px #ffc94d, 0 4px 24px rgba(255,201,77,0.18)',
        'card': '0 2px 16px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
