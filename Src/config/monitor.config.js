require('dotenv').config();

module.exports = {
    appName: process.env.APP_NAME || 'test-app',
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000,
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 80,
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD) || 80,
    
    endpoints: [
        {
            name: 'Local API',
            url: 'http://localhost:3000/health',
            method: 'GET',
            timeout: 5000
        },
        {
            name: 'Database Health',
            url: 'http://localhost:3000/db/health',
            method: 'GET',
            timeout: 3000
        }
    ],
    
    email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO,
        subjectPrefix: process.env.EMAIL_SUBJECT_PREFIX
    }
};require('dotenv').config();

module.exports = {
    appName: process.env.APP_NAME || 'test-app',
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000,
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 80,
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD) || 80,
    
    endpoints: [
        {
            name: 'Local API',
            url: 'http://localhost:3000/health',
            method: 'GET',
            timeout: 5000
        },
        {
            name: 'Database Health',
            url: 'http://localhost:3000/db/health',
            method: 'GET',
            timeout: 3000
        }
    ],
    
    email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_TO,
        subjectPrefix: process.env.EMAIL_SUBJECT_PREFIX
    }
};