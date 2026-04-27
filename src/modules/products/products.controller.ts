import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('homepage')
  @ApiOperation({ summary: 'Get homepage data including banners and featured products' })
  async getHomepage() {
    const data = await this.productsService.getHomepageData();
    return {
      success: true,
      message: 'Homepage data fetched successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  async findAll() {
    const data = await this.productsService.getAllProducts();
    return {
      success: true,
      message: 'All products fetched successfully',
      data,
    };
  }
}
