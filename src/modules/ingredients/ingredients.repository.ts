import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IngredientsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: any) {
    return this.prisma.ingredients.create({ data });
  }

  async createMany(data: any[]) {
    return this.prisma.ingredients.createMany({
      data,
      skipDuplicates: true, // Bỏ qua nếu trùng slug
    });
  }

  async findAll() {
    return this.prisma.ingredients.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    return this.prisma.ingredients.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.ingredients.findUnique({
      where: { slug },
    });
  }

  async findByName(name: string) {
    return this.prisma.ingredients.findUnique({
      where: { name },
    });
  }

  async findManyBySlugs(slugs: string[]) {
    return this.prisma.ingredients.findMany({
      where: { slug: { in: slugs } },
    });
  }

  async update(id: number, data: any) {
    return this.prisma.ingredients.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return this.prisma.ingredients.delete({
      where: { id },
    });
  }
}
