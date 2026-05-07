import { Controller, Get, Post, Body, Param, UseGuards, Req, ParseIntPipe, HttpStatus, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from '../services/orders.service.js';
import { CreateDirectOrderDto } from '../dto/create-direct-order.dto.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';

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
  @ApiOperation({ summary: 'Get all orders of the current user' })
  async getUserOrders(@Req() req: any) {
    const userId = req.user.id;
    const orders = await this.ordersService.getUserOrders(userId);
    return {
      success: true,
      data: orders,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID' })
  async getOrderById(@Param('id', ParseIntPipe) orderId: number) {
    const order = await this.ordersService.getOrderById(orderId);
    return {
      success: true,
      data: order,
    };
  }
}
