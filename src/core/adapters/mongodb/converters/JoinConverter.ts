import { Join } from "mongodb";
import { FilterCondition, JoinClause } from "../../../types/intermediateQuery";
import { RelationshipRegistry } from "../../base/relationship/RelationshipRegistry";
import { FilterConverter } from "./FilterConverter";

export class JoinConverter {
  private relationshipRegistry: RelationshipRegistry;

  constructor(relationshipRegistry: RelationshipRegistry) {
    this.relationshipRegistry = relationshipRegistry;
  }

  /**
   * Convert joins to MongoDB lookup stages
   */
  convertJoins(joins: JoinClause[], sourceCollection: string): any[] {
    console.log("joins: ", joins);
    const stages: any[] = [];
    joins.forEach((join) => {
      const lookupStages = this.convertSingleJoin(join, sourceCollection);
      if (lookupStages) {
        if (Array.isArray(lookupStages)) {
          stages.push(...lookupStages);
        } else {
          stages.push(lookupStages);
        }
      }
    });

    return stages;
  }

  /**
   * Convert single join to MongoDB lookup
   */
  private convertSingleJoin(
    join: JoinClause,
    sourceCollection: string
  ): any | null {
    // Handle relationship-based joins
    console.log("joincc", join);
    if (join.relationship && this.relationshipRegistry) {
      const relationships = this.relationshipRegistry.getForTable
        ? this.relationshipRegistry.getForTable(sourceCollection)
        : [];

      console.log("relationships", relationships);
      const relationship = relationships.find(
        (rel: any) => rel.name === join.relationship!.name
      );
      if (relationship) {
        return this.createRelationshipLookup(join, relationship);
      }
    }

    // Fallback to manual join conditions
    if (join.on && join.on.length > 0) {
      const condition = join.on[0];
      return {
        $lookup: {
          from: join.target,
          localField: condition.local,
          foreignField: condition.foreign,
          as: join.alias || join.target,
        },
      };
    }

    // Default simple lookup
    return {
      $lookup: {
        from: join.target,
        as: join.alias || join.target,
        pipeline: this.buildJoinPipeline(join),
      },
    };
  }

  private createRelationshipLookup(join: JoinClause, relationship: any): any {
    switch (relationship.type) {
      case "many-to-many":
        // code
        if (relationship.junction) {
          return this.buildManyToManyHaveJunction(join, relationship);
        } else {
          return this.buildManyToMany(join, relationship);
        }
      case "one-to-one":
      case "many-to-one":
        return this.buildManyOrOneToOne(join, relationship);
      case "one-to-many":
        return this.buildOneToMany(join, relationship);
      default:
        return [
          {
            $limit: 1,
          },
        ];
    }
  }

  private buildManyToManyHaveJunction(
    join: JoinClause,
    relationship: any
  ): any[] {
    const junctionPipeline = [
      {
        $match: {
          $expr: {
            $eq: [`$${relationship.junction.localKey}`, "$$local_value"],
          },
        },
      },
    ];

    const targetPipeline = [
      {
        $match: {
          $expr: {
            $in: [`$${relationship.foreignField}`, "$$junction_ids"],
          },
        },
      },
    ];

    // Add filters if specified
    this.buildJoinField(join.filter, targetPipeline);

    // Add nested joins if any
    this.buildNestedJoin(join, targetPipeline);

    // Return compound lookup: first junction, then target
    return [
      // First lookup: get junction records
      {
        $lookup: {
          from: relationship.junction.table,
          let: { local_value: `$${relationship.localField}` },
          pipeline: junctionPipeline,
          as: "_junction",
        },
      },
      // Second lookup: get target records using junction IDs
      {
        $lookup: {
          from: join.target,
          let: {
            junction_ids: {
              $map: {
                input: "$_junction",
                as: "j",
                in: `$$j.${relationship.junction.foreignKey}`,
              },
            },
          },
          pipeline: targetPipeline,
          as: join.alias || join.target,
        },
      },
      // Clean up junction data
      {
        $unset: "_junction",
      },
    ];
  }

