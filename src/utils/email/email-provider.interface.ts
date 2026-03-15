export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<void>;
}
