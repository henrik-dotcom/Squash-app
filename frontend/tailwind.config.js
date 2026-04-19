/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    colors: {
      'squash-dark': '#0d1117',
      'squash-darker': '#010409',
      'squash-accent': '#238636',
      'squash-blue': '#1f6feb',
      'squash-red': '#ff4455',
      'squash-green': '#44ff77',
      'gray': {
        '100': '#e8e8f0',
        '200': '#d0d0d8',
        '300': '#b8b8c0',
        '400': '#a0a0a8',
        '600': '#555',
        '700': '#333',
        '800': '#111120',
        '900': '#0a0a0f',
      },
      'black': '#000',
      'white': '#fff',
      'orange': {
        '500': '#ff8855',
      },
      'red': {
        '900': '#4a1a1a',
      },
      'blue': {
        '900': '#1a3a4a',
      },
      'green': {
        '500': '#44ff77',
      },
    },
    extend: {},
  },
  plugins: [],
}
