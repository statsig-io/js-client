import DynamicConfig, { OnDefaultValueFallback } from './DynamicConfig';
import Layer, { LogParameterFunction } from './Layer';
import { IHasStatsigInternal, StatsigOverrides } from './StatsigClient';
import BootstrapValidator from './utils/BootstrapValidator';
import { StatsigUser } from './StatsigUser';
import {
  INTERNAL_STORE_KEY,
  OVERRIDES_STORE_KEY,
  STICKY_DEVICE_EXPERIMENTS_KEY,
} from './utils/Constants';
import {
  djb2Hash,
  sha256Hash,
  getUserCacheKey,
  UserCacheKey,
  djb2HashForObject,
} from './utils/Hashing';
import StatsigAsyncStorage from './utils/StatsigAsyncStorage';
import StatsigLocalStorage from './utils/StatsigLocalStorage';
import { UserPersistentStorageInterface } from './StatsigSDKOptions';
import { EvaluationReason } from './utils/EvaluationReason';
import { verifySDKKeyUsed } from './utils/ResponseVerification';

export type EvaluationDetails = {
  time: number;
  reason: EvaluationReason;
};

type APIFeatureGate = {
  name: string;
  value: boolean;
  rule_id: string;
  group_name?: string;
  id_type?: string;
  secondary_exposures: [];
};

export type StoreGateFetchResult = {
  gate: APIFeatureGate;
  evaluationDetails: EvaluationDetails;
};

type APIDynamicConfig = {
  name: string;
  value: { [key: string]: unknown };
  rule_id: string;
  group_name?: string;
  id_type?: string;
  secondary_exposures: [];
  is_device_based?: boolean;
  is_user_in_experiment?: boolean;
  is_experiment_active?: boolean;
  allocated_experiment_name: string | null;
  undelegated_secondary_exposures?: [];
  explicit_parameters?: string[];
};

type APIInitializeData = {
  dynamic_configs: Record<string, APIDynamicConfig | undefined>;
  feature_gates: Record<string, APIFeatureGate | undefined>;
  layer_configs: Record<string, APIDynamicConfig | undefined>;
  has_updates?: boolean;
  time: number;
  hash_used?: 'djb2' | 'sha256' | 'none';
  derived_fields?: Record<string, string>;
};

type APIInitializeDataWithDeltas = APIInitializeData & {
  deleted_configs?: string[];
  deleted_gates?: string[];
  deleted_layers?: string[];
  is_delta?: boolean;
  checksum?: string;
  deltas_full_response?: {
    dynamic_configs: Record<string, APIDynamicConfig | undefined>;
    feature_gates: Record<string, APIFeatureGate | undefined>;
    layer_configs: Record<string, APIDynamicConfig | undefined>;
  };
};

export type APIInitializeDataWithPrefetchedUsers = APIInitializeData & {
  prefetched_user_values?: Record<string, APIInitializeData>;
};

type APIInitializeDataWithDeltasWithPrefetchedUsers =
  APIInitializeDataWithDeltas & {
    prefetched_user_values?: Record<string, APIInitializeDataWithDeltas>;
  };

export type UserCacheValues = APIInitializeDataWithPrefetchedUsers & {
  sticky_experiments: Record<string, APIDynamicConfig | undefined>;
  evaluation_time?: number;
  user_hash?: string;
  stableIDUsed?: string;
};

type UserPersistentStorageData = {
  experiments: Record<string, unknown>;
};

const MAX_USER_VALUE_CACHED = 10;

export default class StatsigStore {
  private sdkInternal: IHasStatsigInternal;

  private overrides: StatsigOverrides = {
    gates: {},
    configs: {},
    layers: {},
  };

  private loaded: boolean;
  private values: Record<string, UserCacheValues | undefined>;
  private userValues: UserCacheValues;
  private stickyDeviceExperiments: Record<string, APIDynamicConfig>;
  private userCacheKey: UserCacheKey;
  private reason: EvaluationReason;
  private userPersistentStorageAdapter: UserPersistentStorageInterface | null;
  private userPersistentStorageData: UserPersistentStorageData;

  public constructor(
    sdkInternal: IHasStatsigInternal,
    initializeValues: Record<string, unknown> | null,
  ) {
    this.sdkInternal = sdkInternal;
    this.userCacheKey = this.sdkInternal.getCurrentUserCacheKey();
    this.values = {};
    this.userValues = {
      feature_gates: {},
      dynamic_configs: {},
      sticky_experiments: {},
      layer_configs: {},
      has_updates: false,
      time: 0,
      evaluation_time: 0,
      derived_fields: {},
    };
    this.stickyDeviceExperiments = {};
    this.loaded = false;
    this.reason = EvaluationReason.Uninitialized;
    this.userPersistentStorageAdapter = this.sdkInternal
      .getOptions()
      .getUserPersistentStorage();
    this.userPersistentStorageData = { experiments: {} };

    if (initializeValues) {
      this.bootstrap(initializeValues);
    } else {
      this.load();
    }
  }

