export class NotImplemented extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet`);
  }
}
