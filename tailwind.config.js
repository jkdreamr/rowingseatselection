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
        bone: { DEFAULT: '#0d1110', dark: '#161c1a' },
        charcoal: { DEFAULT: '#f3f1ea', soft: '#c4c8c0', muted: '#8a918a', light: '#5d655f' },
        stone: { DEFAULT: '#39413d', dark: '#4c554f', light: '#1c2321' },
        olive: { DEFAULT: '#9aa07e', soft: '#b3b894', bg: '#1a201a' },
        taupe: { DEFAULT: '#8a7d6d', soft: '#9e9384' },
        coral: { DEFAULT: '#8c1515', dark: '#820000', soft: '#321719' },
        surface: { DEFAULT: 'rgba(255,255,255,0.04)', solid: '#141a18' },
        background: '#0d1110',
        ink: { DEFAULT: '#f3f1ea', soft: '#c4c8c0', muted: '#8a918a', 900: '#f7f6f1' },
        line: { DEFAULT: '#39413d', soft: '#262d2a' },
        cardinal: { DEFAULT: '#8c1515', dark: '#820000', soft: '#321719' },
        container: { low: '#111614', DEFAULT: '#161c1a', high: '#1f2624', highest: '#283029' },
        success: '#5fbf85',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: { tightest: '-0.04em', editorial: '-0.025em' },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.05), 0 16px 44px rgba(0,0,0,0.5)',
        glass: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 30px rgba(0,0,0,0.4)',
      },
      borderRadius: { card: '20px', pill: '100px' },
    },
  },
  plugins: [],
};
