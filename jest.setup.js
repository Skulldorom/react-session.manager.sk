import "@testing-library/jest-dom";

const originalConsoleError = console.error.bind(console);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (typeof message === "string" && /inside a test was not wrapped in act/.test(message)) return;
    originalConsoleError(message, ...args);
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
