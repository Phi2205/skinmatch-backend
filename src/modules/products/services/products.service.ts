import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository.js';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { UpdateProductDto } from '../dto/update-product.dto.js';

import { ProductFilterDto } from '../dto/product-filter.dto.js';

@Injectable()
export class ProductsService {
  constructor(private repository: ProductsRepository) {}

  // ─── Public ────────────────────────────────────────────

  async getHomepageData() {
    const [banners, featuredProducts] = await Promise.all([
      this.repository.findActiveBanners(),
      this.repository.findFeaturedProducts(10),
    ]);

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

  async getAllProductsPaginated(query: ProductFilterDto, onlyActive = true) {
    // Parse comma-separated IDs into number arrays
    const parseIds = (str?: string): number[] | undefined => {
      if (!str) return undefined;
      return str.split(',').map((v) => Number(v.trim())).filter((n) => !isNaN(n) && n > 0);
    };

    return this.repository.findAllPaginated({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      onlyActive,
      category_id: query.category_id,
      is_featured: query.is_featured,
      is_active: query.is_active,
      min_price: query.min_price,
      max_price: query.max_price,
      concern_ids: parseIds(query.concern_ids),
      ingredient_ids: parseIds(query.ingredient_ids),
      skin_type_ids: parseIds(query.skin_type_ids),
      badge_ids: parseIds(query.badge_ids),
    });
  }

  async getProductDetail(id: number) {
    const product = await this.repository.findProductById(id);

    if (!product) return null;

    return {
      ...product,
      badges: product.product_badges.map((pb) => pb.badges),
      concerns: product.product_concerns.map((pc) => pc.concerns),
      ingredients: product.product_ingredients.map((pi) => pi.ingredients),
      skin_types: product.product_skin_types.map((ps) => ps.skin_types),
      product_badges: undefined,
      product_concerns: undefined,
      product_ingredients: undefined,
      product_skin_types: undefined,
    };
  }

  // ─── Admin CRUD ────────────────────────────────────────

  async findOne(id: number) {
    const product = await this.repository.findProductById(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${id}`);
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    return this.repository.create(dto);
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.repository.update(id, dto);
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    await this.repository.delete(id);
    return product;
  }

  async updateStatus(id: number, is_active: boolean) {
    await this.findOne(id);
    return this.repository.updateStatus(id, is_active);
  }

  // ─── Product Images ────────────────────────────────────

  async addProductImage(productId: number, imageUrl: string, altText?: string, isMain = false) {
    await this.findOne(productId); // ensure product exists
    return this.repository.addProductImage(productId, imageUrl, altText, isMain);
  }

  async deleteProductImage(imageId: number) {
    const image = await this.repository.findProductImageById(imageId);
    if (!image) {
      throw new NotFoundException(`Không tìm thấy ảnh sản phẩm với ID ${imageId}`);
    }
    await this.repository.deleteProductImage(imageId);
    return image;
  }
}
