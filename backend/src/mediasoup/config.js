const config = require('../config');

/**
 * Mediasoup Router Codecs Configuration
 * Optimized for Asia-Pacific region (Vietnam, Singapore, etc.)
 */
const routerCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    parameters: {
      useinbandfec: 1,
      usedtx: 1
    }
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1
    }
  }
];

/**
 * WebRtcTransport Configuration
 * Optimized for Vietnam and global access
 */
const webRtcTransportConfig = {
  listenIps: [
    {
      ip: config.MEDIASOUP.LISTEN_IP,
      announcedIp: config.MEDIASOUP.ANNOUNCED_IP,
      announcedAddress: config.MEDIASOUP.ANNOUNCED_DOMAIN
    }
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  preferTcp: false,
  initialAvailableOutgoingBitrate: 1000000,
  minimumAvailableOutgoingBitrate: 600000,
  maxSctpMessageSize: 262144,
  maxIncomingBitrate: 1500000
};

/**
 * Worker Settings
 */
const workerSettings = {
  logLevel: config.NODE_ENV === 'production' ? 'warn' : 'debug',
  logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  rtcMinPort: config.MEDIASOUP.MIN_PORT,
  rtcMaxPort: config.MEDIASOUP.MAX_PORT
};

module.exports = {
  routerCodecs,
  webRtcTransportConfig,
  workerSettings
};

