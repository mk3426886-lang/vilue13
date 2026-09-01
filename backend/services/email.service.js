/**
 * Vilue — Email service
 *
 * Provider-swappable: only this file talks to Gmail/Nodemailer directly.
 * Every caller uses sendEmail(to, subject, html) and never touches
 * transporter details, so switching to SendGrid/SES later means
 * rewriting this one file only.
 *
 * Setup required (see /.env.example):
 *   GMAIL_USER      — the Gmail address Vilue sends from
 *   GMAIL_APP_PASSWORD — a 16-char Google "App Password", NOT the normal
 *                        account password. Generate one at:
 *                        https://myaccount.google.com/apppasswords
 *                        (requires 2-Step Verification enabled on the account)
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      'Email service not configured — set GMAIL_USER and GMAIL_APP_PASSWORD in .env'
    );
  }

  // Koyeb (and most PaaS hosts) block/throttle outbound SMTP on port 465
  // for datacenter IPs — connections either hang or get silently dropped,
  // which is why registration could look like it "does nothing" (the
  // request never resolves). Port 587 with STARTTLS is what Koyeb's own
  // docs recommend, and short timeouts make any real failure surface as
  // a clear error instead of an indefinite hang.
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS, upgraded automatically after connecting
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

async function sendEmail(to, subject, html) {
  const t = getTransporter();
  return t.sendMail({
    from: `Vilue <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

async function sendOtpEmail(to, code, lang = 'ar') {
  const isAr = lang === 'ar';
  const subject = isAr ? 'رمز التحقق الخاص بك في فيليو' : 'Your Vilue verification code';
  const dir = isAr ? 'rtl' : 'ltr';

  const t = {
    preheader: isAr ? 'رمز التحقق الخاص بك جاهز' : 'Your verification code is ready',
    heading: isAr ? 'تحقق من حسابك' : 'Verify your account',
    body: isAr
      ? 'استخدم الرمز التالي لإكمال إنشاء حسابك في فيليو:'
      : 'Use the code below to complete your Vilue account setup:',
    expiry: isAr ? 'ينتهي هذا الرمز خلال 10 دقائق.' : 'This code expires in 10 minutes.',
    spamNote: isAr
      ? 'لم تجد الرسالة؟ تحقق من مجلد الرسائل غير المرغوب بها (Spam / Junk).'
      : "Can't find it? Check your Spam or Junk folder.",
    warning: isAr
      ? 'لم تطلب هذا الرمز؟ يمكنك تجاهل هذه الرسالة بأمان.'
      : "Didn't request this? You can safely ignore this email.",
    footer: isAr
      ? 'هذه رسالة تلقائية من فيليو، الرجاء عدم الرد عليها.'
      : 'This is an automated message from Vilue — please do not reply.',
  };

  const html = `
  <!DOCTYPE html>
  <html lang="${lang}" dir="${dir}">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#F4F5FA;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#F4F5FA;">${t.preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5FA;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:440px;" cellpadding="0" cellspacing="0">

            <!-- Logo header -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:linear-gradient(135deg,#FF4D9D,#6440E0);background-color:#E0248C;width:40px;height:40px;border-radius:12px;text-align:center;vertical-align:middle;">
                      <span style="color:#ffffff;font-weight:800;font-size:18px;line-height:40px;">V</span>
                    </td>
                    <td style="padding-${isAr ? 'right' : 'left'}:10px;color:#0B1330;font-weight:800;font-size:20px;">
                      ${isAr ? 'فيليو' : 'Vilue'}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff;border-radius:20px;padding:36px 28px;box-shadow:0 8px 24px rgba(11,19,48,0.06);text-align:center;">
                <h1 style="margin:0 0 12px;font-size:20px;color:#0B1330;">${t.heading}</h1>
                <p style="margin:0 0 24px;font-size:14px;color:#6B7089;line-height:1.6;">${t.body}</p>

                <div style="background:#EEF0F7;border-radius:14px;padding:18px;margin:0 0 20px;">
                  <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#0B1330;">${code}</span>
                </div>

                <p style="margin:0;font-size:13px;color:#8B8FA8;">${t.expiry}</p>
                <p style="margin:12px 0 0;font-size:12px;color:#E0248C;font-weight:700;background:#FFF0F7;padding:8px 12px;border-radius:10px;">${t.spamNote}</p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 12px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#8B8FA8;">${t.warning}</p>
                <p style="margin:0;font-size:11px;color:#B0B3C4;">${t.footer}</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  return sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendOtpEmail };
