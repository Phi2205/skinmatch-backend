import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Họ và tên của người dùng',
    example: 'Dương Triệu Phi',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ email mới',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại của người dùng',
    example: '0987654321',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(0[3|5|7|8|9])+([0-9]{8})$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;
}
