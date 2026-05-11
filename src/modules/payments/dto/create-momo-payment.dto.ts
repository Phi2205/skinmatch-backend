import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class CreateMomoPaymentDto {
  @ApiProperty({ example: 1, description: 'The ID of the order' })
  @IsNumber()
  @IsNotEmpty()
  orderId: number;

  @ApiProperty({ example: 50000, description: 'The amount to pay' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
