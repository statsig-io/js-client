import DynamicConfig from '../DynamicConfig';

//@ts-ignore
global.console = {
  log: console.log, // console.log are kept in tests for debugging

  // Mock other console functions so they don't pollute the console when running test
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchConfig(config: DynamicConfig): R;
    }
  }
}

expect.extend({
  toMatchConfig(
    this: jest.MatcherContext,
    received: DynamicConfig,
    expected: DynamicConfig,
  ) {
    if (received.getName() !== expected.getName()) {
      return {
        pass: false,
        message: () =>
          `Expected name of DynamicConfig: ${received.getName()} to match: ${expected.getName()}`,
      };
    }
    if (received.getRuleID() !== expected.getRuleID()) {
      return {
        pass: false,
        message: () =>
          `Expected ruleID of DynamicConfig: ${received.getRuleID()} to match: ${expected.getRuleID()}`,
      };
    }
    if (Object.is(received.getValue(), expected.getValue())) {
      return {
        pass: false,
        message: () =>
          `Expected value of DynamicConfig: ${JSON.stringify(
            received.getValue(),
          )} to match: ${JSON.stringify(expected.getValue())}`,
      };
    }

    return {
      pass: true,
      message: () =>
        `Expected ${received} not to be the same DynamicConfig as ${expected}`,
    };
  },
});
