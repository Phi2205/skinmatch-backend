import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository.js';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { UpdateProductImageDto } from '../dto/update-product-image.dto.js';

import { ProductFilterDto } from '../dto/product-filter.dto.js';
import { slugify } from '../../../common/helpers/slug.helper.js';

import { RedisService } from '../../../redis/redis.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private repository: ProductsRepository,
    private redisService: RedisService,
  ) { }

  async generateUniqueSlug(name: string, idToIgnore?: number): Promise<string> {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.repository.findBySlug(slug);
      if (!existing || (idToIgnore && existing.id === idToIgnore)) {
        break; // Slug is unique
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    return slug;
  }

  // ─── Public ────────────────────────────────────────────

  async getHomepageData() {
    const [banners, featuredProducts] = await Promise.all([
      this.repository.findActiveBanners(),
      this.repository.findFeaturedProducts(10),
    ]);

    const formattedProducts = featuredProducts.map((product) => ({
      ...product,
      badges: product.product_badges.map((pb) => pb.badges),
      concerns: product.product_concerns.map((pc) => pc.concerns),
      ingredients: product.product_ingredients.map((pi) => pi.ingredients),
      skin_types: product.product_skin_types.map((ps) => ps.skin_types),
      product_badges: undefined,
      product_concerns: undefined,
      product_ingredients: undefined,
      product_skin_types: undefined,
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

    const { items, totalItems } = await this.repository.findAllPaginated({
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

    const formattedItems = items.map((product) => ({
      ...product,
      images: product.product_images.sort((a, b) => a.position - b.position),
      product_images: undefined,
    }));

    return { items: formattedItems, totalItems };
  }

  async getProductDetail(id: number, onlyActive = true) {
    const product = await this.repository.findProductById(id);

    if (!product) return null;
    if (onlyActive && !product.is_active) return null;

    return {
      ...product,
      images: product.product_images.sort((a, b) => a.position - b.position),
      badges: product.product_badges.map((pb) => pb.badges),
      concerns: product.product_concerns.map((pc) => pc.concerns),
      ingredients: product.product_ingredients.map((pi) => pi.ingredients),
      skin_types: product.product_skin_types.map((ps) => ps.skin_types),
      product_images: undefined,
      product_badges: undefined,
      product_concerns: undefined,
      product_ingredients: undefined,
      product_skin_types: undefined,
    };
  }

  async getProductsByRelation(params: {
    type: 'category' | 'badge' | 'ingredient' | 'concern' | 'skin_type';
    slug: string;
    page?: number;
    limit?: number;
    onlyActive?: boolean;
  }) {
    const cacheKey = `products:relation:${params.type}:${params.slug}:p${params.page ?? 1}:l${params.limit ?? 10}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached products:', e);
      }
    }

    const result = await this.repository.findProductsByRelationSlug(params);

    // Cache for 1 hour (3600 seconds)
    await this.redisService.set(cacheKey, JSON.stringify(result), 3600);

    return result;
  }

  async getProductBySlug(slug: string, onlyActive = true) {
    const product = await this.repository.findBySlug(slug);

    if (!product) return null;
    if (onlyActive && !product.is_active) return null;

    return {
      ...product,
      images: product.product_images.sort((a, b) => a.position - b.position),
      badges: product.product_badges.map((pb) => pb.badges),
      concerns: product.product_concerns.map((pc) => pc.concerns),
      ingredients: product.product_ingredients.map((pi) => pi.ingredients),
      skin_types: product.product_skin_types.map((ps) => ps.skin_types),
      product_images: undefined,
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
    const slug = await this.generateUniqueSlug(dto.slug || dto.name);
    return this.repository.create({ ...dto, slug });
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    let slug: string | undefined;
    if (dto.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }
    return this.repository.update(id, { ...dto, slug });
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

  async addProductImage(productId: number, imageUrl: string, altText?: string, isMain = false, position?: number) {
    await this.findOne(productId); // ensure product exists

    // If position not provided, put it at the end
    if (position === undefined) {
      const existing = await this.repository.findAllProductImages(productId);
      position = existing.length > 0 ? Math.max(...existing.map(img => img.position)) + 1 : 0;
    }

    const newImage = await this.repository.addProductImage(productId, imageUrl, altText, isMain, position);
    await this.reorderProductImages(productId);
    return newImage;
  }

  async updateProductImage(productId: number, imageId: number, dto: UpdateProductImageDto) {
    await this.findOne(productId);
    const image = await this.repository.findProductImageById(imageId);
    if (!image || image.product_id !== productId) {
      throw new NotFoundException(`Ảnh sản phẩm không tồn tại`);
    }

    const updated = await this.repository.updateProductImage(imageId, dto);

    // If position or is_main was changed, we might need to reorder or adjust
    if (dto.position !== undefined || dto.is_main) {
      await this.reorderProductImages(productId);
    }

    return updated;
  }

  async reorderImagesBulk(productId: number, imageOrders: { id: number; position: number }[]) {
    await this.findOne(productId);
    console.log(imageOrders)
    // Update each image position
    for (const item of imageOrders) {
      await this.repository.updateProductImage(item.id, { position: item.position });
    }

    // Run the global reorder logic to handle main image and sequential indexes
    await this.reorderProductImages(productId);

    return this.repository.findAllProductImages(productId);
  }

  async deleteProductImage(imageId: number) {
    const image = await this.repository.findProductImageById(imageId);
    if (!image) {
      throw new NotFoundException(`Không tìm thấy ảnh sản phẩm với ID ${imageId}`);
    }
    const productId = image.product_id;
    await this.repository.deleteProductImage(imageId);
    await this.reorderProductImages(productId);
    return image;
  }

  async findImageById(imageId: number) {
    return this.repository.findProductImageById(imageId);
  }

  private async reorderProductImages(productId: number) {
    const images = await this.repository.findAllProductImages(productId);

    // Sort by: is_main first, then position, then created_at/id
    const sorted = [...images].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return a.position - b.position;
    });

    // Update each image with its new sequential position and handle is_main exclusivity
    for (let i = 0; i < sorted.length; i++) {
      const isMain = i === 0; // The first one in sorted list should be the main one
      if (sorted[i].position !== i || sorted[i].is_main !== isMain) {
        await this.repository.updateProductImage(sorted[i].id, {
          position: i,
          is_main: isMain
        });
      }
    }
  }
}
