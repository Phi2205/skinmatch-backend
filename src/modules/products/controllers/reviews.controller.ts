import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, BadRequestException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from '../services/reviews.service.js';
import { CreateReviewDto } from '../dto/create-review.dto.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { createPaginationMeta } from '../../../common/helpers/pagination.helper.js';

@ApiTags('Product Reviews')
@Controller('products')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) { }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
          return cb(new BadRequestException('Chỉ cho phép tải lên tệp tin định dạng hình ảnh'), false);
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
        orderItemId: { type: 'integer', description: 'ID of the order item' },
        rating: { type: 'integer', minimum: 1, maximum: 5, description: 'Rating score from 1 to 5' },
        comment: { type: 'string', description: 'Optional review comment text' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Upload review images (up to 5 images)',
        },
      },
      required: ['orderItemId', 'rating'],
    },
  })
  @ApiOperation({ summary: 'Create a product review with optional image uploads to Cloudinary' })
  async createReview(
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @Req() req: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (isNaN(+id)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }
    const userId = req.user.id;
    const data = await this.reviewsService.createProductReview(userId, +id, dto, files);

    return {
      success: true,
      message: 'Product review created successfully',
      data,
    };
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get reviews of a product with optional pagination' })
  async getReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (isNaN(+id)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;

    const result = await this.reviewsService.getProductReviews(+id, pageNum, limitNum);

    if (pageNum !== undefined && limitNum !== undefined) {
      const meta = createPaginationMeta(pageNum, limitNum, result.totalItems);
      return {
        success: true,
        message: 'Product reviews fetched successfully',
        data: result.reviews,
        meta,
      };
    }

    return {
      success: true,
      message: 'Product reviews fetched successfully',
      data: result.reviews,
    };
  }
}
