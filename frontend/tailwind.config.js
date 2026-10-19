/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gmail: {
          blue: '#1a73e8',
          hover: '#f1f3f4',
          selected: '#c2e7ff',
          selectedText: '#001d35',
          border: '#e0e0e0',
          sidebar: '#f6f8fc',
          text: '#202124',
          subtext: '#5f6368',
        }
      }
    },
  },
  plugins: [],
}
