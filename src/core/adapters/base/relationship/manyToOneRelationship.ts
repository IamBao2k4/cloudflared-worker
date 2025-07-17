import { Relationship } from "./mainRelationship";
import { EmbedRequest, JoinCondition } from "./types";

/**
 * Many-to-One Relationship
 * Example: Post -> User (author), Order -> Customer
 */
export class ManyToOneRelationship extends Relationship {
  generateJoinCondition(): JoinCondition {
    return {
      localField: this.localField,
      foreignField: this.foreignField,
      joinType: 'left'
    };
  }

  generateLookupStage(embedRequest: EmbedRequest): any {
    const pipeline = this.generateBasePipeline(embedRequest);

    return {
      $lookup: {
        from: this.targetTable,
        localField: this.localField,
        foreignField: this.foreignField,
        as: embedRequest.alias || this.name,
        ...(pipeline.length > 0 && { pipeline })
      }
    };
  }

  isMultiResult(): boolean {
    return false;
  }
}