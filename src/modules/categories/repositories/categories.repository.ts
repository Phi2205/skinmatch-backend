import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';

@Injectable()
export class CategoriesRepository {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto & { slug: string }) {
    return this.prisma.categories.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async createMany(data: any[]) {
    return this.prisma.categories.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async findAll(onlyActive = true) {
    return this.prisma.categories.findMany({
      where: onlyActive ? { is_active: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    return this.prisma.categories.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.categories.findUnique({
      where: { slug },
    });
  }

  async update(id: number, data: any) {
    return this.prisma.categories.update({
      where: { id },
      data,
    });
  }
}
