import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from '../services/products.service.js';

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

  @Get(':id')
  @ApiOperation({ summary: 'Get product detail by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.productsService.getProductDetail(Number(id));
    if (!data) {
      return {
        success: false,
        message: 'Product not found',
      };
    }
    return {
      success: true,
      message: 'Product detail fetched successfully',
      data,
    };
  }
}
