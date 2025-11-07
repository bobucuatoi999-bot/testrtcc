// Optional Prometheus metrics (only loaded if MONITORING_ENABLED=true)
let register, Counter, Gauge, Histogram;

function setupMetrics(app) {
  try {
    // Only initialize if monitoring is enabled
    if (process.env.MONITORING_ENABLED !== 'true') {
      return;
    }

    // Try to require prom-client (should be installed if monitoring is needed)
    try {
      const promClient = require('prom-client');
      register = new promClient.Registry();
      Counter = promClient.Counter;
      Gauge = promClient.Gauge;
      Histogram = promClient.Histogram;

      // Collect default metrics
      promClient.collectDefaultMetrics({ register });

      // Custom metrics
      const roomsGauge = new Gauge({
        name: 'webrtc_rooms_total',
        help: 'Total number of active rooms',
        registers: [register]
      });

      const participantsGauge = new Gauge({
        name: 'webrtc_participants_total',
        help: 'Total number of active participants',
        registers: [register]
      });

      const wsMessagesCounter = new Counter({
        name: 'webrtc_ws_messages_total',
        help: 'Total number of WebSocket messages',
        labelNames: ['type'],
        registers: [register]
      });

      module.exports.register = register;
      module.exports.roomsGauge = roomsGauge;
      module.exports.participantsGauge = participantsGauge;
      module.exports.wsMessagesCounter = wsMessagesCounter;
    } catch (error) {
      console.warn('prom-client not available, monitoring disabled');
    }
  } catch (error) {
    console.warn('Failed to setup metrics', error.message);
  }
}

module.exports = { setupMetrics, register: null };

