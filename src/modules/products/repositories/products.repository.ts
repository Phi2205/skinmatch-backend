import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../modules/prisma/prisma.service.js';

@Injectable()
export class ProductsRepository {
  constructor(private prisma: PrismaService) {}

  async findActiveBanners() {
    return this.prisma.banners.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findFeaturedProducts(limit = 10) {
    return this.prisma.products.findMany({
      where: { is_featured: true },
      include: {
        product_badges: {
          include: {
            badges: true,
          },
        },
      },
      take: limit,
    });
  }

  async findAllProducts() {
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

  async findProductById(id: number) {
    return this.prisma.products.findUnique({
      where: { id },
      include: {
        product_images: true,
        product_badges: {
          include: {
            badges: true,
          },
        },
        product_ingredients: {
          include: {
            ingredients: true,
          },
        },
        product_skin_types: true,
        categories: true,
      },
    });
  }
}
