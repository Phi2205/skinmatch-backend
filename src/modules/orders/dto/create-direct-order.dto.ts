import { IsNumber, IsOptional, Min, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDirectOrderDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  product_id: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  variant_id?: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  receiver_name: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  receiver_phone: string;

  @ApiProperty({ example: 'john@example.com', required: false })
  @IsOptional()
  @IsEmail()
  receiver_email?: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  address_line: string;

  @ApiProperty({ example: 'Ward 1', required: false })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ example: 'District 1', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'HCM City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Handle with care', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: 'VNPAY', enum: ['VNPAY', 'MOMO'] })
  @IsString()
  payment_method: string;
}
