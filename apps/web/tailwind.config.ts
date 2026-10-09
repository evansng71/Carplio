import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        night: {
          DEFAULT: '#0B1F33',
          50: '#E8EEF4',
          100: '#C5D3E2',
          200: '#8FA8C2',
          700: '#14324F',
          800: '#0F283F',
          900: '#0B1F33',
        },
        action: {
          DEFAULT: '#1B6CA8',
          soft: '#E6F1F9',
        },
        cream: '#F7F5F1',
        ok: '#1F7A4D',
        warn: '#C47A1A',
        danger: '#B42318',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(11,31,51,0.06), 0 8px 24px rgba(11,31,51,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
