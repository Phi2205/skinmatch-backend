import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CartsRepository {
  constructor(private prisma: PrismaService) { }

  async findByUserId(userId: number) {
    return this.prisma.cart_items.findMany({
      where: { user_id: userId },
      include: {
        products: {
          include: {
            product_images: true,
          }
        },
        variants: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findItem(userId: number, productId: number, variantId?: number) {
    return this.prisma.cart_items.findFirst({
      where: {
        user_id: userId,
        product_id: productId,
        variant_id: variantId || null,
      },
    });
  }

  async findItemById(id: number) {
    return this.prisma.cart_items.findUnique({
      where: { id },
    });
  }

  async addItem(data: {
    userId: number;
    productId: number;
    variantId?: number;
    quantity: number;
  }) {
    return this.prisma.cart_items.create({
      data: {
        user_id: data.userId,
        product_id: data.productId,
        variant_id: data.variantId,
        quantity: data.quantity,
      },
      include: {
        products: true,
        variants: true,
      },
    });
  }

  async updateQuantity(id: number, quantity: number) {
    return this.prisma.cart_items.update({
      where: { id },
      data: { quantity },
      include: {
        products: true,
        variants: true,
      },
    });
  }

  async removeItem(id: number) {
    return this.prisma.cart_items.delete({
      where: { id },
    });
  }

  async clearCart(userId: number, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.cart_items.deleteMany({
      where: { user_id: userId },
    });
  }
}
