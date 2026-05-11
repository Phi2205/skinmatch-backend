import { IsNotEmpty, IsString, IsDateString, IsBoolean, IsOptional, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFlashSaleItemDto {
  @ApiProperty({ description: 'ID của sản phẩm', example: 1 })
  @IsNotEmpty()
  @IsInt()
  product_id: number;

  @ApiPropertyOptional({ description: 'ID của variant (tùy chọn)', example: 2 })
  @IsOptional()
  @IsInt()
  variant_id?: number;

  @ApiProperty({ description: 'Giá khuyến mại Flash Sale', example: 150000 })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sale_price: number;
}

export class CreateFlashSaleCampaignDto {
  @ApiProperty({ description: 'Tiêu đề chiến dịch Flash Sale', example: 'Khuyến mãi khung giờ vàng 12h-14h' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Thời gian bắt đầu chiến dịch', example: '2026-05-11T12:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  start_at: string;

  @ApiProperty({ description: 'Thời gian kết thúc chiến dịch', example: '2026-05-11T14:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  end_at: string;

  @ApiPropertyOptional({ description: 'Trạng thái kích hoạt chiến dịch', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ description: 'Danh sách sản phẩm/phân loại tham gia Flash Sale', type: [CreateFlashSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlashSaleItemDto)
  items: CreateFlashSaleItemDto[];
}

export class UpdateCampaignStatusDto {
  @ApiProperty({ description: 'Trạng thái hoạt động của chiến dịch', example: true })
  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;
}

