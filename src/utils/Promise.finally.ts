// @ts-nocheck
export default function Polyfill() {
  Promise.prototype.finally =
    Promise.prototype.finally ||
    {
      finally(fn) {
        const onFinally = (callback) => Promise.resolve(fn()).then(callback);
        return this.then(
          (result) => onFinally(() => result),
          (reason) => onFinally(() => Promise.reject(reason)),
        );
      },
    }.finally;
}
