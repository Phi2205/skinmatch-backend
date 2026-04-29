import { PartialType } from '@nestjs/swagger';
import { CreateBadgeDto } from './create-badge.dto.js';

export class UpdateBadgeDto extends PartialType(CreateBadgeDto) {}
