## Statsig
The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.

**Kind**: global constant  

* [statsig](#statsig)
    * [.initialize(sdkKey, [user], [options])](#statsig.initialize) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.checkGate(gateName)](#statsig.checkGate) ⇒ <code>boolean</code>
    * [.getConfig(configName)](#statsig.getConfig) ⇒ [<code>DynamicConfig</code>](#DynamicConfig) \| <code>null</code>
    * [.logEvent(eventName, [value], [metadata])](#statsig.logEvent) ⇒ <code>void</code>
    * [.updateUser(newUser)](#statsig.updateUser) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.isReady()](#statsig.isReady) ⇒ <code>boolean</code>
    * [.shutdown()](#statsig.shutdown)

<a name="statsig.initialize"></a>

### statsig.initialize(sdkKey, [user], [options]) ⇒ <code>Promise.&lt;void&gt;</code>
Initializes the statsig SDK.  This must be called and complete before checking gates/configs or logging.

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - a promise which rejects only if you fail to provide a proper SDK Key
**Throws**: Error if an invalid SDK Key is provided

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| sdkKey | <code>string</code> |  | a SDK key, generated from the statsig developer console |
| [user] | [<code>StatsigUser</code>](#StatsigUser) | <code>{}</code> | an object containing user attributes.  Pass a stable identifier as the key when possible, and any other attributes you have (ip, country, etc.) in order to use advanced gate conditions |
| [options] | [<code>StatsigOptions</code>](#StatsigOptions) | <code>{}</code> | manual sdk configuration for advanced setup |

<a name="statsig.checkGate"></a>

### statsig.checkGate(gateName) ⇒ <code>boolean</code>
Checks the value of a gate for the current user

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>boolean</code> - - value of a gate for the user. Gates are "off" (return false) by default  

| Param | Type | Description |
| --- | --- | --- |
| gateName | <code>string</code> | the name of the gate to check |

<a name="statsig.getConfig"></a>

### statsig.getConfig(configName) ⇒ [<code>DynamicConfig</code>](#DynamicConfig) \| <code>null</code>
Checks the value of a config for the current user

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: [<code>DynamicConfig</code>](#DynamicConfig) - - value of a config for the user  

| Param | Type | Description |
| --- | --- | --- |
| configName | <code>string</code> | the name of the config to get |

<a name="statsig.logEvent"></a>

### statsig.logEvent(eventName, [value], [metadata]) ⇒ <code>void</code>
Log an event for data analysis and alerting or to measure the impact of an experiment

**Kind**: static method of [<code>statsig</code>](#statsig)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| eventName | <code>string</code> |  | the name of the event (eventName = 'Purchase') |
| [value] | <code>string</code> \| <code>number</code> | <code>null</code> | the value associated with the event (value = 10) |
| [metadata] | <code>Record.&lt;string, string&gt;</code> | <code></code> | other attributes associated with this event (metadata = {item_name: 'banana', currency: 'USD'}) |

<a name="statsig.updateUser"></a>

### statsig.updateUser(newUser) ⇒ <code>Promise.&lt;boolean&gt;</code>
Switches the user associated with calls to fetch gates/configs from statsig. This client SDK is intended for single user environments, but its possible a user was unknown previously and then logged in, or logged out and switched to a different account.  Use this function to update the gates/configs and associate event logs with the user.

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - - a promise which *always resolves* to a value which indicates success or failure  

| Param | Type | Description |
| --- | --- | --- |
| updatedUser | [<code>StatsigUser</code>](#StatsigUser) | a set of user attributes identifying the user |

<a name="statsig.isReady"></a>

### statsig.isReady() ⇒ <code>boolean</code>
Checks to see if the SDK is in a ready state to check gates and configs
If the SDK is initializing, or switching users, it is not in a ready state.

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>boolean</code> - if the SDK is ready  

<a name="statsig.shutdown"></a>

### statsig.shutdown()
Informs the statsig SDK that the client is closing or shutting down
so the SDK can clean up internal state

**Kind**: static method of [<code>statsig</code>](#statsig)  


* [.StatsigUser](#StatsigUser) : <code>Object.&lt;string, \*&gt;</code>
* [.StatsigOptions](#StatsigOptions) : <code>Object.&lt;string, \*&gt;</code>
* [.DynamicConfig](#DynamicConfig) : <code>Object</code>

<a name="StatsigUser"></a>

### StatsigUser : <code>Object.&lt;string, \*&gt;</code>
An object of properties relating to the current user

**Properties**

| Name | Type |
| --- | --- |
| [userID] | <code>string</code> \| <code>number</code> | 
| [email] | <code>string</code> | 
| [ip] | <code>string</code> | 
| [userAgent] | <code>string</code> | 
| [country] | <code>string</code> | 
| [locale] | <code>string</code> | 
| [clientVersion] | <code>string</code> | 
| [name] | <code>string</code> | 
| [custom] | <code>Object.&lt;string, (string\|number\|boolean\|Array.&lt;string&gt;)&gt;</code> | 

<a name="StatsigOptions"></a>

### StatsigOptions : <code>Object.&lt;string, \*&gt;</code>
An object of properties for initializing the sdk with advanced options

**Properties**

| Name | Type |
| --- | --- |
| [api] | <code>string</code> | 

<a name="DynamicConfig"></a>

## DynamicConfig : <code>object</code>
A class for fetching the json data configured for a DynamicConfig in the statsig console

**Kind**: global namespace  

* [DynamicConfig](#DynamicConfig) : <code>object</code>
    * [.getValue([key], [defaultValue])](#DynamicConfig+getValue) ⇒ <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code>
    * [.get([key], [defaultValue])](#DynamicConfig+get) ⇒ <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code>

<a name="DynamicConfig+getValue"></a>

### dynamicConfig.getValue([key], [defaultValue]) ⇒ <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code>
With no parameters, returns the JSON object representing this config (or null if not found)
With a key parameter, returns the value at that index in the JSON object, or null if not found
With a key and a defaultValue, returns the value at that index, or the provided default if not found

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | The index of the config to check |
| [defaultValue] | <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code> | <code></code> | The default value of the parameter to return in cases where the parameter is not found |

<a name="DynamicConfig+get"></a>

### dynamicConfig.get([key], [defaultValue]) ⇒ <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code>
A generic, type sensitive getter, which returns the value at the given index in the config if it matches the type of the default value,
and returns the default value otherwise

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  
