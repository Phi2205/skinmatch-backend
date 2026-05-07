import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../services/payments.service.js';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateMomoPaymentDto } from '../dto/create-momo-payment.dto.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('create-momo-link')
  @ApiOperation({ summary: 'Create MoMo payment link' })
  async createMomoLink(@Body() body: CreateMomoPaymentDto) {
    return this.paymentsService.createMomoPayment(body.orderId, body.amount);
  }

  @Post('create-vnpay-link')
  @ApiOperation({ summary: 'Create VNPAY payment link' })
  async createVnpayLink(@Body() body: CreateMomoPaymentDto, @Req() req: Request) {
    const ipAddr = req.headers['x-forwarded-for'] ||
                   req.connection.remoteAddress ||
                   req.socket.remoteAddress ||
                   '127.0.0.1';
    return this.paymentsService.createVnpayPayment(body.orderId, body.amount, ipAddr as string);
  }

  @Get('vnpay-return')
  @ApiOperation({ summary: 'VNPAY Return Redirect' })
  async vnpayReturn(@Query() query: any, @Res() res: Response) {
    console.log('VNPAY Return received:', query);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    
    const result = await this.paymentsService.handleVnpayReturn(query);
    
    if (result.status === '00') {
      return res.redirect(`${frontendUrl}/order-confirmation?orderId=${result.orderId}&status=success`);
    } else {
      return res.redirect(`${frontendUrl}/order-confirmation?orderId=${result.orderId}&status=failed`);
    }
  }

  @Get('vnpay-ipn')
  @ApiOperation({ summary: 'VNPAY IPN Callback' })
  async vnpayIpn(@Query() query: any) {
    console.log('VNPAY IPN received:', query);
    const result = await this.paymentsService.handleVnpayIpn(query);
    if (result.status !== '97') {
      return { RspCode: '00', Message: 'Confirm Success' };
    } else {
      return { RspCode: '97', Message: 'Checksum failed' };
    }
  }

  @Post('momo-callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MoMo IPN Callback' })
  async momoCallback(@Body() body: any) {
    console.log('MoMo Callback received:', body);
    return this.paymentsService.handleMomoCallback(body);
  }

  @Get('momo-return')
  @ApiOperation({ summary: 'MoMo Return Redirect' })
  async momoReturn(@Query() query: any, @Res() res: Response) {
    console.log('MoMo Return received:', query);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const realOrderId = query.orderId ? parseInt(query.orderId.split('-')[0]) : null;

    // resultCode = 0 is success. 1006 is user cancelled. Others are various errors.
    if (query.resultCode !== '0' && realOrderId) {
      try {
        // Hủy đơn hàng và phục hồi kho nếu giao dịch thất bại hoặc bị huỷ
        await this.paymentsService.cancelOrder(realOrderId);
      } catch (error) {
        console.error('Error cancelling order:', error);
      }
      // Redirect về trang kết quả đơn hàng với trạng thái thất bại
      return res.redirect(`${frontendUrl}/order-confirmation?orderId=${realOrderId}&status=failed`);
    }

    if (realOrderId) {
      // Redirect về trang kết quả đơn hàng với trạng thái thành công
      return res.redirect(`${frontendUrl}/order-confirmation?orderId=${realOrderId}&status=success`);
    }

    return res.redirect(frontendUrl);
  }

  @Get('order-status')
  @ApiOperation({ summary: 'Get payment status of an order' })
  async getOrderStatus(@Query('orderId') orderId: string) {
    return this.paymentsService.getTransactionsByOrder(parseInt(orderId));
  }

  @Post('cancel-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order and restore stock' })
  async cancelOrder(@Body('orderId') orderId: number) {
    await this.paymentsService.cancelOrder(orderId);
    return { success: true, message: 'Order cancelled successfully' };
  }
}
