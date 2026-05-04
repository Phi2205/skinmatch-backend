import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IngredientsService } from './ingredients.service.js';
import { CreateIngredientDto } from './dto/create-ingredient.dto.js';
import { CreateMultipleIngredientsDto } from './dto/create-multiple-ingredients.dto.js';
import { UpdateIngredientDto } from './dto/update-ingredient.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/index.js';

@ApiTags('ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new ingredient' })
  async create(@Body() createIngredientDto: CreateIngredientDto) {
    const data = await this.ingredientsService.create(createIngredientDto);
    return {
      success: true,
      message: 'Ingredient created successfully',
      data,
    };
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create multiple ingredients at once' })
  async createMultiple(@Body() dto: CreateMultipleIngredientsDto) {
    const data = await this.ingredientsService.createMultiple(dto.ingredients);
    return {
      success: true,
      message: 'Multiple ingredients created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all ingredients' })
  async findAll() {
    const data = await this.ingredientsService.findAll();
    return {
      success: true,
      message: 'Ingredients fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an ingredient by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.ingredientsService.findOne(+id);
    return {
      success: true,
      message: 'Ingredient fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an ingredient' })
  async update(@Param('id') id: string, @Body() updateIngredientDto: UpdateIngredientDto) {
    const data = await this.ingredientsService.update(+id, updateIngredientDto);
    return {
      success: true,
      message: 'Ingredient updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an ingredient' })
  async remove(@Param('id') id: string) {
    const data = await this.ingredientsService.remove(+id);
    return {
      success: true,
      message: 'Ingredient deleted successfully',
      data,
    };
  }
}
