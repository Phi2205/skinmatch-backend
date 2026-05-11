import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FlashSalesRepository {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Lấy client truy vấn: sử dụng Transaction Context (nếu có) hoặc dùng Prisma gốc
   */
  private getClient(tx?: any) {
    return tx || this.prisma;
  }

  /**
   * Tạo chiến dịch mới
   */
  async createCampaign(data: { title: string; start_at: Date; end_at: Date; is_active?: boolean }, tx?: any) {
    return this.getClient(tx).flash_sale_campaigns.create({
      data,
    });
  }

  /**
   * Tạo nhiều vật phẩm cho chiến dịch
   */
  async createItems(items: { campaign_id: number; product_id: number; variant_id?: number | null; sale_price: number }[], tx?: any) {
    return this.getClient(tx).flash_sale_items.createMany({
      data: items,
    });
  }

  /**
   * Lấy chi tiết chiến dịch kèm sản phẩm và phân loại đầy đủ
   */
  async findCampaignWithItems(id: number, tx?: any) {
    return this.getClient(tx).flash_sale_campaigns.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                slug: true,
                image_url: true,
                summary: true,
              },
            },
            variants: {
              select: {
                id: true,
                price: true,
                sku: true,
                stock: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Tìm các chiến dịch đang hoạt động dựa vào mốc thời gian truyền vào
   */
  async findActiveCampaigns(now: Date) {
    return this.prisma.flash_sale_campaigns.findMany({
      where: {
        is_active: true,
        start_at: { lte: now },
        end_at: { gte: now },
      },
      include: {
        items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                slug: true,
                image_url: true,
                summary: true,
              },
            },
            variants: {
              select: {
                id: true,
                price: true,
                sku: true,
                stock: true,
              },
            },
          },
        },
      },
      orderBy: {
        start_at: 'asc',
      },
    });
  }

  /**
   * Tìm chiến dịch sắp diễn ra tiếp theo gần nhất
   */
  async findNextUpcomingCampaign(now: Date) {
    return this.prisma.flash_sale_campaigns.findFirst({
      where: {
        is_active: true,
        start_at: { gt: now },
      },
      orderBy: {
        start_at: 'asc',
      },
    });
  }
}
