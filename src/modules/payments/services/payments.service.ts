import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { OrdersService } from '../../orders/services/orders.service.js';
import * as crypto from 'crypto';
import axios from 'axios';
import * as qs from 'qs';


@Injectable()
export class PaymentsService {
  constructor(
    private configService: ConfigService,
    private paymentsRepository: PaymentsRepository,
    @Inject(forwardRef(() => OrdersService))
    private ordersService: OrdersService,
  ) {}

  private sortObject(obj: any) {
    let sorted: any = {};
    let str: string[] = [];
    let key;
    for (key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
  }

  private formatDate(date: Date) {
    const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  async createVnpayPayment(orderId: number, amount: number, ipAddr: string) {
    const tmnCode = this.configService.get<string>('VNPAY_TMN_CODE') || '';
    const secretKey = this.configService.get<string>('VNPAY_HASH_SECRET') || '';
    let vnpUrl = this.configService.get<string>('VNPAY_PAYMENT_URL') || '';
    const returnUrl = this.configService.get<string>('VNPAY_RETURN_URL') || '';
    console.log('tmnCode', tmnCode);
    console.log('secretKey', secretKey);
    console.log('vnpUrl', vnpUrl);
    console.log('returnUrl', returnUrl);
    const date = new Date();
    const createDate = this.formatDate(date);
    const vnpAmount = amount * 100;

    let vnp_Params: any = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = `${orderId}-${date.getTime()}`;
    vnp_Params['vnp_OrderInfo'] = `Thanh toan don hang ${orderId}`;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = vnpAmount;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr || '127.0.0.1';
    vnp_Params['vnp_CreateDate'] = createDate;

    vnp_Params = this.sortObject(vnp_Params);

    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    // Save transaction
    await this.paymentsRepository.createTransaction({
      order_id: orderId,
      provider: 'VNPAY',
      amount,
      status: 'PENDING',
      request_id: vnp_Params['vnp_TxnRef'],
    });

    return { payUrl: vnpUrl };
  }

  async handleVnpayReturn(vnp_Params: any) {
    let secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = this.sortObject(vnp_Params);
    const secretKey = this.configService.get<string>('VNPAY_HASH_SECRET') || '';

    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      // Valid signature
      const orderIdStr = vnp_Params['vnp_TxnRef'];
      const orderId = orderIdStr ? parseInt(orderIdStr.split('-')[0]) : null;
      const responseCode = vnp_Params['vnp_ResponseCode'];
      
      const status = responseCode === '00' ? 'SUCCESS' : 'FAILED';
      
      const transaction = await this.paymentsRepository.findByRequestId(orderIdStr);
      if (transaction) {
        await this.paymentsRepository.updateTransaction(transaction.id, {
          transaction_id: vnp_Params['vnp_TransactionNo'],
          status,
          raw_response: vnp_Params,
        });

        if (orderId) {
          if (status === 'SUCCESS') {
             await this.ordersService.updateOrderStatus(orderId, 'PAID');
          } else {
             // Cancel order if payment failed (like momo cancel)
             await this.cancelOrder(orderId);
          }
        }
      }

      return { status: responseCode, orderId };
    } else {
      return { status: '97', orderId: null }; // Checksum failed
    }
  }

  async handleVnpayIpn(vnp_Params: any) {
    return this.handleVnpayReturn(vnp_Params);
  }

  async createMomoPayment(orderId: number, amount: number) {
    const partnerCode = this.configService.get('MOMO_PARTNER_CODE');
    const accessKey = this.configService.get('MOMO_ACCESS_KEY');
    const secretKey = this.configService.get('MOMO_SECRET_KEY');
    const endpoint = this.configService.get('MOMO_ENDPOINT');
    const redirectUrl = this.configService.get('MOMO_REDIRECT_URL');
    const ipnUrl = this.configService.get('MOMO_IPN_URL');

    const requestId = partnerCode + new Date().getTime();
    const orderInfo = `Pay for order #${orderId}`;
    const extraData = '';
    const requestType = 'captureWallet';

    const momoOrderId = `${orderId}-${new Date().getTime()}`;
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode,
      accessKey,
      requestId,
      amount,
      orderId: momoOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi',
    };

    try {
      console.log('Sending to MoMo:', requestBody);
      const response = await axios.post(endpoint, requestBody);
      console.log('MoMo Response:', response.data);

      if (response.data.resultCode !== 0) {
        throw new Error(`MoMo Error: ${response.data.message} (Code: ${response.data.resultCode})`);
      }
      
      // Save transaction to DB
      await this.paymentsRepository.createTransaction({
        order_id: orderId,
        provider: 'MOMO',
        amount,
        status: 'PENDING',
        request_id: requestId,
      });

      return response.data;
    } catch (error) {
      console.error('MoMo Payment Error:', error.response?.data || error.message);
      throw new Error(error.message || 'Failed to create MoMo payment');
    }
  }

  async handleMomoCallback(callbackData: any) {
    const { orderId: momoOrderId, resultCode, message, amount, transId, requestId, signature: momoSignature } = callbackData;
    
    // Tách lấy ID đơn hàng thực tế (Ví dụ: "9-171493..." -> "9")
    const orderId = momoOrderId.split('-')[0];
    
    // Status: 0 is success in MoMo
    const status = resultCode === 0 ? 'SUCCESS' : 'FAILED';
    
    const transaction = await this.paymentsRepository.findByRequestId(requestId);
    if (transaction) {
      await this.paymentsRepository.updateTransaction(transaction.id, {
        transaction_id: transId?.toString(),
        status,
        raw_response: callbackData,
      });

      // Update order status
      await this.ordersService.updateOrderStatus(
        parseInt(orderId), 
        status === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED'
      );
    }

    return { status };
  }


  async getTransactionsByOrder(orderId: number) {
    return this.paymentsRepository.findByOrderId(orderId);
  }

  async cancelOrder(orderId: number) {
    return this.ordersService.cancelOrder(orderId);
  }
}
