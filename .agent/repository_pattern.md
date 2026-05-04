# Chuẩn Repository Pattern

Để đảm bảo kiến trúc sạch (Clean Architecture) và tính tái sử dụng, mọi thao tác với Database trong dự án này ĐỀU PHẢI thông qua Repository Layer.

## Cấu trúc yêu cầu:
1. **Controller**: Xử lý HTTP request/response.
2. **Service**: Xử lý logic nghiệp vụ, catch/throw lỗi (VD: `ConflictException`). **Tuyệt đối không query DB trực tiếp bằng `this.prisma`**.
3. **Repository**: Gọi trực tiếp Prisma để thao tác DB (`findUnique`, `create`, `update`, `delete`). Khai báo trong `src/modules/[module-name]/repositories/`.

## Lợi ích:
- Dễ dàng Unit Test các Service bằng cách mock Repository.
- Tách biệt logic database và logic nghiệp vụ.
- Có thể dùng lại chung các method query DB ở nhiều Service khác nhau.

## Ví dụ cấu trúc Repository:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ExampleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    return this.prisma.example.findUnique({ where: { slug } });
  }
}
```

Ở các lần làm việc tiếp theo, AI phải chủ động tạo/sửa đổi file theo mô hình: **Controller -> Service -> Repository -> Database**.
