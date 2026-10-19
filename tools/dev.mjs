// Chạy `npm run dev` với DEV=1 để bật lệnh thử nghiệm (/give, /hounds, /boss). Chạy được trên cả Windows lẫn macOS/Linux.
import { spawn } from 'node:child_process';

const child = spawn('npm run dev', { stdio: 'inherit', shell: true, env: { ...process.env, DEV: '1' } });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
