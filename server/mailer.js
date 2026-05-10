'use strict';

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function otpEmailHTML(code) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>ThinkFi Verification</h2>

      <p>Your verification code is:</p>

      <div style="
        font-size: 32px;
        font-weight: bold;
        background: #111827;
        color: #22d3ee;
        padding: 16px;
        border-radius: 10px;
        width: fit-content;
        letter-spacing: 6px;
      ">
        ${code}
      </div>

      <p style="margin-top:20px;">
        This code expires in 10 minutes.
      </p>
    </div>
  `;
}

async function sendOTP(to, code) {
  const response = await resend.emails.send({
    from: 'ThinkFi <onboarding@resend.dev>',
    to,
    subject: `${code} - ThinkFi Verification Code`,
    html: otpEmailHTML(code),
  });

  console.log(response);
}

module.exports = { sendOTP };
