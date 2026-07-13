import {
  mailBox,
  mailButton,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class WelcomeMailTemplate {
  subject: string;
  html: string;
  text: string;

  constructor(name: string, dashboardUrl: string) {
    this.subject = `Bem-vindo(a) ao ${MAIL_BRAND.name}`;

    const features = [
      'Consultar o saldo da sua carteira digital',
      'Depositar e transferir valores entre usuários',
      'Acompanhar o histórico de transações',
      'Gerenciar seu perfil e segurança da conta',
    ]
      .map(
        (item) =>
          `<li style="margin:0 0 10px;font-size:15px;color:#0f1923;line-height:1.5;opacity:0.88;"><span style="color:#c9a96e;font-weight:600;margin-right:8px;">→</span>${item}</li>`,
      )
      .join('');

    const body = [
      mailParagraph(
        `Olá, <strong>${name}</strong>! Sua conta no ABank está pronta. ${MAIL_BRAND.motto}`,
        'center',
      ),
      mailBox('Sua conta foi criada e verificada com sucesso.', 'success'),
      mailParagraph('O que você pode fazer agora:'),
      `<ul style="margin:0 0 8px;padding:0;list-style:none;">${features}</ul>`,
      mailButton(dashboardUrl, 'Acessar minha carteira'),
      mailParagraph(
        'Dúvidas? Acesse o aplicativo ou entre em contato com nosso suporte.',
        'center',
      ),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Sua conta ${MAIL_BRAND.name} está ativa. Comece a usar sua carteira digital.`,
      eyebrow: 'Boas-vindas',
      title: `Bem-vindo(a), ${name}!`,
      body,
      footerNote: `Obrigado por escolher o ${MAIL_BRAND.name}.`,
    });

    this.text = `Bem-vindo(a) ao ${MAIL_BRAND.name}

Olá, ${name}!

Sua conta foi criada e verificada com sucesso. ${MAIL_BRAND.motto}

O que você pode fazer agora:
- Consultar o saldo da sua carteira digital
- Depositar e transferir valores entre usuários
- Acompanhar o histórico de transações
- Gerenciar seu perfil e segurança da conta

Acesse sua carteira: ${dashboardUrl}

Obrigado por escolher o ${MAIL_BRAND.name}.`;
  }
}
