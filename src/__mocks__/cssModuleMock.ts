export default new Proxy(
  {} as Record<string | symbol, unknown>,
  {
    get(_target, key) {
      if (key === "__esModule") return false;
      if (typeof key !== "string") return undefined;
      return key;
    },
  }
);
