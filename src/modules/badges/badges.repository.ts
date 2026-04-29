import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BadgesRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: any) {
    return this.prisma.badges.create({ data });
  }

  async createMany(data: any[]) {
    return this.prisma.badges.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async findAll() {
    return this.prisma.badges.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    return this.prisma.badges.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.badges.findUnique({
      where: { slug },
    });
  }

  async findManyBySlugs(slugs: string[]) {
    return this.prisma.badges.findMany({
      where: { slug: { in: slugs } },
    });
  }

  async update(id: number, data: any) {
    return this.prisma.badges.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    return this.prisma.badges.delete({
      where: { id },
    });
  }
}
