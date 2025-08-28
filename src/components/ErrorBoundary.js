import React from "react";
import { toast } from "react-toastify";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Check if this is a theme-related error
    const isThemeError =
      error?.message?.includes("Cannot convert undefined or null to object") &&
      (error?.stack?.includes("Object.entries") ||
        error?.stack?.includes("theme") ||
        error?.stack?.includes("Styled"));

    const errorMessage = isThemeError
      ? "A theme error occurred. This might be due to connection issues. Please refresh the page."
      : "Something went wrong. Please refresh the page or try again later.";

    // Show a toast notification for the error
    toast.error(errorMessage, {
      toastId: "error-boundary",
      icon: "❌",
      autoClose: 10000,
    });

    // Log error to external service if needed
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    return this.props.children;
  }
}

export default ErrorBoundary;
