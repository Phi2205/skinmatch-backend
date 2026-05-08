import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { IngredientsRepository } from './ingredients.repository.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';

@Injectable()
export class IngredientsService {
  constructor(private readonly repository: IngredientsRepository) { }

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

  async create(dto: CreateIngredientDto) {
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`Thành phần với tên "${dto.name}" đã tồn tại.`);
    }

    const slug = await this.generateUniqueSlug(dto.name);
    
    return this.repository.create({
      ...dto,
      slug,
    });
  }

  async createMultiple(dtos: CreateIngredientDto[]) {
    const data: any[] = [];
    const usedSlugs: string[] = [];

    for (const dto of dtos) {
      const slug = await this.generateUniqueSlug(dto.name, undefined, usedSlugs);
      usedSlugs.push(slug);
      data.push({ ...dto, slug });
    }

    return this.repository.createMany(data);
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findOne(id: number) {
    const ingredient = await this.repository.findById(id);
    if (!ingredient) {
      throw new NotFoundException(`Không tìm thấy thành phần với ID ${id}`);
    }
    return ingredient;
  }

  async update(id: number, dto: UpdateIngredientDto) {
    await this.findOne(id); // Check existence

    if (dto.name) {
      const existing = await this.repository.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Thành phần với tên "${dto.name}" đã tồn tại.`);
      }
    }

    let slug: string | undefined;
    if (dto.name) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    return this.repository.update(id, {
      ...dto,
      ...(slug && { slug }),
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Check existence
    return this.repository.delete(id);
  }
}
