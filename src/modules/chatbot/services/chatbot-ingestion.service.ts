import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OpenAI } from 'openai';
import he from 'he';

interface ProductChunk {
  chunk_type: string;
  chunk_index: number;
  chunk_text: string;
}

@Injectable()
export class ChatbotIngestionService {
  private readonly logger = new Logger(ChatbotIngestionService.name);
  private openai: OpenAI;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY is not configured in .env. Embedding generation will fail until it is provided.',
      );
    }
    // Khởi tạo SDK OpenAI
    this.openai = new OpenAI({ apiKey: apiKey || 'dummy-key' });
  }

  /**
   * Làm sạch văn bản: Giải mã các ký tự HTML entities, loại bỏ thẻ HTML, chuẩn hóa khoảng trắng thừa và trim đầu cuối.
   */
  private cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return he
      .decode(text)
      .replace(/<[^>]*>/g, '') // bỏ HTML
      .replace(/\s+/g, ' ')     // gộp khoảng trắng
      .trim();
  }

  /**
   * Tách nhỏ thông tin sản phẩm thành nhiều khối dữ liệu (chunks) có ngữ cảnh độc lập.
   * Sử dụng cột ingredient_full_text trực tiếp, không sử dụng bảng ingredients liên kết Many-to-Many.
   */
  generateProductChunks(product: any): ProductChunk[] {
    const chunks: ProductChunk[] = [];
    let chunkIndex = 0;

    const categoriesStr =
      product.product_categories
        ?.map((pc: any) => pc.categories?.name)
        .filter(Boolean)
        .join(', ') || 'Chưa phân loại';

    const skinTypesStr =
      product.product_skin_types
        ?.map((ps: any) => ps.skin_types?.name)
        .filter(Boolean)
        .join(', ') || 'Mọi loại da';

    const concernsStr =
      product.product_concerns
        ?.map((pc: any) => pc.concerns?.name)
        .filter(Boolean)
        .join(', ') || 'Chưa xác định';

    const activeVariants = product.product_variants?.filter((v: any) => v.is_active) || [];
    const pricesList = activeVariants.map((v: any) => {
      const attrs = v.attributes?.map((a: any) => `${a.name}: ${a.value}`).join(', ');
      const attrStr = attrs ? ` (${attrs})` : '';
      return `${v.price.toLocaleString('vi-VN')} VND${attrStr}`;
    });
    const pricesStr = pricesList.length > 0 ? pricesList.join('; ') : 'Chưa cập nhật giá';

    // 1. CHUNK TỔNG QUAN (Thông tin chung, Giá cả & Gợi ý phân loại)
    const generalText = `ID Sản Phẩm: ${product.id}
Tên Sản Phẩm: ${product.name}
Giá bán (price): ${pricesStr}
Danh mục: ${categoriesStr}
Tóm tắt (summary): ${product.summary || 'Không có tóm tắt'}
Loại da phù hợp: ${skinTypesStr}
Giải quyết vấn đề da: ${concernsStr}`;

    chunks.push({
      chunk_type: 'general',
      chunk_index: chunkIndex++,
      chunk_text: generalText,
    });

    // 2. CHUNK MÔ TẢ CHI TIẾT (Nếu có nội dung chi tiết)
    const cleanedDescription = this.cleanText(product.description);
    if (cleanedDescription && cleanedDescription.toLowerCase() !== 'không có mô tả chi tiết') {
      const descriptionText = `ID Sản Phẩm: ${product.id}
Tên Sản Phẩm: ${product.name}
Giá bán (price): ${pricesStr}
Mô tả chi tiết (description): ${cleanedDescription}`;

      chunks.push({
        chunk_type: 'description',
        chunk_index: chunkIndex++,
        chunk_text: descriptionText,
      });
    }

    // 3. CHUNK HƯỚNG DẪN & THÀNH PHẦN ĐẦY ĐỦ (Nếu có ít nhất 1 trong 2 nội dung)
    const cleanedUsage = this.cleanText(product.usage_instructions);
    const cleanedIngredients = this.cleanText(product.ingredient_full_text);

    if (cleanedUsage || cleanedIngredients) {
      const usagePart = cleanedUsage ? `Cách dùng (usage_instructions): ${cleanedUsage}` : 'Cách dùng: Chưa cập nhật';
      const ingredientsPart = cleanedIngredients
        ? `Thành phần đầy đủ (ingredient_full_text): ${cleanedIngredients}`
        : 'Thành phần đầy đủ: Chưa cập nhật';

      const usageIngredientsText = `ID Sản Phẩm: ${product.id}
Tên Sản Phẩm: ${product.name}
Giá bán (price): ${pricesStr}
${usagePart}
${ingredientsPart}`;

      chunks.push({
        chunk_type: 'usage_ingredients',
        chunk_index: chunkIndex++,
        chunk_text: usageIngredientsText,
      });
    }

    return chunks;
  }

  /**
   * Tạo cấu trúc metadata để lưu cùng vector phục vụ Filter cứng (Hard Filtering)
   */
  generateProductMetadata(product: any) {
    const categoryIds = product.product_categories?.map((pc: any) => pc.category_id) || [];
    const skinTypeIds = product.product_skin_types?.map((ps: any) => ps.skin_type_id) || [];
    const concernIds = product.product_concerns?.map((pc: any) => pc.concern_id) || [];

    return {
      product_id: product.id,
      slug: product.slug,
      is_active: product.is_active,
      category_ids: categoryIds,
      suitable_skin_types: skinTypeIds,
      suitable_concerns: concernIds,
    };
  }

  /**
   * Gọi OpenAI API để tạo Vector Embedding từ chuỗi văn bản (1536 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new InternalServerErrorException(
        'Không thể sinh vector nhúng vì chưa cấu hình OPENAI_API_KEY trong file .env.',
      );
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '), // Loại bỏ xuống dòng để tăng chất lượng nhúng
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('Không nhận được dữ liệu vector từ OpenAI API.');
      }

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Lỗi khi gọi OpenAI Embeddings API: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Lỗi sinh vector nhúng: ${error.message}`);
    }
  }

  /**
   * Đồng bộ hóa Vector Embeddings cho một sản phẩm cụ thể (Tách thành nhiều chunks độc lập)
   */
  async ingestSingleProduct(productId: number): Promise<void> {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: {
        product_categories: { include: { categories: true } },
        product_skin_types: { include: { skin_types: true } },
        product_concerns: { include: { concerns: true } },
        product_variants: { include: { attributes: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với ID ${productId}`);
    }

    // Luôn dọn dẹp (xóa) toàn bộ các chunks cũ của sản phẩm này trước khi nạp mới để tránh rác dữ liệu
    await this.prisma.product_embeddings.deleteMany({
      where: { product_id: productId },
    });

    if (!product.is_active) {
      this.logger.log(`Đã dọn dẹp vector của sản phẩm ID ${productId} do ngưng kích hoạt.`);
      return;
    }

    this.logger.log(`Bắt đầu xử lý chia nhỏ & Vector hóa sản phẩm ID ${productId}: ${product.name}`);

    // Bước 1: Chia nhỏ sản phẩm thành các chunks có nghĩa và sinh metadata
    const chunks = this.generateProductChunks(product);
    const metadata = this.generateProductMetadata(product);

    for (const chunk of chunks) {
      this.logger.log(`- Đang xử lý chunk [${chunk.chunk_type}] (vị trí: ${chunk.chunk_index})`);

      // Bước 2: Sinh Vector Embedding cho từng chunk qua OpenAI
      const embeddingVector = await this.generateEmbedding(chunk.chunk_text);

      // Bước 3: Tạo mới dòng product_embedding
      const createdEmbedding = await this.prisma.product_embeddings.create({
        data: {
          product_id: product.id,
          chunk_type: chunk.chunk_type,
          chunk_index: chunk.chunk_index,
          chunk_text: chunk.chunk_text,
          metadata: metadata as any,
        },
      });

      // Bước 4: Chèn Vector Embedding thực tế vào Postgres sử dụng Raw SQL và ép kiểu ::vector
      const vectorSqlStr = `[${embeddingVector.join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "product_embeddings" SET "embedding" = '${vectorSqlStr}'::vector WHERE "id" = ${createdEmbedding.id}`,
      );
    }

    this.logger.log(
      `Hoàn thành Vector hóa sản phẩm ID ${productId} thành công. Tổng số: ${chunks.length} chunks.`,
    );
  }

  /**
   * Đồng bộ hóa hàng loạt toàn bộ sản phẩm đang hoạt động vào cơ sở dữ liệu Vector (Sync All)
   */
  async ingestAllProducts(): Promise<{ total: number; success: number; failed: number }> {
    this.logger.log('Bắt đầu quy trình đồng bộ hóa vector hàng loạt cho toàn bộ sản phẩm hoạt động...');

    const products = await this.prisma.products.findMany({
      where: { is_active: true },
    });

    let successCount = 0;
    let failedCount = 0;

    for (const product of products) {
      try {
        await this.ingestSingleProduct(product.id);
        successCount++;
        // Delay nhẹ để tránh bị rate limit API OpenAI nếu danh sách sản phẩm quá dài
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        this.logger.error(`Đồng bộ sản phẩm ID ${product.id} thất bại: ${error.message}`);
        failedCount++;
      }
    }

    this.logger.log(
      `Đồng bộ hoàn tất. Tổng cộng: ${products.length} sản phẩm, Thành công: ${successCount}, Thất bại: ${failedCount}.`,
    );

    return {
      total: products.length,
      success: successCount,
      failed: failedCount,
    };
  }

  /**
   * Xóa toàn bộ dữ liệu vector embeddings trong database
   */
  async clearAllEmbeddings(): Promise<{ deletedCount: number }> {
    this.logger.log('Bắt đầu dọn dẹp toàn bộ dữ liệu product_embeddings...');
    const result = await this.prisma.product_embeddings.deleteMany({});
    this.logger.log(`Đã xóa thành công ${result.count} dòng trong product_embeddings.`);
    return { deletedCount: result.count };
  }
}
