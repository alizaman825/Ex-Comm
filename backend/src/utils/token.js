const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

const COOKIE_NAME = 'token';

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

// clearCookie must match the options the cookie was set with (minus maxAge).
const clearCookieOptions = () => {
  const { maxAge, ...opts } = cookieOptions();
  return opts;
};

module.exports = { COOKIE_NAME, signToken, verifyToken, cookieOptions, clearCookieOptions };
