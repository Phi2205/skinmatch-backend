import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OrdersRepository {
  constructor(private prisma: PrismaService) {}

  async createOrder(data: {
    user_id: number;
    total_price: number;
    status: string;
    receiver_name: string;
    receiver_phone: string;
    receiver_email?: string;
    address_line: string;
    ward?: string;
    district?: string;
    city?: string;
    note?: string;
    payment_method: string;
    items: {
      product_id: number;
      variant_id?: number | null;
      quantity: number;
      price: number;
    }[];
  }, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.orders.create({

      data: {
        users: data.user_id ? { connect: { id: data.user_id } } : undefined,
        total_price: data.total_price,
        status: data.status,

        payment_method: data.payment_method,
        receiver_name: data.receiver_name,
        receiver_phone: data.receiver_phone,
        receiver_email: data.receiver_email,
        address_line: data.address_line,
        ward: data.ward,
        district: data.district,
        city: data.city,
        note: data.note,

        order_items: {

          create: data.items.map((item) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        order_items: {
          include: {
            products: true,
            variants: true,
          },
        },
      },
    });
  }

  async findByUserId(userId: number) {
    return this.prisma.orders.findMany({
      where: { users: { id: userId } },

      include: {
        order_items: {
          include: {
            products: true,
            variants: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findById(id: number) {
    return this.prisma.orders.findUnique({
      where: { id },
      include: {
        order_items: {
          include: {
            products: true,
            variants: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      },
    });
  }

  async updateStatus(id: number, status: string, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.orders.update({
      where: { id },
      data: { status },
    });
  }
}
