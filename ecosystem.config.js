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
        // Backend configuration (assumed based on standard setup, can be enabled later if needed)
        // {
        //   name: "rifah-server",
        //   cwd: "./server",
        //   script: "dist/main.js", // or index.js depending on build
        //   env: {
        //     NODE_ENV: "production",
        //     PORT: 5000
        //   }
        // }
    ]
};
