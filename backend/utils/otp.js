import crypto from 'crypto';

export const generateOtp = () => crypto.randomInt(100000, 999999).toString();

/**
 * Sends an OTP via SMS. Currently a stub that logs to console in development.
 * Plug in a real provider (Twilio, MSG91, etc.) using SMS_API_KEY from .env.
 */
export const sendOtpSms = async (mobile, otp) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV OTP] Sending OTP ${otp} to ${mobile}`);
    return true;
  }
  if (!process.env.SMS_API_KEY) {
    throw new Error('SMS_API_KEY not configured. Add your SMS provider credentials to .env');
  }
  // Example: await fetch('https://your-sms-provider.com/send', { ... })
  throw new Error('SMS provider not yet wired up. See utils/otp.js');
};
