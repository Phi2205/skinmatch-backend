import { PartialType, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { CreateProductDto, ProductVariantDto } from './create-product.dto.js';
import { IsOptional, IsInt, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdateProductVariantDto extends PartialType(ProductVariantDto) {
  @ApiPropertyOptional({ example: 1, description: 'ID of existing variant to update (omit if creating a new one)' })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  id?: number;
}

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['variants'] as const)) {
  @ApiPropertyOptional({ type: [UpdateProductVariantDto], description: 'Danh sách variant để update (có id thì cập nhật, không có id thì thêm mới, những cái bị bỏ ra ngoài sẽ bị chuyển is_active = false)' })
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
  @Type(() => UpdateProductVariantDto)
  variants?: UpdateProductVariantDto[];
}
