/* Local provisioning only. Credentials are read from a masked prompt or stdin,
   never command arguments. This does not send email or register public users. */
const { readFile, writeFile, rename, unlink } = require('node:fs/promises');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');
const readline = require('node:readline');
const { isEmail } = require('class-validator');

async function maskedPassword() {
  if (!process.stdin.isTTY) throw new Error('Use --stdin for non-interactive provisioning.');
  process.stdout.write('Senha (entrada oculta): ');
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolvePassword, reject) => {
    let value = '';
    function finish(error) {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolvePassword(value);
    }
    function onKey(text, key = {}) {
      if (key.ctrl && key.name === 'c') return finish(new Error('Cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') value = value.slice(0, -1);
      else if (!key.ctrl && !key.meta && text && [...text].every((character) => character.codePointAt(0) >= 32)) value += text;
      if (value.length > 256) finish(new Error('Password is too long.'));
    }
    process.stdin.on('keypress', onKey);
  });
}
async function main() {
  const root = resolve(__dirname, '../..');
  execFileSync('git', ['check-ignore', '--quiet', '.env'], { cwd: root, stdio: 'ignore' });
  let email, password;
  if (process.argv.includes('--stdin')) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 4096) throw new Error('Input is too long.');
    }
    ({ email, password } = JSON.parse(input));
  } else {
    const prompt = require('node:readline/promises').createInterface({ input: process.stdin, output: process.stdout });
    email = await prompt.question('E-mail do administrador: ');
    prompt.close();
    password = await maskedPassword();
  }
  if (typeof email !== 'string' || !isEmail(email.trim()) || /['\r\n]/.test(email) || email.trim().length > 254) throw new Error('Invalid email.');
  if (typeof password !== 'string' || password.length < 10 || password.length > 256) throw new Error('Password must contain 10 to 256 characters.');
  const { hashPassword } = require('../dist/modules/access/password.js');
  const hash = await hashPassword(password);
  const file = resolve(root, '.env');
  let content = await readFile(file, 'utf8').catch((error) => { if (error.code === 'ENOENT') return ''; throw error; });
  function set(key, value) {
    const line = `${key}='${value}'`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.trimEnd()}\n${line}\n`;
  }
  set('ADMIN_EMAIL', email.trim().toLowerCase());
  set('ADMIN_PASSWORD_HASH', hash);
  if (!/^AUTH_SECRET=.+$/m.test(content)) set('AUTH_SECRET', randomBytes(32).toString('base64url'));
  if (!/^APP_ORIGIN=.+$/m.test(content)) set('APP_ORIGIN', 'http://localhost:3000');
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try { await writeFile(temporary, content, { mode: 0o600, flag: 'wx' }); await rename(temporary, file); }
  finally { await unlink(temporary).catch(() => {}); }
  console.log('Administrador configurado no .env local. Reinicie a API para aplicar e invalidar sessões antigas.');
}
main().catch(() => { console.error('Não foi possível configurar o administrador. Execute o build da API e verifique a entrada e se .env está ignorado pelo Git.'); process.exitCode = 1; });
