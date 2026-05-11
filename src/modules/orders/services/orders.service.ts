import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { OrdersRepository } from '../repositories/orders.repository.js';
import { CartsRepository } from '../../carts/repositories/carts.repository.js';
import { ProductsRepository } from '../../products/repositories/products.repository.js';
import { VariantsRepository } from '../../products/repositories/variants.repository.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDirectOrderDto } from '../dto/create-direct-order.dto.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { PaymentsService } from '../../payments/services/payments.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private ordersRepository: OrdersRepository,
    private cartsRepository: CartsRepository,
    private productsRepository: ProductsRepository,
    private variantsRepository: VariantsRepository,
    private prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly _paymentsService: any,
  ) {}

  private get paymentsService(): PaymentsService {
    return this._paymentsService;
  }

  private async getVariantCheckoutPrice(productId: number, variantId: number | null, originalPrice: number): Promise<number> {
    const now = new Date();
    const activeFlashSales = await this.productsRepository.findActiveFlashSalesByProductId(productId, now);

    const matchingSale = activeFlashSales.find(
      (sale: any) => sale.variant_id === variantId || sale.variant_id === null
    );

    if (matchingSale) {
      return matchingSale.sale_price;
    }

    return originalPrice;
  }

  async createOrderFromCart(userId: number, dto: CreateOrderDto) {
    if (!dto.receiver_phone) {
      throw new BadRequestException('Receiver phone is required');
    }

    const cartItems = await this.cartsRepository.findByUserId(userId);
    
    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Calculate total price with active flash sale check
    let totalPrice = 0;
    const items = await Promise.all(
      cartItems.map(async (cartItem) => {
        const originalPrice = cartItem.variants ? cartItem.variants.price : 0;
        const price = cartItem.variants
          ? await this.getVariantCheckoutPrice(cartItem.product_id, cartItem.variant_id, originalPrice)
          : 0;
        const itemTotal = price * cartItem.quantity;
        totalPrice += itemTotal;

        return {
          product_id: cartItem.product_id,
          variant_id: cartItem.variant_id,
          quantity: cartItem.quantity,
          price: price,
        };
      })
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await this.ordersRepository.createOrder({
        user_id: userId,
        total_price: totalPrice,
        status: 'PENDING',
        ...dto,
        items,
      }, tx);

      await this.cartsRepository.clearCart(userId, tx);
      return createdOrder;
    });

    // Handle payment integration
    let payUrl: string | null = null;
    if (dto.payment_method === 'MOMO') {
      const momoResponse = await this.paymentsService.createMomoPayment(order.id, totalPrice);
      payUrl = momoResponse.payUrl;
    } else if (dto.payment_method === 'VNPAY') {
      const vnpayResponse = await this.paymentsService.createVnpayPayment(order.id, totalPrice, '127.0.0.1');
      payUrl = vnpayResponse.payUrl;
    }

    return {
      ...order,
      payUrl,
    };
  }

  async createDirectOrder(userId: number, dto: CreateDirectOrderDto) {
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }
    if (!dto.receiver_phone) {
      throw new BadRequestException('Receiver phone is required');
    }

    const product = await this.productsRepository.findProductById(dto.product_id);

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    let price = 0;
    if (dto.variant_id) {
      const variant = await this.variantsRepository.findByVariantId(dto.variant_id);
      console.log("stock available: ", variant?.stock);
      console.log("quantity: ", dto.quantity);
      if (!variant) {
        throw new BadRequestException('Product variant not found');
      }
      if (variant.stock < dto.quantity) {
        throw new BadRequestException('Not enough stock available');
      }
      price = await this.getVariantCheckoutPrice(dto.product_id, dto.variant_id, variant.price);
    } else {
      if (product.product_variants.length > 0) {
        const defaultVariant = product.product_variants[0];
        if (defaultVariant.stock < dto.quantity) {
          throw new BadRequestException('Not enough stock available');
        }
        price = await this.getVariantCheckoutPrice(dto.product_id, defaultVariant.id, defaultVariant.price);
        dto.variant_id = defaultVariant.id; // Record the fallback variant id
      } else {
        price = 0; 
      }
    }


    const totalPrice = price * dto.quantity;

    const items = [{
      product_id: dto.product_id,
      variant_id: dto.variant_id,
      quantity: dto.quantity,
      price: price,
    }];

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await this.ordersRepository.createOrder({
        user_id: userId,
        total_price: totalPrice,
        status: 'PENDING',
        ...dto,
        items,
      }, tx);

      if (dto.variant_id) {
        await this.variantsRepository.decrementStock(dto.variant_id, dto.quantity, tx);
      }

      return createdOrder;
    });

    // Handle payment integration
    let payUrl: string | null = null;
    if (dto.payment_method === 'MOMO') {
      const momoResponse = await this.paymentsService.createMomoPayment(order.id, totalPrice);
      payUrl = momoResponse.payUrl;
    } else if (dto.payment_method === 'VNPAY') {
      const vnpayResponse = await this.paymentsService.createVnpayPayment(order.id, totalPrice, '127.0.0.1');
      payUrl = vnpayResponse.payUrl;
    }


    return {
      ...order,
      payUrl,
    };
  }


  async getUserOrders(userId: number, page?: number, limit?: number) {
    return this.ordersRepository.findByUserId(userId, page, limit);
  }

  async getOrderById(orderId: number) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    return order;
  }

  async updateOrderStatus(orderId: number, status: string) {
    return this.ordersRepository.updateStatus(orderId, status);
  }

  async cancelOrder(orderId: number) {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      // Restore stock for all order items
      if (order.order_items && order.order_items.length > 0) {
        for (const item of order.order_items) {
          if (item.variant_id && item.quantity) {
            await this.variantsRepository.incrementStock(item.variant_id, item.quantity, tx);
          }
        }
      }

      // Update order status
      return this.ordersRepository.updateStatus(orderId, 'CANCELLED', tx);
    });
  }
}
