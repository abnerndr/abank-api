import {
  mailBox,
  mailButton,
  mailParagraph,
  MAIL_BRAND,
  renderMailLayout,
} from './mail-layout';

export class PasswordChangedNotificationTemplate {
  subject: string;
  html: string;
  text: string;

  constructor(name: string, supportUrl: string, changeTimestamp: string) {
    this.subject = `Sua senha ${MAIL_BRAND.name} foi alterada`;

    const body = [
      mailParagraph(`Olá, <strong>${name}</strong>,`),
      mailParagraph(
        'Este e-mail confirma que a senha da sua conta ABank foi alterada com sucesso.',
      ),
      mailBox(
        `Sua senha foi alterada em <strong>${changeTimestamp}</strong> (horário de Brasília).`,
        'success',
      ),
      mailParagraph(
        'Se foi <strong>você</strong> quem fez esta alteração, nenhuma outra ação é necessária.',
      ),
      mailBox(
        '<strong>Não foi você?</strong><br>Se você não solicitou esta alteração, entre em contato com nosso suporte imediatamente.',
        'warning',
      ),
      mailButton(supportUrl, 'Reportar atividade suspeita'),
    ].join('');

    this.html = renderMailLayout({
      preheader: `Confirmação de alteração de senha na sua conta ${MAIL_BRAND.name}.`,
      eyebrow: 'Segurança',
      title: 'Senha alterada com sucesso',
      body,
    });

    this.text = `Sua senha ${MAIL_BRAND.name} foi alterada

Olá, ${name},

Este e-mail confirma que a senha da sua conta foi alterada com sucesso.

Data da alteração: ${changeTimestamp} (horário de Brasília)

Se foi você quem fez esta alteração, nenhuma outra ação é necessária.

Se você não solicitou esta alteração, reporte imediatamente:
${supportUrl}`;
  }
}
