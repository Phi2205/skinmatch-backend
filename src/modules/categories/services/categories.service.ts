import { Injectable, ConflictException } from '@nestjs/common';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { UpdateCategoryStatusDto } from '../dto/update-category-status.dto.js';
import { RedisService } from '../../../redis/redis.service.js';

@Injectable()
export class CategoriesService {
  private readonly CACHE_KEY_ALL = 'categories:all';
  private readonly CACHE_KEY_ACTIVE = 'categories:active';

  constructor(
    private repository: CategoriesRepository,
    private redisService: RedisService,
  ) {}

  async generateUniqueSlug(name: string, idToIgnore?: number, extraSlugsToIgnore: string[] = []): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      if (!extraSlugsToIgnore.includes(slug)) {
        const existing = await this.repository.findBySlug(slug);
        if (!existing || (idToIgnore && existing.id === idToIgnore)) {
          break; // Slug is unique
        }
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    return slug;
  }

  async create(dto: CreateCategoryDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const data = await this.repository.create({ ...dto, slug });
    await this.clearCache();
    return data;
  }

  async createMultiple(dtos: CreateCategoryDto[]) {
    const data: any[] = [];
    const usedSlugs: string[] = [];

    for (const dto of dtos) {
      const slug = await this.generateUniqueSlug(dto.name, undefined, usedSlugs);
      usedSlugs.push(slug);
      data.push({
        name: dto.name,
        slug,
        is_active: dto.is_active ?? true,
      });
    }

    const dataResult = await this.repository.createMany(data);
    await this.clearCache();
    return dataResult;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const data: any = { ...dto };
    if (dto.name) {
      data.slug = await this.generateUniqueSlug(dto.name, id);
    }
    const updated = await this.repository.update(id, data);
    await this.clearCache();
    return updated;
  }

  async updateStatus(id: number, dto: UpdateCategoryStatusDto) {
    const updated = await this.repository.update(id, { is_active: dto.is_active });
    await this.clearCache();
    return updated;
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

  async findAll(onlyActive = true) {
    const cacheKey = onlyActive ? this.CACHE_KEY_ACTIVE : this.CACHE_KEY_ALL;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const data = await this.repository.findAll(onlyActive);
    // Cache for 1 hour
    await this.redisService.set(cacheKey, JSON.stringify(data), 3600);

    return data;
  }

  private async clearCache() {
    await Promise.all([
      this.redisService.del(this.CACHE_KEY_ALL),
      this.redisService.del(this.CACHE_KEY_ACTIVE),
    ]);
  }

  async findOne(id: number) {
    return this.repository.findById(id);
  }

  async findOneBySlug(slug: string) {
    return this.repository.findBySlug(slug);
  }
}
