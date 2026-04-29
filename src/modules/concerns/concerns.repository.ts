import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ConcernsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: any) {
    return this.prisma.concerns.create({ data });
  }

  async createMany(data: any[]) {
    return this.prisma.concerns.createMany({
      data,
      skipDuplicates: true, // Bỏ qua nếu trùng slug
    });
  }

  async findAll() {
    return this.prisma.concerns.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    return this.prisma.concerns.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.concerns.findUnique({
      where: { slug },
    });
  }

  async findManyBySlugs(slugs: string[]) {
    return this.prisma.concerns.findMany({
      where: { slug: { in: slugs } },
    });
  }

  async update(id: number, data: any) {
    return this.prisma.concerns.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return this.prisma.concerns.delete({
      where: { id },
    });
  }
}
