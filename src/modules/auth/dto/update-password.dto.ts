import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiPropertyOptional({
    description: 'Mật khẩu hiện tại (bắt buộc nếu tài khoản đăng ký bằng email thông thường)',
    example: 'password123',
  })
  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ApiProperty({
    description: 'Mật khẩu mới',
    example: 'newpassword123',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(6, { message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' })
  newPassword: string;
}
