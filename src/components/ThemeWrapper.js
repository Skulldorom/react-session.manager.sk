import React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Fallback theme for when the main app theme is not available
const fallbackTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc3545",
    },
    error: {
      main: "#d32f2f",
    },
    warning: {
      main: "#ed6c02",
    },
    info: {
      main: "#0288d1",
    },
    success: {
      main: "#2e7d32",
    },
  },
});

const ThemeWrapper = ({ children, theme }) => {
  // Use the provided theme or fallback theme
  const safeTheme = theme || fallbackTheme;

  return <ThemeProvider theme={safeTheme}>{children}</ThemeProvider>;
};

export default ThemeWrapper;
