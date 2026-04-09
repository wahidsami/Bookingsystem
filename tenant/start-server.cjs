const { spawn } = require('child_process');

const port = process.env.PORT || '3003';
const host = process.env.HOST || '0.0.0.0';

const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'start', '-p', port, '-H', host],
    {
        stdio: 'inherit',
        env: process.env,
    }
);

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 0);
});

