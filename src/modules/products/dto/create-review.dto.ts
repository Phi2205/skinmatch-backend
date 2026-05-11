import { IsNotEmpty, IsInt, Min, Max, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({ example: 1, description: 'ID của mục đơn hàng (order_item) cần đánh giá' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  orderItemId: number;

  @ApiProperty({ example: 5, description: 'Điểm đánh giá từ 1 đến 5' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Sản phẩm rất tốt, dùng êm dịu!', description: 'Nội dung bình luận đánh giá' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ example: ['https://example.com/image1.jpg'], description: 'Danh sách các link ảnh đính kèm của review' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
