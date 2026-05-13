import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { asyncHandler } from '../../middleware/errorHandler';
import { emailService } from '../../infrastructure/email/EmailService';

const router = Router();

// Rate limiting: 3 сообщения в час с одного IP
const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3,
  message: { error: 'Слишком много запросов. Попробуйте через час.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Zod схема валидации
const contactSchema = z.object({
  email: z.string().email('Некорректный email').max(100, 'Email слишком длинный'),
  subject: z.enum(['question', 'bug', 'feature', 'other'], {
    errorMap: () => ({ message: 'Некорректная тема' }),
  }),
  message: z
    .string()
    .min(10, 'Сообщение должно содержать минимум 10 символов')
    .max(1000, 'Сообщение не должно превышать 1000 символов'),
  captchaToken: z.string().min(1, 'Пройдите проверку капчи'),
  honeypot: z.string().optional(),
});

// POST /api/contact
router.post(
  '/',
  contactRateLimiter,
  asyncHandler(async (req, res) => {
    // Валидация данных
    const validationResult = contactSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Некорректные данные',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { email, subject, message, honeypot } = validationResult.data;

    // Honeypot проверка (если заполнено — это бот)
    if (honeypot && honeypot.trim() !== '') {
      console.warn('[Contact] Honeypot triggered from IP:', req.ip);
      // Возвращаем успех, чтобы бот не понял, что его обнаружили
      return res.json({ success: true, message: 'Сообщение отправлено' });
    }

    // TODO: Валидация captchaToken (пока пропускаем, т.к. капча mock)
    // В production здесь должна быть проверка JWT токена капчи

    // Sanitization сообщения (удаляем HTML)
    const cleanMessage = sanitizeHtml(message, {
      allowedTags: [],
      allowedAttributes: {},
    });

    console.log('[Contact] Processing message from:', email);

    // Отправка email
    try {
      await emailService.sendContactMessage({
        email,
        subject,
        message: cleanMessage,
      });

      console.log('[Contact] Message sent successfully');
      res.json({
        success: true,
        message: 'Сообщение отправлено',
      });
    } catch (error) {
      console.error('[Contact] Failed to send email:', error);
      
      // Определяем тип ошибки для понятного сообщения
      const errorMessage = error instanceof Error ? error.message : '';
      const isNetworkError = errorMessage.includes('ENETUNREACH') || 
                            errorMessage.includes('ETIMEDOUT') || 
                            errorMessage.includes('ECONNREFUSED');
      
      if (isNetworkError) {
        return res.status(503).json({
          error: 'Не удалось подключиться к почтовому серверу. Возможные причины:',
          details: [
            'Включен VPN — попробуйте отключить',
            'Проблемы с интернет-соединением',
            'Временные проблемы на стороне сервера'
          ],
          hint: 'Попробуйте отключить VPN и повторить попытку'
        });
      }
      
      res.status(500).json({
        error: 'Не удалось отправить сообщение. Попробуйте позже.',
      });
    }
  })
);

// GET /api/contact/test - тест SMTP подключения
router.get(
  '/test',
  asyncHandler(async (req, res) => {
    const isConnected = await emailService.verifyConnection();
    res.json({
      smtp: isConnected ? 'connected' : 'disconnected',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM,
        to: process.env.CONTACT_EMAIL,
      },
    });
  })
);

// POST /api/contact/test-send - отправка тестового письма
router.post(
  '/test-send',
  asyncHandler(async (req, res) => {
    try {
      await emailService.sendContactMessage({
        email: 'test@example.com',
        subject: 'question',
        message: 'Тестовое сообщение для проверки SMTP',
      });
      res.json({ success: true, message: 'Тестовое письмо отправлено' });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
