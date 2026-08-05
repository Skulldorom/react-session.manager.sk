const path = require("node:path");

describe("consumer smoke temp root", () => {
  const originalEnv = process.env.REACT_SESSION_MANAGER_CONSUMER_TMPDIR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REACT_SESSION_MANAGER_CONSUMER_TMPDIR;
    } else {
      process.env.REACT_SESSION_MANAGER_CONSUMER_TMPDIR = originalEnv;
    }
    jest.resetModules();
  });

  it("uses REACT_SESSION_MANAGER_CONSUMER_TMPDIR when creating temp directories", () => {
    process.env.REACT_SESSION_MANAGER_CONSUMER_TMPDIR = path.join(
      "custom",
      "tmp-root"
    );

    const {
      getConsumerSmokeTempParent,
    } = require("../scripts/consumer-smoke-test.cjs");

    expect(getConsumerSmokeTempParent()).toBe(
      path.resolve("custom", "tmp-root")
    );
  });
});
