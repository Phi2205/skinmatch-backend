import { Controller, Get, Put, Body, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin profile thành công',
  })
  async getProfile(@Req() req: any) {
    const userId = req.user.id;
    const profile = await this.userService.getProfile(userId);
    return {
      success: true,
      data: profile,
    };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Cập nhật thông tin tài khoản (name, email, phone)' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật profile thành công',
  })
  async updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    const userId = req.user.id;
    const updated = await this.userService.updateProfile(userId, dto);
    return {
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công',
      data: updated,
    };
  }

  @Put('avatar')
  @ApiOperation({ summary: 'Cập nhật ảnh đại diện (avatar)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn kích thước ảnh là 5MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(new BadRequestException('Chỉ hỗ trợ tệp hình ảnh (jpeg, png, gif, webp, svg)'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiResponse({
    status: 200,
    description: 'Cập nhật ảnh đại diện thành công',
  })
  async updateAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên tệp ảnh của bạn');
    }
    const userId = req.user.id;
    const updated = await this.userService.updateAvatar(userId, file);
    return {
      success: true,
      message: 'Cập nhật ảnh đại diện thành công',
      data: updated,
    };
  }
}
