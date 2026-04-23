import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('MAIL_HOST'),
      port: this.config.get('MAIL_PORT'),
      secure: true,
      auth: {
        user: this.config.get('MAIL_USER'),
        pass: this.config.get('MAIL_PASS'),
      },
    });
  }

  async sendOtp(email: string, otp: string) {
    await this.transporter.sendMail({
      from: `"SkinMatch Auth" <${this.config.get('MAIL_USER')}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your OTP code is: ${otp}. It will expire in 5 minutes.`,
      html: `<b>Your OTP code is: ${otp}</b><p>It will expire in 5 minutes.</p>`,
    });
  }
}
