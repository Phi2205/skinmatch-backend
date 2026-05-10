import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerMiddleware } from './common/middleware/logger.middleware.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { RedisModule } from './redis/redis.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { SkinTypesModule } from './modules/skin-types/skin-types.module.js';
import { ConcernsModule } from './modules/concerns/concerns.module.js';
import { IngredientsModule } from './modules/ingredients/ingredients.module.js';
import { BadgesModule } from './modules/badges/badges.module.js';
import { UploadModule } from './modules/upload/upload.module.js';
import { CacheModule } from './modules/cache/cache.module.js';
import { CartsModule } from './modules/carts/carts.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { ChatbotModule } from './modules/chatbot/chatbot.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // dev only
      }),
    }),

    PrismaModule,

    AuthModule,

    MailModule,

    RedisModule,

    ProductsModule,

    CategoriesModule,
    SkinTypesModule,
    ConcernsModule,
    IngredientsModule,
    BadgesModule,
    UploadModule,
    CacheModule,
    CartsModule,
    PaymentsModule,
    OrdersModule,
    ChatbotModule,
    UserModule,
  ],

  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}