export const MAIL_BRAND = {
  name: 'ABank',
  tagline: 'Banco Digital',
  motto: 'Sua vida financeira, sem complicação.',
} as const;

const C = {
  pageBg: '#f4f2ee',
  card: '#ffffff',
  primary: '#0f1923',
  primaryFg: '#f4f2ee',
  accent: '#c9a96e',
  foreground: '#0f1923',
  muted: '#7a7670',
  mutedBg: '#eae8e3',
  inputBg: '#f0eee9',
  destructive: '#b0292a',
  border: 'rgba(15, 25, 35, 0.1)',
  successBg: 'rgba(77, 128, 97, 0.1)',
  successBorder: 'rgba(77, 128, 97, 0.28)',
  successText: '#2d5a3d',
  warningBg: 'rgba(201, 169, 110, 0.12)',
  warningBorder: 'rgba(201, 169, 110, 0.35)',
  warningText: '#6b5428',
  dangerBg: 'rgba(176, 41, 42, 0.08)',
  dangerBorder: 'rgba(176, 41, 42, 0.25)',
  dangerText: '#8b1f20',
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Courier New', Courier, monospace";

function walletIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="display:block"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`;
}

export interface MailLayoutOptions {
  preheader?: string;
  title?: string;
  eyebrow?: string;
  body: string;
  footerNote?: string;
}

export function renderMailLayout(options: MailLayoutOptions): string {
  const { preheader = '', title, eyebrow, body, footerNote } = options;

  const titleBlock = title
    ? `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${C.foreground};letter-spacing:-0.02em;line-height:1.3;">${title}</h1>`
    : '';

  const eyebrowBlock = eyebrow
    ? `<p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${C.accent};font-family:${MONO};">${eyebrow}</p>`
    : '';

  const footer = footerNote
    ? `<p style="margin:24px 0 0;font-size:13px;color:${C.muted};line-height:1.6;text-align:center;">${footerNote}</p>`
    : `<p style="margin:24px 0 0;font-size:13px;color:${C.muted};line-height:1.6;text-align:center;">Se você não solicitou este e-mail, pode ignorá-lo com segurança.</p>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title ?? MAIL_BRAND.name}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${C.pageBg};font-family:${FONT};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.pageBg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${C.card};border-radius:12px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 4px 24px rgba(15,25,35,0.06);">
          <tr>
            <td style="background-color:${C.primary};padding:28px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;border-radius:8px;border:1px solid rgba(201,169,110,0.4);text-align:center;vertical-align:middle;">${walletIcon()}</td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <span style="font-size:12px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:${C.primaryFg};opacity:0.55;">${MAIL_BRAND.name}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:20px;">
                    <div style="height:1px;background-color:${C.accent};opacity:0.35;max-width:120px;"></div>
                    <p style="margin:12px 0 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${C.accent};font-family:${MONO};">${MAIL_BRAND.tagline}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${eyebrowBlock}
              ${titleBlock}
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;border-top:1px solid ${C.border};">
              <p style="margin:24px 0 8px;font-size:12px;color:${C.muted};text-align:center;line-height:1.5;">
                ${MAIL_BRAND.name} · ${MAIL_BRAND.motto}
              </p>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function mailParagraph(text: string, align: 'left' | 'center' = 'left'): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${C.foreground};line-height:1.65;text-align:${align};opacity:0.88;">${text}</p>`;
}

export function mailButton(
  href: string,
  label: string,
  variant: 'primary' | 'destructive' = 'primary',
): string {
  const bg = variant === 'destructive' ? C.destructive : C.primary;
  const fg = C.primaryFg;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 8px;">
    <tr>
      <td style="border-radius:8px;background-color:${bg};">
        <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${fg};text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

type MailBoxVariant = 'info' | 'warning' | 'success' | 'danger';

export function mailBox(content: string, variant: MailBoxVariant): string {
  const styles: Record<MailBoxVariant, { bg: string; border: string; text: string }> = {
    info: { bg: C.inputBg, border: C.border, text: C.foreground },
    warning: { bg: C.warningBg, border: C.warningBorder, text: C.warningText },
    success: { bg: C.successBg, border: C.successBorder, text: C.successText },
    danger: { bg: C.dangerBg, border: C.dangerBorder, text: C.dangerText },
  };
  const s = styles[variant];
  return `<div style="margin:20px 0;padding:16px 18px;background-color:${s.bg};border:1px solid ${s.border};border-radius:8px;font-size:14px;color:${s.text};line-height:1.6;">${content}</div>`;
}

export function mailCodeBox(code: string): string {
  return `<div style="margin:24px 0;padding:24px 20px;background-color:${C.inputBg};border:1px solid ${C.border};border-radius:10px;text-align:center;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};font-family:${MONO};">Código de verificação</p>
    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:10px;color:${C.foreground};font-family:${MONO};">${code}</p>
  </div>`;
}

export function mailFallbackLink(url: string): string {
  return `<p style="margin:28px 0 8px;font-size:13px;color:${C.muted};line-height:1.5;text-align:center;">Se o botão não funcionar, copie e cole o link abaixo no navegador:</p>
  <p style="margin:0;font-size:13px;word-break:break-all;text-align:center;">
    <a href="${url}" style="color:${C.accent};text-decoration:underline;">${url}</a>
  </p>`;
}

export function mailDetailList(items: Array<{ label: string; value: string }>): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:${C.muted};width:40%;">${item.label}</td><td style="padding:6px 0;font-size:14px;color:${C.foreground};font-family:${MONO};">${item.value}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows}</table>`;
}
