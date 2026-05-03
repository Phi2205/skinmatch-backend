import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ImageOrderDto {
  @ApiProperty({ description: 'ID của ảnh' })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'Thứ tự mới' })
  @IsNumber()
  position: number;
}

export class ReorderProductImagesDto {
  @ApiProperty({ type: [ImageOrderDto], description: 'Danh sách ID và vị trí mới' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOrderDto)
  images: ImageOrderDto[];
}
