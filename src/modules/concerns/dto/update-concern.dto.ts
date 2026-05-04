import { PartialType } from '@nestjs/swagger';
import { CreateConcernDto } from './create-concern.dto.js';

export class UpdateConcernDto extends PartialType(CreateConcernDto) {}
