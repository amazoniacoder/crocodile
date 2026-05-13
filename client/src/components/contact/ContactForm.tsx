import React, { useState } from 'react';
import { CaptchaButton } from '@/captcha';

interface ContactFormProps {
  onSuccess: () => void;
  initialSubject?: string;
  initialMessage?: string;
}

const SUBJECT_OPTIONS = [
  { value: 'question', label: 'Вопрос' },
  { value: 'bug', label: 'Сообщить о баге' },
  { value: 'feature', label: 'Предложение' },
  { value: 'other', label: 'Другое' },
];

export const ContactForm: React.FC<ContactFormProps> = ({ onSuccess, initialSubject, initialMessage }) => {
  const [formData, setFormData] = useState({
    email: '',
    subject: initialSubject ?? 'question',
    message: initialMessage ?? '',
    honeypot: '',
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!captchaSolved) {
      setError('Пройдите проверку капчи');
      return;
    }

    if (formData.honeypot) {
      // Бот заполнил honeypot — тихо игнорируем
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          captchaToken,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Сообщение отправлено! Мы свяжемся с вами в ближайшее время.');
        setFormData({ email: '', subject: 'question', message: '', honeypot: '' });
        setCaptchaToken('');
        setCaptchaSolved(false);
        onSuccess();
      } else {
        setError(data.error || 'Ошибка отправки');
      }
    } catch (err) {
      setError('Ошибка сети. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      {/* Email */}
      <div className="form-field">
        <label htmlFor="contact-email">Email *</label>
        <input
          id="contact-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          required
          maxLength={100}
          placeholder="your@email.com"
          disabled={isSubmitting}
        />
      </div>

      {/* Subject */}
      <div className="form-field">
        <label htmlFor="contact-subject">Тема *</label>
        <select
          id="contact-subject"
          value={formData.subject}
          onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
          required
          disabled={isSubmitting}
        >
          {SUBJECT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div className="form-field">
        <label htmlFor="contact-message">Сообщение *</label>
        <textarea
          id="contact-message"
          value={formData.message}
          onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
          required
          minLength={10}
          maxLength={1000}
          rows={6}
          placeholder="Опишите ваш вопрос или предложение..."
          disabled={isSubmitting}
        />
        <div className="form-field__hint">{formData.message.length}/1000 символов</div>
      </div>

      {/* Honeypot (скрытое поле для ботов) */}
      <input
        type="text"
        name="website"
        value={formData.honeypot}
        onChange={(e) => setFormData((prev) => ({ ...prev, honeypot: e.target.value }))}
        style={{ position: 'absolute', left: '-9999px' }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {/* Captcha */}
      <div className="form-field form-field--captcha">
        <label>Проверка капчи *</label>
        <div className="form-field__captcha-wrapper">
          <CaptchaButton
            onSolved={(token) => {
              setCaptchaToken(token);
              setCaptchaSolved(true);
              setError('');
            }}
            onError={(error) => {
              console.error('Captcha error:', error);
              setCaptchaSolved(false);
              setCaptchaToken('');
            }}
            size="md"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Error */}
      {error && <div className="form-error">{error}</div>}

      {/* Submit */}
      <button
        type="submit"
        className="contact-form__submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Отправка...' : 'Отправить сообщение'}
      </button>
    </form>
  );
};
