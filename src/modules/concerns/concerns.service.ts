import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ConcernsRepository } from './concerns.repository.js';
import { CreateConcernDto } from './dto/create-concern.dto.js';
import { UpdateConcernDto } from './dto/update-concern.dto.js';

@Injectable()
export class ConcernsService {
  constructor(private readonly repository: ConcernsRepository) { }

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

  async create(dto: CreateConcernDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    
    return this.repository.create({
      ...dto,
      slug,
    });
  }

  async createMultiple(dtos: CreateConcernDto[]) {
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
    const concern = await this.repository.findById(id);
    if (!concern) {
      throw new NotFoundException(`Không tìm thấy vấn đề da với ID ${id}`);
    }
    return concern;
  }

  async update(id: number, dto: UpdateConcernDto) {
    await this.findOne(id); // Check existence

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
