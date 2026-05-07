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
import { UpdateProductImageDto } from '../dto/update-product-image.dto.js';
import { ReorderProductImagesDto } from '../dto/reorder-product-images.dto.js';
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
  ) { }

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
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get product detail by ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const isAdmin = req.user?.role === Role.ADMIN;
    const data = await this.productsService.getProductDetail(Number(id), !isAdmin);
    if (!data) {
      return {
        success: false,
        message: 'Product not found or inactive',
      };
    }
    return {
      success: true,
      message: 'Product detail fetched successfully',
      data,
    };
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get product detail by slug' })
  async findBySlug(@Param('slug') slug: string, @Req() req: any) {
    const isAdmin = req.user?.role === Role.ADMIN;
    const data = await this.productsService.getProductBySlug(slug, !isAdmin);

    if (!data) {
      return {
        success: false,
        message: 'Product not found or inactive',
      };
    }

    return {
      success: true,
      message: 'Product detail fetched successfully',
      data,
    };
  }

  @Get('filter-by/:type/:slug')
  @ApiOperation({ summary: 'Get products by a specific relation slug (category, badge, ingredient, concern, skin_type)' })
  async findByRelation(
    @Param('type') type: 'category' | 'badge' | 'ingredient' | 'concern' | 'skin_type',
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;

    const { items, totalItems } = await this.productsService.getProductsByRelation({
      type,
      slug,
      page: pageNum,
      limit: limitNum,
    });

    const meta = createPaginationMeta(pageNum, limitNum, totalItems);

    return {
      success: true,
      message: `Products for ${type} '${slug}' fetched successfully`,
      data: { items, meta },
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
        description: { type: 'string' },
        ingredient_full_text: { type: 'string' },
        usage_instructions: { type: 'string' },
        summary: { type: 'string' },
        is_featured: { type: 'boolean' },
        is_active: { type: 'boolean' },
        image_url: { type: 'string' },
        image: { type: 'string', format: 'binary', description: 'Ảnh chính (ưu tiên hơn image_url)' },
        variants: { type: 'string', description: 'JSON array mảng biến thể, e.g. [{"price": 100000, "attributes": [{"name": "volume", "value": "50ml"}]}]' },
        category_ids: { type: 'string', description: 'JSON array mảng danh mục IDs, e.g. [1,2]' },
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

    // Parse numeric/boolean from form-data strings
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
        description: { type: 'string' },
        ingredient_full_text: { type: 'string' },
        usage_instructions: { type: 'string' },
        summary: { type: 'string' },
        is_featured: { type: 'boolean' },
        is_active: { type: 'boolean' },
        image_url: { type: 'string' },
        image: { type: 'string', format: 'binary' },
        variants: { type: 'string', description: 'JSON array mảng biến thể, e.g. [{"price": 100000, "attributes": [{"name": "volume", "value": "50ml"}]}]' },
        category_ids: { type: 'string', description: 'JSON array mảng danh mục IDs, e.g. [1,2]' },
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

    // Parse numeric/boolean from form-data strings
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
        images: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Danh sách các file ảnh' },
        sequence: { type: 'string', description: 'JSON array mô tả thứ tự. Dùng "FILE" cho ảnh upload, hoặc truyền trực tiếp URL. Ví dụ: ["FILE", "http://...", "FILE"]' },
      },
    },
  })
  @ApiOperation({ summary: 'Add product images (Files or URLs) with precise ordering' })
  async addImages(
    @Param('id') id: string,
    @Body() body: { sequence?: string },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // 1. Upload files to Cloudinary first
    let cloudinaryResults: any[] = [];
    if (files && files.length > 0) {
      cloudinaryResults = await this.cloudinaryService.uploadImages(files, 'skinmatch/products');
    }

    // 2. Parse sequence
    let sequenceItems: string[] = [];
    if (body.sequence) {
      try {
        sequenceItems = JSON.parse(body.sequence);
      } catch {
        sequenceItems = body.sequence.split(',').map(s => s.trim());
      }
    } else {
      // Default behavior if no sequence: Files first, then any specific URLs if we had them (legacy)
      sequenceItems = files.map(() => 'FILE');
    }

    // 3. Map sequence to final URLs
    const finalImages: { url: string; public_id: string | null }[] = [];
    let fileIndex = 0;

    for (const item of sequenceItems) {
      if (item === 'FILE') {
        if (fileIndex < cloudinaryResults.length) {
          finalImages.push({
            url: cloudinaryResults[fileIndex].secure_url,
            public_id: cloudinaryResults[fileIndex].public_id,
          });
          fileIndex++;
        }
      } else if (item && item.startsWith('http')) {
        finalImages.push({ url: item, public_id: null });
      }
    }

    // Fallback: If there are uploaded files not in sequence, append them
    while (fileIndex < cloudinaryResults.length) {
      finalImages.push({
        url: cloudinaryResults[fileIndex].secure_url,
        public_id: cloudinaryResults[fileIndex].public_id,
      });
      fileIndex++;
    }

    if (finalImages.length === 0) {
      throw new BadRequestException('At least one image (file or URL) is required');
    }

    const savedImages: any[] = [];
    try {
      for (let i = 0; i < finalImages.length; i++) {
        const img = await this.productsService.addProductImage(
          +id,
          finalImages[i].url,
          undefined,
          i === 0, // First image is main by default
          i,       // Order/Position
        );
        savedImages.push(img);
      }

      return {
        success: true,
        message: `${savedImages.length} image(s) added successfully`,
        data: savedImages,
      };
    } catch (error) {
      // Cleanup Cloudinary if DB fails
      for (const res of cloudinaryResults) {
        try {
          await this.cloudinaryService.deleteImage(res.public_id);
        } catch (delError) {
          console.error('Failed to cleanup Cloudinary image after DB failure:', res.public_id, delError);
        }
      }
      throw error;
    }
  }

  @Post(':id/images/single')
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
        image: { type: 'string', format: 'binary', description: 'File ảnh để upload' },
        image_url: { type: 'string', description: 'URL ảnh (nếu không upload file)' },
        alt_text: { type: 'string' },
        is_main: { type: 'boolean' },
        position: { type: 'number' },
      },
    },
  })
  @ApiOperation({ summary: 'Add a single product image (Admin)' })
  async addSingleImage(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (isNaN(+id)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }
    let finalUrl = body.image_url;

    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file, 'skinmatch/products');
      finalUrl = uploaded.secure_url;
    }

    if (!finalUrl) {
      throw new BadRequestException('At least one image (file or URL) is required');
    }

    const isMain = body.is_main === 'true' || body.is_main === true;
    const position = body.position !== undefined ? Number(body.position) : undefined;

    const data = await this.productsService.addProductImage(
      +id,
      finalUrl,
      body.alt_text,
      isMain,
      position,
    );

    return {
      success: true,
      message: 'Product image added successfully',
      data,
    };
  }

  @Patch(':id/images/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder product images in bulk (Admin)' })
  async reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderProductImagesDto,
  ) {
    if (isNaN(+id)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }
    const data = await this.productsService.reorderImagesBulk(+id, dto.images);
    return {
      success: true,
      message: 'Product images reordered successfully',
      data,
    };
  }

  @Patch(':id/images/:imageId')
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
        image: { type: 'string', format: 'binary', description: 'File ảnh mới (nếu muốn upload)' },
        image_url: { type: 'string', description: 'URL ảnh mới (nếu không upload file)' },
        alt_text: { type: 'string' },
        is_main: { type: 'boolean' },
        position: { type: 'number' },
      },
    },
  })
  @ApiOperation({ summary: 'Update a specific product image (Admin)' })
  async updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (isNaN(+id) || isNaN(+imageId)) {
      throw new BadRequestException('ID sản phẩm hoặc ID ảnh không hợp lệ');
    }

    if (file) {
      const oldImage = await this.productsService.findImageById(+imageId);
      if (oldImage && oldImage.image_url.includes('cloudinary')) {
        try {
          const publicId = this.cloudinaryService.extractPublicId(oldImage.image_url);
          await this.cloudinaryService.deleteImage(publicId);
        } catch { /* ignore */ }
      }

      const uploaded = await this.cloudinaryService.uploadImage(file, 'skinmatch/products');
      dto.image_url = uploaded.secure_url;
    }

    if (typeof dto.position === 'string') dto.position = Number(dto.position);
    if (typeof dto.is_main === 'string') dto.is_main = dto.is_main === 'true';

    const data = await this.productsService.updateProductImage(+id, +imageId, dto);
    return {
      success: true,
      message: 'Product image updated successfully',
      data,
    };
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product image (Admin)' })
  async deleteImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    if (isNaN(+id) || isNaN(+imageId)) {
      throw new BadRequestException('ID sản phẩm hoặc ID ảnh không hợp lệ');
    }
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
