import { SCRIPT_CATALOG } from './catalog.js';

export function resolveScriptPath(pathname) {
  const match = pathname.match(/^\/([A-Za-z0-9._-]+)(?:@([A-Za-z0-9._-]+))?$/);
  if (!match) return null;

  const [, name, version] = match;
  const script = SCRIPT_CATALOG[name];
  if (!script) return null;

  if (!version) {
    return {
      kind: 'latest',
      assetPath: script.latestPath,
    };
  }

  const assetPath = script.versions[version];
  if (!assetPath) return null;

  return {
    kind: 'versioned',
    assetPath,
  };
}
