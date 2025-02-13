import * as TypeGraphQL from "type-graphql";
import * as GraphQLScalars from "graphql-scalars";
import { MainUserCreateInput } from "../../../inputs/MainUserCreateInput";

@TypeGraphQL.ArgsType()
export class CreateMainUserArgs {
  @TypeGraphQL.Field(_type => MainUserCreateInput, {
    nullable: false
  })
  data!: MainUserCreateInput;
}
