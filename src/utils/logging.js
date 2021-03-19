import LogEvent from '../LogEvent';

const CONFIG_EXPOSURE_EVENT = 'config_exposure';
const GATE_EXPOSURE_EVENT = 'gate_exposure';
const INTERNAL_EVENT_PREFIX = 'statsig::';

export function logGateExposure(eventProcessor, gateName, gateValue) {
  logStatsigInternal(eventProcessor, GATE_EXPOSURE_EVENT, null, {
    gate: gateName,
    gateValue: gateValue,
  });
}

export function logConfigExposure(eventProcessor, configName, groupName) {
  logStatsigInternal(eventProcessor, CONFIG_EXPOSURE_EVENT, null, {
    config: configName,
    configGroup: groupName,
  });
}

export function logStatsigInternal(
  eventProcessor,
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

  if (metadata.error != null) {
    eventProcessor.log(event, eventName + metadata.error);
  } else {
    eventProcessor.log(event);
  }
}
