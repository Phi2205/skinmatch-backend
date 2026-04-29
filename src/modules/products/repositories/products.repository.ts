import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProductsRepository {
  constructor(private prisma: PrismaService) {}

  // ─── Public queries ────────────────────────────────────

  async findActiveBanners() {
    return this.prisma.banners.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findFeaturedProducts(limit = 10) {
    return this.prisma.products.findMany({
      where: { is_featured: true, is_active: true },
      include: {
        product_badges: {
          include: { badges: true },
        },
      },
      take: limit,
    });
  }

  async findAllPaginated(params: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    onlyActive?: boolean;
    category_id?: number;
    is_featured?: boolean;
    is_active?: boolean;
    min_price?: number;
    max_price?: number;
    concern_ids?: number[];
    ingredient_ids?: number[];
    skin_type_ids?: number[];
    badge_ids?: number[];
  }) {
    const {
      page, limit, search,
      sortBy = 'created_at', sortOrder = 'desc',
      onlyActive = true,
      category_id, is_featured, is_active,
      min_price, max_price,
      concern_ids, ingredient_ids, skin_type_ids, badge_ids,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Active filter (public vs admin)
    if (onlyActive) {
      where.is_active = true;
    } else if (is_active !== undefined) {
      where.is_active = is_active;
    }

    // Search by name
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Category filter
    if (category_id) {
      where.category_id = category_id;
    }

    // Featured filter
    if (is_featured !== undefined) {
      where.is_featured = is_featured;
    }

    // Price range
    if (min_price !== undefined || max_price !== undefined) {
      where.price = {};
      if (min_price !== undefined) where.price.gte = min_price;
      if (max_price !== undefined) where.price.lte = max_price;
    }

    // Filter by relation IDs — product must have ALL specified IDs
    if (concern_ids?.length) {
      where.AND = [
        ...(where.AND || []),
        ...concern_ids.map((id) => ({
          product_concerns: { some: { concern_id: id } },
        })),
      ];
    }

    if (ingredient_ids?.length) {
      where.AND = [
        ...(where.AND || []),
        ...ingredient_ids.map((id) => ({
          product_ingredients: { some: { ingredient_id: id } },
        })),
      ];
    }

    if (skin_type_ids?.length) {
      where.AND = [
        ...(where.AND || []),
        ...skin_type_ids.map((id) => ({
          product_skin_types: { some: { skin_type_id: id } },
        })),
      ];
    }

    if (badge_ids?.length) {
      where.AND = [
        ...(where.AND || []),
        ...badge_ids.map((id) => ({
          product_badges: { some: { badge_id: id } },
        })),
      ];
    }

    // Validate sortBy to prevent injection
    const allowedSortFields = ['name', 'price', 'created_at', 'id'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    const [items, totalItems] = await Promise.all([
      this.prisma.products.findMany({
        where,
        include: {
          categories: true,
          product_badges: {
            include: { badges: true },
          },
          product_images: true,
        },
        orderBy: { [safeSortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.products.count({ where }),
    ]);

    return { items, totalItems };
  }

  async findProductById(id: number) {
    return this.prisma.products.findUnique({
      where: { id },
      include: {
        categories: true,
        product_images: true,
        product_badges: {
          include: { badges: true },
        },
        product_ingredients: {
          include: { ingredients: true },
        },
        product_skin_types: {
          include: { skin_types: true },
        },
        product_concerns: {
          include: { concerns: true },
        },
      },
    });
  }

  // ─── Admin CRUD ────────────────────────────────────────

  async create(data: {
    name: string;
    price: number;
    category_id?: number;
    description?: string;
    summary?: string;
    image_url?: string;
    is_featured?: boolean;
    is_active?: boolean;
    badge_ids?: number[];
    concern_ids?: number[];
    ingredient_ids?: number[];
    skin_type_ids?: number[];
  }) {
    const {
      badge_ids, concern_ids, ingredient_ids, skin_type_ids,
      ...productData
    } = data;

    return this.prisma.products.create({
      data: {
        ...productData,
        product_badges: badge_ids?.length
          ? { createMany: { data: badge_ids.map((id) => ({ badge_id: id })) } }
          : undefined,
        product_concerns: concern_ids?.length
          ? { createMany: { data: concern_ids.map((id) => ({ concern_id: id })) } }
          : undefined,
        product_ingredients: ingredient_ids?.length
          ? { createMany: { data: ingredient_ids.map((id) => ({ ingredient_id: id })) } }
          : undefined,
        product_skin_types: skin_type_ids?.length
          ? { createMany: { data: skin_type_ids.map((id) => ({ skin_type_id: id })) } }
          : undefined,
      },
      include: {
        categories: true,
        product_badges: { include: { badges: true } },
        product_concerns: { include: { concerns: true } },
        product_ingredients: { include: { ingredients: true } },
        product_skin_types: { include: { skin_types: true } },
        product_images: true,
      },
    });
  }

  async update(
    id: number,
    data: {
      name?: string;
      price?: number;
      category_id?: number;
      description?: string;
      summary?: string;
      image_url?: string;
      is_featured?: boolean;
      is_active?: boolean;
      badge_ids?: number[];
      concern_ids?: number[];
      ingredient_ids?: number[];
      skin_type_ids?: number[];
    },
  ) {
    const {
      badge_ids, concern_ids, ingredient_ids, skin_type_ids,
      ...productData
    } = data;

    // Use a transaction to atomically update product + relations
    return this.prisma.$transaction(async (tx) => {
      // Update relation tables if provided (delete old, create new)
      if (badge_ids !== undefined) {
        await tx.product_badges.deleteMany({ where: { product_id: id } });
        if (badge_ids.length) {
          await tx.product_badges.createMany({
            data: badge_ids.map((badge_id) => ({ product_id: id, badge_id })),
          });
        }
      }

      if (concern_ids !== undefined) {
        await tx.product_concerns.deleteMany({ where: { product_id: id } });
        if (concern_ids.length) {
          await tx.product_concerns.createMany({
            data: concern_ids.map((concern_id) => ({ product_id: id, concern_id })),
          });
        }
      }

      if (ingredient_ids !== undefined) {
        await tx.product_ingredients.deleteMany({ where: { product_id: id } });
        if (ingredient_ids.length) {
          await tx.product_ingredients.createMany({
            data: ingredient_ids.map((ingredient_id) => ({ product_id: id, ingredient_id })),
          });
        }
      }

      if (skin_type_ids !== undefined) {
        await tx.product_skin_types.deleteMany({ where: { product_id: id } });
        if (skin_type_ids.length) {
          await tx.product_skin_types.createMany({
            data: skin_type_ids.map((skin_type_id) => ({ product_id: id, skin_type_id })),
          });
        }
      }

      // Update product scalar fields
      return tx.products.update({
        where: { id },
        data: productData,
        include: {
          categories: true,
          product_badges: { include: { badges: true } },
          product_concerns: { include: { concerns: true } },
          product_ingredients: { include: { ingredients: true } },
          product_skin_types: { include: { skin_types: true } },
          product_images: true,
        },
      });
    });
  }

  async delete(id: number) {
    return this.prisma.products.delete({
      where: { id },
    });
  }

  async updateStatus(id: number, is_active: boolean) {
    return this.prisma.products.update({
      where: { id },
      data: { is_active },
    });
  }

  // ─── Product Images ────────────────────────────────────

  async addProductImage(productId: number, imageUrl: string, altText?: string, isMain = false) {
    return this.prisma.product_images.create({
      data: {
        product_id: productId,
        image_url: imageUrl,
        alt_text: altText,
        is_main: isMain,
      },
    });
  }

  async deleteProductImage(imageId: number) {
    return this.prisma.product_images.delete({
      where: { id: imageId },
    });
  }

  async findProductImageById(imageId: number) {
    return this.prisma.product_images.findUnique({
      where: { id: imageId },
    });
  }
}
