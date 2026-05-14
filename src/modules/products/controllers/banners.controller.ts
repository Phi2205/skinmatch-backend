import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { Role } from '../../../generated/prisma/index.js';
import { ProductsService } from '../services/products.service.js';
import { CloudinaryService } from '../../cloudinary/cloudinary.service.js';
import { UpdateBannerDto } from '../dto/update-banner.dto.js';
import { CreateBannerDto } from '../dto/create-banner.dto.js';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh banner (bắt buộc)',
        },
        title: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        button_text: { type: 'string', nullable: true },
        button_link: { type: 'string', nullable: true },
        position: { type: 'string', nullable: true },
        is_active: { type: 'boolean', nullable: true },
      },
    },
  })
  @ApiOperation({ summary: 'Create a banner (Admin only)' })
  async createBanner(
    @Body() createBannerDto: CreateBannerDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Ảnh banner là bắt buộc');
    }

    const uploadResult = await this.cloudinaryService.uploadImage(file);
    const imageUrl = uploadResult.secure_url;

    const createdBanner = await this.productsService.createBanner(createBannerDto, imageUrl);

    return {
      success: true,
      message: 'Banner created successfully',
      data: createdBanner,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh banner mới (tuỳ chọn)',
        },
        title: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        button_text: { type: 'string', nullable: true },
        button_link: { type: 'string', nullable: true },
        position: { type: 'string', nullable: true },
        is_active: { type: 'boolean', nullable: true },
      },
    },
  })
  @ApiOperation({ summary: 'Update a banner (Admin only)' })
  async updateBanner(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadImage(file);
      imageUrl = uploadResult.secure_url;
    }

    const updatedBanner = await this.productsService.updateBanner(+id, updateBannerDto, imageUrl);

    return {
      success: true,
      message: 'Banner updated successfully',
      data: updatedBanner,
    };
  }
}
