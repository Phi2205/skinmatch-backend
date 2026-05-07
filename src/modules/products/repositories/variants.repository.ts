import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class VariantsRepository {
  constructor(private prisma: PrismaService) {}

  async findByVariantId(variantId: number) {
    return this.prisma.product_variants.findUnique({
      where: { id: variantId },
      include: {
        attributes: true,
        products: true, // Include related product information if needed
      },
    });
  }

  async decrementStock(variantId: number, quantity: number, tx?: any) {
    const prisma = tx || this.prisma;
    const result = await prisma.$executeRaw`
      UPDATE product_variants
      SET stock = stock - ${quantity}
      WHERE id = ${variantId} AND stock >= ${quantity}
    `;

    if (result === 0) {
      throw new BadRequestException('Not enough stock');
    }
  }

  async incrementStock(variantId: number, quantity: number, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.product_variants.update({
      where: { id: variantId },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });
  }
}
