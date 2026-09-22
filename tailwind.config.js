/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: { xs: '400px' },
      colors: {
        ink: { DEFAULT: '#111111', soft: '#555555', muted: '#8a8a8a' },
        line: { DEFAULT: '#e5e5e5', strong: '#cfcfcf' },
        paper: { DEFAULT: '#ffffff', alt: '#f7f7f7' },
        cardinal: { DEFAULT: '#8C1515', dark: '#820000', soft: '#f6e9e9' },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: { editorial: '-0.025em' },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
};
