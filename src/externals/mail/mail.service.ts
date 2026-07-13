import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { CONFIG } from 'src/shared/constants/env';
import { LoginNotificationMailTemplate } from './templates/login-notification.template';
import { MagicLinkMailTemplate } from './templates/magic-link.template';
import { PasswordChangedNotificationTemplate } from './templates/password-changed-notification.template';
import { PasswordResetMailTemplate } from './templates/password-reset.template';
import { TwoFactorCodeMailTemplate } from './templates/two-factor-code.template';
import { VerificationMailTemplate } from './templates/verification-mail.template';
import { WelcomeMailTemplate } from './templates/welcome-mail.template';

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly name: string;
  private readonly appUrl: string;
  constructor() {
    this.apiKey = CONFIG.MAIL.API_KEY;
    this.from = CONFIG.MAIL.FROM;
    this.name = CONFIG.MAIL.NAME;
    this.appUrl = CONFIG.FRONTEND_URL;
    this.logger.log('Mailer sender Mail service initialized successfully');
  }

  private setMailApiKey() {
    return sgMail.setApiKey(this.apiKey);
  }

  private async sendMail(to: string, template: EmailTemplate) {
    this.setMailApiKey();
    try {
      const messageData = {
        to,
        from: {
          email: this.from,
          name: this.name,
        },
        subject: template.subject,
        text: template.text || 'Please enable HTML to view this email properly.',
        html: template.html,
      };

      const result = await sgMail.send(messageData);
      this.logger.log(`Email sent successfully to ${to} via SendGrid`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to} via SendGrid:`, error);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${this.appUrl}/auth/verify-email?token=${token}`;
    const template: EmailTemplate = new VerificationMailTemplate(verificationUrl);
    return await this.sendMail(email, template);
  }

  async sendMagicLink(email: string, token: string) {
    const magicLinkUrl = `${this.appUrl}/auth/magic-link?token=${token}`;
    const template: EmailTemplate = new MagicLinkMailTemplate(magicLinkUrl);
    return await this.sendMail(email, template);
  }

  async sendPasswordReset(email: string, token: string) {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;
    const template: EmailTemplate = new PasswordResetMailTemplate(resetUrl);
    return await this.sendMail(email, template);
  }

  async sendWelcomeEmail(email: string, name: string) {
    const dashboardUrl = `${this.appUrl}/dashboard`;
    const template: EmailTemplate = new WelcomeMailTemplate(name, dashboardUrl);
    return await this.sendMail(email, template);
  }

  async sendPasswordChangedNotification(email: string, name: string) {
    const supportUrl = `${this.appUrl}/support`;
    const changeTimestamp = new Date().toLocaleString();
    const template: EmailTemplate = new PasswordChangedNotificationTemplate(
      name,
      supportUrl,
      changeTimestamp,
    );
    return await this.sendMail(email, template);
  }

  async sendLoginNotification(email: string, name: string, ipAddress?: string, userAgent?: string) {
    const changePasswordUrl = `${this.appUrl}/auth/change-password`;
    const loginTimestamp = new Date().toLocaleString();
    const template: EmailTemplate = new LoginNotificationMailTemplate(
      name,
      loginTimestamp,
      ipAddress ?? 'IP Desconhecido',
      userAgent ?? 'Dispositivo Desconhecido',
      changePasswordUrl,
    );
    return await this.sendMail(email, template);
  }

  async sendTwoFactorCode(email: string, code: string) {
    const template: EmailTemplate = new TwoFactorCodeMailTemplate(code);
    return await this.sendMail(email, template);
  }

  // Método utilitário para enviar emails customizados
  async sendCustomEmail(to: string, subject: string, html: string, text?: string) {
    const template: EmailTemplate = {
      subject,
      html,
      text,
    };
    return this.sendMail(to, template);
  }

  async testConnection(): Promise<boolean> {
    try {
      const apiKey = CONFIG.MAIL.API_KEY;
      if (!apiKey) {
        this.logger.error('SendGrid API key not configured');
        return false;
      }
      this.logger.log('SendGrid connection test: API key is configured');
      return true;
    } catch (error) {
      this.logger.error('SendGrid connection test failed:', error);
      return false;
    }
  }

  async sendTestEmail(to: string): Promise<boolean> {
    try {
      const template: EmailTemplate = {
        subject: 'SendGrid Test Email',
        html: `
          <h1>SendGrid Integration Test</h1>
          <p>This is a test email to verify SendGrid integration is working correctly.</p>
          <p>Sent at: ${new Date().toLocaleString()}</p>
        `,
        text: `
          SendGrid Integration Test
    
          This is a test email to verify SendGrid integration is working correctly.
          
          Sent at: ${new Date().toLocaleString()}
        `,
      };
      await this.sendMail(to, template);
      return true;
    } catch (error) {
      this.logger.error('Failed to send test email:', error);
      return false;
    }
  }
}
