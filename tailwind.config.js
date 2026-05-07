// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fern: '#4A5940', // deep green — primary brand
        dark: '#3D4A34', // darker green — headings
        sage: '#D4DCCA', // pale green — backgrounds
        moss: '#BFCAAD', // mid green — borders, accents
        clay: '#C8B99A', // warm tan — warmth & rules
        linen: '#C4B5A0', // neutral warm
        oat: '#D6C5B0', // light tan — secondary backgrounds
        parchment: '#F7F4EF', // off-white — page background
        leaf: '#EEF0E8', // very light green — card backgrounds
        muted: '#6b6b5e', // body text
        subtle: '#8A7E6E', // secondary text, labels
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Inter', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
