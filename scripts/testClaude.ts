import { execSync } from 'child_process';
import * as os from 'os';

console.log('PATH:', process.env.PATH);
console.log('HOME:', os.homedir());

const claudeExec = process.env.CLAUDE_CODE_EXECPATH || '';
console.log('CLAUDE_CODE_EXECPATH:', claudeExec);

try {
  // Try using CLAUDE_CODE_EXECPATH directly (the .exe binary)
  const out1 = execSync(`echo "hi" | "${claudeExec}" --print`, {
    encoding: 'utf-8', shell: '/bin/bash', env: process.env, timeout: 15000,
  });
  console.log('EXECPATH works:', out1.slice(0, 30));
} catch (e: any) {
  console.log('EXECPATH fail:', e.message.slice(0, 100));
}

try {
  // Try calling via node (run the .exe as an ELF)
  const out2 = execSync(`echo "hi" | claude --print`, {
    encoding: 'utf-8', shell: '/bin/bash', env: process.env, timeout: 15000,
  });
  console.log('claude --print works:', out2.slice(0, 30));
} catch (e: any) {
  console.log('claude --print fail:', e.message.slice(0, 100));
}
