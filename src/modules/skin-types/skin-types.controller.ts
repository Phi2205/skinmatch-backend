import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkinTypesService } from './skin-types.service.js';
import { CreateSkinTypeDto } from './dto/create-skin-type.dto.js';
import { CreateMultipleSkinTypesDto } from './dto/create-multiple-skin-types.dto.js';
import { UpdateSkinTypeDto } from './dto/update-skin-type.dto.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/index.js';

@ApiTags('skin-types')
@Controller('skin-types')
export class SkinTypesController {
  constructor(private readonly skinTypesService: SkinTypesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new skin type' })
  async create(@Body() createSkinTypeDto: CreateSkinTypeDto) {
    const data = await this.skinTypesService.create(createSkinTypeDto);
    return {
      success: true,
      message: 'Skin type created successfully',
      data,
    };
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create multiple skin types at once' })
  async createMultiple(@Body() dto: CreateMultipleSkinTypesDto) {
    const data = await this.skinTypesService.createMultiple(dto.skinTypes);
    return {
      success: true,
      message: 'Multiple skin types created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all skin types' })
  async findAll() {
    const data = await this.skinTypesService.findAll();
    return {
      success: true,
      message: 'Skin types fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a skin type by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.skinTypesService.findOne(+id);
    return {
      success: true,
      message: 'Skin type fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a skin type' })
  async update(@Param('id') id: string, @Body() updateSkinTypeDto: UpdateSkinTypeDto) {
    const data = await this.skinTypesService.update(+id, updateSkinTypeDto);
    return {
      success: true,
      message: 'Skin type updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a skin type' })
  async remove(@Param('id') id: string) {
    const data = await this.skinTypesService.remove(+id);
    return {
      success: true,
      message: 'Skin type deleted successfully',
      data,
    };
  }
}
