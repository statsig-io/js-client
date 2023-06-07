import StatsigClient from '../StatsigClient';
import StatsigStore from '../StatsigStore';
import { StatsigUser } from '../StatsigUser';

const sha256GateEntry = {
  feature_gates: {
    '5v6IDYah7WmooSLkL7W3ak4pzBq5KXvJdac3tRmLnzE=': {
      name: '5v6IDYah7WmooSLkL7W3ak4pzBq5KXvJdac3tRmLnzE=',
      value: true,
      rule_id: 'sQN2LEGrBMz7qbmFqPssF',
      secondary_exposures: [],
    },
  },
  hash_used: 'sha256',
};

const implicitSha256GateEntry = {
  feature_gates: {
    '5v6IDYah7WmooSLkL7W3ak4pzBq5KXvJdac3tRmLnzE=': {
      name: '5v6IDYah7WmooSLkL7W3ak4pzBq5KXvJdac3tRmLnzE=',
      value: true,
      rule_id: 'sQN2LEGrBMz7qbmFqPssF',
      secondary_exposures: [],
    },
  },
};

const djb2GateEntry = {
  feature_gates: {
    '2867927529': {
      name: '2867927529',
      value: true,
      rule_id: 'sQN2LEGrBMz7qbmFqPssF',
      secondary_exposures: [],
    },
  },
  hash_used: 'djb2',
};

const noneGateEntry = {
  feature_gates: {
    a_gate: {
      name: 'a_gate',
      value: true,
      rule_id: 'sQN2LEGrBMz7qbmFqPssF',
      secondary_exposures: [],
    },
  },
  hash_used: 'none',
};

const emptyResponse = {
  feature_gates: {},
  dynamic_configs: {},
  layer_configs: {},
  sdkParams: {},
  has_updates: true,
  generator: 'scrapi-nest',
  time: 1680738378062,
};

describe('Bootstrap and Hashing', () => {
  const user: StatsigUser = { userID: 'a-user' };
  const client = new StatsigClient('', user, { localMode: true });

  it('works with none', () => {
    const store = new StatsigStore(client, null);
    store.bootstrap({ ...emptyResponse, ...noneGateEntry });
    expect(store.checkGate('a_gate').gate.value).toBe(true);
  });

  it('works with djb2', () => {
    const store = new StatsigStore(client, null);
    store.bootstrap({ ...emptyResponse, ...djb2GateEntry });
    expect(store.checkGate('a_gate').gate.value).toBe(true);
  });

  it('works with sha256', () => {
    const store = new StatsigStore(client, null);
    store.bootstrap({ ...emptyResponse, ...sha256GateEntry });
    expect(store.checkGate('a_gate').gate.value).toBe(true);
  });

  it('works with implicit sha256', () => {
    const store = new StatsigStore(client, null);
    store.bootstrap({ ...emptyResponse, ...implicitSha256GateEntry });
    expect(store.checkGate('a_gate').gate.value).toBe(true);
  });
});
