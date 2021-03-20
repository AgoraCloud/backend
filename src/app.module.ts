import { AuditingInterceptor } from './interceptors/auditing.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProjectTasksModule } from './modules/projects/tasks/tasks.module';
import { ProjectLanesModule } from './modules/projects/lanes/lanes.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';
import { LogLevel } from './config/configuration.interface';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './modules/users/users.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { TokensModule } from './modules/tokens/tokens.module';
import configuration from './config/configuration';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailModule } from './modules/mail/mail.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { KubernetesModule } from './modules/kubernetes/kubernetes.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import * as Joi from '@hapi/joi';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './modules/logger/logger.module';
import { commaDelimitedLogLevel } from './utils/regex.patterns';
import { WikiSectionsModule } from './modules/wiki/sections/sections.module';
import { WikiPagesModule } from './modules/wiki/pages/pages.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AuditingModule } from './modules/auditing/auditing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
        PORT: Joi.number().default(3000),
        LOG_LEVEL: Joi.string()
          .pattern(new RegExp(commaDelimitedLogLevel))
          .default(`${LogLevel.Warn},${LogLevel.Error}`),
        DOMAIN: Joi.string().domain().required(),
        DATABASE_URI: Joi.string().required(),
        ADMIN_EMAIL: Joi.string().email().required(),
        ADMIN_PASSWORD: Joi.string().min(8).required(),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        SMTP_SECURE: Joi.boolean().required(),
        SMTP_USERNAME: Joi.string().required(),
        SMTP_PASSWORD: Joi.string().required(),
        KUBERNETES_NAMESPACE: Joi.string().required(),
        KUBERNETES_STORAGE_CLASS: Joi.string().required(),
        KUBERNETES_SERVICE_ACCOUNT: Joi.string().required(),
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('databaseUri'),
        useCreateIndex: true,
        useFindAndModify: false,
      }),
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('smtp.host'),
          port: configService.get<number>('smtp.port'),
          secure: configService.get<boolean>('smtp.secure'),
          auth: {
            user: configService.get<string>('smtp.username'),
            pass: configService.get<string>('smtp.password'),
          },
        },
        defaults: {
          from: `"AgoraCloud" <${configService.get<string>('smtp.username')}>`,
        },
        template: {
          dir: process.cwd() + '/templates/',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthenticationModule,
    WorkspacesModule,
    TokensModule,
    EventEmitterModule.forRoot(),
    MailModule,
    DeploymentsModule,
    KubernetesModule,
    ProxyModule,
    HealthModule,
    LoggerModule,
    WikiSectionsModule,
    WikiPagesModule,
    ProjectsModule,
    ProjectLanesModule,
    ProjectTasksModule,
    AuthorizationModule,
    AuditingModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('api');
  }
}
