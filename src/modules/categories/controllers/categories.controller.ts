import { Controller, Get, Post, Body, Param, UseGuards, Patch, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from '../services/categories.service.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { UpdateCategoryStatusDto } from '../dto/update-category-status.dto.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { Role } from '../../../generated/prisma/index.js';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category' })
  async create(@Body() dto: CreateCategoryDto) {
    const data = await this.categoriesService.create(dto);
    return {
      success: true,
      message: 'Category created successfully',
      data,
    };
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all categories (public sees only active, admin sees all)' })
  async findAll(@Req() req: any) {
    const isAdmin = req.user?.role === Role.ADMIN;
    const data = await this.categoriesService.findAll(!isAdmin);
    return {
      success: true,
      message: 'Categories fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.categoriesService.findOne(Number(id));
    if (!data) {
      return {
        success: false,
        message: 'Category not found',
      };
    }
    return {
      success: true,
      message: 'Category fetched successfully',
      data,
    };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.categoriesService.findOneBySlug(slug);
    if (!data) {
      return {
        success: false,
        message: 'Category not found',
      };
    }
    return {
      success: true,
      message: 'Category fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const data = await this.categoriesService.update(Number(id), dto);
    return {
      success: true,
      message: 'Category updated successfully',
      data,
    };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category active status' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateCategoryStatusDto) {
    const data = await this.categoriesService.updateStatus(Number(id), dto);
    return {
      success: true,
      message: 'Category status updated successfully',
      data,
    };
  }
}
