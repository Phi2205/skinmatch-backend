import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private redis: RedisService,
  ) {}

  // 🎯 TẠO TOKEN
  private async generateTokens(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };
    
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: '7d',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // 🔐 REGISTER (Cách 1: Lưu Redis trước)
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu OTP và thông tin đăng ký vào Redis (5 phút)
    const otpKey = `otp:${dto.email}`;
    await this.redis.set(otpKey, otp, 300);

    const registerDataKey = `register:${dto.email}`;
    const registerData = JSON.stringify({
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });
    await this.redis.set(registerDataKey, registerData, 300);

    await this.mail.sendOtp(dto.email, otp);

    return {
      success: true,
      message: 'OTP has been sent to your email. Please verify to complete registration.',
    };
  }

  // ✅ VERIFY OTP (Tạo user trong DB sau khi verify)
  async verifyOtp(dto: VerifyOtpDto) {
    // 1. Kiểm tra OTP từ Redis
    const otpKey = `otp:${dto.email}`;
    const storedOtp = await this.redis.get(otpKey);

    if (!storedOtp || storedOtp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // 2. Lấy thông tin đăng ký tạm thời từ Redis
    const registerDataKey = `register:${dto.email}`;
    const registerDataStr = await this.redis.get(registerDataKey);

    if (!registerDataStr) {
      throw new BadRequestException('Registration data has expired. Please register again.');
    }

    const registerData = JSON.parse(registerDataStr);

    // 3. Kiểm tra lại email (double check)
    const existingUser = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // 4. Mã hóa mật khẩu và tạo user
    const passwordHash = await bcrypt.hash(registerData.password, 10);
    const user = await this.prisma.users.create({
      data: {
        email: registerData.email,
        name: registerData.name,
        password_hash: passwordHash,
        is_verified: true, // Mark as verified immediately
      },
    });

    // 5. Xóa dữ liệu tạm trong Redis
    await this.redis.del(otpKey);
    await this.redis.del(registerDataKey);

    // 6. Tạo token
    const tokens = await this.generateTokens(user.id, user.email, user.role || 'USER');

    return {
      success: true,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // 🔐 LOGIN
  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email not found');
    }

    if (!user.password_hash) {
      throw new UnauthorizedException('Please login using your social account or reset your password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password_hash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role || 'USER');

    return {
      success: true,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    };
  }

  // 🔄 REFRESH TOKEN
  async refreshToken(refreshToken: string) {
    try {
      // 1. Kiểm tra xem token có trong blacklist của Redis không (nếu đã logout)
      const isBlacklisted = await this.redis.get(`blacklist:refresh:${refreshToken}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // 2. Verify refresh token
      const payload = await this.jwt.verifyAsync(refreshToken);

      // 3. Tìm user trong database
      const user = await this.prisma.users.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 4. Tạo bộ token mới
      const tokens = await this.generateTokens(user.id, user.email, user.role || 'USER');

      return {
        success: true,
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // 🌐 GOOGLE LOGIN
  async googleLogin(req: any) {
    if (!req.user) {
      throw new BadRequestException('Unauthenticated');
    }

    let user = await this.prisma.users.findUnique({
      where: { email: req.user.email },
    });

    const googleName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Google User';
    const googleAvatar = req.user.picture || null;

    if (!user) {
      user = await this.prisma.users.create({
        data: {
          email: req.user.email,
          name: googleName,
          avatar_url: googleAvatar,
          is_verified: true,
          role: 'USER',
        },
      });
    } 

    const tokens = await this.generateTokens(user.id, user.email, user.role || 'USER');
    return {
      success: true,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    };
  }

  // 👤 GET PROFILE (ME)
  async getMe(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        role: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    return {
      success: true,
      data: user,
    };
  }

  // 🔐 UPDATE PASSWORD
  async updatePassword(userId: number, dto: UpdatePasswordDto) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    // Nếu tài khoản đã có mật khẩu (đăng ký thường), yêu cầu mật khẩu cũ để xác thực
    if (user.password_hash) {
      if (!dto.oldPassword) {
        throw new BadRequestException('Vui lòng nhập mật khẩu cũ để xác nhận thay đổi');
      }

      const isMatch = await bcrypt.compare(dto.oldPassword, user.password_hash);
      if (!isMatch) {
        throw new BadRequestException('Mật khẩu cũ không chính xác');
      }
    }

    // Mã hóa mật khẩu mới và lưu
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.users.update({
      where: { id: userId },
      data: {
        password_hash: passwordHash,
      },
    });

    return {
      success: true,
      message: 'Mật khẩu đã được đổi thành công',
    };
  }
}


