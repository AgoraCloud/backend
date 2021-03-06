import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectLanesService } from './../lanes/lanes.service';
import { ProjectTaskNotFoundException } from './../../../exceptions/project-task-not-found.exception';
import {
  ProjectLane,
  ProjectLaneDocument,
  ProjectLaneSchema,
} from './../lanes/schemas/lane.schema';
import { ProjectDocument } from './../schemas/project.schema';
import { WorkspaceDocument } from './../../workspaces/schemas/workspace.schema';
import { UserDocument } from './../../users/schemas/user.schema';
import {
  ProjectTask,
  ProjectTaskSchema,
  ProjectTaskDocument,
} from './schemas/task.schema';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import {
  MongooseMockModule,
  closeMongooseConnection,
} from './../../../../test/utils/mongoose-mock-module';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectTasksService } from './tasks.service';
import { Connection, Types } from 'mongoose';
import { CreateProjectTaskDto, UpdateProjectTaskDto } from '@agoracloud/common';

const user: UserDocument = {
  _id: Types.ObjectId(),
  fullName: 'Test User',
  email: 'test@test.com',
  password: '',
  isEnabled: true,
  isVerified: true,
} as UserDocument;

const workspace: WorkspaceDocument = {
  _id: Types.ObjectId(),
  name: 'Test Workspace',
  users: [user],
} as WorkspaceDocument;

const project: ProjectDocument = {
  _id: Types.ObjectId(),
  name: 'Project 1',
  description: 'Project description',
  workspace,
  user,
} as ProjectDocument;

const projectLane: ProjectLaneDocument = {
  _id: Types.ObjectId(),
  name: 'Project Lane 1',
  workspace,
  user,
  project,
} as ProjectLaneDocument;

let projectLane2: ProjectLaneDocument;

let projectTaskId: string;

