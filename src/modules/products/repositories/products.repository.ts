import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProductsRepository {
  constructor(private prisma: PrismaService) { }

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
        product_categories: {
          include: { categories: true },
        },
        product_variants: {
          where: { is_active: true },
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
    category_ids?: number[];
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
      category_ids, is_featured, is_active,
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
    if (category_ids?.length) {
      where.AND = [
        ...(where.AND || []),
        ...category_ids.map((id) => ({
          product_categories: { some: { category_id: id } },
        })),
      ];
    }

    // Featured filter
    if (is_featured !== undefined) {
      where.is_featured = is_featured;
    }

    // Price range - filter products that have at least one variant within price range
    if (min_price !== undefined || max_price !== undefined) {
      where.product_variants = {
        some: {
          price: {
            gte: min_price,
            lte: max_price,
          }
        }
      };
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
    const allowedSortFields = ['name', 'created_at', 'id'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    const [items, totalItems] = await Promise.all([
      this.prisma.products.findMany({
        where,
        include: {
          product_categories: {
            include: { categories: true },
          },
          product_images: true,
          product_variants: {
            where: { is_active: true },
            include: { attributes: true }
          },
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
        product_categories: {
          include: { categories: true },
        },
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
        product_variants: {
          include: { attributes: true }
        },
      },
    });
  }

  async findSimilarProductsByVector(productId: number, limit = 4): Promise<any[]> {
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        p.id, 
        p.name, 
        p.slug, 
        p.image_url, 
        p.summary,
        MIN(pe2.embedding <=> pe1.embedding) as distance
      FROM "product_embeddings" pe1
      INNER JOIN "product_embeddings" pe2 ON pe2.product_id <> pe1.product_id
      INNER JOIN "products" p ON pe2.product_id = p.id
      WHERE pe1.product_id = $1 AND p.is_active = true AND pe1.embedding IS NOT NULL AND pe2.embedding IS NOT NULL
      GROUP BY p.id, p.name, p.slug, p.image_url, p.summary
      ORDER BY distance ASC
      LIMIT $2
    `, productId, limit);
  }

  async findProductsByCategoryFallback(productId: number, categoryIds: number[], limit = 4) {
    return this.prisma.products.findMany({
      where: {
        id: { not: productId },
        is_active: true,
        product_categories: {
          some: {
            category_id: { in: categoryIds },
          },
        },
      },
      select: { id: true },
      take: limit,
    });
  }

  async findProductsGeneralFallback(productId: number, limit = 4) {
    return this.prisma.products.findMany({
      where: {
        id: { not: productId },
        is_active: true,
      },
      select: { id: true },
      take: limit,
    });
  }

  async findProductsForRecommendation(ids: number[]) {
    return this.prisma.products.findMany({
      where: { id: { in: ids } },
      include: {
        product_categories: {
          include: { categories: true },
        },
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
        product_variants: {
          where: { is_active: true },
          include: { attributes: true }
        },
      },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.products.findUnique({
      where: { slug },
      include: {
        product_categories: {
          include: { categories: true },
        },
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
        product_variants: {
          where: { is_active: true },
          include: { attributes: true }
        },
      },
    });
  }

  async findProductsByRelationSlug(params: {
    type: 'category' | 'badge' | 'ingredient' | 'concern' | 'skin_type';
    slug: string;
    page?: number;
    limit?: number;
    onlyActive?: boolean;
  }) {
    const { type, slug, page = 1, limit = 10, onlyActive = true } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      is_active: onlyActive ? true : undefined,
    };

    if (type === 'category') {
      where.product_categories = { some: { categories: { slug } } };
    } else if (type === 'badge') {
      where.product_badges = { some: { badges: { slug } } };
    } else if (type === 'ingredient') {
      where.product_ingredients = { some: { ingredients: { slug } } };
    } else if (type === 'concern') {
      where.product_concerns = { some: { concerns: { slug } } };
    } else if (type === 'skin_type') {
      where.product_skin_types = { some: { skin_types: { slug } } };
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.products.findMany({
        where,
        select: {
          id: true,
          name: true,
          summary: true,
          image_url: true,
          slug: true,
          product_variants: {
            where: { is_active: true },
            include: { attributes: true }
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.products.count({ where }),
    ]);

    const formattedItems = items.map((product) => {
      const minPrice = product.product_variants?.length
        ? Math.min(...product.product_variants.map((v) => v.price))
        : 0;
      return {
        ...product,
        price: minPrice,
        variants: product.product_variants,
        product_variants: undefined,
      };
    });

    return { items: formattedItems, totalItems };
  }

  // ─── Admin CRUD ────────────────────────────────────────

  async create(data: {
    name: string;
    category_ids?: number[];
    description?: string;
    summary?: string;
    image_url?: string;
    is_featured?: boolean;
    is_active?: boolean;
    badge_ids?: number[];
    concern_ids?: number[];
    ingredient_ids?: number[];
    skin_type_ids?: number[];
    ingredient_full_text?: string;
    usage_instructions?: string;
    slug: string;
    variants?: {
      price: number;
      sku?: string;
      stock?: number;
      attributes?: { name: string; value: string }[]
    }[];
  }) {
    const {
      badge_ids, concern_ids, ingredient_ids, skin_type_ids, category_ids, variants,
      ...productData
    } = data;

    return this.prisma.products.create({
      data: {
        ...productData,
        product_categories: category_ids?.length
          ? { createMany: { data: category_ids.map((id) => ({ category_id: id })) } }
          : undefined,
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
        product_variants: variants?.length
          ? {
            create: variants.map((v) => ({
              price: v.price,
              sku: v.sku,
              stock: v.stock,
              attributes: v.attributes?.length
                ? { create: v.attributes }
                : undefined,
            })),
          }
          : undefined,
      },
      include: {
        product_categories: { include: { categories: true } },
        product_badges: { include: { badges: true } },
        product_concerns: { include: { concerns: true } },
        product_ingredients: { include: { ingredients: true } },
        product_skin_types: { include: { skin_types: true } },
        product_images: true,
        product_variants: {
          include: { attributes: true }
        },
      },
    });
  }

  async update(
    id: number,
    data: {
      name?: string;
      category_ids?: number[];
      description?: string;
      summary?: string;
      image_url?: string;
      is_featured?: boolean;
      is_active?: boolean;
      badge_ids?: number[];
      concern_ids?: number[];
      ingredient_ids?: number[];
      skin_type_ids?: number[];
      ingredient_full_text?: string;
      usage_instructions?: string;
      slug?: string;
      variants?: {
        id?: number;
        price?: number;
        sku?: string;
        stock?: number;
        attributes?: { name: string; value: string }[]
      }[];
    }) {
    const {
      badge_ids, concern_ids, ingredient_ids, skin_type_ids, category_ids, variants,
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

      if (category_ids !== undefined) {
        await tx.product_categories.deleteMany({ where: { product_id: id } });
        if (category_ids.length) {
          await tx.product_categories.createMany({
            data: category_ids.map((category_id) => ({ product_id: id, category_id })),
          });
        }
      }

      if (variants !== undefined) {
        // 1. Get all currently active variants of this product in the DB
        const existingVariants = await tx.product_variants.findMany({
          where: { product_id: id, is_active: true },
          select: { id: true },
        });
        const existingIds = existingVariants.map((v) => v.id);

        // 2. Identify incoming items with IDs vs without IDs
        const incomingWithId = variants.filter((v) => v.id !== undefined && v.id !== null);
        const incomingWithoutId = variants.filter((v) => v.id === undefined || v.id === null);

        const incomingIds = incomingWithId.map((v) => v.id as number);

        // 3. Any existing active ID that is NOT in the incoming update list should be soft-deleted (is_active: false)
        const idsToSoftDelete = existingIds.filter((exId) => !incomingIds.includes(exId));
        if (idsToSoftDelete.length > 0) {
          await tx.product_variants.updateMany({
            where: { id: { in: idsToSoftDelete } },
            data: { is_active: false },
          });
        }

        // 4. Update the items that have an ID
        for (const v of incomingWithId) {
          const { id: vId, attributes, ...vData } = v;
          await tx.product_variants.update({
            where: { id: vId },
            data: {
              ...vData,
              is_active: true, // Ensure it is active if updated
            },
          });

          // Update attributes for this variant
          if (attributes !== undefined) {
            await tx.variant_attributes.deleteMany({
              where: { variant_id: vId! },
            });
            if (attributes.length > 0) {
              await tx.variant_attributes.createMany({
                data: attributes.map((attr) => ({
                  variant_id: vId!,
                  name: attr.name,
                  value: attr.value,
                })),
              });
            }
          }
        }

        // 5. Create new items that don't have an ID
        for (const v of incomingWithoutId) {
          const { attributes, price, ...vData } = v;
          if (price === undefined) {
            throw new BadRequestException('Mọi variant mới được thêm phải có giá (price)');
          }
          await tx.product_variants.create({
            data: {
              product_id: id,
              price,
              ...vData,
              is_active: true,
              attributes: attributes?.length
                ? {
                  create: attributes.map((attr) => ({
                    name: attr.name,
                    value: attr.value,
                  })),
                }
                : undefined,
            },
          });
        }
      }

      // Update product scalar fields
      return tx.products.update({
        where: { id },
        data: productData,
        include: {
          product_categories: { include: { categories: true } },
          product_badges: { include: { badges: true } },
          product_concerns: { include: { concerns: true } },
          product_ingredients: { include: { ingredients: true } },
          product_skin_types: { include: { skin_types: true } },
          product_images: true,
          product_variants: {
            include: { attributes: true }
          },
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

  async addProductImage(productId: number, imageUrl: string, altText?: string, isMain = false, position = 0) {
    return this.prisma.product_images.create({
      data: {
        product_id: productId,
        image_url: imageUrl,
        alt_text: altText,
        is_main: isMain,
        position: position,
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

  async updateProductImage(imageId: number, data: any) {
    return this.prisma.product_images.update({
      where: { id: imageId },
      data,
    });
  }

  async findAllProductImages(productId: number) {
    return this.prisma.product_images.findMany({
      where: { product_id: productId },
      orderBy: { position: 'asc' },
    });
  }
}
