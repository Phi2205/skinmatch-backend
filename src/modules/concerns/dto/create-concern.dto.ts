import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConcernDto {
  @ApiProperty({ example: 'Mụn', description: 'Tên vấn đề da' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
