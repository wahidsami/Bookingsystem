module.exports = {
    apps: [
        {
            name: "rifah-client",
            cwd: "./client",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            }
        },
        {
            name: "rifah-server",
            cwd: "./server",
            script: "src/index.js",
            env: {
                NODE_ENV: "production",
                PORT: 5000
            }
        }
    ]
};
