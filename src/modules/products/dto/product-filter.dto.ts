import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductFilterDto {
  @ApiPropertyOptional({ default: 1, description: 'Trang hiện tại' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Số bản ghi mỗi trang (max 100)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên sản phẩm' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 'created_at', description: 'Trường sắp xếp (name, price, created_at)' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  // ─── Filters ───────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Lọc theo category IDs (comma-separated, VD: 1,2)' })
  @IsString()
  @IsOptional()
  category_ids?: string;

  @ApiPropertyOptional({ description: 'Lọc theo concern IDs (comma-separated, VD: 1,2,3)' })
  @IsString()
  @IsOptional()
  concern_ids?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ingredient IDs (comma-separated)' })
  @IsString()
  @IsOptional()
  ingredient_ids?: string;

  @ApiPropertyOptional({ description: 'Lọc theo skin type IDs (comma-separated)' })
  @IsString()
  @IsOptional()
  skin_type_ids?: string;

  @ApiPropertyOptional({ description: 'Lọc theo badge IDs (comma-separated)' })
  @IsString()
  @IsOptional()
  badge_ids?: string;

  @ApiPropertyOptional({ description: 'Lọc sản phẩm nổi bật' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  is_featured?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái active (admin)' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Lọc giá tối thiểu' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  min_price?: number;

  @ApiPropertyOptional({ description: 'Lọc giá tối đa' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  max_price?: number;
}
