const { z } = require('zod');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME, clearCookieOptions } = require('../utils/token');

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    emailAlerts: z.boolean().optional(),
  })
  .strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to delete your account'),
});

async function updateProfile(req, res) {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user });
}

async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.currentPassword))) {
    throw new AppError(400, 'Current password is incorrect');
  }
  await user.setPassword(req.body.newPassword);
  await user.save();
  res.status(204).end();
}

async function deleteAccount(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.password))) throw new AppError(400, 'Password is incorrect');
  await User.deleteOne({ _id: user._id });
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  res.status(204).end();
}

module.exports = {
  updateProfile,
  changePassword,
  deleteAccount,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
};
