import {
  mailBox,
  mailButton,
  mailDetailList,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class LoginNotificationMailTemplate {
  subject: string;
  html: string;
  text: string;

  constructor(
    name: string,
    loginTimestamp: string,
    ipAddress: string,
    userAgent: string,
    changePasswordUrl: string,
  ) {
    this.subject = 'Novo login na sua conta ABank';

    const body = [
      mailParagraph(`Olá, <strong>${name}</strong>,`),
      mailParagraph(
        'Detectamos um novo acesso à sua conta ABank. Confira os detalhes abaixo:',
      ),
      mailBox(
        mailDetailList([
          { label: 'Data', value: loginTimestamp },
          { label: 'Endereço IP', value: ipAddress },
          { label: 'Dispositivo', value: userAgent },
        ]),
        'warning',
      ),
      mailParagraph(
        'Se foi <strong>você</strong> quem fez este acesso, nenhuma outra ação é necessária.',
      ),
      mailBox(
        '<strong>Não reconhece este acesso?</strong><br>Se você não foi o autor deste login, altere sua senha imediatamente para proteger sua conta.',
        'danger',
      ),
      mailButton(changePasswordUrl, 'Alterar senha', 'destructive'),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Novo login detectado na sua conta ${MAIL_BRAND.name}.`,
      eyebrow: 'Segurança',
      title: 'Novo login detectado',
      body,
      footerNote:
        'Este alerta é enviado automaticamente sempre que um novo acesso é identificado.',
    });

    this.text = `Novo login na sua conta ${MAIL_BRAND.name}

Olá, ${name},

Detectamos um novo acesso à sua conta. Detalhes:

Data: ${loginTimestamp}
Endereço IP: ${ipAddress}
Dispositivo: ${userAgent}

Se foi você quem fez este acesso, nenhuma outra ação é necessária.

Se você não foi o autor deste login, altere sua senha imediatamente:
${changePasswordUrl}`;
  }
}
