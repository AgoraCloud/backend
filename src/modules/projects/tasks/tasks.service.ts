import { ProjectLanesService } from './../lanes/lanes.service';
import { ProjectTaskNotFoundException } from './../../../exceptions/project-task-not-found.exception';
import { ProjectLaneDocument } from './../lanes/schemas/lane.schema';
import { ProjectDocument } from './../schemas/project.schema';
import { WorkspaceDocument } from './../../workspaces/schemas/workspace.schema';
import { UserDocument } from './../../users/schemas/user.schema';
import { ProjectLaneDeletedEvent } from './../../../events/project-lane-deleted.event';
import { ProjectTask, ProjectTaskDocument } from './schemas/task.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { CreateProjectTaskDto } from './dto/create-task.dto';
import { UpdateProjectTaskDto } from './dto/update-task.dto';
import { Model, Query } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { Event } from '../../../events/events.enum';

@Injectable()
export class ProjectTasksService {
  constructor(
    @InjectModel(ProjectTask.name)
    private readonly projectTasksModel: Model<ProjectTaskDocument>,
    private readonly projectLanesService: ProjectLanesService,
  ) {}

  /**
   * Create a project task
   * @param user the user
   * @param workspace the workspace
   * @param project the project
   * @param projectLane the project lane
   * @param createProjectTaskDto the project task to create
   * @returns the created project task document
   */
  async create(
    user: UserDocument,
    workspace: WorkspaceDocument,
    project: ProjectDocument,
    projectLane: ProjectLaneDocument,
    createProjectTaskDto: CreateProjectTaskDto,
  ): Promise<ProjectTaskDocument> {
    const projectTask: ProjectTask = new ProjectTask(createProjectTaskDto);
    projectTask.user = user;
    projectTask.workspace = workspace;
    projectTask.project = project;
    projectTask.lane = projectLane;
    const createdProjectTask: ProjectTaskDocument = await this.projectTasksModel.create(
      projectTask,
    );
    return createdProjectTask;
  }

  /**
   * Find all project tasks
   * @param projectLaneId the project lane id
   * @param userId the users id
   * @param workspaceId the workspace id
   * @param projectId the project id
   * @returns an array of project task documents
   */
  async findAll(
    projectLaneId: string,
    userId?: string,
    workspaceId?: string,
    projectId?: string,
  ): Promise<ProjectTaskDocument[]> {
    let projectTasksQuery: Query<
      ProjectTaskDocument[],
      ProjectTaskDocument
    > = this.projectTasksModel.find().where('lane').equals(projectLaneId);
    if (userId) {
      projectTasksQuery = projectTasksQuery.where('user').equals(userId);
    }
    if (workspaceId) {
      projectTasksQuery = projectTasksQuery
        .where('workspace')
        .equals(workspaceId);
    }
    if (projectId) {
      projectTasksQuery = projectTasksQuery.where('project').equals(projectId);
    }
    const projectTasks: ProjectTaskDocument[] = await projectTasksQuery.exec();
    return projectTasks;
  }

  /**
   * Find a project task
   * @param workspaceId the workspace id
   * @param projectId the project id
   * @param projectLaneId the project lane id
   * @param projectTaskId the project task id
   * @param userId the users id
   * @throws ProjectTaskNotFoundException
   * @returns a project task document
   */
  async findOne(
    workspaceId: string,
    projectId: string,
    projectLaneId: string,
    projectTaskId: string,
    userId?: string,
  ): Promise<ProjectTaskDocument> {
    let projectTaskQuery: Query<
      ProjectTaskDocument,
      ProjectTaskDocument
    > = this.projectTasksModel
      .findOne()
      .where('_id')
      .equals(projectTaskId)
      .where('workspace')
      .equals(workspaceId)
      .where('project')
      .equals(projectId)
      .where('lane')
      .equals(projectLaneId);
    if (userId) {
      projectTaskQuery = projectTaskQuery.where('user').equals(userId);
    }
    const projectTask: ProjectTaskDocument = await projectTaskQuery.exec();
    if (!projectTask) throw new ProjectTaskNotFoundException(projectTaskId);
    return projectTask;
  }

  /**
   * Update a project task
   * @param workspaceId the workspace id
   * @param projectId the project id
   * @param projectLaneId the project lane id
   * @param projectTaskId the project task id
   * @param updateProjectTaskDto the updated project task
   * @param userId the users id
   * @returns the updated project task document
   */
  async update(
    workspaceId: string,
    projectId: string,
    projectLaneId: string,
    projectTaskId: string,
    updateProjectTaskDto: UpdateProjectTaskDto,
    userId?: string,
  ): Promise<ProjectTaskDocument> {
    const projectTask: ProjectTaskDocument = await this.findOne(
      workspaceId,
      projectId,
      projectLaneId,
      projectTaskId,
      userId,
    );
    // Change the updated fields only
    projectTask.title = updateProjectTaskDto.title || projectTask.title;
    projectTask.description =
      updateProjectTaskDto.description || projectTask.description;
    const newProjectLaneId: string = updateProjectTaskDto.lane?.id;
    if (newProjectLaneId && newProjectLaneId != projectLaneId) {
      const newProjectLane: ProjectLaneDocument = await this.projectLanesService.findOne(
        workspaceId,
        projectId,
        newProjectLaneId,
        userId,
      );
      projectTask.lane = newProjectLane;
    }

    let projectTaskQuery: Query<
      { ok: number; n: number; nModified: number },
      ProjectTaskDocument
    > = this.projectTasksModel
      .updateOne(null, projectTask)
      .where('_id')
      .equals(projectTaskId)
      .where('workspace')
      .equals(workspaceId)
      .where('project')
      .equals(projectId)
      .where('lane')
      .equals(projectLaneId);
    if (userId) {
      projectTaskQuery = projectTaskQuery.where('user').equals(userId);
    }
    await projectTaskQuery.exec();
    return projectTask;
  }

  /**
   * Delete a project task
   * @param workspaceId the workspace id
   * @param projectId the project id
   * @param projectLaneId the project lane id
   * @param projectTaskId the project task id
   * @param userId the users id
   * @throws ProjectTaskNotFoundException
   */
  async remove(
    workspaceId: string,
    projectId: string,
    projectLaneId: string,
    projectTaskId: string,
    userId?: string,
  ): Promise<void> {
    let projectTaskQuery: Query<
      ProjectTaskDocument,
      ProjectTaskDocument
    > = this.projectTasksModel
      .findOneAndDelete()
      .where('_id')
      .equals(projectTaskId)
      .where('workspace')
      .equals(workspaceId)
      .where('project')
      .equals(projectId)
      .where('lane')
      .equals(projectLaneId);
    if (userId) {
      projectTaskQuery = projectTaskQuery.where('user').equals(userId);
    }
    const projectTask: ProjectTaskDocument = await projectTaskQuery.exec();
    if (!projectTask) throw new ProjectTaskNotFoundException(projectTaskId);
  }

  /**
   * Delete all project tasks
   * @param projectLaneId the project lane id
   */
  private async removeAll(projectLaneId: string): Promise<void> {
    await this.projectTasksModel
      .deleteMany()
      .where('lane')
      .equals(projectLaneId);
  }

  /**
   * Handles the project.lane.deleted event
   * @param payload the project.lane.deleted event payload
   */
  @OnEvent(Event.ProjectLaneDeleted)
  private async handleProjectLaneDeletedEvent(
    payload: ProjectLaneDeletedEvent,
  ): Promise<void> {
    await this.removeAll(payload.id);
  }
}
