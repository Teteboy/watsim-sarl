/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          watsim: {
            primaryDark: '#014945',
            primaryGreen: '#4DB049',
            secondaryGreen: '#196D43',
            deepTeal: '#014A41',
            offWhite: '#FAFEF9',
            white: '#FFFFFF',
            cardBg: '#FFFFFF',
            textPrimary: '#0A2420',
            textSecondary: '#4A6662',
            textMuted: '#8AABA7',
            divider: '#E8F2F1',
            success: '#4DB049',
            error: '#E53935',
            warning: '#FFA726',
          },
        },
        fontFamily: {
          'dm-sans': ['DM Sans', 'sans-serif'],
          'poppins': ['Poppins', 'sans-serif'],
          'montserrat': ['Montserrat', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }