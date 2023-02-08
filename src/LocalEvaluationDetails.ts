import { LocalEvaluationReason } from './LocalEvaluationReason';

export class LocalEvaluationDetails {
  readonly configSyncTime: number;
  readonly initTime: number;
  readonly serverTime: number;
  readonly reason: LocalEvaluationReason;

  private constructor(
    configSyncTime: number,
    initTime: number,
    reason: LocalEvaluationReason,
  ) {
    this.configSyncTime = configSyncTime;
    this.initTime = initTime;
    this.reason = reason;
    this.serverTime = Date.now();
  }

  static uninitialized() {
    return new LocalEvaluationDetails(
      0,
      0,
      'Uninitialized',
    );
  }

  static make(reason: LocalEvaluationReason) {
    return new LocalEvaluationDetails(
      0,
      0,
      reason,
    );
  }
}
