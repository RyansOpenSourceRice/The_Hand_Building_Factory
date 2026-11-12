import {existsSync, readFileSync} from 'node:fs';

const FILE = 'test-results/results.json';

function walk(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      if (test.status !== 'unexpected' && test.status !== 'flaky') {
        continue;
      }
      const result = test.results?.at(-1);
      const message = (result?.error?.message ?? 'failed')
          .split('\n')[0]
          .slice(0, 300);
      const level = test.status === 'flaky' ? 'warning' : 'error';
      console.log(`::${level} file=${spec.file}::${spec.title} - ${message}`);
    }
  }
  for (const child of suite.suites ?? []) {
    walk(child);
  }
}

if (existsSync(FILE)) {
  const report = JSON.parse(readFileSync(FILE, 'utf8'));
  for (const suite of report.suites ?? []) {
    walk(suite);
  }
}
