import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateSkinTypeDto } from './dto/create-skin-type.dto.js';
import { UpdateSkinTypeDto } from './dto/update-skin-type.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SkinTypesService {
  constructor(private prisma: PrismaService) { }

  async generateUniqueSlug(name: string, idToIgnore?: number, extraSlugsToIgnore: string[] = []): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      if (!extraSlugsToIgnore.includes(slug)) {
        const existing = await this.prisma.skin_types.findUnique({ where: { slug } });
        if (!existing || (idToIgnore && existing.id === idToIgnore)) {
          break; // Slug is unique
        }
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    return slug;
  }

  async create(createSkinTypeDto: CreateSkinTypeDto) {
    const existing = await this.prisma.skin_types.findUnique({
      where: { name: createSkinTypeDto.name }
    });

    if (existing) {
      throw new ConflictException('Loại da này đã tồn tại');
    }

    const slug = await this.generateUniqueSlug(createSkinTypeDto.name);

    return this.prisma.skin_types.create({
      data: {
        ...createSkinTypeDto,
        slug,
      },
    });
  }

  async createMultiple(dtos: CreateSkinTypeDto[]) {
    const data: any[] = [];
    const usedSlugs: string[] = [];

    for (const dto of dtos) {
      const slug = await this.generateUniqueSlug(dto.name, undefined, usedSlugs);
      usedSlugs.push(slug);
      data.push({
        ...dto,
        slug,
      });
    }

    return this.prisma.skin_types.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async findAll() {
    return this.prisma.skin_types.findMany({
      orderBy: { id: 'asc' }
    });
  }

  async findOne(id: number) {
    const skinType = await this.prisma.skin_types.findUnique({
      where: { id }
    });

    if (!skinType) {
      throw new NotFoundException(`Không tìm thấy loại da với ID ${id}`);
    }

    return skinType;
  }

  async update(id: number, updateSkinTypeDto: UpdateSkinTypeDto) {
    await this.findOne(id); // Check existence

    let slug: string | undefined;

    if (updateSkinTypeDto.name) {
      const existing = await this.prisma.skin_types.findFirst({
        where: {
          name: updateSkinTypeDto.name,
          NOT: { id }
        }
      });
      if (existing) {
        throw new ConflictException('Tên loại da đã tồn tại');
      }
      slug = await this.generateUniqueSlug(updateSkinTypeDto.name, id);
    }

    return this.prisma.skin_types.update({
      where: { id },
      data: {
        ...updateSkinTypeDto,
        ...(slug && { slug }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Check existence
    return this.prisma.skin_types.delete({
      where: { id }
    });
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD') // Chuẩn hóa Unicode để tách dấu
      .replace(/[\u0300-\u036f]/g, '') // Xóa dấu
      .replace(/[đĐ]/g, 'd')
      .replace(/([^0-9a-z-\s])/g, '') // Xóa ký tự đặc biệt
      .replace(/(\s+)/g, '-') // Thay khoảng trắng bằng -
      .replace(/-+/g, '-') // Xóa các dấu - liền nhau
      .replace(/^-+/, '') // Xóa - ở đầu
      .replace(/-+$/, ''); // Xóa - ở cuối
  }
}
