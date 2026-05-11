import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CartsService } from '../services/carts.service.js';
import { AddToCartDto } from '../dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto.js';

@ApiTags('carts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) { }

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  async getCart(@Req() req: any) {
    const userId = req.user.id;
    const items = await this.cartsService.getCart(userId);
    return {
      success: true,
      data: items,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add item to cart' })
  async addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    const userId = req.user.id;
    const item = await this.cartsService.addToCart(userId, dto);
    return {
      success: true,
      message: 'Item added to cart successfully',
      data: item,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update cart item quantity' })
  async updateQuantity(
    @Req() req: any,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = req.user.id;
    const item = await this.cartsService.updateItemQuantity(userId, itemId, dto);
    return {
      success: true,
      message: 'Cart item updated successfully',
      data: item,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(@Req() req: any, @Param('id', ParseIntPipe) itemId: number) {
    const userId = req.user.id;
    await this.cartsService.removeItem(userId, itemId);
    return {
      success: true,
      message: 'Item removed from cart successfully',
    };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear cart' })
  async clearCart(@Req() req: any) {
    const userId = req.user.id;
    await this.cartsService.clearCart(userId);
    return {
      success: true,
      message: 'Cart cleared successfully',
    };
  }
}
