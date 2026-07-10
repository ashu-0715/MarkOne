import rateLimit from 'express-rate-limit';

const sharedAuthOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

// Tighter limit on OTP and registration endpoints to slow down abuse.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' },
  ...sharedAuthOptions,
});

// Login and student join can happen many times from one classroom Wi-Fi/IP.
// Successful requests are ignored so real students/teachers do not get stuck waiting.
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  skipSuccessfulRequests: true,
  message: { message: 'Too many failed login attempts. Please check the details and try again shortly.' },
  ...sharedAuthOptions,
});

export const studentJoinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  skipSuccessfulRequests: true,
  message: { message: 'Too many failed join attempts. Please check the class code and try again shortly.' },
  ...sharedAuthOptions,
});

// General API limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'Too many requests. Please slow down.' },
  ...sharedAuthOptions,
});
