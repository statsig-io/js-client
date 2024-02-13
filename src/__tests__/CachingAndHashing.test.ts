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

describe('Caching and Hashing', () => {
  const user: StatsigUser = { userID: 'a-user' };
  const client = new StatsigClient('', user, { localMode: true });

  let store: StatsigStore;

  const resetStoreWithCachedValue = async (json: Record<string, any>) => {
    await store.save(user, { ...emptyResponse, ...json }, client.getStableID());
    store = new StatsigStore(client, null);
  };

  beforeEach(() => {
    store = new StatsigStore(client, null);
  });

  describe.each([
    ['none', noneGateEntry],
    ['djb2', djb2GateEntry],
    ['sha256', sha256GateEntry],
    ['implicit sha256', implicitSha256GateEntry],
  ])(`when cache contains '%s' hash_used`, (_hashType, cachedValue) => {
    beforeEach(async () => {
      await resetStoreWithCachedValue({
        ...emptyResponse,
        ...cachedValue,
      });
    });

    it('returns cached value', () => {
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });

    it('can switch to djb2', async () => {
      await store.save(
        user,
        { ...emptyResponse, ...djb2GateEntry },
        client.getStableID(),
      );
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });

    it('can switch to none', async () => {
      await store.save(
        user,
        { ...emptyResponse, ...noneGateEntry },
        client.getStableID(),
      );
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });

    it('can switch to implicit sha256', async () => {
      await store.save(
        user,
        {
          ...emptyResponse,
          ...implicitSha256GateEntry,
        },
        client.getStableID(),
      );
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });
  });

  describe('when cache contains sha256', () => {
    beforeEach(async () => {
      await resetStoreWithCachedValue({ ...emptyResponse, ...sha256GateEntry });
    });

    it('returns cached value', () => {
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });

    it('can switch to djb2', async () => {
      await store.save(
        user,
        { ...emptyResponse, ...djb2GateEntry },
        client.getStableID(),
      );
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });

    it('can switch to none', async () => {
      await store.save(
        user,
        { ...emptyResponse, ...noneGateEntry },
        client.getStableID(),
      );
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });

    it('can switch to implicit sha256', async () => {
      await store.save(
        user,
        {
          ...emptyResponse,
          ...implicitSha256GateEntry,
        },
        client.getStableID(),
      );
      expect(store.checkGate('a_gate').gate.value).toBe(true);
    });
  });
});
