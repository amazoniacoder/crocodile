import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import dns from 'dns';

// Принудительно использовать IPv4 для всех DNS-запросов
dns.setDefaultResultOrder('ipv4first');

interface ContactMessageData {
  email: string;
  subject: 'question' | 'bug' | 'feature' | 'other';
  message: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private initializationError: string | null = null;

  constructor() {
    // Не инициализируем в конструкторе, делаем это лениво
  }

  private ensureInitialized() {
    if (this.transporter !== null) {
      return; // Уже инициализирован
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      this.initializationError = 'SMTP not configured in environment variables';
      console.warn('[EmailService] SMTP not configured. Email sending disabled.');
      return;
    }

    try {
      const port = parseInt(SMTP_PORT || '587');
      const secure = SMTP_SECURE === 'true' || port === 465;

      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
        },
        debug: true,
        logger: true,
      } as any);

      this.isConfigured = true;
      console.log('[EmailService] Initialized successfully');
    } catch (error) {
      this.initializationError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EmailService] Initialization failed:', error);
    }
  }

  async sendContactMessage(data: ContactMessageData): Promise<void> {
    this.ensureInitialized();

    if (!this.isConfigured || !this.transporter) {
      console.error('[EmailService] Service not configured:', this.initializationError);
      throw new Error(this.initializationError || 'Email service not configured');
    }

    const subjectMap = {
      question: 'Вопрос',
      bug: 'Сообщение о баге',
      feature: 'Предложение',
      other: 'Другое',
    };

    const emailText = `
От: ${data.email}
Тема: ${subjectMap[data.subject]}

Сообщение:
${data.message}

---
Отправлено через форму обратной связи BlogPro
    `.trim();

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
      replyTo: data.email,
      subject: `[BlogPro] ${subjectMap[data.subject]}`,
      text: emailText,
    };

    console.log('[EmailService] Attempting to send email:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Message sent successfully:`, info.messageId);
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      if (error instanceof Error) {
        console.error('[EmailService] Error details:', error.message);
      }
      throw new Error('Failed to send email');
    }
  }

  async verifyConnection(): Promise<boolean> {
    this.ensureInitialized();

    if (!this.isConfigured || !this.transporter) {
      console.error('[EmailService] Cannot verify: service not configured -', this.initializationError);
      return false;
    }

    try {
      console.log('[EmailService] Verifying SMTP connection...');
      await this.transporter.verify();
      console.log('[EmailService] SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('[EmailService] Connection verification failed:', error);
      if (error instanceof Error) {
        console.error('[EmailService] Error message:', error.message);
        console.error('[EmailService] Error stack:', error.stack);
      }
      return false;
    }
  }
}

export const emailService = new EmailService();
