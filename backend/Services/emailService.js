import nodemailer from "nodemailer";

let cachedTransporter = null;

const createTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } =
    process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: SMTP_SECURE === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  } else {
    cachedTransporter = {
      sendMail: async (mailOptions) => {
        console.log("[EmailService] Mock email delivery", mailOptions);
      },
    };
  }

  return cachedTransporter;
};

export const sendClubInvitationEmail = async ({
  to,
  clubName,
  tempPassword,
  loginUrl,
}) => {
  if (!to) {
    return;
  }

  const transporter = createTransporter();
  const resolvedLoginUrl =
    loginUrl || process.env.PORTAL_LOGIN_URL || "http://localhost:5176/login";

  const subject = `TRF Portal Access for ${clubName}`;
  const text = `Bienvenue sur le portail TRF.

Un compte a été créé pour ${clubName}.

Identifiant: ${to}
Mot de passe provisoire: ${tempPassword}

Veuillez vous connecter sur ${resolvedLoginUrl} et changer votre mot de passe dès la première connexion.`;

  const html = `<p>Bienvenue sur le portail TRF.</p>
<p>Un compte a été créé pour <strong>${clubName}</strong>.</p>
<ul>
  <li><strong>Identifiant:</strong> ${to}</li>
  <li><strong>Mot de passe provisoire:</strong> ${tempPassword}</li>
</ul>
<p>Veuillez vous connecter sur <a href="${resolvedLoginUrl}">${resolvedLoginUrl}</a> et changer votre mot de passe dès la première connexion.</p>`;

  await transporter.sendMail({
    to,
    from: process.env.MAIL_FROM || "no-reply@trf-portal.local",
    subject,
    text,
    html,
  });
};
