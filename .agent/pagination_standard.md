# Chuẩn Pagination Request / Response

Để đảm bảo tính nhất quán khi phân trang, mọi API endpoint có danh sách (GET list) ĐỀU PHẢI tuân thủ cấu trúc dưới đây.

## Request — Query Parameters

```
GET /products?page=1&limit=10&search=serum&sortBy=created_at&sortOrder=desc
```

| Param       | Type     | Default   | Mô tả                                       |
|-------------|----------|-----------|----------------------------------------------|
| `page`      | `number` | `1`       | Trang hiện tại (bắt đầu từ 1)               |
| `limit`     | `number` | `10`      | Số bản ghi trên mỗi trang (max: 100)        |
| `search`    | `string` | `""`      | Từ khóa tìm kiếm (tìm theo name)            |
| `sortBy`    | `string` | `"created_at"` | Trường sắp xếp                          |
| `sortOrder` | `"asc" \| "desc"` | `"desc"` | Thứ tự sắp xếp                     |

> Mỗi module có thể bổ sung thêm các filter riêng (VD: `category_id`, `is_active`, `is_featured`).

## Response — Cấu trúc chuẩn

```typescript
{
  success: true,
  message: 'Products fetched successfully',
  data: {
    items: [...],          // Mảng dữ liệu của trang hiện tại
    meta: {
      page: 1,             // Trang hiện tại
      limit: 10,           // Số bản ghi trên mỗi trang
      totalItems: 58,      // Tổng số bản ghi
      totalPages: 6,       // Tổng số trang = ceil(totalItems / limit)
      hasNextPage: true,    // Còn trang tiếp theo không
      hasPrevPage: false,   // Có trang trước không
    }
  }
}
```

## DTO — PaginationQueryDto (dùng chung)

File: `src/common/dto/pagination-query.dto.ts`

```typescript
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, description: 'Trang hiện tại' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Số bản ghi mỗi trang' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 'created_at', description: 'Trường sắp xếp' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

## Helper — Tạo meta object (dùng chung)

File: `src/common/helpers/pagination.helper.ts`

```typescript
export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function createPaginationMeta(page: number, limit: number, totalItems: number): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
```

## Ví dụ — Repository

```typescript
async findAllPaginated(params: {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  where?: any;
}) {
  const { page, limit, search, sortBy = 'created_at', sortOrder = 'desc', where = {} } = params;
  const skip = (page - 1) * limit;

  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [items, totalItems] = await Promise.all([
    this.prisma.products.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      include: { ... },
    }),
    this.prisma.products.count({ where }),
  ]);

  return { items, totalItems };
}
```

## Ví dụ — Controller

```typescript
@Get()
@ApiOperation({ summary: 'Get all products with pagination' })
async findAll(@Query() query: PaginationQueryDto) {
  const { items, totalItems } = await this.service.findAll(query);
  const meta = createPaginationMeta(query.page, query.limit, totalItems);

  return {
    success: true,
    message: 'Products fetched successfully',
    data: { items, meta },
  };
}
```

Mọi tác vụ code liên quan tới việc thêm mới API danh sách đều phải tuân thủ nghiêm ngặt cấu trúc pagination này.
