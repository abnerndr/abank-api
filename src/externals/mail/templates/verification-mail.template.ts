import {
  mailBox,
  mailButton,
  mailFallbackLink,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class VerificationMailTemplate {
  subject: string;
  html: string;
  text?: string;

  constructor(verificationUrl: string) {
    this.subject = `Confirme seu e-mail no ${MAIL_BRAND.name}`;

    const body = [
      mailParagraph(
        'Falta pouco para ativar sua conta ABank. Clique no botão abaixo para confirmar seu endereço de e-mail.',
        'center',
      ),
      mailButton(verificationUrl, 'Verificar e-mail'),
      mailBox(
        'Este link expira em <strong>24 horas</strong> por motivos de segurança.',
        'info',
      ),
      mailFallbackLink(verificationUrl),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Confirme seu e-mail e ative sua conta ${MAIL_BRAND.name}.`,
      eyebrow: 'Cadastro',
      title: 'Verifique seu e-mail',
      body,
    });

    this.text = `Confirme seu e-mail no ${MAIL_BRAND.name}

Falta pouco para ativar sua conta. Confirme seu endereço de e-mail:
${verificationUrl}

Este link expira em 24 horas por motivos de segurança.

Se você não criou uma conta ABank, pode ignorar este e-mail com segurança.`;
  }
}
