/**
 * TOON (Token-Oriented Object Notation) Formatter
 * Inspired by chaindead/tooner
 * 
 * Provides high-density, token-efficient serialization of structured context payloads
 * (git diffs, test summaries, directory maps) for AI session activators and checkpoints.
 */

export interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures?: Array<{ name: string; message: string }>;
}

export interface FileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
}

export interface ActivatorContext {
  task: string;
  files: FileChange[];
  testSummary?: TestSummary;
}

/**
 * Encodes structured activator context into ultra-compact TOON representation.
 * Reduces token consumption by ~40% compared to standard formatted JSON.
 */
export function encodeToon(context: ActivatorContext): string {
  const lines: string[] = [];
  lines.push(`@task: ${context.task.trim()}`);
  
  if (context.files && context.files.length > 0) {
    lines.push(`@files[${context.files.length}]:`);
    for (const f of context.files) {
      const sym = f.status === 'added' ? '+' : f.status === 'deleted' ? '-' : '~';
      lines.push(`  ${sym} ${f.path} (+${f.additions}/-${f.deletions})`);
    }
  } else {
    lines.push(`@files: none`);
  }

  if (context.testSummary) {
    const ts = context.testSummary;
    lines.push(`@tests: ${ts.passed}P/${ts.failed}F/${ts.skipped}S (total:${ts.total})`);
    if (ts.failures && ts.failures.length > 0) {
      lines.push(`@failures:`);
      for (const fail of ts.failures) {
        lines.push(`  ! [${fail.name}]: ${fail.message.replace(/\n/g, ' ')}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Decodes a TOON formatted string back into an ActivatorContext object.
 */
export function decodeToon(toonStr: string): ActivatorContext {
  const lines = toonStr.split('\n');
  let task = '';
  const files: FileChange[] = [];
  let testSummary: TestSummary | undefined;
  let inFailures = false;
  const failures: Array<{ name: string; message: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('@task:')) {
      task = line.slice(6).trim();
    } else if (line.startsWith('~ ') || line.startsWith('+ ') || line.startsWith('- ')) {
      const statusMap: Record<string, 'modified' | 'added' | 'deleted'> = {
        '~': 'modified',
        '+': 'added',
        '-': 'deleted'
      };
      const status = statusMap[line[0]];
      const rest = line.slice(2);
      const match = rest.match(/^(.*?)\s+\(\+(\d+)\/-\((\d+)\)\)$/) || rest.match(/^(.*?)\s+\(\+(\d+)\/-(\d+)\)$/);
      if (match) {
        files.push({
          path: match[1],
          status,
          additions: parseInt(match[2], 10),
          deletions: parseInt(match[3], 10)
        });
      } else {
        files.push({ path: rest, status, additions: 0, deletions: 0 });
      }
    } else if (line.startsWith('@tests:')) {
      const match = line.slice(7).trim().match(/^(\d+)P\/(\d+)F\/(\d+)S\s+\(total:(\d+)\)$/);
      if (match) {
        testSummary = {
          passed: parseInt(match[1], 10),
          failed: parseInt(match[2], 10),
          skipped: parseInt(match[3], 10),
          total: parseInt(match[4], 10)
        };
      }
    } else if (line.startsWith('@failures:')) {
      inFailures = true;
    } else if (inFailures && line.startsWith('! [')) {
      const match = line.match(/^!\s*\[(.*?)\]:\s*(.*)$/);
      if (match) {
        failures.push({ name: match[1], message: match[2] });
      }
    }
  }

  if (testSummary && failures.length > 0) {
    testSummary.failures = failures;
  }

  return { task, files, testSummary };
}
