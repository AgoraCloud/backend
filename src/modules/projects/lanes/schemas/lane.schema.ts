import { Project, ProjectDocument } from './../../schemas/project.schema';
import { User, UserDocument } from './../../../users/schemas/user.schema';
import {
  Workspace,
  WorkspaceDocument,
} from './../../../workspaces/schemas/workspace.schema';
import { SchemaFactory, Prop, Schema } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ProjectLaneDocument = ProjectLane & Document;

@Schema({ collection: 'project_lanes', timestamps: true })
export class ProjectLane {
  @Prop({ required: true, minlength: 1 })
  name: string;

  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: Workspace.name,
    index: true,
  })
  workspace: WorkspaceDocument;

  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    index: true,
  })
  user: UserDocument;

  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: Project.name,
    index: true,
  })
  project: ProjectDocument;

  constructor(partial: Partial<ProjectLane>) {
    Object.assign(this, partial);
  }
}

export const ProjectLaneSchema = SchemaFactory.createForClass(ProjectLane);
