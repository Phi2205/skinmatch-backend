import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ReviewsRepository {
  constructor(private prisma: PrismaService) { }

  async findProductById(id: number) {
    return this.prisma.products.findUnique({
      where: { id },
    });
  }

  async findOrderItemForReview(orderItemId: number) {
    return this.prisma.order_items.findUnique({
      where: { id: orderItemId },
      include: {
        orders: true,
      },
    });
  }

  async createReview(data: {
    user_id: number;
    product_id: number;
    rating: number;
    comment?: string;
    orderItemId: number;
    images?: string[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the product review along with review_images
      const review = await tx.product_reviews.create({
        data: {
          user_id: data.user_id,
          product_id: data.product_id,
          rating: data.rating,
          comment: data.comment,
          review_images: data.images && data.images.length > 0
            ? {
                create: data.images.map((url) => ({
                  image_url: url,
                })),
              }
            : undefined,
        },
        include: {
          review_images: true,
        },
      });

      // 2. Update the order item to be reviewed
      await tx.order_items.update({
        where: { id: data.orderItemId },
        data: { is_reviewed: true },
      });

      // 3. Update the product's total stars and reviews count
      await tx.products.update({
        where: { id: data.product_id },
        data: {
          rating_sum: { increment: data.rating },
          review_count: { increment: 1 },
        },
      });

      return review;
    });
  }

  async getProductReviews(productId: number, page?: number, limit?: number) {
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const [reviews, totalItems] = await this.prisma.$transaction([
        this.prisma.product_reviews.findMany({
          where: { product_id: productId },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            review_images: {
              select: {
                id: true,
                image_url: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.product_reviews.count({
          where: { product_id: productId },
        }),
      ]);
      return { reviews, totalItems };
    }

    const reviews = await this.prisma.product_reviews.findMany({
      where: { product_id: productId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        review_images: {
          select: {
            id: true,
            image_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return { reviews, totalItems: reviews.length };
  }
}
