/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a101d',
          900: '#0f172a',
          850: '#131e35',
          800: '#172b4d',
          700: '#1e3a8a',
        },
        brand: {
          navy: '#0f172a',
          primary: '#172b4d',
          blue: '#2563eb',
          slate: '#475569',
        },
        danger: {
          DEFAULT: '#dc2626',
          light: '#fef2f2',
          border: '#fecaca',
          glow: 'rgba(220, 38, 38, 0.25)',
        },
        warning: {
          DEFAULT: '#d97706',
          light: '#fffbeb',
          border: '#fde68a',
          glow: 'rgba(217, 119, 6, 0.2)',
        },
        safe: {
          DEFAULT: '#15803d',
          light: '#f0fdf4',
          border: '#bbf7d0',
          glow: 'rgba(21, 128, 61, 0.2)',
        },
        blocked: '#64748b',
        user: '#2563eb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'dialog': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radar 2s linear infinite',
        'dash-flow': 'dash 1.5s linear infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.8)', opacity: '0.9' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        dash: {
          to: { 'stroke-dashoffset': '-24' }
        }
      }
    },
  },
  plugins: [],
}
