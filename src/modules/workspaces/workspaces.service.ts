import { WorkspaceUserRemovedEvent } from './../../events/workspace-user-removed.event';
import { UserDeletedEvent } from './../../events/user-deleted.event';
import { WorkspaceDeletedEvent } from '../../events/workspace-deleted.event';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { WorkspaceNotFoundException } from './../../exceptions/workspace-not-found.exception';
import { InjectModel } from '@nestjs/mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Model } from 'mongoose';
import { Event } from '../../events/events.enum';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a workspace
   * @param user the user
   * @param createWorkspaceDto the workspace to create
   */
  create(
    user: UserDocument,
    createWorkspaceDto: CreateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    const createdWorkspace: WorkspaceDocument = new this.workspaceModel(
      createWorkspaceDto,
    );
    createdWorkspace.users = [user._id];
    return createdWorkspace.save();
  }

  /**
   * Find all workspaces
   * @param userId the users id
   */
  async findAll(userId: string): Promise<WorkspaceDocument[]> {
    return this.workspaceModel.find().where('users').in([userId]);
  }

  /**
   * Find a workspace
   * @param userId the users id
   * @param workspaceId the workspace id
   */
  async findOne(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceDocument> {
    const workspace: WorkspaceDocument = await this.workspaceModel
      .findOne()
      .where('_id')
      .equals(workspaceId)
      .where('users')
      .in([userId]);
    if (!workspace) throw new WorkspaceNotFoundException(workspaceId);
    return workspace;
  }

  /**
   * Update a workspace
   * @param userId the users id
   * @param workspaceId the workspace id
   * @param updateWorkspaceDto the updated workspace
   */
  async update(
    userId: string,
    workspaceId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDocument> {
    const workspace: WorkspaceDocument = await this.workspaceModel
      .findOneAndUpdate(null, updateWorkspaceDto, { new: true })
      .where('_id')
      .equals(workspaceId)
      .where('users')
      .in([userId]);
    if (!workspace) throw new WorkspaceNotFoundException(workspaceId);
    return workspace;
  }

  /**
   * Delete a workspace
   * @param userId the users id
   * @param workspaceId the workspace id
   */
  async remove(userId: string, workspaceId: string): Promise<void> {
    const workspace = await this.workspaceModel
      .findOneAndDelete()
      .where('_id')
      .equals(workspaceId)
      .where('users')
      .in([userId]);
    if (!workspace) throw new WorkspaceNotFoundException(workspaceId);
    this.eventEmitter.emit(
      Event.WorkspaceDeleted,
      new WorkspaceDeletedEvent(workspaceId),
    );
  }

  /**
   * Handles the user.deleted event
   * @param payload the user.deleted even payload
   */
  @OnEvent(Event.UserDeleted)
  private async handleUserDeletedEvent(
    payload: UserDeletedEvent,
  ): Promise<void> {
    const userId: string = payload.id;
    const workspaces: WorkspaceDocument[] = await this.findAll(userId);
    for (const workspace of workspaces) {
      const workspaceId: string = workspace._id;
      // The user is the only user in the workspace, delete the workspace
      if (workspace.users.length === 1) {
        await this.remove(userId, workspaceId);
      } else {
        // Remove the user from the workspace users
        workspace.users = workspace.users.filter((u) => u._id !== userId);
        await this.workspaceModel.updateOne(
          { _id: workspaceId },
          { users: workspace.users },
        );
        this.eventEmitter.emit(
          Event.WorkspaceUserRemoved,
          new WorkspaceUserRemovedEvent(workspaceId, userId),
        );
      }
    }
  }
}
