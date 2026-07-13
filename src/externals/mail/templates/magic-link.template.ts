import {
  mailBox,
  mailButton,
  mailFallbackLink,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class MagicLinkMailTemplate {
  subject: string;
  html: string;
  text: string;

  constructor(magicLinkUrl: string) {
    this.subject = `Seu link de acesso ${MAIL_BRAND.name}`;

    const body = [
      mailParagraph(
        'Clique no botão abaixo para acessar sua conta de forma segura. Não é necessário informar senha.',
        'center',
      ),
      mailButton(magicLinkUrl, 'Acessar minha conta'),
      mailBox(
        '<strong>Link de uso único.</strong> Este acesso expira em <strong>15 minutos</strong>. Não compartilhe este link com ninguém.',
        'warning',
      ),
      mailFallbackLink(magicLinkUrl),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Acesse sua conta ${MAIL_BRAND.name} com um clique.`,
      eyebrow: 'Acesso rápido',
      title: 'Seu link de login',
      body,
    });

    this.text = `Seu link de acesso ${MAIL_BRAND.name}

Acesse sua conta pelo link abaixo:
${magicLinkUrl}

Este link é de uso único e expira em 15 minutos. Não o compartilhe com ninguém.

Se você não solicitou este acesso, pode ignorar este e-mail com segurança.`;
  }
}
