/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E53935',
          dark: '#C62828',
          light: '#FFEBEE',
          hover: '#D32F2F',
        },
        health: {
          dark: '#0F172A',
          slate: '#334155',
          muted: '#64748B',
          light: '#F8FAFC',
        }
      },
      boxShadow: {
        'soft': '0 10px 25px -5px rgba(229, 57, 53, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
