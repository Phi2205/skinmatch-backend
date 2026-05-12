import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FlashSalesRepository } from './flash-sales.repository.js';
import { CreateFlashSaleCampaignDto, CreateFlashSaleItemDto } from './dto/create-flash-sale.dto.js';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class FlashSalesService {
  private readonly CACHE_KEY = 'flash-sales:active';
  private readonly CACHE_TTL = 300; // Lưu cache trong 5 phút (300 giây)

  constructor(
    private readonly prisma: PrismaService, // Cần thiết để khởi tạo khối transaction ($transaction)
    private readonly flashSalesRepository: FlashSalesRepository,
    private readonly redisService: RedisService,
  ) { }

  /**
   * Tạo mới chiến dịch Flash Sale kèm danh sách sản phẩm tham gia
   */
  async createCampaign(dto: CreateFlashSaleCampaignDto) {
    const startAt = new Date(dto.start_at);
    const endAt = new Date(dto.end_at);

    if (startAt >= endAt) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc');
    }

    // Thực hiện trong một Transaction để đảm bảo tính toàn vẹn dữ liệu
    const campaign = await this.prisma.$transaction(async (tx) => {
      // 1. Tạo campaign thông qua repository với transaction context tx
      const campaignData = await this.flashSalesRepository.createCampaign(
        {
          title: dto.title,
          start_at: startAt,
          end_at: endAt,
          is_active: dto.is_active !== undefined ? dto.is_active : true,
        },
        tx,
      );

      // 2. Tạo các item thuộc campaign thông qua repository với transaction context tx
      const itemsData = dto.items.map((item) => ({
        campaign_id: campaignData.id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        sale_price: item.sale_price,
      }));

      await this.flashSalesRepository.createItems(itemsData, tx);

      // 3. Trả về kết quả hoàn chỉnh kèm chi tiết sản phẩm thông qua repository
      return this.flashSalesRepository.findCampaignWithItems(campaignData.id, tx);
    });

    // Khi tạo mới chiến dịch, tiến hành xóa cache hiện tại để khách hàng cập nhật dữ liệu mới nhất ngay lập tức
    await this.redisService.del(this.CACHE_KEY);

    // Xóa cache của từng sản phẩm tham gia trong chiến dịch mới
    if (dto.items && dto.items.length > 0) {
      const productIds = [...new Set(dto.items.map((item) => item.product_id))];
      await Promise.all(
        productIds.map((id) => this.redisService.del(`product:flash-sales-list:${id}`))
      );
    }

    return campaign;
  }

  /**
   * Lấy danh sách các chiến dịch Flash Sale đang diễn ra trong khung giờ hiện tại (Có sử dụng Cache động)
   */
  async getCurrentActiveCampaigns() {
    // 1. Thử lấy dữ liệu từ cache Redis trước
    const cached = await this.redisService.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Nếu không có cache, tiến hành truy vấn DB
    const now = new Date();
    const activeCampaigns = await this.flashSalesRepository.findActiveCampaigns(now);

    // 3. Tính toán TTL động tối ưu để tránh dính cache khi chiến dịch kết thúc hoặc chiến dịch mới bắt đầu
    let ttl = this.CACHE_TTL; // Mặc định 5 phút (300 giây)

    // A. Nếu có chiến dịch đang chạy, tính thời gian còn lại đến khi chiến dịch kết thúc sớm nhất
    if (activeCampaigns.length > 0) {
      const endTimes = activeCampaigns.map((c) => new Date(c.end_at).getTime());
      const minEndTime = Math.min(...endTimes);
      const secondsUntilEnd = Math.ceil((minEndTime - now.getTime()) / 1000);

      if (secondsUntilEnd > 0 && secondsUntilEnd < ttl) {
        ttl = secondsUntilEnd;
      }
    }

    // B. Kiểm tra xem có chiến dịch tiếp theo nào sắp bắt đầu hay không để tự động kết thúc cache rỗng/cũ đúng giờ
    const nextCampaign = await this.flashSalesRepository.findNextUpcomingCampaign(now);
    if (nextCampaign) {
      const startAtTime = new Date(nextCampaign.start_at).getTime();
      const secondsUntilStart = Math.ceil((startAtTime - now.getTime()) / 1000);

      if (secondsUntilStart > 0 && secondsUntilStart < ttl) {
        ttl = secondsUntilStart;
      }
    }

    // 4. Lưu kết quả mới truy vấn vào cache với TTL động tối ưu
    await this.redisService.set(this.CACHE_KEY, JSON.stringify(activeCampaigns), ttl);

    return activeCampaigns;
  }

  /**
   * Lấy danh sách sản phẩm tham gia một chiến dịch có phân trang
   */
  async getCampaignItemsPaginated(campaignId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return this.flashSalesRepository.findCampaignItemsPaginated(campaignId, skip, limit);
  }


  /**
   * Thêm sản phẩm/phân loại vào chiến dịch Flash Sale có sẵn
   */
  async addItemToCampaign(campaignId: number, dto: CreateFlashSaleItemDto) {
    // 1. Kiểm tra campaign có tồn tại không
    const campaign = await this.prisma.flash_sale_campaigns.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new BadRequestException('Chiến dịch Flash Sale không tồn tại');
    }

    // 2. Kiểm tra product_id có tồn tại không
    const product = await this.prisma.products.findUnique({
      where: { id: dto.product_id },
    });
    if (!product) {
      throw new BadRequestException('Sản phẩm không tồn tại');
    }

    // 3. Nếu có variant_id, kiểm tra variant_id có thuộc về product_id đó không và có tồn tại không
    if (dto.variant_id) {
      const variant = await this.prisma.product_variants.findUnique({
        where: { id: dto.variant_id },
      });
      if (!variant) {
        throw new BadRequestException('Phân loại sản phẩm không tồn tại');
      }
      if (variant.product_id !== dto.product_id) {
        throw new BadRequestException('Phân loại không thuộc về sản phẩm này');
      }
    }

    // 4. Kiểm tra xem item này đã được thêm vào chiến dịch này chưa (tránh trùng lặp sản phẩm cùng variant)
    const existingItem = await this.prisma.flash_sale_items.findFirst({
      where: {
        campaign_id: campaignId,
        product_id: dto.product_id,
        variant_id: dto.variant_id || null,
      },
    });
    if (existingItem) {
      throw new BadRequestException('Sản phẩm/phân loại này đã tồn tại trong chiến dịch Flash Sale này');
    }

    // 5. Thêm item mới thông qua repository
    const itemsData = [{
      campaign_id: campaignId,
      product_id: dto.product_id,
      variant_id: dto.variant_id || null,
      sale_price: dto.sale_price,
    }];
    await this.flashSalesRepository.createItems(itemsData);

    // 6. Xóa cache Redis để cập nhật thông tin mới nhất
    await this.redisService.del(this.CACHE_KEY);
    await this.redisService.del(`product:flash-sales-list:${dto.product_id}`);

    // 7. Trả về chi tiết chiến dịch sau khi cập nhật
    return this.flashSalesRepository.findCampaignWithItems(campaignId);
  }

  /**
   * Cập nhật trạng thái hoạt động (is_active) của chiến dịch
   */
  async updateCampaignStatus(campaignId: number, isActive: boolean) {
    // 1. Kiểm tra campaign có tồn tại không
    const campaign = await this.prisma.flash_sale_campaigns.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new BadRequestException('Chiến dịch Flash Sale không tồn tại');
    }

    // 2. Cập nhật trạng thái
    const updatedCampaign = await this.prisma.flash_sale_campaigns.update({
      where: { id: campaignId },
      data: { is_active: isActive },
    });

    // 3. Xóa cache Redis để cập nhật lại trạng thái chiến dịch ngay lập tức
    await this.redisService.del(this.CACHE_KEY);

    // Xóa cache của tất cả sản phẩm tham gia trong chiến dịch này
    const campaignItems = await this.prisma.flash_sale_items.findMany({
      where: { campaign_id: campaignId },
      select: { product_id: true },
    });
    if (campaignItems.length > 0) {
      const productIds = [...new Set(campaignItems.map((item) => item.product_id))];
      await Promise.all(
        productIds.map((id) => this.redisService.del(`product:flash-sales-list:${id}`))
      );
    }

    // 4. Trả về chi tiết chiến dịch sau khi cập nhật
    return this.flashSalesRepository.findCampaignWithItems(campaignId);
  }

  /**
   * Xóa một sản phẩm ra khỏi chiến dịch Flash Sale
   */
  async deleteItem(itemId: number) {
    // 1. Kiểm tra xem item có tồn tại không
    const item = await this.prisma.flash_sale_items.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new BadRequestException('Sản phẩm trong chiến dịch Flash Sale không tồn tại');
    }

    // 2. Xóa item
    await this.prisma.flash_sale_items.delete({
      where: { id: itemId },
    });

    // 3. Xóa cache Redis để cập nhật lại danh sách hoạt động
    await this.redisService.del(this.CACHE_KEY);
    await this.redisService.del(`product:flash-sales-list:${item.product_id}`);

    return true;
  }
}


