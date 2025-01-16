const pm2 = require('pm2');
const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { exec } = require('child_process');

class EndpointMonitor {
    constructor(config) {
        this.name = config.name;
        this.url = config.url;
        this.method = config.method || 'GET';
        this.timeout = config.timeout || 5000;
        this.expectedStatus = config.expectedStatus || 200;
        this.headers = config.headers || {};
        this.body = config.body;
        this.lastStatus = 'unknown';
        this.failureCount = 0;
        this.lastChecked = null;
    }
}

class NodeMonitorAgent {
    constructor(config) {
        this.config = {
            // Application Configuration
            appName: config.appName || 'nodeapp',
            restartThreshold: config.restartThreshold || 5,
            memoryThreshold: config.memoryThreshold || 80,
            cpuThreshold: config.cpuThreshold || 80,
            checkInterval: config.checkInterval || 30000,
            logPath: config.logPath || path.join(__dirname, 'monitor-logs'),
            alertWebhook: config.alertWebhook,
            
            // Endpoints Configuration
            endpoints: this.initializeEndpoints(config.endpoints || []),
            
            // Email Configuration
            email: {
                enabled: config.email?.enabled || false,
                host: config.email?.host || 'smtp.gmail.com',
                port: config.email?.port || 587,
                secure: config.email?.secure || false,
                user: config.email?.user,
                pass: config.email?.pass,
                from: config.email?.from,
                to: config.email?.to,
                subjectPrefix: config.email?.subjectPrefix || '[Node Monitor]'
            }
        };

        this.restartCount = 0;
        this.lastRestartTime = Date.now();
        this.emailTransporter = null;
        this.endpointStatuses = new Map();

        this.initializeSystem();
    }

    initializeEndpoints(endpoints) {
        return endpoints.map(endpoint => new EndpointMonitor(endpoint));
    }

    initializeSystem() {
        // Create log directory if it doesn't exist
        if (!fs.existsSync(this.config.logPath)) {
            fs.mkdirSync(this.config.logPath, { recursive: true });
        }

        // Initialize email transporter if enabled
        if (this.config.email.enabled) {
            this.emailTransporter = nodemailer.createTransport({
                host: this.config.email.host,
                port: this.config.email.port,
                secure: this.config.email.secure,
                auth: {
                    user: this.config.email.user,
                    pass: this.config.email.pass
                }
            });
        }
    }

