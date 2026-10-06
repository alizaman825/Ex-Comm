const { z } = require('zod');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, signToken, cookieOptions, clearCookieOptions } = require('../utils/token');

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z.string().min(8, 'Password must be at least 8 characters').max(128);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password,
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

function sendSession(res, status, user) {
  const token = signToken(user._id);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  // Token is also returned for API clients (Postman); the browser uses the httpOnly cookie.
  res.status(status).json({ user, token });
}

async function register(req, res) {
  const { name, email: mail, password: pass } = req.body;
  if (await User.exists({ email: mail })) throw new AppError(409, 'An account with this email already exists');
  const user = new User({ name, email: mail });
  await user.setPassword(pass);
  await user.save();
  sendSession(res, 201, user);
}

async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await user.checkPassword(req.body.password))) {
    throw new AppError(401, 'Invalid email or password');
  }
  sendSession(res, 200, user);
}

function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  res.status(204).end();
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, logout, me, registerSchema, loginSchema };