  public load(): void {
    this.loadFromLocalStorage();
    this.partialLoadFromPersistentStorageAdapter();
  }

  public async loadAsync(): Promise<void> {
    await this.loadFromAsyncStorage();
    this.partialLoadFromPersistentStorageAdapter();
  }

  public updateUser(isUserPrefetched: boolean): number | null {
    this.userCacheKey = this.sdkInternal.getCurrentUserCacheKey();
    const evaluationTime = this.setUserValueFromCache(isUserPrefetched);
    this.partialLoadFromPersistentStorageAdapter();
    return evaluationTime;
  }

  public getInitializeResponseJson(): string {
    return JSON.stringify(this.userValues);
  }

  private async loadFromAsyncStorage(): Promise<void> {
    this.parseCachedValues(
      await StatsigAsyncStorage.getItemAsync(INTERNAL_STORE_KEY),
      await StatsigAsyncStorage.getItemAsync(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    // triggered for react native, when async storage is setup.  Need to update the cache key
    // as the stableID is not available when this is set in the constructor (RN/async storage clients only)
    this.userCacheKey = this.sdkInternal.getCurrentUserCacheKey();
    this.loaded = true;
  }

  public bootstrap(initializeValues: Record<string, unknown>): void {
    const key = this.sdkInternal.getCurrentUserCacheKey();
    const user = this.sdkInternal.getCurrentUser();
    const stableID =
      user?.customIDs?.stableID ??
      this.sdkInternal.getStatsigMetadata().stableID ??
      null;
    const reason = BootstrapValidator.getEvaluationReasonForBootstrap(
      user,
      initializeValues,
      stableID,
    );

    // clients are going to assume that the SDK is bootstraped after this method runs
    // if we fail to parse, we will fall back to defaults, but we dont want to throw
    // when clients try to check gates/configs/etc after this point
    this.loaded = true;
    try {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const values = initializeValues as Record<string, any>;

      this.userValues.feature_gates = values.feature_gates ?? {};
      this.userValues.dynamic_configs = values.dynamic_configs ?? {};
      this.userValues.layer_configs = values.layer_configs ?? {};
      this.userValues.evaluation_time = Date.now();
      this.userValues.time = Date.now();
      this.userValues.hash_used = values.hash_used;
      this.values[key.v3] = this.userValues;
      this.reason = reason;
      this.loadOverrides();
    } catch (_e) {
      return;
    }
  }

  private loadFromLocalStorage(): void {
    if (StatsigAsyncStorage.asyncStorage) {
      return;
    }
    this.parseCachedValues(
      StatsigLocalStorage.getItem(INTERNAL_STORE_KEY),
      StatsigLocalStorage.getItem(STICKY_DEVICE_EXPERIMENTS_KEY),
    );
    this.loaded = true;
  }

  // Currently only loads experiments, cannot rely on storage adapter for all user values.
  private partialLoadFromPersistentStorageAdapter(): void {
    if (this.userPersistentStorageAdapter) {
      const idType = this.userPersistentStorageAdapter.userIDType ?? 'userID';
      const unitID = this.sdkInternal.getCurrentUserUnitID(idType);
      if (unitID) {
        try {
          this.userPersistentStorageData = JSON.parse(
            this.userPersistentStorageAdapter.load(`${unitID}:${idType}`),
          ) as UserPersistentStorageData;
        } catch (e) {
          console.warn('Failed to load from user persistent storage.', e);
        }
        this.userValues.sticky_experiments = this.userPersistentStorageData
          .experiments as Record<string, APIDynamicConfig>;
      }
    }
  }

  private saveStickyExperimentsToPersistentStorageAdapter(): void {
    if (this.userPersistentStorageAdapter) {
      const idType = this.userPersistentStorageAdapter.userIDType ?? 'userID';
      const unitID = this.sdkInternal.getCurrentUserUnitID(idType);
      if (unitID) {
        const data: UserPersistentStorageData = {
          ...this.userPersistentStorageData,
          experiments: this.userValues.sticky_experiments,
        };
        try {
          this.userPersistentStorageAdapter.save(
            `${unitID}:${idType}`,
            JSON.stringify(data),
          );
        } catch (e) {
          console.warn(
            'Failed to save user experiment values to persistent storage.',
            e,
          );
        }
      }
    }
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  public getLastUpdateTime(
    user: StatsigUser | null,
    stableID: string,
  ): number | null {
    const requestedUserCacheKey = getUserCacheKey(
      stableID,
      user,
      this.sdkInternal.getSDKKey(),
    );
    const userValues = this.getUserValues(requestedUserCacheKey);
    const userHash = djb2HashForObject({ ...user, stableID });
    if (userValues?.user_hash == userHash) {
      return this.userValues.time;
    }
    return null;
  }

  public getPreviousDerivedFields(
    user: StatsigUser | null,
    stableID: string,
  ): Record<string, string> | undefined {
    const requestedUserCacheKey = getUserCacheKey(
      stableID,
      user,
      this.sdkInternal.getSDKKey(),
    );
    const userValues = this.getUserValues(requestedUserCacheKey);
    const userHash = djb2HashForObject({ ...user, stableID });
    if (userValues?.user_hash == userHash) {
      return this.userValues.derived_fields;
    }
    return undefined;
  }

  private parseCachedValues(
    allValues: string | null,
    deviceExperiments: string | null,
  ): void {
    try {
      this.values = allValues ? JSON.parse(allValues) : this.values;
      this.setUserValueFromCache();
    } catch (e) {
      // Cached value corrupted, remove cache
      this.removeFromStorage(INTERNAL_STORE_KEY);
    }

    try {
      const deviceExpParsed = deviceExperiments
        ? JSON.parse(deviceExperiments)
        : null;
      if (deviceExpParsed) {
        this.stickyDeviceExperiments = deviceExpParsed;
      }
    } catch (e) {
      this.removeFromStorage(STICKY_DEVICE_EXPERIMENTS_KEY);
    }

    this.loadOverrides();
  }

  private getUserValues(key: UserCacheKey) {
    return this.values[key.v3] ?? this.values[key.v2] ?? this.values[key.v1];
  }

  private setUserValueFromCache(isUserPrefetched = false): number | null {
    const cachedValues = this.getUserValues(this.userCacheKey);
    if (cachedValues == null) {
      this.resetUserValues();
      this.reason = EvaluationReason.Uninitialized;
      return null;
    }

    if (
      cachedValues.stableIDUsed != null &&
      cachedValues.stableIDUsed !== this.getStableID()
    ) {
      this.sdkInternal
        .getErrorBoundary()
        .logError(
          'stableIDChanged',
          new Error(
            `StableID changed from ${
              cachedValues.stableIDUsed
            } to ${this.getStableID()},
            override stableID ${this.sdkInternal.getOptions().getOverrideStableID()}`,
          ),
        );
    }

    this.userValues = cachedValues;
    this.reason = isUserPrefetched
      ? EvaluationReason.Prefetch
      : EvaluationReason.Cache;

    return cachedValues.evaluation_time ?? 0;
  }

  private removeFromStorage(key: string) {
    StatsigAsyncStorage.removeItemAsync(key).catch((reason) =>
      this.sdkInternal.getErrorBoundary().logError('removeFromStorage', reason),
    );
    StatsigLocalStorage.removeItem(key);
  }

  private loadOverrides(): void {
    if (this.sdkInternal.getOptions().getDisableLocalOverrides()) {
      return;
    }
    const overrides = StatsigLocalStorage.getItem(OVERRIDES_STORE_KEY);
    if (overrides != null) {
      try {
        this.overrides = JSON.parse(overrides);
      } catch (e) {
        StatsigLocalStorage.removeItem(OVERRIDES_STORE_KEY);
      }
    }
  }

  public setEvaluationReason(evalReason: EvaluationReason) {
    this.reason = evalReason;
  }

  public async save(
    user: StatsigUser | null,
    response: Record<string, unknown>,
    stableID: string,
    prefetchUsers?: Record<string, StatsigUser>,
  ): Promise<void> {
    const requestedUserCacheKey = getUserCacheKey(
      stableID,
      user,
      this.sdkInternal.getSDKKey(),
    );
    const initResponse = response as APIInitializeDataWithDeltas;

    if (initResponse.is_delta) {
      return this.saveInitDeltas(user, response, true, stableID, prefetchUsers);
    }

    this.mergeInitializeResponseIntoUserMap(
      initResponse,
      this.values,
      requestedUserCacheKey,
      user,
      (userValues) => userValues,
      stableID,
      prefetchUsers,
    );

    const userValues = this.getUserValues(requestedUserCacheKey);
    if (
      userValues &&
      requestedUserCacheKey &&
      requestedUserCacheKey.v3 === this.userCacheKey.v3
    ) {
      this.userValues = userValues;
      this.reason = EvaluationReason.Network;
    }

    this.values = await this.writeValuesToStorage(this.values);
  }

  /**
   * Persists the init values to storage, but DOES NOT update the state of the store.
   */
  public async saveWithoutUpdatingClientState(
    user: StatsigUser | null,
    response: Record<string, unknown>,
    stableID: string,
    prefetchUsers?: Record<string, StatsigUser>,
  ): Promise<void> {
    const requestedUserCacheKey = getUserCacheKey(
      stableID,
      user,
      this.sdkInternal.getSDKKey(),
    );
    const initResponse =
      response as APIInitializeDataWithDeltasWithPrefetchedUsers;

    if (initResponse.is_delta) {
      return this.saveInitDeltas(
        user,
        response,
        false,
        stableID,
        prefetchUsers,
      );
    }
    const copiedValues: Record<string, UserCacheValues | undefined> =
      JSON.parse(JSON.stringify(this.values));

    this.mergeInitializeResponseIntoUserMap(
      initResponse,
      copiedValues,
      requestedUserCacheKey,
      user,
      (userValues) => userValues,
      stableID,
      prefetchUsers,
    );

    await this.writeValuesToStorage(copiedValues);
  }

  public getDeltasMergeFunction(
    mergedValues: Record<string, UserCacheValues>,
  ): (user: UserCacheValues, key: UserCacheKey) => UserCacheValues {
    return (deltas, key) => {
      const baseValues =
        mergedValues[key.v3] ??
        mergedValues[key.v2] ??
        mergedValues[key.v1] ??
        this.getDefaultUserCacheValues();

      return this.mergeUserCacheValues(baseValues, deltas);
    };
  }

  public async saveInitDeltas(
    user: StatsigUser | null,
    response: Record<string, unknown>,
    updateState: boolean,
    stableID: string,
    prefetchUsers?: Record<string, StatsigUser>,
  ): Promise<void> {
    const requestedUserCacheKey = getUserCacheKey(
      stableID,
      user,
      this.sdkInternal.getSDKKey(),
    );
    const initResponse =
      response as APIInitializeDataWithDeltasWithPrefetchedUsers;

    const mergedValues = JSON.parse(JSON.stringify(this.values));

    // Merge delta values into the previous values
    this.mergeInitializeResponseIntoUserMap(
      initResponse,
      mergedValues,
      requestedUserCacheKey,
      user,
      this.getDeltasMergeFunction(mergedValues),
      stableID,
      prefetchUsers,
    );
    let hasBadHash = false;
    let badChecksum = undefined;
    let hashChanged = false;

    // Delete any deleted configs for prefetch users and check hash
    const cacheKeys = Object.keys(initResponse.prefetched_user_values ?? {});
    cacheKeys.forEach((userKey) => {
      const user = mergedValues[userKey];
      const reponseForUser = initResponse.prefetched_user_values?.[userKey];
      if (user && reponseForUser) {
        removeDeletedKeysFromUserValues(reponseForUser, user);
        const expectedFullHash = reponseForUser.checksum;
        const currentFullHash = djb2HashForObject({
          feature_gates: mergedValues[userKey].feature_gates,
          dynamic_configs: mergedValues[userKey].dynamic_configs,
          layer_configs: mergedValues[userKey].layer_configs,
        });
        if (expectedFullHash && expectedFullHash !== currentFullHash) {
          hasBadHash = true;
          badChecksum = currentFullHash;
        }
        if (userValues.hash_used !== initResponse.hash_used) {
          hashChanged = true;
        }
      }
    });

    // Delete any deleted configs for primary user and check hash
    const userValues =
      mergedValues[requestedUserCacheKey.v3] ??
      mergedValues[requestedUserCacheKey.v2] ??
      mergedValues[requestedUserCacheKey.v1];
    removeDeletedKeysFromUserValues(initResponse, userValues);
    const expectedFullHash = initResponse.checksum;
    const mergedConfigs = {
      feature_gates: userValues.feature_gates,
      dynamic_configs: userValues.dynamic_configs,
      layer_configs: userValues.layer_configs,
    };
    const currentFullHash = djb2HashForObject(mergedConfigs);
    if (expectedFullHash && expectedFullHash !== currentFullHash) {
      hasBadHash = true;
      badChecksum = currentFullHash;
    }

    if (userValues.hash_used !== initResponse.hash_used) {
      hashChanged = true;
    }

    if (hasBadHash || hashChanged) {
      if (initResponse.deltas_full_response != null) {
        // retry
        this.refetchAndSaveValues(
          user,
          stableID,
          prefetchUsers,
          undefined,
          badChecksum,
          hasBadHash,
          mergedConfigs,
          initResponse.deltas_full_response,
        ).catch((reason) =>
          this.sdkInternal
            .getErrorBoundary()
            .logError('refetchAndSaveValues', reason),
        );
        return;
      }
      // retry
      this.refetchAndSaveValues(
        user,
        stableID,
        prefetchUsers,
        undefined,
        badChecksum,
        hasBadHash,
      ).catch((reason) =>
        this.sdkInternal
          .getErrorBoundary()
          .logError('refetchAndSaveValues', reason),
      );
      return;
    }

    if (updateState) {
      if (userValues && requestedUserCacheKey.v3 === this.userCacheKey.v3) {
        this.userValues = userValues;
        this.reason = EvaluationReason.Network;
      }

      this.values = await this.writeValuesToStorage(mergedValues);
    } else {
      await this.writeValuesToStorage(mergedValues);
    }
  }

  private async refetchAndSaveValues(
    user: StatsigUser | null,
    stableID: string,
    prefetchUsers?: Record<string, StatsigUser>,
    timeout: number = this.sdkInternal.getOptions().getInitTimeoutMs(),
    badChecksum?: string,
    hadBadChecksum?: boolean,
    badMergedConfigs?: Record<string, unknown>,
    badFullResponse?: Record<string, unknown>,
  ): Promise<void> {
    const sinceTime = this.getLastUpdateTime(user, stableID);
    const previousDerivedFields = this.getPreviousDerivedFields(user, stableID);

    return this.sdkInternal
      .getNetwork()
      .fetchValues({
        user,
        sinceTime,
        timeout,
        useDeltas: false,
        prefetchUsers,
        previousDerivedFields,
        hadBadDeltaChecksum: hadBadChecksum,
        badChecksum,
        badMergedConfigs,
        badFullResponse,
      })
      .then((json) => {
        if (
          !verifySDKKeyUsed(
            json,
            this.sdkInternal.getSDKKey(),
            this.sdkInternal.getErrorBoundary(),
          )
        ) {
          return;
        }
        if (json?.has_updates) {
          this.saveWithoutUpdatingClientState(
            user,
            json,
            stableID,
            prefetchUsers,
          ).catch((reason) =>
            this.sdkInternal
              .getErrorBoundary()
              .logError('refetchAndSaveValues:then', reason),
          );
        }
      })
      .catch((reason) =>
        this.sdkInternal
          .getErrorBoundary()
          .logError('refetchAndSaveValues', reason),
      );
  }

  private getStableID(): string {
    return this.sdkInternal.getStableID();
  }

  /**
   * Merges the provided init configs into the provided config map, according to the provided merge function
   */
  public mergeInitializeResponseIntoUserMap(
    data: APIInitializeDataWithPrefetchedUsers,
    configMap: Record<string, UserCacheValues | undefined>,
    requestedUserCacheKey: UserCacheKey,
    user: StatsigUser | null,
    mergeFn: (user: UserCacheValues, key: UserCacheKey) => UserCacheValues,
    stableID: string,
    prefetchUsers?: Record<string, StatsigUser>,
  ) {
    if (data.prefetched_user_values) {
      const cacheKeys = Object.keys(data.prefetched_user_values);
      for (const key of cacheKeys) {
        const prefetched = data.prefetched_user_values[key];
        const values = mergeFn(
          this.convertAPIDataToCacheValues(prefetched, key),
          { v1: key, v2: key, v3: key },
        );
        if (prefetchUsers) {
          const userHash = djb2HashForObject(prefetchUsers[key]);
          values.user_hash = userHash;
          values.stableIDUsed = stableID;
        }
        configMap[key] = values;
      }
    }

    if (requestedUserCacheKey) {
      const requestedUserValues = this.convertAPIDataToCacheValues(
        data,
        requestedUserCacheKey.v3,
      );
      const userHash = djb2HashForObject({
        ...user,
        stableID: stableID,
      });
      requestedUserValues.user_hash = userHash;
      requestedUserValues.stableIDUsed = stableID;

      configMap[requestedUserCacheKey.v3] = mergeFn(
        requestedUserValues,
        requestedUserCacheKey,
      );
    }
  }

  private getDefaultUserCacheValues(): UserCacheValues {
    return {
      feature_gates: {},
      layer_configs: {},
      dynamic_configs: {},
      sticky_experiments: {},
      time: 0,
      evaluation_time: 0,
      derived_fields: {},
    };
  }

  private mergeUserCacheValues(
    baseValues: UserCacheValues,
    valuesToMerge: UserCacheValues,
  ): UserCacheValues {
    return {
      feature_gates: {
        ...baseValues.feature_gates,
        ...valuesToMerge.feature_gates,
      },
      layer_configs: {
        ...baseValues.layer_configs,
        ...valuesToMerge.layer_configs,
      },
      dynamic_configs: {
        ...baseValues.dynamic_configs,
        ...valuesToMerge.dynamic_configs,
      },
      sticky_experiments: baseValues.sticky_experiments,
      time: valuesToMerge.time,
      evaluation_time: valuesToMerge.evaluation_time,
      derived_fields: valuesToMerge.derived_fields,
      hash_used: valuesToMerge.hash_used,
      user_hash: valuesToMerge.user_hash,
      stableIDUsed: valuesToMerge.stableIDUsed,
    };
  }

  /**
   * Writes the provided values to storage, truncating down to
   * MAX_USER_VALUE_CACHED number entries.
   * @returns The truncated entry list
   */
  private async writeValuesToStorage(
    valuesToWrite: Record<string, UserCacheValues | undefined>,
  ): Promise<Record<string, UserCacheValues | undefined>> {
    // delete the older version of cache
    if (valuesToWrite[this.userCacheKey.v3]) {
      delete valuesToWrite[this.userCacheKey.v2];
      delete valuesToWrite[this.userCacheKey.v1];
    } else if (valuesToWrite[this.userCacheKey.v2]) {
      delete valuesToWrite[this.userCacheKey.v1];
    }

    // trim values to only have the max allowed
    const filteredValues = Object.entries(valuesToWrite)
      .sort(({ 1: a }, { 1: b }) => {
        if (a == null) {
          return 1;
        }
        if (b == null) {
          return -1;
        }
        return (
          (b?.evaluation_time ?? b?.time) - (a?.evaluation_time ?? a?.time)
        );
      })
      .slice(0, MAX_USER_VALUE_CACHED);
    valuesToWrite = Object.fromEntries(filteredValues);
    if (StatsigAsyncStorage.asyncStorage) {
      await StatsigAsyncStorage.setItemAsync(
        INTERNAL_STORE_KEY,
        JSON.stringify(valuesToWrite),
      );
    } else {
      StatsigLocalStorage.setItem(
        INTERNAL_STORE_KEY,
        JSON.stringify(valuesToWrite),
      );
    }

    return valuesToWrite;
  }

  public checkGate(
    gateName: string,
    ignoreOverrides = false,
  ): StoreGateFetchResult {
    const gateNameHash = this.getHashedSpecName(gateName);
    let gateValue: APIFeatureGate = {
      name: gateName,
      value: false,
      rule_id: '',
      secondary_exposures: [],
    };
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.gates[gateName] != null) {
      gateValue = {
        name: gateName,
        value: this.overrides.gates[gateName],
        rule_id: 'override',
        secondary_exposures: [],
      };
      details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
    } else {
      const value = this.userValues?.feature_gates[gateNameHash];
      if (value) {
        gateValue = value;
      }
      details = this.getEvaluationDetails(value != null);
    }

    return { evaluationDetails: details, gate: gateValue };
  }

  public getConfig(configName: string, ignoreOverrides = false): DynamicConfig {
    const configNameHash = this.getHashedSpecName(configName);
    let configValue: DynamicConfig;
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.configs[configName] != null) {
      details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
      configValue = new DynamicConfig(
        configName,
        this.overrides.configs[configName],
        'override',
        details,
        [],
        '',
        this.makeOnConfigDefaultValueFallback(
          this.sdkInternal.getCurrentUser(),
        ),
      );
    } else if (this.userValues?.dynamic_configs[configNameHash] != null) {
      const rawConfigValue = this.userValues?.dynamic_configs[configNameHash];
      details = this.getEvaluationDetails(true);
      configValue = this.createDynamicConfig(
        configName,
        rawConfigValue,
        details,
      );
    } else {
      details = this.getEvaluationDetails(false);
      configValue = new DynamicConfig(configName, {}, '', details);
    }

    return configValue;
  }

  public getExperiment(
    expName: string,
    keepDeviceValue = false,
    ignoreOverrides = false,
  ): DynamicConfig {
    let exp: DynamicConfig;
    let details: EvaluationDetails;
    if (!ignoreOverrides && this.overrides.configs[expName] != null) {
      details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
      exp = new DynamicConfig(
        expName,
        this.overrides.configs[expName],
        'override',
        details,
      );
    } else {
      const latestValue = this.getLatestValue(expName, 'dynamic_configs');
      details = this.getEvaluationDetails(latestValue != null);

      const finalValue = this.getPossiblyStickyValue(
        expName,
        latestValue,
        keepDeviceValue,
        false /* isLayer */,
        details,
      );
      exp = this.createDynamicConfig(expName, finalValue, details);
    }

    return exp;
  }

  public getLayer(
    logParameterFunction: LogParameterFunction | null,
    layerName: string,
    keepDeviceValue: boolean,
  ): Layer {
    if (this.overrides.layers[layerName] != null) {
      const details = this.getEvaluationDetails(
        false,
        EvaluationReason.LocalOverride,
      );
      return Layer._create(
        layerName,
        this.overrides.layers[layerName] ?? {},
        'override',
        details,
        logParameterFunction,
      );
    }

    const latestValue = this.getLatestValue(layerName, 'layer_configs');
    const details = this.getEvaluationDetails(latestValue != null);
    const finalValue = this.getPossiblyStickyValue(
      layerName,
      latestValue,
      keepDeviceValue,
      true /* isLayer */,
      details,
    );

    return Layer._create(
      layerName,
      finalValue?.value ?? {},
      finalValue?.rule_id ?? '',
      details,
      logParameterFunction,
      finalValue?.secondary_exposures,
      finalValue?.undelegated_secondary_exposures,
      finalValue?.allocated_experiment_name ?? '',
      finalValue?.explicit_parameters,
      finalValue?.group_name,
    );
  }

  public overrideConfig(
    configName: string,
    value: Record<string, unknown>,
  ): void {
    try {
      JSON.stringify(value);
    } catch (e) {
      console.warn('Failed to stringify given config override.  Dropping', e);
      return;
    }
    this.overrides.configs[configName] = value;
    this.saveOverrides();
  }

  public overrideLayer(
    layerName: string,
    value: Record<string, unknown>,
  ): void {
    try {
      JSON.stringify(value);
    } catch (e) {
      console.warn('Failed to stringify given layer override.  Dropping', e);
      return;
    }
    this.overrides.layers[layerName] = value;
    this.saveOverrides();
  }

  public overrideGate(gateName: string, value: boolean): void {
    this.overrides.gates[gateName] = value;
    this.saveOverrides();
  }

  public removeGateOverride(gateName?: string): void {
    if (gateName == null) {
      this.overrides.gates = {};
    } else {
      delete this.overrides.gates[gateName];
    }
    this.saveOverrides();
  }

  public removeConfigOverride(configName?: string): void {
    if (configName == null) {
      this.overrides.configs = {};
    } else {
      delete this.overrides.configs[configName];
    }
    this.saveOverrides();
  }

  public removeLayerOverride(layerName?: string): void {
    if (layerName == null) {
      this.overrides.layers = {};
    } else {
      delete this.overrides.layers[layerName];
    }
    this.saveOverrides();
  }

  public getAllOverrides(): StatsigOverrides {
    return this.overrides;
  }

  private saveOverrides(): void {
    try {
      StatsigLocalStorage.setItem(
        OVERRIDES_STORE_KEY,
        JSON.stringify(this.overrides),
      );
    } catch (e) {
      console.warn('Failed to persist gate/config overrides');
    }
  }

  private getLatestValue(
    name: string,
    topLevelKey: 'layer_configs' | 'dynamic_configs',
  ): APIDynamicConfig | undefined {
    const hash = this.getHashedSpecName(name);
    return (
      this.userValues?.[topLevelKey]?.[hash] ??
      this.userValues?.[topLevelKey]?.[name]
    );
  }

  // Sticky Logic: https://gist.github.com/daniel-statsig/3d8dfc9bdee531cffc96901c1a06a402
  private getPossiblyStickyValue(
    name: string,
    latestValue: APIDynamicConfig | undefined,
    keepDeviceValue: boolean,
    isLayer: boolean,
    details: EvaluationDetails,
  ): APIDynamicConfig | undefined {
    const key = this.getHashedSpecName(name);

    // We don't want sticky behavior. Clear any sticky values and return latest.
    if (!keepDeviceValue) {
      this.removeStickyValue(key);
      return latestValue;
    }

    // If there is no sticky value, save latest as sticky and return latest.
    const stickyValue = this.getStickyValue(key);
    if (!stickyValue) {
      this.attemptToSaveStickyValue(key, latestValue);
      return latestValue;
    }

    // Get the latest config value. Layers require a lookup by allocated_experiment_name.
    let latestExperimentValue = null;
    if (isLayer) {
      latestExperimentValue = this.getLatestValue(
        stickyValue?.allocated_experiment_name ?? '',
        'dynamic_configs',
      );
    } else {
      latestExperimentValue = latestValue;
    }

    if (latestExperimentValue?.is_experiment_active == true) {
      details.reason = EvaluationReason.Sticky;
      return stickyValue;
    }

    if (latestValue?.is_experiment_active == true) {
      this.attemptToSaveStickyValue(key, latestValue);
    } else {
      this.removeStickyValue(key);
    }

    return latestValue;
  }

  private createDynamicConfig(
    name: string,
    apiConfig: APIDynamicConfig | undefined,
    details: EvaluationDetails,
  ) {
    return new DynamicConfig(
      name,
      apiConfig?.value ?? {},
      apiConfig?.rule_id ?? '',
      details,
      apiConfig?.secondary_exposures,
      apiConfig?.allocated_experiment_name ?? '',
      this.makeOnConfigDefaultValueFallback(this.sdkInternal.getCurrentUser()),
      apiConfig?.group_name,
      apiConfig?.id_type,
      apiConfig?.is_experiment_active,
    );
  }

  private getStickyValue(key: string): APIDynamicConfig | null {
    return (
      this.userValues?.sticky_experiments[key] ??
      this.stickyDeviceExperiments[key]
    );
  }

  private attemptToSaveStickyValue(key: string, config?: APIDynamicConfig) {
    if (
      !config ||
      !config.is_user_in_experiment ||
      !config.is_experiment_active
    ) {
      return;
    }

    if (config.is_device_based === true) {
      // save sticky values in memory
      this.stickyDeviceExperiments[key] = config;
    } else if (this.userValues?.sticky_experiments) {
      this.userValues.sticky_experiments[key] = config;
    }
    // also save to persistent storage
    this.saveStickyValuesToStorage();
  }

  private removeStickyValue(key: string) {
    if (
      Object.keys(this.userValues?.sticky_experiments ?? {}).length === 0 &&
      Object.keys(this.stickyDeviceExperiments ?? {}).length === 0
    ) {
      return;
    }

    delete this.userValues?.sticky_experiments[key];
    delete this.stickyDeviceExperiments[key];
    this.saveStickyValuesToStorage();
  }

  private saveStickyValuesToStorage() {
    if (this.userPersistentStorageAdapter) {
      this.saveStickyExperimentsToPersistentStorageAdapter();
    } else {
      this.values[this.userCacheKey.v3] = this.userValues;
      this.setItemToStorage(INTERNAL_STORE_KEY, JSON.stringify(this.values));
      this.setItemToStorage(
        STICKY_DEVICE_EXPERIMENTS_KEY,
        JSON.stringify(this.stickyDeviceExperiments),
      );
    }
  }

  public getGlobalEvaluationDetails(): EvaluationDetails {
    return {
      reason: this.reason ?? EvaluationReason.Uninitialized,
      time: this.userValues.evaluation_time ?? 0,
    };
  }

  private getEvaluationDetails(
    valueExists: boolean,
    reasonOverride?: EvaluationReason,
  ): EvaluationDetails {
    if (valueExists) {
      return {
        reason: this.reason,
        time: this.userValues.evaluation_time ?? Date.now(),
      };
    } else {
      return {
        reason:
          reasonOverride ??
          (this.reason == EvaluationReason.Uninitialized
            ? EvaluationReason.Uninitialized
            : EvaluationReason.Unrecognized),
        time: Date.now(),
      };
    }
  }

  private resetUserValues() {
    this.userValues = {
      feature_gates: {},
      dynamic_configs: {},
      sticky_experiments: {},
      layer_configs: {},
      time: 0,
      evaluation_time: 0,
      derived_fields: {},
    };
  }

  private getHashedSpecName(input: string): string {
    switch (this.userValues.hash_used) {
      case 'djb2':
        return djb2Hash(input);
      case 'none':
        return input;
      default:
        return sha256Hash(input);
    }
  }

  private convertAPIDataToCacheValues(
    data: APIInitializeData,
    cacheKey: string,
  ): UserCacheValues {
    // Specifically pulling keys from data here to avoid pulling in unwanted keys
    return {
      feature_gates: data.feature_gates,
      layer_configs: data.layer_configs,
      dynamic_configs: data.dynamic_configs,
      sticky_experiments: this.values[cacheKey]?.sticky_experiments ?? {},
      time: data.time == null || isNaN(data.time) ? 0 : data.time,
      evaluation_time: Date.now(),
      hash_used: data.hash_used,
      derived_fields: data.derived_fields,
    };
  }

  private setItemToStorage(key: string, value: string) {
    if (StatsigAsyncStorage.asyncStorage) {
      StatsigAsyncStorage.setItemAsync(key, value).catch((reason) => {
        void this.sdkInternal
          .getErrorBoundary()
          .logError('setItemToStorage', reason);
      });
    } else {
      StatsigLocalStorage.setItem(key, value);
    }
  }

  private makeOnConfigDefaultValueFallback(
    user: StatsigUser | null,
  ): OnDefaultValueFallback {
    return (config, parameter, defaultValueType, valueType) => {
      if (!this.isLoaded()) {
        return;
      }

      this.sdkInternal.getLogger().logConfigDefaultValueFallback(
        user,
        `Parameter ${parameter} is a value of type ${valueType}.
          Returning requested defaultValue type ${defaultValueType}`,
        {
          name: config.getName(),
          ruleID: config.getRuleID(),
          parameter,
          defaultValueType,
          valueType,
        },
      );
    };
  }
}

function removeDeletedKeysFromUserValues(
  initResponse: APIInitializeDataWithDeltasWithPrefetchedUsers,
  userValues: UserCacheValues,
) {
  (initResponse.deleted_configs ?? []).forEach((key) => {
    delete userValues.dynamic_configs[key];
  });
  (initResponse.deleted_gates ?? []).forEach((key) => {
    delete userValues.feature_gates[key];
  });
  (initResponse.deleted_layers ?? []).forEach((key) => {
    delete userValues.layer_configs[key];
  });
}
