/**
 * The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.
 */
declare namespace statsig {
  /**
   * Initializes the statsig SDK.  This must be called and complete before checking gates/configs or logging.
   * @param {string} sdkKey - a SDK key, generated from the statsig developer console
   * @param {typedefs.StatsigUser} [user={}] - an object containing user attributes.  Pass a stable identifier as the key when possible, and any other attributes you have (ip, country, etc.) in order to use advanced gate conditions
   * @param {typedefs.StatsigOptions} [options={}] - manual sdk configuration for advanced setup
   * @returns {Promise<void>} - a promise which rejects only if you fail to provide a proper SDK Key
   * @throws Error if an invalid SDK Key is provided
   */
  function initialize(
    sdkKey: string,
    user?: StatsigUser | null,
    options?: StatsigOptions | null,
  ): Promise<void>;

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   */
  function checkGate(gateName: string): boolean;

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @returns {DynamicConfig} - value of a config for the user
   */
  function getConfig(configName: string): DynamicConfig;

  /**
   * Log an event for data analysis and alerting or to measure the impact of an experiment
   * @param {string} eventName - the name of the event (eventName = 'Purchase')
   * @param {?string|number} [value=null] - the value associated with the event (value = 10)
   * @param {?Record<string, string>} [metadata=null] - other attributes associated with this event (metadata = {item_name: 'banana', currency: 'USD'})
   * @returns {void}
   */
  function logEvent(
    eventName: string,
    value?: string | number,
    metadata?: Record<string, string>,
  ): void;

  /**
   * Updates the user associated with calls to fetch gates/configs from statsig. This client SDK is intended for single user environments, but its possible a user was unknown previously and then logged in, or logged out and switched to a different account.  Use this function to update the gates/configs and associate event logs with the user.
   * @param {typedefs.StatsigUser} updatedUser - a set of user attributes identifying the user
   * @returns {Promise<boolean>} - a promise which *always resolves* to a value which indicates success or failure
   */
  function updateUser(newUser: StatsigUser): Promise<boolean>;

  /**
   * Checks to see if the SDK is in a ready state to check gates and configs
   * If the SDK is initializing, or switching users, it is not in a ready state.
   * @returns {boolean} if the SDK is ready
   */
  function isReady(): boolean;

  /**
   * Informs the statsig SDK that the client is closing or shutting down
   * so the SDK can clean up internal state
   */
  function shutdown(): void;

  /**
   * An object of properties relating to the current user
   * Provide as many as possible to take advantage of advanced conditions in the statsig console
   * A dictionary of additional fields can be provided under the "custom" field
   */
  export type StatsigUser = {
    userID?: string | number;
    email?: string;
    ip?: string;
    userAgent?: string;
    country?: string;
    locale?: string;
    clientVersion?: string;
    custom?: Record<string, string | number | boolean | Array<string>>;
  };

  /**
   * An object of properties for initializing the sdk with advanced options
   */
  export type StatsigOptions = {
    api?: string;
  };

  /**
   * A class for fetching the json data configured for a DynamicConfig in the statsig console
   */
  export type DynamicConfig = {
    value: any;
    getRawValue: () => string | number | boolean | Record<string, any>;
    getBool: (name: string, defaultValue: boolean) => boolean;
    getNumber: (name: string, defaultValue: number) => number;
    getString: (name: string, defaultValue: string) => string;
    getArray: (name: string, defaultValue: Array<any>) => Array<any>;
    getObject: (name: string, defaultValue: object) => DynamicConfig;
  };
}

export default statsig;

declare module 'statsig-react-native-sdk' {
  export default statsig;
}
