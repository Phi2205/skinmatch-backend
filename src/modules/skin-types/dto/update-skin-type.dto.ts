import { PartialType } from '@nestjs/swagger';
import { CreateSkinTypeDto } from './create-skin-type.dto.js';

export class UpdateSkinTypeDto extends PartialType(CreateSkinTypeDto) {}
