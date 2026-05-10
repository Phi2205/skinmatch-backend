import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Lấy thông tin chi tiết của người dùng
   */
  async getProfile(userId: number) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        role: true,
        is_verified: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    return user;
  }

  /**
   * Cập nhật thông tin name, email, phone cho người dùng
   */
  async updateProfile(userId: number, dto: UpdateUserDto) {
    // 1. Kiểm tra người dùng có tồn tại không
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // 2. Nếu có thay đổi email, kiểm tra xem email mới đã được sử dụng bởi ai khác chưa
    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.prisma.users.findUnique({
        where: { email: dto.email },
      });

      if (emailTaken && emailTaken.id !== userId) {
        throw new ConflictException('Email này đã được đăng ký bởi tài khoản khác');
      }
    }

    // 3. Tiến hành cập nhật thông tin
    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        name: dto.name !== undefined ? dto.name : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        phone: dto.phone !== undefined ? dto.phone : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        role: true,
        is_verified: true,
        created_at: true,
      },
    });

    return updatedUser;
  }

  /**
   * Cập nhật ảnh đại diện cho người dùng
   */
  async updateAvatar(userId: number, file: Express.Multer.File) {
    // 1. Kiểm tra người dùng có tồn tại không
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // 2. Nếu người dùng đã có avatar cũ trên Cloudinary, tiến hành xóa để tránh rác dung lượng
    if (user.avatar_url && user.avatar_url.includes('cloudinary.com')) {
      try {
        const oldPublicId = this.cloudinaryService.extractPublicId(user.avatar_url);
        await this.cloudinaryService.deleteImage(oldPublicId);
      } catch (error) {
        this.logger.warn(`Không thể xóa ảnh đại diện cũ trên Cloudinary: ${error.message}`);
      }
    }

    // 3. Tải ảnh mới lên Cloudinary (lưu trữ trong thư mục 'users/avatars')
    const uploadResult = await this.cloudinaryService.uploadImage(file, 'users/avatars');

    // 4. Cập nhật đường dẫn ảnh mới vào cơ sở dữ liệu
    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        avatar_url: uploadResult.secure_url,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar_url: true,
        role: true,
        is_verified: true,
        created_at: true,
      },
    });

    return updatedUser;
  }
}
