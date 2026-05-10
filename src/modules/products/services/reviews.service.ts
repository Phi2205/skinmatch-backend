import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReviewsRepository } from '../repositories/reviews.repository.js';
import { CreateReviewDto } from '../dto/create-review.dto.js';
import { CloudinaryService } from '../../cloudinary/cloudinary.service.js';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly repository: ReviewsRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  private async ensureProductExists(productId: number) {
    const product = await this.repository.findProductById(productId);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${productId}`);
    }
    return product;
  }

  async createProductReview(
    userId: number,
    productId: number,
    dto: CreateReviewDto,
    files?: Express.Multer.File[],
  ) {
    // 1. Ensure product exists
    await this.ensureProductExists(productId);

    // 2. Find order item
    const orderItem = await this.repository.findOrderItemForReview(dto.orderItemId);
    if (!orderItem) {
      throw new BadRequestException('Mục đơn hàng (order_item) không tồn tại');
    }

    // 3. Verify product matches order item
    if (orderItem.product_id !== productId) {
      throw new BadRequestException('Sản phẩm đánh giá không trùng khớp với sản phẩm trong đơn hàng');
    }

    // 4. Verify order item belongs to current user
    if (!orderItem.orders || orderItem.orders.user_id !== userId) {
      throw new BadRequestException('Bạn không có quyền đánh giá mục đơn hàng này');
    }

    // 5. Verify order is paid
    if (orderItem.orders.status !== 'PAID') {
      throw new BadRequestException('Đơn hàng chưa được thanh toán thành công. Chỉ đơn hàng "PAID" mới có thể đánh giá.');
    }

    // 6. Verify order item has not been reviewed
    if (orderItem.is_reviewed) {
      throw new BadRequestException('Sản phẩm này trong đơn hàng của bạn đã được đánh giá trước đó');
    }

    // 7. Upload images to Cloudinary if files are uploaded
    const imageUrls: string[] = [];
    if (dto.images && dto.images.length > 0) {
      imageUrls.push(...dto.images);
    }

    if (files && files.length > 0) {
      const uploadResults = await this.cloudinaryService.uploadImages(files, 'skinmatch/reviews');
      const uploadedUrls = uploadResults.map((result) => result.secure_url);
      imageUrls.push(...uploadedUrls);
    }

    // 8. Create review
    const review = await this.repository.createReview({
      user_id: userId,
      product_id: productId,
      rating: dto.rating,
      comment: dto.comment,
      orderItemId: dto.orderItemId,
      images: imageUrls,
    });

    return review;
  }

  async getProductReviews(productId: number, page?: number, limit?: number) {
    // Ensure product exists
    await this.ensureProductExists(productId);
    return this.repository.getProductReviews(productId, page, limit);
  }
}
