import LogEvent from '../LogEvent';

const CONFIG_EXPOSURE_EVENT = 'config_exposure';
const GATE_EXPOSURE_EVENT = 'gate_exposure';
const INTERNAL_EVENT_PREFIX = 'statsig::';

export function logGateExposure(eventProcessor, user, gateName, gateValue) {
  logStatsigInternal(eventProcessor, user, GATE_EXPOSURE_EVENT, null, {
    gate: gateName,
    gateValue: gateValue,
  });
}

export function logConfigExposure(eventProcessor, user, configName, groupName) {
  logStatsigInternal(eventProcessor, user, CONFIG_EXPOSURE_EVENT, null, {
    config: configName,
    configGroup: groupName,
  });
}

export function logStatsigInternal(
  eventProcessor,
  user,
  eventName,
  value = null,
  metadata = {},
) {
  if (typeof eventProcessor.log !== 'function') {
    return;
  }
  let event = new LogEvent(INTERNAL_EVENT_PREFIX + eventName);
  event.setValue(value);
  if (metadata == null) {
    metadata = {};
  }
  event.setMetadata(metadata);
  event.setUser(user);
  if (metadata.error != null) {
    eventProcessor.log(event, eventName + metadata.error);
  } else {
    eventProcessor.log(event);
  }
}
