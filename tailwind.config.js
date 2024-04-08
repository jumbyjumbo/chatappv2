/** @type {import('tailwindcss').Config} */

const shadowOpacity = 0.6;
const pixelSize = 12; // Variable for pixel size

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        helvetica: ['helvetica', 'sans-serif'],
        cascadia: ['cascadia', 'sans-serif'],
      },
      boxShadow: {
        'bottomshadow': `0px ${pixelSize}px ${pixelSize}px rgba(0, 0, 0, ${shadowOpacity})`,
        'rightshadow': `${pixelSize}px 0px ${pixelSize}px rgba(0, 0, 0, ${shadowOpacity})`,
        'centeredshadow': `0 0 ${pixelSize}px rgba(0, 0, 0, ${shadowOpacity})`,
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
};
