import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
