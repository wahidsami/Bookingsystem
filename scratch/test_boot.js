const cp = require('child_process');

console.log('Spawning server to check for startup exceptions...');

const serverProcess = cp.spawn('node', ['src/index.js'], {
    cwd: 'd:\\Waheed\\Refah\\Bookingsystem\\server',
    stdio: 'pipe'
});

let output = '';
serverProcess.stdout.on('data', data => {
    output += data.toString();
    console.log('[STDOUT]', data.toString());
});

serverProcess.stderr.on('data', data => {
    output += data.toString();
    console.error('[STDERR]', data.toString());
});

serverProcess.on('exit', code => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code || 0);
});

// Kill it after 4 seconds if it's still alive (meaning it booted successfully)
setTimeout(() => {
    console.log('Server is still running after 4 seconds. Assuming successful boot. Killing process...');
    serverProcess.kill();
    process.exit(0);
}, 4000);