describe('ProjectTasksService', () => {
  let service: ProjectTasksService;
  let projectLanesService: ProjectLanesService;
  let connection: Connection;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseMockModule({
          connectionName: (new Date().getTime() * Math.random()).toString(16),
        }),
        MongooseModule.forFeature([
          { name: ProjectTask.name, schema: ProjectTaskSchema },
        ]),
        MongooseModule.forFeature([
          { name: ProjectLane.name, schema: ProjectLaneSchema },
        ]),
      ],
      providers: [ProjectTasksService, EventEmitter2, ProjectLanesService],
    }).compile();

    service = module.get<ProjectTasksService>(ProjectTasksService);
    projectLanesService = module.get<ProjectLanesService>(ProjectLanesService);
    connection = await module.get(getConnectionToken());

    // Create a new project lane to test the update project task lane
    // (i.e. simulate moving a task from one lane to the other)
    projectLane2 = await projectLanesService.create(user, workspace, project, {
      name: 'Project Lane 2',
    });
  });

  afterAll(async () => {
    await connection.close();
    await closeMongooseConnection();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project task', async () => {
      const createProjectTaskDto: CreateProjectTaskDto = {
        title: 'Project Task',
        description: 'Project task description',
      };
      const createdProjectTask: ProjectTaskDocument = await service.create(
        user,
        workspace,
        project,
        projectLane,
        createProjectTaskDto,
      );
      expect(createdProjectTask.title).toBe(createProjectTaskDto.title);
      expect(createdProjectTask.description).toBe(
        createProjectTaskDto.description,
      );
      projectTaskId = createdProjectTask._id;
    });
  });

  describe('findAll', () => {
    it('should find all project tasks in the given project lane', async () => {
      const retrievedProjectTasks: ProjectTaskDocument[] =
        await service.findAll(projectLane._id);
      expect(retrievedProjectTasks).toBeTruthy();
      expect(retrievedProjectTasks[0].lane._id).toEqual(projectLane._id);
    });

    it('should find all project tasks in the given project lane for the given user', async () => {
      const retrievedProjectTasks: ProjectTaskDocument[] =
        await service.findAll(projectLane._id, user._id);
      expect(retrievedProjectTasks).toBeTruthy();
      expect(retrievedProjectTasks[0].user._id).toEqual(user._id);
      expect(retrievedProjectTasks[0].lane._id).toEqual(projectLane._id);
    });

    it('should find all project tasks in the given workspace and project lane for the given user', async () => {
      const retrievedProjectTasks: ProjectTaskDocument[] =
        await service.findAll(projectLane._id, user._id, workspace._id);
      expect(retrievedProjectTasks).toBeTruthy();
      expect(retrievedProjectTasks[0].user._id).toEqual(user._id);
      expect(retrievedProjectTasks[0].workspace._id).toEqual(workspace._id);
      expect(retrievedProjectTasks[0].lane._id).toEqual(projectLane._id);
    });

    it('should find all project tasks in the given workspace, project and project lane for the given user', async () => {
      const retrievedProjectTasks: ProjectTaskDocument[] =
        await service.findAll(
          projectLane._id,
          user._id,
          workspace._id,
          project._id,
        );
      expect(retrievedProjectTasks).toBeTruthy();
      expect(retrievedProjectTasks[0].user._id).toEqual(user._id);
      expect(retrievedProjectTasks[0].workspace._id).toEqual(workspace._id);
      expect(retrievedProjectTasks[0].project._id).toEqual(project._id);
      expect(retrievedProjectTasks[0].lane._id).toEqual(projectLane._id);
    });
  });

  describe('findOne', () => {
    it('should throw an error if the project task with the given id was not found', async () => {
      const projectTaskId: string = Types.ObjectId().toHexString();
      const expectedErrorMessage: string = new ProjectTaskNotFoundException(
        projectTaskId,
      ).message;
      try {
        await service.findOne(
          workspace._id,
          project._id,
          projectLane._id,
          projectTaskId,
          user._id,
        );
        fail('It should throw an error');
      } catch (err) {
        expect(err.message).toBe(expectedErrorMessage);
      }
    });

    it('should find the project task in the given workspace, project and project lane for the given user', async () => {
      const retrievedProjectTask: ProjectTaskDocument = await service.findOne(
        workspace._id,
        project._id,
        projectLane._id,
        projectTaskId,
        user._id,
      );
      expect(retrievedProjectTask._id).toEqual(projectTaskId);
      expect(retrievedProjectTask.user._id).toEqual(user._id);
      expect(retrievedProjectTask.workspace._id).toEqual(workspace._id);
      expect(retrievedProjectTask.project._id).toEqual(project._id);
      expect(retrievedProjectTask.lane._id).toEqual(projectLane._id);
    });
  });

  describe('update', () => {
    it('should update the project task', async () => {
      const updateProjectTaskDto: UpdateProjectTaskDto = {
        title: 'new Project Task',
        description: 'New project task description',
        lane: {
          id: projectLane2._id,
        },
      };
      const updatedProjectTask: ProjectTaskDocument = await service.update(
        workspace._id,
        project._id,
        projectLane._id,
        projectTaskId,
        updateProjectTaskDto,
        user._id,
      );
      expect(updatedProjectTask._id).toEqual(projectTaskId);
      expect(updatedProjectTask.title).toBe(updateProjectTaskDto.title);
      expect(updatedProjectTask.description).toBe(
        updateProjectTaskDto.description,
      );
      expect(updatedProjectTask.lane._id).toEqual(projectLane2._id);
    });
  });

  describe('remove', () => {
    it('should throw an error if the project task with the given id was not found', async () => {
      const projectTaskId: string = Types.ObjectId().toHexString();
      const expectedErrorMessage: string = new ProjectTaskNotFoundException(
        projectTaskId,
      ).message;
      try {
        await service.remove(
          workspace._id,
          project._id,
          projectLane2._id,
          projectTaskId,
          user._id,
        );
        fail('It should throw an error');
      } catch (err) {
        expect(err.message).toBe(expectedErrorMessage);
      }
    });

    it('should delete the project task', async () => {
      await service.remove(
        workspace._id,
        project._id,
        projectLane2._id,
        projectTaskId,
        user._id,
      );
      // Make sure that the project task has been deleted
      const retrievedProjectTasks: ProjectTaskDocument[] =
        await service.findAll(
          projectLane2._id,
          user._id,
          workspace._id,
          project._id,
        );
      expect(retrievedProjectTasks.length).toBe(0);
    });
  });
});
