import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsArray, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Sữa rửa mặt ABC', description: 'Tên sản phẩm' })
  @IsString()
  @IsNotEmpty()
  name: string;
 
  @ApiProperty({ example: 'sua-rua-mat-abc', description: 'Slug sản phẩm' })
  @IsString()
  @IsNotEmpty()
  slug: string;


  @ApiProperty({ example: 250000, description: 'Giá sản phẩm (VND)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 1, description: 'ID danh mục' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  category_id?: number;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết sản phẩm' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Danh sách thành phần đầy đủ' })
  @IsString()
  @IsOptional()
  ingredient_full_text?: string;

  @ApiPropertyOptional({ description: 'Hướng dẫn sử dụng' })
  @IsString()
  @IsOptional()
  usage_instructions?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt ngắn sản phẩm' })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({ example: false, description: 'Sản phẩm nổi bật' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  is_featured?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Trạng thái kích hoạt' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'URL ảnh chính (nếu không upload file)', example: 'https://...' })
  @IsString()
  @IsOptional()
  image_url?: string;

  // Relation IDs — sent as JSON arrays in form-data
  @ApiPropertyOptional({ description: 'Mảng badge IDs', example: [1, 2] })
  @IsOptional()
  badge_ids?: number[];

  @ApiPropertyOptional({ description: 'Mảng concern IDs', example: [1, 3] })
  @IsOptional()
  concern_ids?: number[];

  @ApiPropertyOptional({ description: 'Mảng ingredient IDs', example: [2, 5] })
  @IsOptional()
  ingredient_ids?: number[];

  @ApiPropertyOptional({ description: 'Mảng skin type IDs', example: [1, 2] })
  @IsOptional()
  skin_type_ids?: number[];
}
