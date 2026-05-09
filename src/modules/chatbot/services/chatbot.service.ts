import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../../redis/redis.service.js';
import { OpenAI } from 'openai';
import { AskChatbotDto } from '../dto/ask-chatbot.dto.js';
import { Response } from 'express';

interface RRFEntry {
  item: any;
  rrfScore: number;
  ranks: {
    vector?: number;
    keyword?: number;
  };
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY is not configured in .env. AskChatbot will fail until it is provided.',
      );
    }
    this.openai = new OpenAI({ apiKey: apiKey || 'dummy-key' });
  }

  /**
   * Truy vấn Lai (Hybrid Search) kết hợp Vector Search & Keyword Search (PostgreSQL FTS + ILIKE)
   * Sử dụng giải thuật Reciprocal Rank Fusion (RRF) để kết hợp kết quả.
   */
  async hybridSearch(message: string, skinTypeId?: number | null, limit = 15): Promise<any[]> {
    try {
      // 1. Sinh Vector Embedding cho câu hỏi của người dùng
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message.replace(/\n/g, ' '),
      });
      const queryVector = response.data[0].embedding;
      const vectorSqlStr = `[${queryVector.join(',')}]`;

      // 2. Gọi Vector Search (Top 15 candidates)
      const vectorCandidates = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          pe.id, 
          pe.product_id, 
          pe.chunk_type, 
          pe.chunk_text, 
          pe.metadata,
          (pe.embedding <=> '${vectorSqlStr}'::vector) as distance
        FROM "product_embeddings" pe
        INNER JOIN "products" p ON pe.product_id = p.id
        WHERE p.is_active = true AND pe.embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT 15
      `);

      // 3. Gọi Keyword Search sử dụng PostgreSQL FTS đơn giản và ILIKE (Top 15 candidates)
      const keywordCandidates = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          pe.id, 
          pe.product_id, 
          pe.chunk_type, 
          pe.chunk_text, 
          pe.metadata
        FROM "product_embeddings" pe
        INNER JOIN "products" p ON pe.product_id = p.id
        WHERE p.is_active = true AND (
          to_tsvector('simple', pe.chunk_text) @@ plainto_tsquery('simple', $1)
          OR pe.chunk_text ILIKE $2
        )
        LIMIT 15
      `, message, `%${message}%`);

      // 4. Hợp nhất hai danh sách bằng Reciprocal Rank Fusion (RRF)
      const rrfMap = new Map<number, RRFEntry>();

      // Tính điểm RRF cho Vector Candidates
      vectorCandidates.forEach((item, index) => {
        const rank = index + 1;
        const id = item.id;
        if (!rrfMap.has(id)) {
          rrfMap.set(id, { item, rrfScore: 0, ranks: {} });
        }
        const entry = rrfMap.get(id)!;
        entry.ranks.vector = rank;
        entry.rrfScore += 1 / (60 + rank);
      });

      // Tính điểm RRF cho Keyword Candidates
      keywordCandidates.forEach((item, index) => {
        const rank = index + 1;
        const id = item.id;
        if (!rrfMap.has(id)) {
          rrfMap.set(id, { item, rrfScore: 0, ranks: {} });
        }
        const entry = rrfMap.get(id)!;
        entry.ranks.keyword = rank;
        entry.rrfScore += 1 / (60 + rank);
      });

      // Sắp xếp các ứng viên theo điểm RRF giảm dần
      let sortedCandidates = Array.from(rrfMap.values())
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .map(entry => entry.item);

      // 5. Áp dụng Bộ lọc cứng Cá nhân hóa (Hard-Filtering) theo Skin Type (nếu có)
      if (skinTypeId) {
        const filtered = sortedCandidates.filter(item => {
          const suitableSkinTypes = item.metadata?.suitable_skin_types;
          // Nếu sản phẩm chỉ định rõ loại da phù hợp, loại da người dùng phải nằm trong mảng đó.
          // Nếu suitable_skin_types rỗng hoặc chứa skinTypeId thì coi là phù hợp.
          return (
            !suitableSkinTypes ||
            suitableSkinTypes.length === 0 ||
            suitableSkinTypes.includes(skinTypeId)
          );
        });

        // Nếu bộ lọc cứng không loại bỏ hết tất cả kết quả, ta lấy danh sách đã lọc.
        // Ngược lại, nếu lọc cứng làm rỗng danh sách (do chưa nạp nhiều sản phẩm), ta giữ lại danh sách gốc để chatbot luôn có ngữ cảnh tư vấn.
        if (filtered.length > 0) {
          sortedCandidates = filtered;
        }
      }

      // Giới hạn số lượng chunks đầu ra để nhét vào prompt
      return sortedCandidates.slice(0, limit);
    } catch (error) {
      this.logger.error(`Lỗi thực hiện tìm kiếm Hybrid Search: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Lỗi tìm kiếm sản phẩm: ${error.message}`);
    }
  }

  /**
   * Lấy lịch sử trò chuyện từ Redis Cache (Giới hạn tối đa 10 tin nhắn gần nhất để giữ ngữ cảnh gọn)
   */
  async getChatHistory(sessionId: string): Promise<any[]> {
    const key = `chatbot:session:${sessionId}`;
    const cached = await this.redis.get(key);
    if (!cached) return [];
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }

  /**
   * Lưu lịch sử trò chuyện vào Redis Cache (Thời gian lưu 24 giờ)
   */
  async saveChatHistory(sessionId: string, history: any[]): Promise<void> {
    const key = `chatbot:session:${sessionId}`;
    // Chỉ lưu tối đa 20 tin nhắn gần nhất trong Redis để giữ tối ưu bộ nhớ
    const trimmed = history.slice(-20);
    await this.redis.set(key, JSON.stringify(trimmed), 86400);
  }

  /**
   * Trả về câu trả lời nhanh cho các tin nhắn chào hỏi, cám ơn hoặc tạm biệt phổ biến.
   * Giúp hệ thống không cần truy vấn Database hay gọi OpenAI, phản hồi tức thì và tiết kiệm chi phí.
   */
  getFastResponse(message: string): string | null {
    const normalized = message.toLowerCase().trim();
    
    const greetings = [
      'chào', 'hello', 'hi', 'xin chào', 'chào bạn', 'chào ad', 'chào shop', 
      'chào chuyên gia', 'tư vấn giúp mình', 'tư vấn giúp em', 'ad ơi', 'shop ơi'
    ];
    const thanks = [
      'cảm ơn', 'cám ơn', 'thank', 'thanks', 'thank you', 'tks', 'tk you', 
      'cảm ơn shop', 'cảm ơn ad'
    ];
    const goodbye = [
      'tạm biệt', 'bye', 'goodbye', 'g9', 'chúc ngủ ngon'
    ];

    if (greetings.some(g => normalized === g || normalized.startsWith(g + ' ') || normalized.endsWith(' ' + g))) {
      return 'Xin chào! Mình là **SkinMatch AI Expert** - Chuyên gia tư vấn da liễu và mỹ phẩm của SkinMatch. Rất vui được hỗ trợ bạn! Hôm nay làn da của bạn đang cần mình tư vấn vấn đề gì thế nhỉ?';
    }
    
    if (thanks.some(t => normalized === t || normalized.startsWith(t + ' ') || normalized.endsWith(' ' + t))) {
      return 'Dạ không có gì ạ! Rất vui được hỗ trợ bạn. Nếu bạn có thêm bất kỳ thắc mắc nào về sản phẩm hoặc quy trình dưỡng da, cứ nhắn cho mình nhé. Chúc bạn luôn có một làn da khỏe đẹp!';
    }
    
    if (goodbye.some(gb => normalized === gb || normalized.startsWith(gb + ' ') || normalized.endsWith(' ' + gb))) {
      return 'Tạm biệt bạn nhé! Chúc bạn một ngày tốt lành và luôn tự tin với làn da của mình. Hẹn gặp lại bạn!';
    }

    return null;
  }

  /**
   * Viết lại câu hỏi của người dùng thành câu truy vấn tìm kiếm độc lập (standalone query)
   * dựa trên ngữ cảnh lịch sử trò chuyện để tránh mất dấu đối tượng khi dùng đại từ chỉ định.
   */
  async condenseQuery(message: string, chatHistory: any[]): Promise<string> {
    if (!chatHistory || chatHistory.length === 0) {
      return message;
    }

    try {
      const systemPrompt = `Bạn là một trợ lý AI chuyên nghiệp có nhiệm vụ phân tích lịch sử hội thoại và tin nhắn mới nhất của người dùng, sau đó viết lại tin nhắn mới nhất thành một câu TRUY VẤN TÌM KIẾM ĐỘC LẬP (standalone search query) bằng tiếng Việt để tìm kiếm sản phẩm tối ưu nhất trong cơ sở dữ liệu.

HƯỚNG DẪN VIẾT LẠI:
1. Nếu tin nhắn mới nhất là câu hỏi độc lập, đầy đủ nghĩa, hoặc chỉ là câu chào hỏi, cám ơn đơn giản, hãy giữ nguyên tin nhắn đó (không viết lại).
2. Nếu tin nhắn chứa đại từ chỉ định, từ thay thế hoặc ngầm ám chỉ đến ngữ cảnh trước đó (ví dụ: "loại đó", "mấy sản phẩm này", "nó", "còn loại nào khác", "cho mình thông tin thêm", "giá bao nhiêu", "dùng thế nào", "có tốt không", v.v.), hãy phân tích lịch sử hội thoại để xác định rõ đối tượng được nhắc tới, sau đó viết lại thành câu truy vấn rõ ràng chứa tên sản phẩm hoặc loại sản phẩm cụ thể.
3. Câu viết lại phải ngắn gọn, tự nhiên, tập trung vào các từ khóa chính của sản phẩm (ví dụ: "Thông tin chi tiết nước hoa nam Laura Anne Diamond Homme và Armaf Club De Nuit Intense Man").
4. Tuyệt đối chỉ trả về DUY NHẤT câu truy vấn đã viết lại dưới dạng văn bản thường, không có thêm lời giải thích, không nằm trong dấu ngoặc kép.`;

      // Chỉ lấy 5 tin nhắn gần nhất để làm ngữ cảnh tránh loãng thông tin và tiết kiệm token
      const recentHistory = chatHistory.slice(-5);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: `Hãy viết lại tin nhắn này: "${message}"` }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages as any,
        temperature: 0.1, // Nhiệt độ thấp để đảm bảo viết lại chính xác và nhất quán
      });

      const rewritten = (completion.choices[0].message.content || '').trim();
      this.logger.log(`[RAG Query Reformulation] Gốc: "${message}" -> Viết lại: "${rewritten}"`);
      return rewritten || message;
    } catch (error) {
      this.logger.warn(`Lỗi khi viết lại câu hỏi: ${error.message}`);
      return message;
    }
  }

  /**
   * Xử lý chính: Nhận tin nhắn, Hybrid Search ngữ cảnh, gọi LLM và trả kết quả kèm đề xuất sản phẩm trực quan.
   */
  async ask(dto: AskChatbotDto) {
    const { message, sessionId = 'default-session' } = dto;

    try {
      // 1. Khôi phục lịch sử chat từ Redis trước để sử dụng cho việc viết lại truy vấn (RAG Condensation)
      const chatHistory = await this.getChatHistory(sessionId);

      // 1.5. Kiểm tra câu trả lời nhanh (greetings, thanks, bye) để phản hồi tức thì không cần qua RAG/LLM
      const fastResponse = this.getFastResponse(message);
      if (fastResponse) {
        const updatedHistory = [
          ...chatHistory,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: fastResponse, timestamp: new Date().toISOString() },
        ];
        await this.saveChatHistory(sessionId, updatedHistory);

        return {
          answer: fastResponse,
          recommendedProducts: [],
          sessionId,
        };
      }

      // 2. Viết lại truy vấn của người dùng nếu có tham chiếu đến ngữ cảnh cũ (như "loại đó", "sản phẩm này", v.v.)
      const searchQuery = await this.condenseQuery(message, chatHistory);

      // 3. Tìm kiếm ngữ cảnh sản phẩm trùng khớp thông qua Truy vấn Lai (Hybrid Search) sử dụng searchQuery đã tối ưu
      const matchedChunks = await this.hybridSearch(searchQuery, null, 6);
      console.log('Matched Chunks:', matchedChunks);
      // Định dạng chuỗi văn bản ngữ cảnh làm đầu vào cho LLM
      const contextText = matchedChunks.length > 0
        ? matchedChunks
          .map((chunk, index) => `[SẢN PHẨM ${index + 1} - ID: ${chunk.product_id}]:\n${chunk.chunk_text}\n---`)
          .join('\n\n')
        : 'Không tìm thấy sản phẩm nào phù hợp trực tiếp trong cơ sở dữ liệu.';

      // 4. Xây dựng System Prompt tư vấn chuyên nghiệp
      const systemPrompt = `Bạn là "SkinMatch AI Expert" - Trợ lý và Chuyên gia tư vấn da liễu số một của nền tảng mỹ phẩm SkinMatch.
Nhiệm vụ của bạn là lắng nghe câu hỏi từ khách hàng, giải thích khoa học dựa trên hoạt chất thành phần và đưa ra gợi ý sản phẩm phù hợp từ ngữ cảnh cung cấp.

BẠN PHẢI TRẢ VỀ PHẢN HỒI DƯỚI DẠNG MỘT ĐỐI TƯỢNG JSON CÓ CẤU TRÚC CHÍNH XÁC SAU:
{
  "answer": "Nội dung câu trả lời của bạn gửi cho khách hàng (sử dụng định dạng Markdown nếu cần thiết).",
  "recommendedProductIds": [các_id_số_hoặc_chuỗi_của_sản_phẩm_được_đề_xuất]
}

HÃY TUÂN THỦ NGHIÊM NGẶT CÁC QUY TẮC ĐIỀN THÔNG TIN JSON:
1. LUẬT RECOMMEND SẢN PHẨM (QUAN TRỌNG NHẤT):
   - Bạn PHẢI điền ID của sản phẩm vào mảng "recommendedProductIds" khi:
     + Bạn giới thiệu, nhắc tên, hướng dẫn sử dụng, so sánh hoặc cung cấp bất kỳ thông tin chi tiết nào (như thành phần, cách dùng, công dụng, giá cả) về sản phẩm đó trong câu trả lời "answer".
     + Người dùng hỏi mua, hỏi tìm sản phẩm cụ thể hoặc yêu cầu gợi ý/tư vấn sản phẩm phù hợp với làn da và vấn đề da của họ.
   - Tuyệt đối để mảng "recommendedProductIds" là mảng rỗng [] khi:
     + Người dùng chỉ chào hỏi, cảm ơn hoặc hỏi những thông tin ngoài lề không liên quan.
     + Người dùng hỏi các kiến thức da liễu chung mang tính lý thuyết suông (ví dụ: "da dầu là gì", "nguyên nhân gây mụn", "tại sao da bị lão hóa") mà câu trả lời của bạn không đề xuất hay nhắc đến một sản phẩm cụ thể nào.
   - Chỉ lấy các ID sản phẩm thực sự xuất hiện trong phần "NGỮ CẢNH SẢN PHẨM KHẢ DỤNG" bên dưới. Tuyệt đối không tự bịa đặt ID hay sản phẩm khác.

2. PHÂN TÍCH THÀNH PHẦN KHOA HỌC: Giải thích cặn kẽ tại sao sản phẩm đó phù hợp với vấn đề da của họ bằng cách chỉ rõ các thành phần hoạt chất nổi bật (Active Ingredients) xuất hiện trong ngữ cảnh.
3. GIỌNG ĐIỆU CHUYÊN NGHIỆP: Giọng điệu thân thiện, ấm áp, đáng tin cậy nhưng khoa học. Gọi người dùng là "bạn" và xưng "SkinMatch" hoặc "mình".
4. LƯU Ý AN TOÀN: Hãy luôn khuyên người dùng test thử sản phẩm mới trên một vùng da nhỏ trước khi thoa toàn mặt.
5. QUY TẮC ĐỊNH DẠNG VÀ TRÌNH BÀY (CỰC KỲ QUAN TRỌNG):
   - Tuyệt đối KHÔNG sử dụng danh sách liệt kê có ký hiệu gạch đầu dòng, dấu sao (như "- ", "* ") hoặc danh sách đánh số ("1. ", "2. ") để liệt kê các thành phần hoạt chất, công dụng, hoặc các bước chăm sóc da.
   - Tuyệt đối KHÔNG sử dụng bảng biểu Markdown (tables sử dụng ký tự gạch đứng '|'), không chia cột, không vẽ lưới so sánh hoặc bất kỳ sơ đồ chia cột nào khác. Tuyệt đối KHÔNG sử dụng ký tự '|' trong câu trả lời.
   - Hãy trình bày mọi sự liệt kê hoặc so sánh dưới dạng các ĐOẠN VĂN BẢN (PARAGRAPHS) THƯỜNG THỨC, cách nhau bởi 2 dấu xuống dòng, tràn viền đầy đủ chiều rộng (full width).
   - Với mỗi hoạt chất, sản phẩm hoặc đề mục cần liệt kê, viết tên đề mục/hoạt chất bằng chữ in đậm (ví dụ: "**Bí đao**: Giúp..." hoặc "**Tinh dầu tràm trà**: Có tác dụng...") trên một đoạn văn độc lập. Tránh gom chung tất cả vào một đoạn duy nhất.
   - Định dạng này giúp câu trả lời hiển thị tràn viền cực kỳ thoáng đãng, dễ đọc và sang trọng trên cả giao diện di động hẹp.

---
NGỮ CẢNH SẢN PHẨM KHẢ DỤNG TRÊN SKINMATCH:
${contextText}
`;

      // 5. Định dạng tin nhắn gửi cho OpenAI Chat Completion API
      const messagesForLLM = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: message },
      ];

      // 6. Gọi LLM sinh phản hồi dưới định dạng JSON
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesForLLM as any,
        temperature: 0.35, // Giữ độ chính xác cao, tránh ảo tưởng thông tin sản phẩm
        response_format: { type: 'json_object' },
      });

      let rawContent = (completion.choices[0].message.content || '').trim();

      // Loại bỏ khối markdown json nếu có
      const match = rawContent.match(/^```json\s*([\s\S]*?)\s*```$/i);
      if (match) {
        rawContent = match[1].trim();
      }

      let assistantReply = 'Xin lỗi bạn, SkinMatch không thể xử lý yêu cầu lúc này.';
      let recommendedProductIds: any[] = [];

      try {
        const jsonResponse = JSON.parse(rawContent);
        assistantReply = jsonResponse.answer || 'Xin lỗi bạn, SkinMatch không thể xử lý yêu cầu lúc này.';
        recommendedProductIds = Array.isArray(jsonResponse.recommendedProductIds)
          ? jsonResponse.recommendedProductIds
          : [];
      } catch (parseError) {
        this.logger.warn(`Lỗi parse JSON phản hồi từ OpenAI: ${parseError.message}. Nội dung thô: ${rawContent}`);
        assistantReply = rawContent;
      }
      console.log('Assistant Reply:', assistantReply);
      console.log('Recommended Product IDs:', recommendedProductIds);

      // 7. Cập nhật và lưu lại lịch sử chat vào Redis
      const updatedHistory = [
        ...chatHistory,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() },
      ];
      await this.saveChatHistory(sessionId, updatedHistory);

      // 8. Trích xuất danh sách sản phẩm đề xuất (Visual Recommendation Cards)
      const originalIds = matchedChunks.map((chunk) => chunk.product_id);
      const isNumberId = originalIds.length > 0 && typeof originalIds[0] === 'number';

      const finalProductIds = recommendedProductIds
        .map((id) => {
          if (isNumberId) {
            const parsed = Number(id);
            return isNaN(parsed) ? null : parsed;
          }
          return String(id);
        })
        .filter((id) => id !== null) as any[];

      // Chỉ giữ lại các ID hợp lệ xuất hiện trong matchedChunks để bảo mật và an toàn dữ liệu
      const matchedProductIds = [...new Set(matchedChunks.map((chunk) => chunk.product_id))];
      const validProductIds = finalProductIds.filter((id) => matchedProductIds.includes(id));

      console.log('Final Recommended Product IDs:', validProductIds);
      let recommendedProducts: any[] = [];

      if (validProductIds.length > 0) {
        const productsFromDb = await this.prisma.products.findMany({
          where: { id: { in: validProductIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            image_url: true,
            summary: true,
            product_variants: {
              where: { is_active: true },
              select: { price: true },
            },
          },
        });

        // Sắp xếp các sản phẩm theo thứ tự đề xuất cụ thể của AI
        recommendedProducts = validProductIds
          .map((id) => {
            const product = productsFromDb.find((p) => p.id === id);
            if (!product) return null;
            const minPrice = product.product_variants?.length
              ? Math.min(...product.product_variants.map((v) => v.price))
              : 0;
            return {
              id: product.id,
              name: product.name,
              slug: product.slug,
              image_url: product.image_url,
              summary: product.summary,
              price: minPrice,
            };
          })
          .filter((p) => p !== null);
      }

      // Trả về cấu trúc phản hồi hoàn chỉnh
      return {
        answer: assistantReply,
        recommendedProducts,
        sessionId,
      };
    } catch (error) {
      this.logger.error(`Lỗi xử lý hỏi đáp Chatbot: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Lỗi hệ thống chatbot: ${error.message}`);
    }
  }

  /**
   * Xử lý hỏi đáp dưới dạng stream (Server-Sent Events) truyền trực tiếp qua Express Response.
   */
  async askStream(dto: AskChatbotDto, res: Response) {
    const { message, sessionId = 'default-session' } = dto;

    try {
      // 1. Khôi phục lịch sử chat từ Redis
      const chatHistory = await this.getChatHistory(sessionId);

      // 2. Kiểm tra câu trả lời nhanh (không cần stream)
      const fastResponse = this.getFastResponse(message);
      if (fastResponse) {
        // Cập nhật lịch sử cuộc trò chuyện vào Redis
        const updatedHistory = [
          ...chatHistory,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: fastResponse, timestamp: new Date().toISOString() },
        ];
        await this.saveChatHistory(sessionId, updatedHistory);

        // Trả về toàn bộ câu trả lời ngay lập tức dưới dạng một chunk đơn
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: fastResponse })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'products', products: [] })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // 3. Viết lại truy vấn của người dùng nếu có tham chiếu đến ngữ cảnh cũ
      const searchQuery = await this.condenseQuery(message, chatHistory);

      // 4. Tìm kiếm ngữ cảnh sản phẩm qua Truy vấn Lai (Hybrid Search)
      const matchedChunks = await this.hybridSearch(searchQuery, null, 6);
      const contextText = matchedChunks.length > 0
        ? matchedChunks
          .map((chunk, index) => `[SẢN PHẨM ${index + 1} - ID: ${chunk.product_id}]:\n${chunk.chunk_text}\n---`)
          .join('\n\n')
        : 'Không tìm thấy sản phẩm nào phù hợp trực tiếp trong cơ sở dữ liệu.';

      // 5. Xây dựng System Prompt tư vấn chuyên nghiệp có yêu cầu trả về ID sản phẩm dạng Thẻ Tag ở cuối
      const systemPrompt = `Bạn là "SkinMatch AI Expert" - Trợ lý và Chuyên gia tư vấn da liễu số một của nền tảng mỹ phẩm SkinMatch.
Nhiệm vụ của bạn là lắng nghe câu hỏi từ khách hàng, giải thích khoa học dựa trên hoạt chất thành phần và đưa ra gợi ý sản phẩm phù hợp từ ngữ cảnh cung cấp.

HƯỚNG DẪN TRẢ LỜI (STREAM MODE):
1. Hãy viết câu trả lời một cách tự nhiên, thân thiện và khoa học bằng định dạng Markdown.
2. LUẬT RECOMMEND SẢN PHẨM:
   - Khi bạn giới thiệu, nhắc tên, hướng dẫn sử dụng, so sánh hoặc cung cấp thông tin chi tiết về sản phẩm nào trong câu trả lời, bạn PHẢI liệt kê ID của sản phẩm đó vào thẻ tag ở DÒNG CUỐI CÙNG của câu trả lời.
   - Thẻ tag có định dạng chính xác sau: [RECOMMENDED_IDS: id1, id2, ...] (ví dụ: [RECOMMENDED_IDS: 13, 14]).
   - CẢNH BÁO QUAN TRỌNG: Chỉ điền "ID: ..." thực tế của sản phẩm được ghi trong ngữ cảnh (ví dụ: ID: 15). TUYỆT ĐỐI không điền số thứ tự của danh sách (như 1, 2, 3, 4) hay số thứ tự của sản phẩm trong ngữ cảnh (như SẢN PHẨM 1, SẢN PHẨM 2) vào thẻ tag. Việc điền sai ID sẽ khiến hệ thống không thể hiển thị sản phẩm cho khách hàng.
   - Nếu bạn không giới thiệu hoặc đề xuất sản phẩm nào, hãy để thẻ rỗng: [RECOMMENDED_IDS: ].
   - Chỉ được lấy các ID thực sự xuất hiện trong phần "NGỮ CẢNH SẢN PHẨM KHẢ DỤNG" bên dưới. Tuyệt đối không tự bịa đặt ID khác.

3. PHÂN TÍCH THÀNH PHẦN KHOA HỌC: Giải thích cặn kẽ tại sao sản phẩm đó phù hợp với vấn đề da của họ bằng cách chỉ rõ các thành phần hoạt chất nổi bật (Active Ingredients) xuất hiện trong ngữ cảnh.
4. GIỌNG ĐIỆU CHUYÊN NGHIỆP: Giọng điệu thân thiện, ấm áp, đáng tin cậy nhưng khoa học. Gọi người dùng là "bạn" và xưng "SkinMatch" hoặc "mình".
5. LƯU Ý AN TOÀN: Hãy luôn khuyên người dùng test thử sản phẩm mới trên một vùng da nhỏ trước khi thoa toàn mặt.
6. QUY TẮC ĐỊNH DẠNG VÀ TRÌNH BÀY (CỰC KỲ QUAN TRỌNG):
   - Tuyệt đối KHÔNG sử dụng danh sách liệt kê có ký hiệu gạch đầu dòng, dấu sao (như "- ", "* ") hoặc danh sách đánh số ("1. ", "2. ") để liệt kê các thành phần hoạt chất, công dụng, hoặc các bước chăm sóc da.
   - Tuyệt đối KHÔNG sử dụng bảng biểu Markdown (tables sử dụng ký tự gạch đứng '|'), không chia cột, không vẽ lưới so sánh hoặc bất kỳ sơ đồ chia cột nào khác. Tuyệt đối KHÔNG sử dụng ký tự '|' trong câu trả lời.
   - Hãy trình bày mọi sự liệt kê hoặc so sánh dưới dạng các ĐOẠN VĂN BẢN (PARAGRAPHS) THƯỜNG THỨC, cách nhau bởi 2 dấu xuống dòng, tràn viền đầy đủ chiều rộng (full width).
   - Với mỗi hoạt chất, sản phẩm hoặc đề mục cần liệt kê, viết tên đề mục/hoạt chất bằng chữ in đậm (ví dụ: "**Bí đao**: Giúp..." hoặc "**Tinh dầu tràm trà**: Có tác dụng...") trên một đoạn văn độc lập. Tránh gom chung tất cả vào một đoạn duy nhất.
   - Định dạng này giúp câu trả lời hiển thị tràn viền cực kỳ thoáng đãng, dễ đọc và sang trọng trên cả giao diện di động hẹp.

---
NGỮ CẢNH SẢN PHẨM KHẢ DỤNG TRÊN SKINMATCH:
${contextText}
`;

      // 6. Định dạng tin nhắn gửi cho OpenAI
      const messagesForLLM = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
        { 
          role: 'user', 
          content: message + '\n\n[LƯU Ý HỆ THỐNG: Bạn BẮT BUỘC phải kết thúc câu trả lời bằng thẻ tag [RECOMMENDED_IDS: id1, id2, ...] (ví dụ: [RECOMMENDED_IDS: 12, 15]) để đề xuất sản phẩm bạn vừa giới thiệu ở trên. Điền chính xác ID từ ngữ cảnh khả dụng. Nếu không đề xuất sản phẩm nào, bắt buộc ghi [RECOMMENDED_IDS: ]. Tuyệt đối không được quên thẻ tag này ở dòng cuối cùng của câu trả lời!]'
        },
      ];

      // 7. Gọi OpenAI chat completion với stream: true
      const stream = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesForLLM as any,
        temperature: 0.35,
        stream: true,
      });

      let buffer = '';
      let fullAssistantText = '';

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        buffer += text;

        // Phát hiện và bóc tách thẻ tag [RECOMMENDED_IDS: ...] ra khỏi phần chữ gửi đi (không phân biệt hoa thường)
        const tagMatch = buffer.match(/\[RECOMMENDED_IDS:/i);
        if (tagMatch && tagMatch.index !== undefined) {
          const tagIndex = tagMatch.index;
          const beforeTag = buffer.substring(0, tagIndex);
          if (beforeTag.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: beforeTag })}\n\n`);
            fullAssistantText += beforeTag;
            buffer = buffer.substring(tagIndex);
          }
        } else {
          // Giữ lại buffer an toàn 25 ký tự đề phòng từ khóa bị chia cắt giữa các chunk
          if (buffer.length > 35) {
            const safeToSend = buffer.substring(0, buffer.length - 25);
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: safeToSend })}\n\n`);
            fullAssistantText += safeToSend;
            buffer = buffer.substring(buffer.length - 25);
          }
        }
      }

      // Xử lý buffer còn lại sau khi kết thúc stream
      console.log('DEBUG [askStream] Final buffer before parsing:', JSON.stringify(buffer));
      let recommendedIdsStr = '';
      const finalTagMatch = buffer.match(/\[RECOMMENDED_IDS:\s*([^[\]]*)\s*\]/i);
      if (finalTagMatch) {
        recommendedIdsStr = finalTagMatch[1];
        buffer = buffer.replace(/\[RECOMMENDED_IDS:\s*([^[\]]*)\s*\]/i, '');
      } else {
        buffer = buffer.replace(/\[RECOMMENDED_IDS[\s\S]*/i, '');
      }

      // Gửi nốt phần chữ còn lại
      if (buffer.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: buffer })}\n\n`);
        fullAssistantText += buffer;
      }

      // 8. Phân tích các ID sản phẩm đề xuất thu thập được từ stream
      const rawIds = recommendedIdsStr
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
      console.log('rawIds', rawIds);

      const originalIds = matchedChunks.map(chunk => chunk.product_id);
      const isNumberId = originalIds.length > 0 && typeof originalIds[0] === 'number';

      const finalProductIds = rawIds
        .map(id => {
          if (isNumberId) {
            const parsed = Number(id);
            return isNaN(parsed) ? null : parsed;
          }
          return String(id);
        })
        .filter(id => id !== null) as any[];

      // Chỉ giữ lại các ID hợp lệ xuất hiện trong matchedChunks để đảm bảo an toàn dữ liệu
      const matchedProductIds = [...new Set(matchedChunks.map(chunk => chunk.product_id))];
      console.log('matchedProductIds', matchedProductIds);
      console.log('finalProductIds', finalProductIds);
      const validProductIds = [...new Set(finalProductIds.filter(id => matchedProductIds.includes(id)))];

      let recommendedProducts: any[] = [];
      if (validProductIds.length > 0) {
        const productsFromDb = await this.prisma.products.findMany({
          where: { id: { in: validProductIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            image_url: true,
            summary: true,
            product_variants: {
              where: { is_active: true },
              select: { price: true },
            },
          },
        });

        recommendedProducts = validProductIds
          .map(id => {
            const product = productsFromDb.find(p => p.id === id);
            if (!product) return null;
            const minPrice = product.product_variants?.length
              ? Math.min(...product.product_variants.map(v => v.price))
              : 0;
            return {
              id: product.id,
              name: product.name,
              slug: product.slug,
              image_url: product.image_url,
              summary: product.summary,
              price: minPrice,
            };
          })
          .filter(p => p !== null);
      }

      // 9. Cập nhật lịch sử trò chuyện vào Redis
      const cleanAssistantReply = fullAssistantText.trim();
      const updatedHistory = [
        ...chatHistory,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: cleanAssistantReply, timestamp: new Date().toISOString() },
      ];
      await this.saveChatHistory(sessionId, updatedHistory);

      // Gửi danh sách sản phẩm và tín hiệu kết thúc stream cho Client
      res.write(`data: ${JSON.stringify({ type: 'products', products: recommendedProducts })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error(`Lỗi xử lý stream Chatbot: ${error.message}`, error.stack);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Lỗi hệ thống khi xử lý câu trả lời.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (writeErr) {
        this.logger.error(`Không thể ghi lỗi ra stream: ${writeErr.message}`);
      }
    }
  }
}
