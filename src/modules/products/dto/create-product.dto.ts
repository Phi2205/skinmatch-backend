import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsArray, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class VariantAttributeDto {
  @ApiProperty({ example: 'volume', description: 'Tên thuộc tính (e.g. volume, color)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '50ml', description: 'Giá trị thuộc tính' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class ProductVariantDto {
  @ApiProperty({ type: [VariantAttributeDto], description: 'Danh sách thuộc tính của variant' })
  @IsArray()
  @IsOptional()
  @Type(() => VariantAttributeDto)
  attributes?: VariantAttributeDto[];

  @ApiProperty({ example: 250000, description: 'Giá (VND)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  stock?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Sữa rửa mặt ABC', description: 'Tên sản phẩm' })
  @IsString()
  @IsNotEmpty()
  name: string;
 
  @ApiPropertyOptional({ example: 'sua-rua-mat-abc', description: 'Slug sản phẩm (tự động generate nếu để trống)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ type: [ProductVariantDto], description: 'Danh sách dung tích và giá' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @IsOptional()
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({ description: 'Mảng danh mục IDs', example: [1, 2] })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value.split(',').map(Number);
      }
    }
    return value;
  })
  @IsOptional()
  category_ids?: number[];

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
  @Transform(({ value }) => typeof value === 'string' ? JSON.parse(value) : value)
  @IsOptional()
  badge_ids?: number[];

  @ApiPropertyOptional({ description: 'Mảng concern IDs', example: [1, 3] })
  @Transform(({ value }) => typeof value === 'string' ? JSON.parse(value) : value)
  @IsOptional()
  concern_ids?: number[];

  @ApiPropertyOptional({ description: 'Mảng ingredient IDs', example: [2, 5] })
  @Transform(({ value }) => typeof value === 'string' ? JSON.parse(value) : value)
  @IsOptional()
  ingredient_ids?: number[];

  @ApiPropertyOptional({ description: 'Mảng skin type IDs', example: [1, 2] })
  @Transform(({ value }) => typeof value === 'string' ? JSON.parse(value) : value)
  @IsOptional()
  skin_type_ids?: number[];
}