    async start() {
        try {
            // Connect to PM2
            await new Promise((resolve, reject) => {
                pm2.connect((err) => {
                    if (err) {
                        this.logError('Failed to connect to PM2', err);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            // Start monitoring
            this.startMonitoring();
            this.log('AI Monitor Agent started successfully');
            await this.sendEmail('Monitor Started', 'Application monitoring has been initiated successfully.');
        } catch (error) {
            this.logError('Failed to start monitor', error);
            throw error;
        }
    }

    // ... (previous initialization methods remain the same)

    async checkAllEndpoints() {
        const results = await Promise.all(this.config.endpoints.map(endpoint => this.checkEndpoint(endpoint)));

        const failedEndpoints = results.filter(result => !result.healthy);
        if (failedEndpoints.length > 0) {
            await this.restartFailedEndpoints(failedEndpoints);
            const failedEndPointsAfterRetry = await Promise.all(failedEndpoints.map(endpoint => this.checkEndpoint(endpoint)));
            await this.handleUnhealthyEndpoints(failedEndPointsAfterRetry);
        }

        // Update status dashboard
        this.updateEndpointStatuses(results);
    }

    async restartFailedEndpoints(failedEndpoints, retries = 3) {
        for (const endpoint of failedEndpoints) {
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    await this.restartEndpoint(endpoint);
                    console.log(`Successfully restarted ${endpoint.name} on attempt ${attempt}`);
                    break; // Exit the retry loop on success
                } catch (error) {
                    console.error(`Attempt ${attempt} to restart ${endpoint.name} failed:`, error);
                    if (attempt === retries) {
                        console.error(`Failed to restart ${endpoint.name} after ${retries} attempts`);
                    }
                }
            }
        }
    }
     
    restartEndpoint(endpoint) {
        return new Promise((resolve, reject) => {
            exec(`pm2 restart ${endpoint.name}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`Restarted ${endpoint.name}:`, stdout);
                    resolve(stdout);
                }
            });
        });
    }

    async checkEndpoint(endpoint) {
        try {
            const startTime = Date.now();
            const response = await axios({
                method: endpoint.method,
                url: endpoint.url,
                timeout: endpoint.timeout,
                headers: endpoint.headers,
                data: endpoint.body,
                validateStatus: status => status === endpoint.expectedStatus
            });

            const responseTime = Date.now() - startTime;
            endpoint.lastChecked = new Date();
            endpoint.lastStatus = 'healthy';
            endpoint.failureCount = 0;

            return {
                endpoint: endpoint.name,
                url: endpoint.url,
                healthy: true,
                responseTime,
                lastChecked: endpoint.lastChecked
            };
        } catch (error) {
            endpoint.failureCount++;
            endpoint.lastStatus = 'unhealthy';
            endpoint.lastChecked = new Date();

            return {
                endpoint: endpoint.name,
                url: endpoint.url,
                healthy: false,
                error: error.message,
                failureCount: endpoint.failureCount,
                lastChecked: endpoint.lastChecked
            };
        }
    }

    async handleUnhealthyEndpoints(failedEndpoints) {
        const failureDetails = failedEndpoints.map(result => `
            <tr>
                <td>${result.endpoint}</td>
                <td>${result.url}</td>
                <td>${result.error}</td>
                <td>${result.failureCount}</td>
                <td>${result.lastChecked}</td>
            </tr>
        `).join('');

        await this.sendEmail(
            'Endpoint Health Alert',
            `
            <h3 style="color: #d32f2f;">Unhealthy Endpoints Detected</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Endpoint</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">URL</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Error</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Failure Count</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Last Checked</th>
                    </tr>
                </thead>
                <tbody>
                    ${failureDetails}
                </tbody>
            </table>
            `
        );
    }

    updateEndpointStatuses(results) {
        this.endpointStatuses.clear();
        results.forEach(result => {
            this.endpointStatuses.set(result.endpoint, {
                healthy: result.healthy,
                lastChecked: result.lastChecked,
                responseTime: result.responseTime,
                failureCount: result.failureCount || 0
            });
        });
    }

    async generateStatusReport() {
        const statusEntries = Array.from(this.endpointStatuses.entries());
        const statusRows = statusEntries.map(([endpoint, status]) => `
            <tr>
                <td>${endpoint}</td>
                <td style="color: ${status.healthy ? 'green' : 'red'}">
                    ${status.healthy ? 'Healthy' : 'Unhealthy'}
                </td>
                <td>${status.responseTime || 'N/A'} ms</td>
                <td>${status.failureCount}</td>
                <td>${status.lastChecked?.toISOString() || 'Never'}</td>
            </tr>
        `).join('');

        return `
            <h3>Endpoint Status Report</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Endpoint</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Response Time</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Failure Count</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Last Checked</th>
                    </tr>
                </thead>
                <tbody>
                    ${statusRows}
                </tbody>
            </table>
        `;
    }

    startMonitoring() {
        setInterval(async () => {
            try {
                await this.checkAllEndpoints();
                await this.checkSystemResources();
                await this.checkApplicationLogs();
                await this.performMaintenanceTasks();

                // Generate and send daily status report
                if (this.shouldSendDailyReport()) {
                    const statusReport = await this.generateStatusReport();
                    await this.sendEmail('Daily Status Report', statusReport);
                }
            } catch (error) {
                this.logError('Monitoring error', error);
            }
        }, this.config.checkInterval);
    }

    async checkSystemResources() {
        const cpuUsage = this.getCpuUsage();
        const memUsage = this.getMemoryUsage();

        if (cpuUsage > this.config.cpuThreshold) {
            await this.alertHighResourceUsage('CPU', cpuUsage);
        }

        if (memUsage > this.config.memoryThreshold) {
            await this.alertHighResourceUsage('Memory', memUsage);
        }
    }



    async checkApplicationLogs() {
        pm2.launchBus(async (err, bus) => {
            if (err) {
                this.logError('PM2 bus error', err);
                return;
            }

            bus.on('log:err', async (data) => {
                if (data.process.name === this.config.appName) {
                    this.logError('Application error', data.data);
                    await this.analyzeError(data.data);
                }
            });
        });
    }

    async performMaintenanceTasks() {
        // Cleanup old logs
        await this.cleanupOldLogs();
        // Additional maintenance tasks can be added here
    }

    cleanupOldLogs() {
        const logFiles = fs.readdirSync(this.config.logPath);
        const oldFiles = logFiles.filter(file => {
            const filePath = path.join(this.config.logPath, file);
            const stats = fs.statSync(filePath);
            return Date.now() - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000; // 7 days
        });

        oldFiles.forEach(file => {
            fs.unlinkSync(path.join(this.config.logPath, file));
        });
    }

    shouldSendDailyReport() {
        const now = new Date();
        return now.getHours() === 0 && now.getMinutes() === 0;
    }

    getCpuUsage() {
        return (os.loadavg()[0] * 100 / os.cpus().length).toFixed(2);
    }

    getMemoryUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        return ((totalMem - freeMem) / totalMem * 100).toFixed(2);
    }

    log(message) {
        const logMessage = `[${new Date().toISOString()}] ${message}\n`;
        fs.appendFileSync(path.join(this.config.logPath, 'monitor.log'), logMessage);
    }

    logError(message, error) {
        const errorMessage = `[${new Date().toISOString()}] ERROR: ${message}: ${error}\n`;
        fs.appendFileSync(path.join(this.config.logPath, 'error.log'), errorMessage);
    }

    async analyzeError(errorData) {
        const errorPatterns = {
            memoryLeak: /heap out of memory|javascript heap out of memory/i,
            networkError: /ECONNREFUSED|ETIMEDOUT/i,
            diskSpace: /no space left on device/i
        };

        for (const [type, pattern] of Object.entries(errorPatterns)) {
            if (pattern.test(errorData)) {
                await this.handleSpecificError(type, errorData);
            }
        }
    }

    async handleSpecificError(errorType, errorData) {
        const actions = {
            memoryLeak: async () => {
                await this.sendEmail('Memory Leak Detected', 'Potential memory leak detected in application');
                await this.generateHeapDump();
            },
            networkError: async () => {
                await this.sendEmail('Network Error', 'Network connectivity issues detected');
                await this.checkNetworkConnectivity();
            },
            diskSpace: async () => {
                await this.sendEmail('Disk Space Alert', 'Low disk space detected');
                await this.cleanupDiskSpace();
            }
        };

        if (actions[errorType]) {
            await actions[errorType]();
        }
    }

    async checkNetworkConnectivity() {
        try {
            await axios.get('https://api.github.com');
            this.log('Network connectivity check passed');
        } catch (error) {
            this.alertCriticalIssue('Network connectivity issues detected');
        }
    }

    async cleanupDiskSpace() {
        // Clean up old log files
        const logFiles = fs.readdirSync(this.config.logPath);
        const oldFiles = logFiles.filter(file => {
            const filePath = path.join(this.config.logPath, file);
            const stats = fs.statSync(filePath);
            return Date.now() - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000; // 7 days
        });

        oldFiles.forEach(file => {
            fs.unlinkSync(path.join(this.config.logPath, file));
        });
    }

    async alertHighResourceUsage(resourceType, usage) {
        const message = `High ${resourceType} usage detected: ${usage.toFixed(2)}%`;
        this.log(message);
        await this.sendAlert('warning', message);
    }

    async alertCriticalIssue(message) {
        this.log(`CRITICAL: ${message}`);
        await this.sendAlert('critical', message);
    }

    async sendEmail(subject, content) {
        if (!this.config.email.enabled || !this.emailTransporter) {
            return;
        }

        try {
            const mailOptions = {
                from: this.config.email.from,
                to: this.config.email.to,
                subject: `${this.config.email.subjectPrefix} ${subject}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #2196f3;">Node.js Application Monitor</h2>
                        ${content}
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                            <h3>System Information:</h3>
                            <ul>
                                <li>Host: ${os.hostname()}</li>
                                <li>Platform: ${os.platform()}</li>
                                <li>Memory Usage: ${this.getMemoryUsage()}%</li>
                                <li>CPU Usage: ${this.getCpuUsage()}%</li>
                                <li>Uptime: ${Math.floor(os.uptime() / 3600)} hours</li>
                            </ul>
                        </div>
                        <p style="color: #666; font-size: 12px; margin-top: 20px;">
                            This is an automated message from Node Monitor Agent
                        </p>
                    </div>
                `
            };

            await this.emailTransporter.sendMail(mailOptions);
            this.log(`Email alert sent: ${subject}`);
        } catch (error) {
            this.logError('Failed to send email alert', error);
        }
    }

    async generateHeapDump() {
        // Implementation for generating heap dump
        // This could use v8-profiler or heapdump module
        this.log('Generating heap dump for analysis');
    }

    // ... (rest of the previous code remains the same)
}

module.exports = NodeMonitorAgent;