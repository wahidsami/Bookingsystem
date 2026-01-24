const http = require('http');

const data = JSON.stringify({
    companyName: 'Rifah Salon',
    email: 'owner@rifah.sa',
    password: 'securePassword123',
    plan: 'pro'
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`StatusCode: ${res.statusCode}`);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
