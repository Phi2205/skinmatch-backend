import { Injectable } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository.js';

@Injectable()
export class ProductsService {
  constructor(private repository: ProductsRepository) {}

  async getHomepageData() {
    const [banners, featuredProducts] = await Promise.all([
      this.repository.findActiveBanners(),
      this.repository.findFeaturedProducts(10),
    ]);

    // Format lại dữ liệu sản phẩm để dễ dùng ở FE
    const formattedProducts = featuredProducts.map((product) => ({
      ...product,
      badges: product.product_badges.map((pb) => pb.badges),
      product_badges: undefined,
    }));

    return {
      banners,
      featuredProducts: formattedProducts,
    };
  }

  async getAllProducts() {
    return this.repository.findAllProducts();
  }

  async getProductDetail(id: number) {
    const product = await this.repository.findProductById(id);

    if (!product) return null;

    return {
      ...product,
      badges: product.product_badges.map((pb) => pb.badges),
      ingredients: product.product_ingredients.map((pi) => pi.ingredients),
      product_badges: undefined,
      product_ingredients: undefined,
    };
  }
}
