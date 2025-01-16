const NodeMonitorAgent = require('./services/monitor.agent');
const config = require('./config/monitor.config');
const logger = require('./utils/logger');

async function startMonitor() {
    try {
        const monitor = new NodeMonitorAgent(config);
        await monitor.start();
        logger.info('Monitor started successfully');
    } catch (error) {
        logger.error('Failed to start monitor:', error);
        process.exit(1);
    }
}

startMonitor();