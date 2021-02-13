import { Observable } from 'rxjs';
import { WorkspaceDocument } from './../modules/workspaces/schemas/workspace.schema';
import { UserDocument } from './../modules/users/schemas/user.schema';
import { InvalidMongoIdException } from './../exceptions/invalid-mongo-id.exception';
import { isMongoId } from 'class-validator';
import { WikiSectionsService } from './../modules/wiki/sections/sections.service';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { WikiSectionDocument } from './../modules/wiki/sections/schemas/section.schema';
import { RequestWithWorkspaceUserAndWikiSection } from '../utils/requests.interface';

@Injectable()
export class WikiSectionInterceptor implements NestInterceptor {
  constructor(private readonly wikiSectionsService: WikiSectionsService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request: RequestWithWorkspaceUserAndWikiSection = context
      .switchToHttp()
      .getRequest();
    const wikiSectionId: string = request.params.sectionId;
    if (!isMongoId(wikiSectionId)) {
      throw new InvalidMongoIdException('sectionId');
    }

    const user: UserDocument = request.user;
    const workspace: WorkspaceDocument = request.workspace;
    const wikiSection: WikiSectionDocument = await this.wikiSectionsService.findOne(
      user._id,
      workspace._id,
      wikiSectionId,
    );
    request.wikiSection = wikiSection;
    return next.handle();
  }
}
