/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, near-black backgrounds with a subtle brown/sepia tint
        warm: {
          950: '#080605',
          900: '#0E0A08',
          850: '#14100C',
          800: '#1A1410',
          750: '#221A14',
          700: '#2C2018',
          600: '#3A2C22',
          500: '#7A6860',
          400: '#A08880',
          300: '#C4AFA8',
          200: '#E0CEC6',
          100: '#F0E4DC',
        },
        // Muted deep crimson — not harsh, brick/ember tones
        crimson: {
          950: '#160404',
          900: '#220808',
          800: '#360E0E',
          700: '#4E1414',
          600: '#671A1A',
          500: '#832020',
          400: '#A02C2C',
          300: '#BB3C3C',
          200: '#D05454',
          100: '#E87878',
          50:  '#F5A8A8',
        },
        // Muted status tones
        moss:   { 600: '#2E5A36', 400: '#4A8A56', 300: '#5EAA6A' },
        amber:  { 600: '#5C4A18', 400: '#8A7020', 300: '#A88A2C' },
      },
      fontFamily: {
        sans: ['Satoshi', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-down': 'slideDown 0.25s ease-out',
        'grain': 'grain 0.4s steps(1) infinite',
      },
      keyframes: {
        slideDown: {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
        grain: {
          '0%':   { transform: 'translate(0, 0)' },
          '20%':  { transform: 'translate(-3%, -4%)' },
          '40%':  { transform: 'translate(4%, 2%)' },
          '60%':  { transform: 'translate(-2%, 5%)' },
          '80%':  { transform: 'translate(3%, -2%)' },
          '100%': { transform: 'translate(-1%, 1%)' },
        },
      },
    },
  },
  plugins: [],
};
