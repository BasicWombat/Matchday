/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          50:  '#f0f7f4',
          100: '#d8ede4',
          200: '#b4d9c7',
          300: '#82b9a3',
          400: '#4f9e7c',
          500: '#2d7f5f',
          600: '#1e6449',
          700: '#195238',
          800: '#163f2c',
          900: '#0e2a1d',
          950: '#071510',
        },
        gold: {
          300: '#fde68a',
          400: '#fcd34d',
          500: '#f5c200',
          600: '#d4a600',
        },
      },
      fontFamily: {
        bebas: ['"Bebas Neue"', 'sans-serif'],
        body:  ['"DM Sans"',    'sans-serif'],
      },
    },
  },
  plugins: [],
};
