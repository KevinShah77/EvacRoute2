/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        danger: {
          DEFAULT: '#EF4444',
          glow: 'rgba(239, 68, 68, 0.4)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.3)',
        },
        safe: {
          DEFAULT: '#10B981',
          glow: 'rgba(16, 185, 129, 0.4)',
        },
        blocked: '#6B7280',
        user: '#3B82F6',
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
