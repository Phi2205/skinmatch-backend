import { Controller, Get, Post, Body, UseGuards, Param, ParseIntPipe, Patch, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { FlashSalesService } from './flash-sales.service.js';
import { CreateFlashSaleCampaignDto, CreateFlashSaleItemDto, UpdateCampaignStatusDto } from './dto/create-flash-sale.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/index.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { createPaginationMeta } from '../../common/helpers/pagination.helper.js';

@ApiTags('flash-sales')
@Controller('flash-sales')
export class FlashSalesController {
  constructor(private readonly flashSalesService: FlashSalesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mới chiến dịch Flash Sale (Chỉ dành cho Admin)' })
  @ApiBody({ type: CreateFlashSaleCampaignDto })
  @ApiResponse({
    status: 201,
    description: 'Tạo chiến dịch Flash Sale thành công',
  })
  async createCampaign(@Body() dto: CreateFlashSaleCampaignDto) {
    const campaign = await this.flashSalesService.createCampaign(dto);
    return {
      success: true,
      message: 'Tạo chiến dịch Flash Sale thành công',
      data: campaign,
    };
  }

  @Post(':campaignId/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm sản phẩm/phân loại vào chiến dịch Flash Sale (Chỉ dành cho Admin)' })
  @ApiBody({ type: CreateFlashSaleItemDto })
  @ApiResponse({
    status: 201,
    description: 'Thêm sản phẩm vào chiến dịch Flash Sale thành công',
  })
  async addItemToCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: CreateFlashSaleItemDto,
  ) {
    const campaign = await this.flashSalesService.addItemToCampaign(campaignId, dto);
    return {
      success: true,
      message: 'Thêm sản phẩm vào chiến dịch Flash Sale thành công',
      data: campaign,
    };
  }

  @Patch(':campaignId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái hoạt động của chiến dịch Flash Sale (Chỉ dành cho Admin)' })
  @ApiBody({ type: UpdateCampaignStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái chiến dịch thành công',
  })
  async updateCampaignStatus(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    const campaign = await this.flashSalesService.updateCampaignStatus(campaignId, dto.is_active);
    return {
      success: true,
      message: 'Cập nhật trạng thái chiến dịch thành công',
      data: campaign,
    };
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa sản phẩm khỏi chiến dịch Flash Sale (Chỉ dành cho Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Xóa sản phẩm khỏi chiến dịch thành công',
  })
  async deleteItem(@Param('itemId', ParseIntPipe) itemId: number) {
    await this.flashSalesService.deleteItem(itemId);
    return {
      success: true,
      message: 'Xóa sản phẩm khỏi chiến dịch Flash Sale thành công',
    };
  }
  @Get('active')
  @ApiOperation({ summary: 'Lấy danh sách Flash Sale đang hoạt động ở khung giờ hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách Flash Sale thành công',
  })
  async getActiveSales(@Query() query: PaginationQueryDto) {
    const activeSales = await this.flashSalesService.getCurrentActiveCampaigns();
    
    // Nếu không truyền page và limit, trả về danh sách đầy đủ (tương thích ngược với FE)
    if (query.page === undefined && query.limit === undefined) {
      return {
        success: true,
        data: activeSales,
      };
    }

    const totalItems = activeSales.length;
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 10;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedItems = activeSales.slice(startIndex, endIndex);

    const meta = createPaginationMeta(pageNum, limitNum, totalItems);

    return {
      success: true,
      data: {
        items: paginatedItems,
        meta,
      },
    };
  }
}


