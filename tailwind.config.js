/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1A3C5E",
        secondary: "#27AE60",
        tertiary: "#E69200",
        error: "#BA1A1A",
        bg: "#F5F7FA",
        card: "#FFFFFF",
        text: "#1A1A2E",
        text2: "#43474E",
        border: "#E5E7EB",
      },
      borderRadius: {
        button: "10px",
        card: "16px",
        pill: "999px",
      },
      fontFamily: {
        display: ["DM Sans", "sans-serif"],
        numeric: ["DM Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
        labels: ["Inter", "sans-serif"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        gutter: "16px",
      },
    },
  },
  plugins: [],
}
