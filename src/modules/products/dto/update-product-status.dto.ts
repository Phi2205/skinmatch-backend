import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductStatusDto {
  @ApiProperty({ example: true, description: 'Trạng thái kích hoạt sản phẩm' })
  @IsBoolean()
  is_active: boolean;
}
