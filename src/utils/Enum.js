export function Enum(...keys) {
  return Object.freeze(keys.reduce((obj, key) => ((obj[key] = key), obj), {}));
}
