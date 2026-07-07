/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D0D0D',
        card: '#171717',
        surface: '#222222',
        accent: '#FF8C00',
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#FACC15',
        muted: '#A1A1AA',
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,140,0,0.25), 0 8px 24px rgba(255,140,0,0.12)',
      },
    },
  },
  plugins: [],
};
