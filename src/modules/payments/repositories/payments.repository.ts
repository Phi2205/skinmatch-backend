import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PaymentsRepository {
  constructor(private prisma: PrismaService) {}

  async createTransaction(data: {
    order_id: number;
    provider: string;
    amount: number;
    status: string;
    request_id?: string;
  }) {
    return this.prisma.payment_transactions.create({
      data,
    });
  }

  async updateTransaction(id: number, data: {
    transaction_id?: string;
    status: string;
    raw_response?: any;
  }) {
    return this.prisma.payment_transactions.update({
      where: { id },
      data,
    });
  }

  async findByRequestId(requestId: string) {
    return this.prisma.payment_transactions.findFirst({
      where: { request_id: requestId },
    });
  }

  async findByOrderId(orderId: number) {
    return this.prisma.payment_transactions.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });
  }
}
