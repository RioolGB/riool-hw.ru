import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log("[email] SMTP не настроен — использую streamTransport (письма логируются в консоль)");
    transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
  } else {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
  return transporter;
}

export interface ReminderEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(message: ReminderEmail): Promise<void> {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || "CycleTracker <no-reply@example.com>";
  const info = await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  if ((info as { response?: string }).response) {
    console.log(`[email] Отправлено на ${message.to}: ${(info as { response: string }).response}`);
  } else {
    const preview = (info as { message?: Buffer }).message;
    if (preview) {
      const raw = preview.toString("utf8");
      console.log("[email] Письмо (не отправлено, SMTP не настроен):\n");
      console.log("------BEGIN EMAIL------");
      console.log(`To: ${message.to}`);
      console.log(`Subject: ${message.subject}`);
      console.log(raw.split("\r\n\r\n")[1] ?? raw);
      console.log("------END EMAIL------");
    }
  }
}

export function sendPeriodReminder(
  to: string,
  expectedDate: string,
  cycleDay: number
): Promise<void> {
  const subject = "Завтра ожидаются месячные";
  const text = [
    `Здравствуйте!`,
    ``,
    `По вашим наблюдениям завтра (${expectedDate}) ожидается начало менструального цикла.`,
    `Надеемся, трекер помогает вам чувствовать себя увереннее.`,
    ``,
    `— CycleTracker`
  ].join("\n");
  const html = `
<p>Здравствуйте!</p>
<p>По вашим наблюдениям <strong>завтра (${expectedDate})</strong> ожидается начало менструального цикла.</p>
<p>Надеемся, трекер помогает вам чувствовать себя увереннее.</p>
<p>— CycleTracker</p>`;
  return sendEmail({ to, subject, text, html });
}