import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req,
  UseGuards, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductsService } from '../services/products.service.js';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { UpdateProductStatusDto } from '../dto/update-product-status.dto.js';
import { ProductFilterDto } from '../dto/product-filter.dto.js';
import { CloudinaryService } from '../../cloudinary/cloudinary.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { Role } from '../../../generated/prisma/index.js';
import { createPaginationMeta } from '../../../common/helpers/pagination.helper.js';

/**
 * Parse a value that might be a JSON array string or already an array of numbers.
 * form-data sends arrays as strings like "[1,2,3]" — this handles both cases.
 */
function parseIntArray(value: any): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {
      // If not JSON, try comma-separated
      return value.split(',').map((v: string) => Number(v.trim())).filter((n: number) => !isNaN(n));
    }
  }
  return undefined;
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  PUBLIC ENDPOINTS
  // ═══════════════════════════════════════════════════════

  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage data including banners and featured products' })
  async getHomepage() {
    const data = await this.productsService.getHomepageData();
    return {
      success: true,
      message: 'Homepage data fetched successfully',
      data,
    };
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all products with pagination and filters' })
  async findAll(@Query() query: ProductFilterDto, @Req() req: any) {
    const isAdmin = req.user?.role === Role.ADMIN;
    const { items, totalItems } = await this.productsService.getAllProductsPaginated(query, !isAdmin);
    const meta = createPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems);

    return {
      success: true,
      message: 'Products fetched successfully',
      data: { items, meta },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product detail by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.productsService.getProductDetail(Number(id));
    if (!data) {
      return {
        success: false,
        message: 'Product not found',
      };
    }
    return {
      success: true,
      message: 'Product detail fetched successfully',
      data,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════

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
      required: ['name', 'price'],
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        category_id: { type: 'number' },
        description: { type: 'string' },
        summary: { type: 'string' },
        is_featured: { type: 'boolean' },
        is_active: { type: 'boolean' },
        image_url: { type: 'string' },
        image: { type: 'string', format: 'binary', description: 'Ảnh chính (ưu tiên hơn image_url)' },
        badge_ids: { type: 'string', description: 'JSON array, e.g. [1,2]' },
        concern_ids: { type: 'string', description: 'JSON array, e.g. [1,3]' },
        ingredient_ids: { type: 'string', description: 'JSON array, e.g. [2,5]' },
        skin_type_ids: { type: 'string', description: 'JSON array, e.g. [1,2]' },
      },
    },
  })
  @ApiOperation({ summary: 'Create a new product (Admin)' })
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Upload image to Cloudinary if file provided
    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file, 'skinmatch/products');
      dto.image_url = uploaded.secure_url;
    }

    // Parse relation arrays from form-data
    dto.badge_ids = parseIntArray(dto.badge_ids);
    dto.concern_ids = parseIntArray(dto.concern_ids);
    dto.ingredient_ids = parseIntArray(dto.ingredient_ids);
    dto.skin_type_ids = parseIntArray(dto.skin_type_ids);

    // Parse numeric/boolean from form-data strings
    if (typeof dto.price === 'string') dto.price = Number(dto.price);
    if (typeof dto.category_id === 'string') dto.category_id = Number(dto.category_id);
    if (typeof dto.is_featured === 'string') dto.is_featured = dto.is_featured === 'true';
    if (typeof dto.is_active === 'string') dto.is_active = dto.is_active === 'true';

    const data = await this.productsService.create(dto);
    return {
      success: true,
      message: 'Product created successfully',
      data,
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
        name: { type: 'string' },
        price: { type: 'number' },
        category_id: { type: 'number' },
        description: { type: 'string' },
        summary: { type: 'string' },
        is_featured: { type: 'boolean' },
        is_active: { type: 'boolean' },
        image_url: { type: 'string' },
        image: { type: 'string', format: 'binary' },
        badge_ids: { type: 'string', description: 'JSON array, e.g. [1,2]' },
        concern_ids: { type: 'string', description: 'JSON array, e.g. [1,3]' },
        ingredient_ids: { type: 'string', description: 'JSON array, e.g. [2,5]' },
        skin_type_ids: { type: 'string', description: 'JSON array, e.g. [1,2]' },
      },
    },
  })
  @ApiOperation({ summary: 'Update a product (Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      // Delete old image from Cloudinary if exists
      const product = await this.productsService.findOne(+id);
      if (product.image_url && product.image_url.includes('cloudinary')) {
        try {
          const publicId = this.cloudinaryService.extractPublicId(product.image_url);
          await this.cloudinaryService.deleteImage(publicId);
        } catch { /* ignore */ }
      }

      const uploaded = await this.cloudinaryService.uploadImage(file, 'skinmatch/products');
      dto.image_url = uploaded.secure_url;
    }

    // Parse relation arrays
    dto.badge_ids = parseIntArray(dto.badge_ids);
    dto.concern_ids = parseIntArray(dto.concern_ids);
    dto.ingredient_ids = parseIntArray(dto.ingredient_ids);
    dto.skin_type_ids = parseIntArray(dto.skin_type_ids);

    // Parse numeric/boolean from form-data strings
    if (typeof dto.price === 'string') dto.price = Number(dto.price);
    if (typeof dto.category_id === 'string') dto.category_id = Number(dto.category_id);
    if (typeof dto.is_featured === 'string') dto.is_featured = dto.is_featured === 'true';
    if (typeof dto.is_active === 'string') dto.is_active = dto.is_active === 'true';

    const data = await this.productsService.update(+id, dto);
    return {
      success: true,
      message: 'Product updated successfully',
      data,
    };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle product active status (Admin)' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateProductStatusDto) {
    const data = await this.productsService.updateStatus(+id, dto.is_active);
    return {
      success: true,
      message: 'Product status updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (Admin)' })
  async remove(@Param('id') id: string) {
    const product = await this.productsService.findOne(+id);

    // Delete main image from Cloudinary
    if (product.image_url && product.image_url.includes('cloudinary')) {
      try {
        const publicId = this.cloudinaryService.extractPublicId(product.image_url);
        await this.cloudinaryService.deleteImage(publicId);
      } catch { /* ignore */ }
    }

    // Delete product_images from Cloudinary
    if (product.product_images?.length) {
      for (const img of product.product_images) {
        if (img.image_url.includes('cloudinary')) {
          try {
            const publicId = this.cloudinaryService.extractPublicId(img.image_url);
            await this.cloudinaryService.deleteImage(publicId);
          } catch { /* ignore */ }
        }
      }
    }

    const data = await this.productsService.remove(+id);
    return {
      success: true,
      message: 'Product deleted successfully',
      data,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  PRODUCT IMAGES (Admin)
  // ═══════════════════════════════════════════════════════

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(
    FilesInterceptor('images', 10, {
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
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiOperation({ summary: 'Upload product images (Admin, max 10)' })
  async addImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    const results = await this.cloudinaryService.uploadImages(files, 'skinmatch/products');

    const images: any[] = [];
    for (let i = 0; i < results.length; i++) {
      const img = await this.productsService.addProductImage(
        +id,
        results[i].secure_url,
        undefined,
        i === 0, // First image is main by default
      );
      images.push(img);
    }

    return {
      success: true,
      message: `${images.length} image(s) added successfully`,
      data: images,
    };
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product image (Admin)' })
  async deleteImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    const image = await this.productsService.deleteProductImage(+imageId);

    // Cleanup from Cloudinary
    if (image.image_url.includes('cloudinary')) {
      try {
        const publicId = this.cloudinaryService.extractPublicId(image.image_url);
        await this.cloudinaryService.deleteImage(publicId);
      } catch { /* ignore */ }
    }

    return {
      success: true,
      message: 'Product image deleted successfully',
      data: image,
    };
  }
}
