import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CartsRepository } from '../repositories/carts.repository.js';
import { AddToCartDto } from '../dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from '../dto/update-cart-item.dto.js';

@Injectable()
export class CartsService {
  constructor(private cartsRepository: CartsRepository) { }

  async getCart(userId: number) {
    return this.cartsRepository.findByUserId(userId);
  }

  async addToCart(userId: number, dto: AddToCartDto) {
    const existingItem = await this.cartsRepository.findItem(userId, dto.productId, dto.variantId);

    if (existingItem) {
      return this.cartsRepository.updateQuantity(existingItem.id, existingItem.quantity + dto.quantity);
    }

    return this.cartsRepository.addItem({
      userId,
      productId: dto.productId,
      variantId: dto.variantId,
      quantity: dto.quantity,
    });
  }

  async updateItemQuantity(userId: number, itemId: number, dto: UpdateCartItemDto) {
    const item = await this.cartsRepository.findItemById(itemId);

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.user_id !== userId) {
      throw new ForbiddenException('You do not have permission to update this cart item');
    }

    return this.cartsRepository.updateQuantity(itemId, dto.quantity);
  }

  async removeItem(userId: number, itemId: number) {
    const item = await this.cartsRepository.findItemById(itemId);

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.user_id !== userId) {
      throw new ForbiddenException('You do not have permission to remove this cart item');
    }

    return this.cartsRepository.removeItem(itemId);
  }

  async clearCart(userId: number) {
    return this.cartsRepository.clearCart(userId);
  }
}
