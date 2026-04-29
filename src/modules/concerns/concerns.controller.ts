import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConcernsService } from './concerns.service.js';
import { CreateConcernDto } from './dto/create-concern.dto.js';
import { CreateMultipleConcernsDto } from './dto/create-multiple-concerns.dto.js';
import { UpdateConcernDto } from './dto/update-concern.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/index.js';

@ApiTags('concerns')
@Controller('concerns')
export class ConcernsController {
  constructor(private readonly concernsService: ConcernsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new concern' })
  async create(@Body() createConcernDto: CreateConcernDto) {
    const data = await this.concernsService.create(createConcernDto);
    return {
      success: true,
      message: 'Concern created successfully',
      data,
    };
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create multiple concerns at once' })
  async createMultiple(@Body() dto: CreateMultipleConcernsDto) {
    const data = await this.concernsService.createMultiple(dto.concerns);
    return {
      success: true,
      message: 'Multiple concerns created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all concerns' })
  async findAll() {
    const data = await this.concernsService.findAll();
    return {
      success: true,
      message: 'Concerns fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a concern by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.concernsService.findOne(+id);
    return {
      success: true,
      message: 'Concern fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a concern' })
  async update(@Param('id') id: string, @Body() updateConcernDto: UpdateConcernDto) {
    const data = await this.concernsService.update(+id, updateConcernDto);
    return {
      success: true,
      message: 'Concern updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a concern' })
  async remove(@Param('id') id: string) {
    const data = await this.concernsService.remove(+id);
    return {
      success: true,
      message: 'Concern deleted successfully',
      data,
    };
  }
}
