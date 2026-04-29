import { Injectable, ConflictException } from '@nestjs/common';
import { CategoriesRepository } from '../repositories/categories.repository.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { UpdateCategoryStatusDto } from '../dto/update-category-status.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private repository: CategoriesRepository) {}

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
    return this.repository.create({ ...dto, slug });
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

    return this.repository.createMany(data);
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const data: any = { ...dto };
    if (dto.name) {
      data.slug = await this.generateUniqueSlug(dto.name, id);
    }
    return this.repository.update(id, data);
  }

  async updateStatus(id: number, dto: UpdateCategoryStatusDto) {
    return this.repository.update(id, { is_active: dto.is_active });
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
    return this.repository.findAll(onlyActive);
  }

  async findOne(id: number) {
    return this.repository.findById(id);
  }

  async findOneBySlug(slug: string) {
    return this.repository.findBySlug(slug);
  }
}
