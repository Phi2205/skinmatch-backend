import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { BadgesService } from './badges.service.js';
import { CreateBadgeDto } from './dto/create-badge.dto.js';
import { CreateMultipleBadgesDto } from './dto/create-multiple-badges.dto.js';
import { UpdateBadgeDto } from './dto/update-badge.dto.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/index.js';

@ApiTags('badges')
@Controller('badges')
export class BadgesController {
  constructor(
    private readonly badgesService: BadgesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('icon', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
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
        name: { type: 'string', example: 'Bestseller' },
        icon_url: { type: 'string', description: 'URL icon (nếu không upload file)' },
        icon: { type: 'string', format: 'binary', description: 'File icon (ưu tiên hơn icon_url)' },
      },
      required: ['name'],
    },
  })
  @ApiOperation({ summary: 'Create a new badge (URL or file upload)' })
  async create(
    @Body() createBadgeDto: CreateBadgeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file, 'skinmatch/badges');
      createBadgeDto.icon_url = uploaded.secure_url;
    }

    const data = await this.badgesService.create(createBadgeDto);
    return {
      success: true,
      message: 'Badge created successfully',
      data,
    };
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create multiple badges at once' })
  async createMultiple(@Body() dto: CreateMultipleBadgesDto) {
    const data = await this.badgesService.createMultiple(dto.badges);
    return {
      success: true,
      message: 'Multiple badges created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all badges' })
  async findAll() {
    const data = await this.badgesService.findAll();
    return {
      success: true,
      message: 'Badges fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a badge by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.badgesService.findOne(+id);
    return {
      success: true,
      message: 'Badge fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('icon', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
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
        name: { type: 'string', example: 'Bestseller' },
        icon_url: { type: 'string', description: 'URL icon (nếu không upload file)' },
        icon: { type: 'string', format: 'binary', description: 'File icon (ưu tiên hơn icon_url)' },
      },
    },
  })
  @ApiOperation({ summary: 'Update a badge (URL or file upload)' })
  async update(
    @Param('id') id: string,
    @Body() updateBadgeDto: UpdateBadgeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // If a file is uploaded, push it to Cloudinary and delete the old one
    if (file) {
      const badge = await this.badgesService.findOne(+id);

      // Delete old icon from Cloudinary if it exists
      if (badge.icon_url && badge.icon_url.includes('cloudinary')) {
        try {
          const publicId = this.cloudinaryService.extractPublicId(badge.icon_url);
          await this.cloudinaryService.deleteImage(publicId);
        } catch {
          // Ignore delete errors (old image may not exist)
        }
      }

      const uploaded = await this.cloudinaryService.uploadImage(file, 'skinmatch/badges');
      updateBadgeDto.icon_url = uploaded.secure_url;
    }

    const data = await this.badgesService.update(+id, updateBadgeDto);
    return {
      success: true,
      message: 'Badge updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a badge' })
  async remove(@Param('id') id: string) {
    // Delete icon from Cloudinary if it exists
    const badge = await this.badgesService.findOne(+id);
    if (badge.icon_url && badge.icon_url.includes('cloudinary')) {
      try {
        const publicId = this.cloudinaryService.extractPublicId(badge.icon_url);
        await this.cloudinaryService.deleteImage(publicId);
      } catch {
        // Ignore delete errors
      }
    }

    const data = await this.badgesService.remove(+id);
    return {
      success: true,
      message: 'Badge deleted successfully',
      data,
    };
  }
}
