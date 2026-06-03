export const ASSET_ROOT = '/asset';

export function assetPath(path) {
  const cleanPath = String(path).replace(/^\/+/, '');
  return `${ASSET_ROOT}/${cleanPath.split('/').map(encodeURIComponent).join('/')}`;
}
