import {
  mailBox,
  mailCodeBox,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class TwoFactorCodeMailTemplate {
  subject: string;
  html: string;
  text: string;

  constructor(code: string) {
    this.subject = `Código de verificação ${MAIL_BRAND.name}`;

    const body = [
      mailParagraph(
        'Use o código abaixo para concluir o login na sua conta ABank:',
        'center',
      ),
      mailCodeBox(code),
      mailBox(
        'Este código expira em <strong>5 minutos</strong>. Não compartilhe com ninguém.',
        'warning',
      ),
      mailParagraph(
        'Insira este código na tela de autenticação do aplicativo para continuar.',
        'center',
      ),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Seu código de verificação ${MAIL_BRAND.name}: ${code}`,
      eyebrow: 'Autenticação',
      title: 'Código de segurança',
      body,
    });

    this.text = `Código de verificação ${MAIL_BRAND.name}

Seu código de autenticação de dois fatores é: ${code}

Este código expira em 5 minutos. Não compartilhe com ninguém.

Insira este código na tela de autenticação do aplicativo para continuar.

Se você não solicitou este código, pode ignorar este e-mail com segurança.`;
  }
}
