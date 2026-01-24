// Test script for user authentication
const http = require('http');

const API_URL = 'http://localhost:5000/api/v1/auth/user';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, 'http://localhost:5000');
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = {
                        status: res.statusCode,
                        data: body ? JSON.parse(body) : null
                    };
                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testUserAuth() {
    console.log('\n🧪 TESTING USER AUTHENTICATION SYSTEM');
    console.log('═'.repeat(60));

    let accessToken = null;
    let userId = null;

    // Test 1: Register new user
    console.log('\n📝 Test 1: Register New User');
    console.log('─'.repeat(60));
    try {
        const registerData = {
            email: `test${Date.now()}@rifah.com`,
            phone: `+96650${Math.floor(1000000 + Math.random() * 9000000)}`,
            password: 'Test@123456',
            firstName: 'Ahmed',
            lastName: 'Al-Saudi'
        };

        const registerRes = await makeRequest('POST', `${API_URL}/register`, registerData);

        if (registerRes.status === 201) {
            console.log('✅ User registered successfully!');
            console.log(`   Email: ${registerData.email}`);
            console.log(`   Name: ${registerData.firstName} ${registerData.lastName}`);
            accessToken = registerRes.data.data.tokens.accessToken;
            userId = registerRes.data.data.user.id;
            console.log(`   User ID: ${userId}`);
        } else {
            console.log('❌ Registration failed:', registerRes.data.message);
        }
    } catch (error) {
        console.log('❌ Registration error:', error.message);
    }

    // Test 2: Login
    console.log('\n🔐 Test 2: Login');
    console.log('─'.repeat(60));
    try {
        const loginData = {
            email: 'test@rifah.com',
            password: 'Test@123456'
        };

        const loginRes = await makeRequest('POST', `${API_URL}/login`, loginData);

        if (loginRes.status === 200) {
            console.log('✅ Login successful!');
            console.log(`   User: ${loginRes.data.data.user.firstName} ${loginRes.data.data.user.lastName}`);
            accessToken = loginRes.data.data.tokens.accessToken;
        } else {
            console.log('❌ Login failed:', loginRes.data.message);
        }
    } catch (error) {
        console.log('❌ Login error:', error.message);
    }

    // Test 3: Logout
    console.log('\n🚪 Test 3: Logout');
    console.log('─'.repeat(60));
    try {
        const logoutRes = await makeRequest('POST', `${API_URL}/logout`, null);

        if (logoutRes.status === 200) {
            console.log('✅ Logout successful!');
        } else {
            console.log('❌ Logout failed');
        }
    } catch (error) {
        console.log('❌ Logout error:', error.message);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Authentication tests complete!\n');
}

// Wait for server to be ready
console.log('Waiting for server to be ready...');
setTimeout(testUserAuth, 2000);
