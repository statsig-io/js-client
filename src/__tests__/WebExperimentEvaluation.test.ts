import Statsig from '../index';
import * as WebExperiments from './web_experiments.json';

describe('WebExperimentEvaluation', () => {

  test('Evaluation', async () => {
    const options = {
      localMode: true,
      localEvaluationConfigs: WebExperiments
    };
    await Statsig.initialize("client-test", {
      // @ts-ignore
      url: "http://statsig.com/sync.html"
    }, options);

    const exp = await Statsig.genWebExperiment('test_web_experiment');

    expect(exp.getValue()).toEqual({ "javascript": "alert('You are in control!')" });
  });

});
