import React from "react";
import { toast } from "react-toastify";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI only for session manager errors
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      "SessionManager ErrorBoundary caught an error:",
      error,
      errorInfo
    );

    // Since this error boundary is now specifically for session manager components,
    // we can handle all errors that reach it

    // Check if this is a theme-related error
    const isThemeError =
      error?.message?.includes("Cannot convert undefined or null to object") &&
      (error?.stack?.includes("Object.entries") ||
        error?.stack?.includes("theme") ||
        error?.stack?.includes("Styled"));

    // Check for network/connection errors
    const isNetworkError =
      error?.message?.includes("Network Error") ||
      error?.message?.includes("Request failed") ||
      error?.code === "ERR_NETWORK";

    // Check for authentication/session errors
    const isAuthError =
      error?.message?.includes("401") ||
      error?.message?.includes("403") ||
      error?.message?.includes("455") ||
      error?.response?.status === 401 ||
      error?.response?.status === 403 ||
      error?.response?.status === 455;

    let errorMessage;
    if (isThemeError) {
      errorMessage =
        "A theme error occurred. This might be due to connection issues. Please refresh the page.";
    } else if (isNetworkError) {
      errorMessage =
        "Network connection error in session manager. Please check your connection and try again.";
    } else if (isAuthError) {
      errorMessage =
        "Authentication error in session manager. You may need to log in again.";
    } else {
      errorMessage =
        "Session manager encountered an error. Please refresh the page or try again later.";
    }

    // Show a toast notification for the error
    toast.error(errorMessage, {
      toastId: "session-manager-error",
      icon: "❌",
      autoClose: 10000,
    });

    // Log error to external service if needed
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI for session manager errors
      // But still render children to avoid breaking the app completely
      return this.props.children;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
