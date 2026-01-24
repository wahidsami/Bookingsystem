// Quick script to start backend and show output
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Rifah Backend Server...\n');

const serverProcess = spawn('node', ['src/index.js'], {
    cwd: path.join(__dirname, 'server'),
    stdio: 'inherit',
    shell: true
});

serverProcess.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

serverProcess.on('exit', (code) => {
    if (code !== 0) {
        console.error(`❌ Server exited with code ${code}`);
    }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping server...');
    serverProcess.kill();
    process.exit(0);
});

