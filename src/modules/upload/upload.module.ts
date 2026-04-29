import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';

@Module({
  imports: [CloudinaryModule],
  controllers: [UploadController],
})
export class UploadModule {}
