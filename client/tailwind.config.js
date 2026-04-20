/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          950: '#071a10',
          900: '#0b2a1a',
          800: '#113823',
          700: '#18502f',
          600: '#1f6038',
        },
        gold: {
          200: '#f0dfa0',
          300: '#dfc06a',
          400: '#c9a03c',
          500: '#a07c2a',
        },
        cream: {
          50:  '#fdf9f0',
          100: '#f5ecda',
          200: '#e8d6b8',
          400: '#c4a87a',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
      },
      backgroundImage: {
        'felt-gradient': 'radial-gradient(ellipse at top, #18502f 0%, #0b2a1a 60%, #071a10 100%)',
      },
      boxShadow: {
        'gold': '0 0 0 1px #c9a03c, 0 4px 24px rgba(201,160,60,0.15)',
        'card': '0 2px 16px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
