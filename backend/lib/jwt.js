const jwt = require('jsonwebtoken');
const logger = require('./logger');

const SECRET = process.env.JWT_SECRET || 'change-me';
const EXPIRES_IN = '1h';

/**
 * Create JWT token
 */
function createToken(payload) {
  try {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
  } catch (error) {
    logger.error('Error creating token', { error: error.message });
    throw error;
  }
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    logger.error('Error verifying token', { error: error.message });
    throw error;
  }
}

module.exports = { createToken, verifyToken };

