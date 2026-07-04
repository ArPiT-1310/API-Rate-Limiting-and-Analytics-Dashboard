import jwt from 'jsonwebtoken';

/**
 * Generates a short-lived access token containing the user ID.
 * @param {string} userId - The unique identifier of the user.
 * @returns {string} Signed JWT access token.
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
};

/**
 * Generates a long-lived refresh token containing the user ID.
 * @param {string} userId - The unique identifier of the user.
 * @returns {string} Signed JWT refresh token.
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

export {
  generateAccessToken,
  generateRefreshToken,
};