  private buildManyToMany(join: JoinClause, relationship: any): any[] {
    const fullLocalFeld = relationship.definition.localField;
    let localField = fullLocalFeld.split(".")[0];
    let localFieldId = fullLocalFeld.split(".")[1];

    let name = relationship.definition.name;
    const pipeline = this.initialSpecialPipeline(relationship);

    // Add filters if specified
    this.buildJoinField(join.filter, pipeline);

    // Add nested joins if any
    this.buildNestedJoin(join, pipeline);

    const lookup = {
      $lookup: {
        from: join.target,
        let: { local_value: `$${relationship.localField}` },
        pipeline: pipeline,
        as: join.alias || join.target,
      },
    };

    return [
      lookup,
      {
        $addFields: {
          [localField]: {
            $map: {
              // input: `$${localField}`,
              input: {
                $cond: {
                  if: { $eq: [{ $type: `$${localField}` }, "array"] },
                  then: `$${localField}`,
                  else: `$${join.alias || join.target}`,
                },
              },
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    $cond: {
                      if: {
                        $eq: [{ $type: "$$item" }, "object"],
                      },
                      then: {
                        product: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: `$${join.alias || join.target}`,
                                as: "pd",
                                cond: {
                                  $eq: ["$$pd._id", `$$item.${localFieldId}`],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      else: {},
                    },
                  },
                ],
              },
            },
          },
        },
      },
      // remove the original field if needed
      {
        $unset: name,
      },
    ];
  }

  private buildManyOrOneToOne(join: JoinClause, relationship: any): any[] {
    const query = this.buildOneToMany(join, relationship);
    query.push({
      $unwind: {
        path: `$${join.alias || join.target}`,
        preserveNullAndEmptyArrays: true,
      },
    });
    return query;
  }

  private buildOneToMany(join: JoinClause, relationship: any): any[] {
    const pipeline = this.initialSpecialPipeline(relationship);
    // Add filters if specified
    this.buildJoinField(join.filter, pipeline);

    // Add nested joins if any
    this.buildNestedJoin(join, pipeline);

    const lookup = {
      $lookup: {
        from: join.target,
        let: { local_value: `$${relationship.localField}` },
        pipeline: pipeline,
        as: join.alias || join.target,
      },
    };
    return [lookup];
  }

  private buildJoinPipeline(join: JoinClause): any[] {
    const pipeline: any[] = [];

    // Add filters
    this.buildJoinField(join.filter, pipeline);

    // Add nested joins
    this.buildNestedJoin(join, pipeline);

    return pipeline;
  }

  private buildJoinField(filter: FilterCondition | undefined, pipeline: any[]) {
    if (filter) {
      pipeline.push({
        $match: FilterConverter.convertFilter(filter),
      });
    }
  }

  private buildNestedJoin(join: JoinClause, pipeline: any[]) {
    if (join.joins && join.joins.length > 0) {
      join.joins.forEach((nestedJoin) => {
        const nestedLookups = this.convertSingleJoin(nestedJoin, join.target);
        if (Array.isArray(nestedLookups)) {
          pipeline.push(...nestedLookups);
        } else if (nestedLookups) {
          pipeline.push(nestedLookups);
        }
      });
    }
  }

  private initialSpecialPipeline(relationship: any): any[] {
    return [
      {
        $match: {
          $expr: {
            $cond: {
              if: { $isArray: "$$local_value" },
              then: {
                $in: [
                  `$${relationship.foreignField}`,
                  {
                    $map: {
                      input: "$$local_value",
                      as: "id",
                      in: {
                        $cond: {
                          if: { $eq: [{ $type: "$$id" }, "string"] },
                          then: {
                            $convert: {
                              input: "$$id",
                              to: "objectId",
                              onError: null,
                              onNull: null,
                            },
                          },
                          else: "$$id",
                        },
                      },
                    },
                  },
                ],
              },
              else: {
                $eq: [
                  // `$${relationship.foreignField}`,
                  {
                    $cond: {
                      if: {
                        $eq: [
                          {
                            $type: `$${relationship.foreignField}`,
                          },
                          "string",
                        ],
                      },
                      then: {
                        $convert: {
                          input: `$${relationship.foreignField}`,
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                      else: `$${relationship.foreignField}`,
                    },
                  },
                  {
                    $cond: {
                      if: { $eq: [{ $type: "$$local_value" }, "string"] },
                      then: {
                        $convert: {
                          input: "$$local_value",
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                      else: "$$local_value",
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ];
  }
}
