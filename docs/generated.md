## Classes

<dl>
<dt><a href="#DynamicConfig">DynamicConfig</a></dt>
<dd></dd>
</dl>

## Objects

<dl>
<dt><a href="#typedefs">typedefs</a> : <code>object</code></dt>
<dd></dd>
</dl>

## Constants

<dl>
<dt><a href="#statsig">statsig</a></dt>
<dd><p>The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#get">get([key], [defaultValue])</a> ⇒ <code>T</code> | <code>null</code></dt>
<dd><p>A generic, type sensitive getter, which returns the value at the given index in the config if it matches the type of the default value,
and returns the default value otherwise</p>
</dd>
</dl>

<a name="DynamicConfig"></a>

## DynamicConfig
**Kind**: global class  

* [DynamicConfig](#DynamicConfig)
    * [new DynamicConfig()](#new_DynamicConfig_new)
    * [.getValue([key], [defaultValue])](#DynamicConfig.getValue) ⇒ <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code>

<a name="new_DynamicConfig_new"></a>

### new DynamicConfig()
A class for fetching the json data configured for a DynamicConfig in the statsig console

<a name="DynamicConfig.getValue"></a>

### DynamicConfig.getValue([key], [defaultValue]) ⇒ <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code>
With no parameters, returns the JSON object representing this config (or null if not found)
With a key parameter, returns the value at that index in the JSON object, or null if not found
With a key and a defaultValue, returns the value at that index, or the provided default if not found

**Kind**: static method of [<code>DynamicConfig</code>](#DynamicConfig)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [key] | <code>string</code> |  | The index of the config to check |
| [defaultValue] | <code>boolean</code> \| <code>number</code> \| <code>string</code> \| <code>object</code> \| <code>Array.&lt;any&gt;</code> \| <code>null</code> | <code></code> | The default value of the parameter to return in cases where the parameter is not found |

<a name="typedefs"></a>

## typedefs : <code>object</code>
**Kind**: global namespace  

* [typedefs](#typedefs) : <code>object</code>
    * [.StatsigUser](#typedefs.StatsigUser) : <code>Object.&lt;string, \*&gt;</code>
    * [.StatsigOptions](#typedefs.StatsigOptions) : <code>Object.&lt;string, \*&gt;</code>

<a name="typedefs.StatsigUser"></a>

### typedefs.StatsigUser : <code>Object.&lt;string, \*&gt;</code>
An object of properties relating to the current user

**Kind**: static typedef of [<code>typedefs</code>](#typedefs)  
**Properties**

| Name | Type |
| --- | --- |
| [userID] | <code>string</code> \| <code>number</code> | 
| [email] | <code>string</code> | 
| [ip] | <code>string</code> | 
| [userAgent] | <code>string</code> | 
| [country] | <code>string</code> | 
| [locale] | <code>string</code> | 
| [appVersion] | <code>string</code> | 
| [name] | <code>string</code> | 
| [custom] | <code>Object.&lt;string, (string\|number\|boolean\|Array.&lt;string&gt;)&gt;</code> | 

<a name="typedefs.StatsigOptions"></a>

### typedefs.StatsigOptions : <code>Object.&lt;string, \*&gt;</code>
An object of properties for initializing the sdk with advanced options

**Kind**: static typedef of [<code>typedefs</code>](#typedefs)  
**Properties**

| Name | Type |
| --- | --- |
| [api] | <code>string</code> | 

<a name="statsig"></a>

## statsig
The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.

**Kind**: global constant  

* [statsig](#statsig)
    * [.initialize(sdkKey, [user], [options])](#statsig.initialize) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.checkGate(gateName)](#statsig.checkGate) ⇒ <code>boolean</code>
    * [.getConfig(configName)](#statsig.getConfig) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
    * [.getExperiment(experimentName)](#statsig.getExperiment) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
    * [.logEvent(eventName, [value], [metadata])](#statsig.logEvent) ⇒ <code>void</code>
    * [.updateUser(updatedUser)](#statsig.updateUser) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.isReady()](#statsig.isReady) ⇒ <code>boolean</code>
    * [.shutdown()](#statsig.shutdown)

<a name="statsig.initialize"></a>

### statsig.initialize(sdkKey, [user], [options]) ⇒ <code>Promise.&lt;void&gt;</code>
Initializes the statsig SDK.  This must be called and complete before checking gates/configs or logging.

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>Promise.&lt;void&gt;</code> - - a promise which rejects only if you fail to provide a proper SDK Key  
**Throws**:

- Error if an invalid SDK Key is provided


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| sdkKey | <code>string</code> |  | a SDK key, generated from the statsig developer console |
| [user] | [<code>StatsigUser</code>](#typedefs.StatsigUser) | <code>{}</code> | an object containing user attributes.  Pass a stable identifier as the key when possible, and any other attributes you have (ip, country, etc.) in order to use advanced gate conditions |
| [options] | [<code>StatsigOptions</code>](#typedefs.StatsigOptions) | <code>{}</code> | manual sdk configuration for advanced setup |

<a name="statsig.checkGate"></a>

### statsig.checkGate(gateName) ⇒ <code>boolean</code>
Checks the value of a gate for the current user

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>boolean</code> - - value of a gate for the user. Gates are "off" (return false) by default  
**Throws**:

- Error if initialize() is not called first, or gateName is not a string


| Param | Type | Description |
| --- | --- | --- |
| gateName | <code>string</code> | the name of the gate to check |

<a name="statsig.getConfig"></a>

### statsig.getConfig(configName) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
Checks the value of a config for the current user

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: [<code>DynamicConfig</code>](#DynamicConfig) - - value of a config for the user  
**Throws**:

- Error if initialize() is not called first, or configName is not a string


| Param | Type | Description |
| --- | --- | --- |
| configName | <code>string</code> | the name of the config to get |

<a name="statsig.getExperiment"></a>

### statsig.getExperiment(experimentName) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
Gets the experiment for a given user

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: [<code>DynamicConfig</code>](#DynamicConfig) - - value of the experiment for the user, represented by a Dynamic Config object  
**Throws**:

- Error if initialize() is not called first, or experimentName is not a string


| Param | Type | Description |
| --- | --- | --- |
| experimentName | <code>string</code> | the name of the experiment to get |

<a name="statsig.logEvent"></a>

### statsig.logEvent(eventName, [value], [metadata]) ⇒ <code>void</code>
Log an event for data analysis and alerting or to measure the impact of an experiment

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Throws**:

- Error if initialize() is not called first


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| eventName | <code>string</code> |  | the name of the event (eventName = 'Purchase') |
| [value] | <code>string</code> \| <code>number</code> | <code>null</code> | the value associated with the event (value = 10) |
| [metadata] | <code>Record.&lt;string, string&gt;</code> | <code></code> | other attributes associated with this event (metadata = {item_name: 'banana', currency: 'USD'}) |

<a name="statsig.updateUser"></a>

### statsig.updateUser(updatedUser) ⇒ <code>Promise.&lt;boolean&gt;</code>
Updates the user associated with calls to fetch gates/configs from statsig. This client SDK is intended for single user environments, but its possible a user was unknown previously and then logged in, or logged out and switched to a different account.  Use this function to update the gates/configs and associate event logs with the user.

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - - a promise which *always resolves* to a value which indicates success or failure  
**Throws**:

- Error if initialize() is not called first


| Param | Type | Description |
| --- | --- | --- |
| updatedUser | [<code>StatsigUser</code>](#typedefs.StatsigUser) | a set of user attributes identifying the user |

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
<a name="get"></a>

## get([key], [defaultValue]) ⇒ <code>T</code> \| <code>null</code>
A generic, type sensitive getter, which returns the value at the given index in the config if it matches the type of the default value,
and returns the default value otherwise

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| [key] | <code>string</code> | The index of the config to check |
| [defaultValue] | <code>T</code> \| <code>null</code> | The default value of the parameter to return in cases where the parameter is not found or does not match the type of the default value |

