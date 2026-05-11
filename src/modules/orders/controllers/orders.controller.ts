import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, ParseIntPipe, HttpStatus, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service.js';
import { CreateDirectOrderDto } from '../dto/create-direct-order.dto.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { createPaginationMeta } from '../../../common/helpers/pagination.helper.js';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an order from the current user\'s cart' })
  async createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user.id;
    const order = await this.ordersService.createOrderFromCart(userId, dto);
    return {
      success: true,
      message: 'Order created successfully',
      data: order,
    };
  }

  @Post('direct')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an order directly from a product (Buy Now)' })
  async createDirectOrder(@Req() req: any, @Body() dto: CreateDirectOrderDto) {
    const userId = req.user.id;
    const order = await this.ordersService.createDirectOrder(userId, dto);
    return {
      success: true,
      message: 'Order created successfully',
      data: order,
    };
  }


  @Get()
  @ApiOperation({ summary: 'Get all orders of the current user with optional pagination' })
  async getUserOrders(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;

    const result = await this.ordersService.getUserOrders(userId, pageNum, limitNum);

    if (pageNum !== undefined && limitNum !== undefined) {
      const meta = createPaginationMeta(pageNum, limitNum, result.totalItems);
      return {
        success: true,
        message: 'Orders fetched successfully',
        data: {
          items: result.items,
          meta,
        },
      };
    }

    return {
      success: true,
      message: 'Orders fetched successfully',
      data: result.items,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID' })
  async getOrderById(@Param('id', ParseIntPipe) orderId: number) {
    const order = await this.ordersService.getOrderById(orderId);
    return {
      success: true,
      message: 'Order details fetched successfully',
      data: order,
    };
  }
}
