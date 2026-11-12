const DEFAULT_BASE = import.meta.env.BASE_URL;

export function audioPath(file: string, base = DEFAULT_BASE): string {
  const dir = base.endsWith('/') ? base : `${base}/`;
  return `${dir}audio/${file}`;
}
