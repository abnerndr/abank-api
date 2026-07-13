import {
  mailBox,
  mailButton,
  mailFallbackLink,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class PasswordResetMailTemplate {
  subject: string;
  html: string;
  text: string;

  constructor(resetUrl: string) {
    this.subject = `Redefina sua senha ${MAIL_BRAND.name}`;

    const body = [
      mailParagraph(
        'Você solicitou a redefinição de senha da sua conta ABank. Clique no botão abaixo para criar uma nova senha.',
        'center',
      ),
      mailButton(resetUrl, 'Redefinir senha'),
      mailBox(
        'Este link expira em <strong>1 hora</strong> por questões de segurança.',
        'warning',
      ),
      mailFallbackLink(resetUrl),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Redefina o acesso à sua conta ${MAIL_BRAND.name}.`,
      eyebrow: 'Recuperação',
      title: 'Redefinição de senha',
      body,
      footerNote:
        'Se você não solicitou esta redefinição, ignore este e-mail. Sua senha permanecerá inalterada.',
    });

    this.text = `Redefina sua senha ${MAIL_BRAND.name}

Você solicitou a redefinição de senha. Acesse o link abaixo:
${resetUrl}

Este link expira em 1 hora por questões de segurança.

Se você não solicitou esta redefinição, ignore este e-mail. Sua senha não será alterada.`;
  }
}
