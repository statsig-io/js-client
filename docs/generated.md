## Objects

<dl>
<dt><a href="#typedefs">typedefs</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#DynamicConfig">DynamicConfig</a> : <code>object</code></dt>
<dd><p>A class for fetching the json data configured for a DynamicConfig in the statsig console</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#statsig">statsig</a></dt>
<dd><p>The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.</p>
</dd>
</dl>

<a name="typedefs"></a>

## typedefs : <code>object</code>
**Kind**: global namespace  

* [typedefs](#typedefs) : <code>object</code>
    * [.StatsigUser](#typedefs.StatsigUser) : <code>Object.&lt;string, \*&gt;</code>
    * [.StatsigOptions](#typedefs.StatsigOptions) : <code>Object</code>

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
| [clientVersion] | <code>string</code> | 
| [name] | <code>string</code> | 
| [custom] | <code>object</code> | 

<a name="typedefs.StatsigOptions"></a>

### typedefs.StatsigOptions : <code>Object</code>
An object of properties for initializing the sdk with advanced options

**Kind**: static typedef of [<code>typedefs</code>](#typedefs)  
**Properties**

| Name | Type |
| --- | --- |
| [api] | <code>string</code> | 

<a name="DynamicConfig"></a>

## DynamicConfig : <code>object</code>
A class for fetching the json data configured for a DynamicConfig in the statsig console

**Kind**: global namespace  

* [DynamicConfig](#DynamicConfig) : <code>object</code>
    * [.getBool(name, [defaultValue])](#DynamicConfig+getBool) ⇒ <code>boolean</code>
    * [.getString(name, [defaultValue])](#DynamicConfig+getString) ⇒ <code>string</code>
    * [.getNumber(name, [defaultValue])](#DynamicConfig+getNumber) ⇒ <code>number</code>
    * [.getObject(name, [defaultValue])](#DynamicConfig+getObject) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
    * [.getRawValue()](#DynamicConfig+getRawValue) ⇒ <code>any</code>

<a name="DynamicConfig+getBool"></a>

### dynamicConfig.getBool(name, [defaultValue]) ⇒ <code>boolean</code>
Returns the boolean value of the given parameter, or the defaultValue if not found.

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  
**Throws**:

- Error if the defaultValue is null or not a boolean


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | The name of the parameter to check |
| [defaultValue] | <code>boolean</code> | <code>false</code> | The default value of the parameter to return in cases where the parameter is not found or is not the correct type. |

<a name="DynamicConfig+getString"></a>

### dynamicConfig.getString(name, [defaultValue]) ⇒ <code>string</code>
Returns the string value of the given parameter, or the defaultValue if not found.

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  
**Throws**:

- Error if the defaultValue is null or not a string


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | The name of the parameter to check |
| [defaultValue] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | The default value of the parameter to return in cases where the parameter is not found or is not the correct type. |

<a name="DynamicConfig+getNumber"></a>

### dynamicConfig.getNumber(name, [defaultValue]) ⇒ <code>number</code>
Returns the number value of the given parameter, or the defaultValue if not found.

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  
**Throws**:

- Error if the defaultValue is null or not a number


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | The name of the parameter to check |
| [defaultValue] | <code>number</code> | <code>0</code> | The default value of the parameter to return in cases where the parameter is not found or is not the correct type. |

<a name="DynamicConfig+getObject"></a>

### dynamicConfig.getObject(name, [defaultValue]) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
Returns the object value of the given parameter as another DynamicConfig, or a DynamicConfig representing the defaultValue if not found.

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  
**Throws**:

- Error if the defaultValue is null or not an object


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>string</code> |  | The name of the parameter to check |
| [defaultValue] | <code>object</code> | <code>{}</code> | The default value of the parameter to return in cases where the parameter is not found or is not the correct type. |

<a name="DynamicConfig+getRawValue"></a>

### dynamicConfig.getRawValue() ⇒ <code>any</code>
Returns the raw value of the DynamicConfig

**Kind**: instance method of [<code>DynamicConfig</code>](#DynamicConfig)  
<a name="statsig"></a>

## statsig
The global statsig class for interacting with gates, configs, experiments configured in the statsig developer console.  Also used for event logging to view in the statsig console, or for analyzing experiment impacts using pulse.

**Kind**: global constant  

* [statsig](#statsig)
    * [.initialize(sdkKey, [user], [options])](#statsig.initialize) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.checkGate(gateName)](#statsig.checkGate) ⇒ <code>boolean</code>
    * [.getConfig(configName)](#statsig.getConfig) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
    * [.logEvent(eventName, [value], [metadata])](#statsig.logEvent) ⇒ <code>void</code>
    * [.switchUser(newUser)](#statsig.switchUser) ⇒ <code>Promise.&lt;boolean&gt;</code>
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

- Error if gateName is not a string


| Param | Type | Description |
| --- | --- | --- |
| gateName | <code>string</code> | the name of the gate to check |

<a name="statsig.getConfig"></a>

### statsig.getConfig(configName) ⇒ [<code>DynamicConfig</code>](#DynamicConfig)
Checks the value of a config for the current user

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: [<code>DynamicConfig</code>](#DynamicConfig) - - value of a config for the user  
**Throws**:

- Error if configName is not a string


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
| [metadata] | <code>object</code> | <code></code> | other attributes associated with this event (metadata = {items: 2, currency: USD}) |

<a name="statsig.switchUser"></a>

### statsig.switchUser(newUser) ⇒ <code>Promise.&lt;boolean&gt;</code>
Switches the user associated with calls to fetch gates/configs from statsig. This client SDK is intended for single user environments, but its possible a user was unknown previously and then logged in, or logged out and switched to a different account.  Use this function to update the gates/configs and associate event logs with the new user.

**Kind**: static method of [<code>statsig</code>](#statsig)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - - a promise which *always resolves* to a value which indicates success or failure  

| Param | Type | Description |
| --- | --- | --- |
| newUser | [<code>StatsigUser</code>](#typedefs.StatsigUser) | a set of user attributes identifying the new user |

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
