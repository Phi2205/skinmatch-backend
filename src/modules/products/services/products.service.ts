import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository.js';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { UpdateProductImageDto } from '../dto/update-product-image.dto.js';

import { ProductFilterDto } from '../dto/product-filter.dto.js';
import { slugify } from '../../../common/helpers/slug.helper.js';

import { RedisService } from '../../../redis/redis.service.js';
import { ChatbotIngestionService } from '../../chatbot/services/chatbot-ingestion.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private repository: ProductsRepository,
    private redisService: RedisService,
    private chatbotIngestionService: ChatbotIngestionService,
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

    const formattedProducts = featuredProducts.map((product) => {
      const minPrice = product.product_variants?.length
        ? Math.min(...product.product_variants.map((v) => v.price))
        : 0;

      return {
        ...product,
        price: minPrice,
        rating: product.review_count > 0 ? Math.round((product.rating_sum / product.review_count) * 10) / 10 : 0,
        reviews_count: product.review_count,
        variants: product.product_variants,
        badges: product.product_badges.map((pb) => pb.badges),
        concerns: product.product_concerns.map((pc) => pc.concerns),
        ingredients: product.product_ingredients.map((pi) => pi.ingredients),
        skin_types: product.product_skin_types.map((ps) => ps.skin_types),
        categories: product.product_categories.map((pc) => pc.categories),
        product_badges: undefined,
        product_concerns: undefined,
        product_ingredients: undefined,
        product_skin_types: undefined,
        product_categories: undefined,
        product_variants: undefined,
      };
    });

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
      category_ids: parseIds(query.category_ids),
      is_featured: query.is_featured,
      is_active: query.is_active,
      min_price: query.min_price,
      max_price: query.max_price,
      concern_ids: parseIds(query.concern_ids),
      ingredient_ids: parseIds(query.ingredient_ids),
      skin_type_ids: parseIds(query.skin_type_ids),
      badge_ids: parseIds(query.badge_ids),
    });

    // 1. Lấy tất cả active flash sales cho các sản phẩm hiện tại trong 1 query duy nhất (bulk query)
    const productIds = items.map((p) => p.id);
    console.log(productIds);
    const now = new Date();
    console.log(now);
    const allFlashSales = productIds.length > 0
      ? await this.repository.findActiveFlashSalesByProductIds(productIds, now)
      : [];
    // 2. Gom nhóm các flash sale theo product_id vào Map để truy xuất nhanh O(1)
    const flashSaleMap = new Map<number, any[]>();
    for (const sale of allFlashSales) {
      if (!flashSaleMap.has(sale.product_id)) {
        flashSaleMap.set(sale.product_id, []);
      }
      flashSaleMap.get(sale.product_id)!.push(sale);
    }


    // 3. Thực hiện map dữ liệu in-memory
    const formattedItems = items.map((product) => {
      const minPrice = product.product_variants?.length
        ? Math.min(...product.product_variants.map((v) => v.price))
        : 0;

      const productSales = flashSaleMap.get(product.id) || [];

      // Chèn thông tin flash sale vào từng variant tương ứng
      const variantsWithFlashSale = product.product_variants?.map((variant) => {
        const matchingSale = productSales.find(
          (sale) => sale.variant_id === variant.id || sale.variant_id === null
        );

        return {
          ...variant,
          flash_sale: matchingSale ? {
            item_id: matchingSale.id,
            campaign_id: matchingSale.campaign_id,
            sale_price: matchingSale.sale_price,
            campaign_title: matchingSale.flash_sales?.title,
            start_at: matchingSale.flash_sales?.start_at,
            end_at: matchingSale.flash_sales?.end_at,
          } : null,
        };
      }) || [];

      // Tìm xem có flash sale chung cho toàn bộ product (variant_id === null) không
      const productFlashSale = productSales.find((sale) => sale.variant_id === null) || productSales[0] || null;

      return {
        ...product,
        price: minPrice,
        rating: product.review_count > 0 ? Math.round((product.rating_sum / product.review_count) * 10) / 10 : 0,
        reviewsCount: product.review_count,
        variants: variantsWithFlashSale,
        images: product.product_images.sort((a, b) => a.position - b.position),
        categories: product.product_categories.map((pc) => pc.categories),
        flash_sale: productFlashSale ? {
          item_id: productFlashSale.id,
          campaign_id: productFlashSale.campaign_id,
          sale_price: productFlashSale.sale_price,
          campaign_title: productFlashSale.flash_sales?.title,
          start_at: productFlashSale.flash_sales?.start_at,
          end_at: productFlashSale.flash_sales?.end_at,
        } : null,
        product_images: undefined,
        product_categories: undefined,
        product_variants: undefined,
      };
    });

    return { items: formattedItems, totalItems };
  }

  async getProductDetail(id: number, onlyActive = true) {
    const cacheKey = `product:detail:${id}:${onlyActive}`;
    const cached = await this.redisService.get(cacheKey);

    let product: any = null;

    if (cached) {
      try {
        product = JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached product detail:', e);
      }
    }
    console.log("đã tới đây")

    if (!product) {
      const dbProduct = await this.repository.findProductById(id);

      if (!dbProduct) return null;
      if (onlyActive && !dbProduct.is_active) return null;

      const minPrice = dbProduct.product_variants?.length
        ? Math.min(...dbProduct.product_variants.map((v) => v.price))
        : 0;

      product = {
        ...dbProduct,
        price: minPrice,
        rating: dbProduct.review_count > 0 ? Math.round((dbProduct.rating_sum / dbProduct.review_count) * 10) / 10 : 0,
        reviewsCount: dbProduct.review_count,
        variants: dbProduct.product_variants,
        images: dbProduct.product_images.sort((a, b) => a.position - b.position),
        badges: dbProduct.product_badges.map((pb) => pb.badges),
        concerns: dbProduct.product_concerns.map((pc) => pc.concerns),
        ingredients: dbProduct.product_ingredients.map((pi) => pi.ingredients),
        skin_types: dbProduct.product_skin_types.map((ps) => ps.skin_types),
        categories: dbProduct.product_categories.map((pc) => pc.categories),
        product_images: undefined,
        product_badges: undefined,
        product_concerns: undefined,
        product_ingredients: undefined,
        product_skin_types: undefined,
        product_categories: undefined,
        product_variants: undefined,
      };

      // Cache product chính trong 30 phút (Không chứa flash sale)
      await this.redisService.set(cacheKey, JSON.stringify(product), 1800);
    }

    if (!product) return null;
    console.log("đã tới đây")

    // 1. LUÔN LUÔN lấy thông tin Flash Sale riêng biệt (có cache riêng động tới khi kết thúc)
    const flashSales = await this.getProductActiveFlashSales(id);
    console.log("flashsales",flashSales)

    // 2. Chèn thông tin flash sale vào từng variant tương ứng
    const variantsWithFlashSale = product.variants?.map((variant: any) => {
      const matchingSale = flashSales.find(
        (sale: any) => sale.variant_id === variant.id || sale.variant_id === null
      );

      return {
        ...variant,
        flash_sale: matchingSale ? {
          item_id: matchingSale.id,
          campaign_id: matchingSale.campaign_id,
          sale_price: matchingSale.sale_price,
          campaign_title: matchingSale.flash_sales?.title,
          start_at: matchingSale.flash_sales?.start_at,
          end_at: matchingSale.flash_sales?.end_at,
        } : null,
      };
    }) || [];

    // Tìm xem có flash sale chung cho toàn bộ product (variant_id === null) không
    const productFlashSale = flashSales.find((sale: any) => sale.variant_id === null) || flashSales[0] || null;

    return {
      ...product,
      variants: variantsWithFlashSale,
      flash_sale: productFlashSale ? {
        item_id: productFlashSale.id,
        campaign_id: productFlashSale.campaign_id,
        sale_price: productFlashSale.sale_price,
        campaign_title: productFlashSale.flash_sales?.title,
        start_at: productFlashSale.flash_sales?.start_at,
        end_at: productFlashSale.flash_sales?.end_at,
      } : null,
    };
  }

  async getProductActiveFlashSales(productId: number) {
    const flashSaleCacheKey = `product:flash-sales-list:${productId}`;
    const cachedFlashSales = await this.redisService.get(flashSaleCacheKey);

    if (cachedFlashSales) {
      try {
        return JSON.parse(cachedFlashSales);
      } catch (e) {
        console.error('Error parsing cached product active flash sales:', e);
      }
    }

    const now = new Date();
    const flashSaleItems = await this.repository.findActiveFlashSalesByProductId(productId, now);

    let ttl = 60; // Mặc định nếu không có flash sale nào, cache trong 1 phút để tránh overload DB
    if (flashSaleItems.length > 0) {
      // Tính toán TTL dựa trên thời gian kết thúc sớm nhất của chiến dịch đang diễn ra
      const endTimes = flashSaleItems.map((item: any) => new Date(item.flash_sales.end_at).getTime());
      const minEndTime = Math.min(...endTimes);
      const secondsUntilEnd = Math.ceil((minEndTime - now.getTime()) / 1000);

      if (secondsUntilEnd > 0) {
        ttl = secondsUntilEnd; // Lưu cache cho tới khi flash sale kết thúc
      }
    }

    // Cache thông tin danh sách flash sale với TTL động đến khi kết thúc chiến dịch
    await this.redisService.set(flashSaleCacheKey, JSON.stringify(flashSaleItems), ttl);

    return flashSaleItems;
  }



  async getSimilarProducts(productId: number, limit = 4) {
    const cacheKey = `product:similar:${productId}:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached similar products:', e);
      }
    }

    // Ensure product exists
    const product = await this.repository.findProductById(productId);
    if (!product) {
      return [];
    }

    // 1. Try finding vector-based similarity
    let similarCandidates = await this.repository.findSimilarProductsByVector(productId, limit);
    let similarIds = similarCandidates.map((c) => Number(c.product_id || c.id));

    // 2. Fallback 1: Same categories if vector similarity returned nothing
    if (similarIds.length === 0) {
      const categoryIds = product.product_categories.map((pc) => pc.category_id);
      if (categoryIds.length > 0) {
        const fallbackCategory = await this.repository.findProductsByCategoryFallback(productId, categoryIds, limit);
        similarIds = fallbackCategory.map((p) => p.id);
      }
    }

    // 3. Fallback 2: General active products if still nothing
    if (similarIds.length === 0) {
      const fallbackGeneral = await this.repository.findProductsGeneralFallback(productId, limit);
      similarIds = fallbackGeneral.map((p) => p.id);
    }

    if (similarIds.length === 0) {
      return [];
    }

    // 4. Get full product details for final recommended IDs
    const productsFromDb = await this.repository.findProductsForRecommendation(similarIds);

    // Format and maintain rank order
    const formattedProducts = similarIds
      .map((id) => {
        const p = productsFromDb.find((item) => item.id === id);
        if (!p) return null;
        const minPrice = p.product_variants?.length
          ? Math.min(...p.product_variants.map((v) => v.price))
          : 0;

        return {
          ...p,
          price: minPrice,
          rating: p.review_count > 0 ? Math.round((p.rating_sum / p.review_count) * 10) / 10 : 0,
          reviewsCount: p.review_count,
          variants: p.product_variants,
          images: p.product_images.sort((a, b) => a.position - b.position),
          badges: p.product_badges.map((pb) => pb.badges),
          categories: p.product_categories.map((pc) => pc.categories),
          concerns: p.product_concerns.map((pc) => pc.concerns),
          ingredients: p.product_ingredients.map((pi) => pi.ingredients),
          skin_types: p.product_skin_types.map((ps) => ps.skin_types),
          product_images: undefined,
          product_badges: undefined,
          product_categories: undefined,
          product_variants: undefined,
          product_concerns: undefined,
          product_ingredients: undefined,
          product_skin_types: undefined,
        };
      })
      .filter((p) => p !== null);

    // Cache results for 1 hour (3600 seconds)
    await this.redisService.set(cacheKey, JSON.stringify(formattedProducts), 3600);

    return formattedProducts;
  }

  private async clearProductDetailCache(id: number) {
    try {
      await Promise.all([
        this.redisService.del(`product:detail:${id}:true`),
        this.redisService.del(`product:detail:${id}:false`),
        this.redisService.delByPattern('products:relation:*'),
        this.redisService.delByPattern(`product:similar:${id}:*`),
      ]);
    } catch (err) {
      console.error('Error clearing product detail cache:', err);
    }
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

    let result: any = null;

    if (cached) {
      try {
        result = JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached products:', e);
      }
    }

    if (!result) {
      result = await this.repository.findProductsByRelationSlug(params);

      // Cache for 1 hour (3600 seconds)
      await this.redisService.set(cacheKey, JSON.stringify(result), 3600);
    }

    if (!result || !result.items) return result;

    // 1. Lấy danh sách tất cả Product ID có trên trang hiện tại
    const productIds = result.items.map((p: any) => p.id);

    // 2. Truy vấn gộp (Bulk Fetch) tất cả các active flash sale của danh sách ID này bằng 1 query duy nhất
    const now = new Date();
    const allFlashSales = await this.repository.findActiveFlashSalesByProductIds(productIds, now);

    // 3. Thực hiện map dữ liệu hoàn toàn in-memory, loại bỏ hoàn toàn N+1 query
    const enrichedItems = result.items.map((product: any) => {
      // Lọc các Flash Sale thuộc về sản phẩm hiện tại
      const productSales = allFlashSales.filter((sale: any) => sale.product_id === product.id);

      // Chèn thông tin flash sale vào từng variant tương ứng
      const variantsWithFlashSale = product.variants?.map((variant: any) => {
        const matchingSale = productSales.find(
          (sale: any) => sale.variant_id === variant.id || sale.variant_id === null
        );

        return {
          ...variant,
          flash_sale: matchingSale ? {
            item_id: matchingSale.id,
            campaign_id: matchingSale.campaign_id,
            sale_price: matchingSale.sale_price,
            campaign_title: matchingSale.flash_sales?.title,
            start_at: matchingSale.flash_sales?.start_at,
            end_at: matchingSale.flash_sales?.end_at,
          } : null,
        };
      }) || [];

      // Tìm xem có flash sale chung cho toàn bộ product (variant_id === null) không
      const productFlashSale = productSales.find((sale: any) => sale.variant_id === null) || productSales[0] || null;

      return {
        ...product,
        variants: variantsWithFlashSale,
        flash_sale: productFlashSale ? {
          item_id: productFlashSale.id,
          campaign_id: productFlashSale.campaign_id,
          sale_price: productFlashSale.sale_price,
          campaign_title: productFlashSale.flash_sales?.title,
          start_at: productFlashSale.flash_sales?.start_at,
          end_at: productFlashSale.flash_sales?.end_at,
        } : null,
      };
    });

    return {
      ...result,
      items: enrichedItems,
    };
  }



  async getProductBySlug(slug: string, onlyActive = true) {
    const cacheKey = `product:slug:${slug}:${onlyActive}`;
    const cached = await this.redisService.get(cacheKey);

    let product: any = null;

    if (cached) {
      try {
        product = JSON.parse(cached);
      } catch (e) {
        console.error('Error parsing cached product by slug:', e);
      }
    }

    if (!product) {
      const dbProduct = await this.repository.findBySlug(slug);

      if (!dbProduct) return null;
      if (onlyActive && !dbProduct.is_active) return null;

      const minPrice = dbProduct.product_variants?.length
        ? Math.min(...dbProduct.product_variants.map((v) => v.price))
        : 0;

      product = {
        ...dbProduct,
        price: minPrice,
        rating: dbProduct.review_count > 0 ? Math.round((dbProduct.rating_sum / dbProduct.review_count) * 10) / 10 : 0,
        reviewsCount: dbProduct.review_count,
        variants: dbProduct.product_variants,
        images: dbProduct.product_images.sort((a, b) => a.position - b.position),
        badges: dbProduct.product_badges.map((pb) => pb.badges),
        concerns: dbProduct.product_concerns.map((pc) => pc.concerns),
        ingredients: dbProduct.product_ingredients.map((pi) => pi.ingredients),
        skin_types: dbProduct.product_skin_types.map((ps) => ps.skin_types),
        categories: dbProduct.product_categories.map((pc) => pc.categories),
        product_images: undefined,
        product_badges: undefined,
        product_concerns: undefined,
        product_ingredients: undefined,
        product_skin_types: undefined,
        product_categories: undefined,
        product_variants: undefined,
      };

      // Cache product chính trong 30 phút (Không chứa flash sale)
      await this.redisService.set(cacheKey, JSON.stringify(product), 1800);
    }

    if (!product) return null;

    // 1. LUÔN LUÔN lấy thông tin Flash Sale riêng biệt (có cache riêng động tới khi kết thúc)
    const flashSales = await this.getProductActiveFlashSales(product.id);

    // 2. Chèn thông tin flash sale vào từng variant tương ứng
    const variantsWithFlashSale = product.variants?.map((variant: any) => {
      const matchingSale = flashSales.find(
        (sale: any) => sale.variant_id === variant.id || sale.variant_id === null
      );

      return {
        ...variant,
        flash_sale: matchingSale ? {
          item_id: matchingSale.id,
          campaign_id: matchingSale.campaign_id,
          sale_price: matchingSale.sale_price,
          campaign_title: matchingSale.flash_sales?.title,
          start_at: matchingSale.flash_sales?.start_at,
          end_at: matchingSale.flash_sales?.end_at,
        } : null,
      };
    }) || [];

    // Tìm xem có flash sale chung cho toàn bộ product (variant_id === null) không
    const productFlashSale = flashSales.find((sale: any) => sale.variant_id === null) || flashSales[0] || null;

    return {
      ...product,
      variants: variantsWithFlashSale,
      flash_sale: productFlashSale ? {
        item_id: productFlashSale.id,
        campaign_id: productFlashSale.campaign_id,
        sale_price: productFlashSale.sale_price,
        campaign_title: productFlashSale.flash_sales?.title,
        start_at: productFlashSale.flash_sales?.start_at,
        end_at: productFlashSale.flash_sales?.end_at,
      } : null,
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
    const result = await this.repository.create({ ...dto, slug });
    await this.clearProductDetailCache(result.id);

    // Ingest into vector database in the background to avoid blocking the API
    this.chatbotIngestionService.ingestSingleProduct(result.id).catch((err) => {
      console.error(`Failed to ingest product ${result.id} to vector DB:`, err);
    });

    return result;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    let slug: string | undefined;
    if (dto.slug) {
      slug = await this.generateUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }
    const updated = await this.repository.update(id, { ...dto, slug });
    await this.clearProductDetailCache(id);

    // Re-ingest into vector database in the background to avoid blocking the API
    this.chatbotIngestionService.ingestSingleProduct(id).catch((err) => {
      console.error(`Failed to re-ingest product ${id} to vector DB:`, err);
    });

    return updated;
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    await this.repository.delete(id);
    await this.clearProductDetailCache(id);
    return product;
  }

  async updateStatus(id: number, is_active: boolean) {
    await this.findOne(id);
    const result = await this.repository.updateStatus(id, is_active);
    await this.clearProductDetailCache(id);

    // Update ingestion in the background (will clear vectors if is_active is false)
    this.chatbotIngestionService.ingestSingleProduct(id).catch((err) => {
      console.error(`Failed to update status ingestion for product ${id}:`, err);
    });

    return result;
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
    await this.clearProductDetailCache(productId);
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

    await this.clearProductDetailCache(productId);
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
    await this.clearProductDetailCache(productId);

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
    await this.clearProductDetailCache(productId);
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
