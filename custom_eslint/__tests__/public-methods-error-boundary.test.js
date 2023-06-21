import errorBoundaryCheck from "../public-methods-error-boundary";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  parser: require.resolve("@typescript-eslint/parser"),
});

const errors = [{ message: `All code in public method should be contained inside a single errorBoundary statment.` }];

const validContructor = 
`
export default class StatsigClient implements IHasStatsigInternal, IStatsig {
  public constructor() {
    const a = 1;
  }
}
`

const validPublicGetter = 
`
export default class StatsigClient implements IHasStatsigInternal, IStatsig {
  public getNetwork(): StatsigNetwork {
    return this.network;
  }
}
`

const validPrivateFunction =
`
  export default class StatsigClient implements IHasStatsigInternal, IStatsig {
    private checkGateImpl(): StoreGateFetchResult {
      this.ensureStoreLoaded();
      return this.store.checkGate(gateName, ignoreOverrides);
    }
  }  
  `

const validUsage =
`
  export default class StatsigClient implements IHasStatsigInternal, IStatsig {
 
    public getLayer(): Layer {
      return this.errorBoundary.capture(
        'getLayer',
        () => {},
        () =>
          Layer._create(layerName, {}, '', this.getEvalutionDetailsForError()),
        { diagnosticsKey: DiagnosticsKey.GET_LAYER },
      );
    }  
  }
`

const validNoReturnStatment =
`
export default class StatsigClient implements IHasStatsigInternal, IStatsig {
  public getLayer(): void {
    this.errorBoundary.capture(
      'getLayer',
      () => {},
      () => {},
      { diagnosticsKey: DiagnosticsKey.GET_LAYER },
    );
  }  
}
`

const invalidCodeOutsideErrorboundary =
`
  export default class StatsigClient implements IHasStatsigInternal, IStatsig {
    public getLayer(): Layer {
      const a = 1;
      return this.errorBoundary.capture(
        'getLayer',
        () => {},
        () => {},
        { diagnosticsKey: DiagnosticsKey.GET_LAYER },
      );
    }  
  }
`

const invalidNoErrorBoundary =
`
export default class StatsigClient implements IHasStatsigInternal, IStatsig {
  public getGate(): FeatureGate {
    return new FeatureGate();
  }  
}
`

const validTests = [ 
  validContructor,  
  validNoReturnStatment,  
  validPrivateFunction,  
  validUsage, 
  validPublicGetter
].map((e) => {return {code: e}});

const invalidTests = [
  invalidCodeOutsideErrorboundary,
  invalidNoErrorBoundary
].map(e => {return {code: e, errors}})

ruleTester.run("public-methods-error-boundary", errorBoundaryCheck, {
  valid: validTests,
  invalid: invalidTests,
});