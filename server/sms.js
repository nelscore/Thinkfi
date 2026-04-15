'use strict';

/**
 * sms.js — SMS service for OTP delivery.
 *
 * Currently uses development mock (logs to console).
 * To use real SMS (Twilio, AWS, etc.), replace sendSMS() implementation.
 */

/**
 * Send an OTP via SMS.
 * @param {string} phone — recipient phone number (e.g., +91 98765 43210)
 * @param {string} code  — the 6-digit code
 */
async function sendSMS(phone, code) {
  // ──────────────────────────────────────────────────
  // DEVELOPMENT MODE: Log to console
  // In production, replace this with real SMS provider
  // ──────────────────────────────────────────────────
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📱 SMS OTP (Development Mode)');
    console.log('═══════════════════════════════════════════════════');
    console.log(`To: ${phone}`);
    console.log(`OTP Code: ${code}`);
    console.log('Expires: 10 minutes');
    console.log('═══════════════════════════════════════════════════\n');
    return;
  }

  // ──────────────────────────────────────────────────
  // PRODUCTION: Implement real SMS provider
  // Example for Twilio:
  // ──────────────────────────────────────────────────
  /*
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  await client.messages.create({
    body: `Your ThinkFi verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
  */
}

module.exports = { sendSMS };
