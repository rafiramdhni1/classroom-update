/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'tone-accent',
    'tone-success',
    'tone-warn',
    'tone-danger',
    'tone-info',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface-2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--c-accent-strong) / <alpha-value>)',
        'accent-deep': 'rgb(var(--c-accent-deep) / <alpha-value>)',
        'accent-2': 'rgb(var(--c-accent-2) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        'accent-ink': 'rgb(var(--c-accent-ink) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        'success-soft': 'rgb(var(--c-success-soft) / <alpha-value>)',
        'success-ink': 'rgb(var(--c-success-ink) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        'warn-soft': 'rgb(var(--c-warn-soft) / <alpha-value>)',
        'warn-ink': 'rgb(var(--c-warn-ink) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--c-danger-soft) / <alpha-value>)',
        'danger-ink': 'rgb(var(--c-danger-ink) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
        'info-soft': 'rgb(var(--c-info-soft) / <alpha-value>)',
        'info-ink': 'rgb(var(--c-info-ink) / <alpha-value>)',
        hero1: 'rgb(var(--hero-1) / <alpha-value>)',
        hero2: 'rgb(var(--hero-2) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Sora', '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, rgb(var(--c-accent)) 0%, rgb(var(--c-accent-deep)) 60%, rgb(var(--c-accent-2)) 140%)',
        'brand-soft': 'linear-gradient(135deg, rgb(var(--c-accent) / 0.22), rgb(var(--c-accent-2) / 0.18))',
        hero: 'linear-gradient(118deg, rgb(var(--hero-1)), rgb(var(--hero-2)) 74%)',
        sidebar: 'linear-gradient(165deg, rgb(var(--shell-1)), rgb(var(--shell-2)) 78%)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.05), 0 22px 44px -30px rgb(15 23 42 / 0.5)',
        lift: '0 26px 50px -26px rgb(15 23 42 / 0.4)',
        glow: '0 18px 40px -18px rgb(var(--c-accent) / 0.75), inset 0 1px 0 rgb(255 255 255 / 0.25)',
        glass: '0 20px 46px -30px rgb(15 23 42 / 0.6)',
        ring: '0 0 0 4px rgb(var(--c-accent) / 0.16)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        floatY: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-14px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp .4s cubic-bezier(.22,1,.36,1) both',
        pop: 'pop .24s cubic-bezier(.22,1,.36,1) both',
        floatY: 'floatY 5s ease-in-out infinite',
        slideRight: 'slideRight .35s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
};
