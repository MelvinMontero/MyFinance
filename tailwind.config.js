/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta inicial — refinaremos en Fase 7
        brand: {
          50: '#f0fdf4',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
      spacing: {
        // Sistema basado en múltiplos de 4 (sección 9 del spec)
      },
    },
  },
  plugins: [],
};
