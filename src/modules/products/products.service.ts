import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async getHomepageData() {
    const [banners, featuredProducts] = await Promise.all([
      // 1. Lấy danh sách banner đang hoạt động
      this.prisma.banners.findMany({
        where: { is_active: true },
        orderBy: { created_at: 'desc' },
      }),
      // 2. Lấy sản phẩm nổi bật kèm theo badges
      this.prisma.products.findMany({
        where: { is_featured: true },
        include: {
          product_badges: {
            include: {
              badges: true,
            },
          },
        },
        take: 10,
      }),
    ]);

    // Format lại dữ liệu sản phẩm để dễ dùng ở FE
    const formattedProducts = featuredProducts.map((product) => ({
      ...product,
      badges: product.product_badges.map((pb) => pb.badges),
      product_badges: undefined, // Ẩn bớt field không cần thiết
    }));

    return {
      banners,
      featuredProducts: formattedProducts,
    };
  }

  async getAllProducts() {
    return this.prisma.products.findMany({
      include: {
        product_badges: {
          include: {
            badges: true,
          },
        },
      },
    });
  }
}
