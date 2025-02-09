import "reflect-metadata";
import { promises as fs } from "fs";
import { buildSchema, Query, Resolver } from "type-graphql";
import { graphql, GraphQLSchema } from "graphql";

import generateArtifactsDirPath from "../helpers/artifacts-dir";
import { generateCodeFromSchema } from "../helpers/generate-code";

describe("relations resolvers execution", () => {
  describe("single primary key", () => {
    let outputDirPath: string;
    let graphQLSchema: GraphQLSchema;

    beforeAll(async () => {
      outputDirPath = generateArtifactsDirPath("functional-relations");
      await fs.mkdir(outputDirPath, { recursive: true });
      const prismaSchema = /* prisma */ `
        enum Color {
          RED
          GREEN
          BLUE
        }

        model User {
          id     Int      @id @default(autoincrement())
          name   String?
          posts  Post[]
        }

        model Post {
          uuid      String  @id @default(cuid())
          content   String
          author    User    @relation(fields: [authorId], references: [id])
          authorId  Int
          color     Color
        }
      `;
      await generateCodeFromSchema(prismaSchema, { outputDirPath });
      const {
        UserRelationsResolver,
        PostRelationsResolver,
        User,
        Post,
      } = require(outputDirPath);
      @Resolver()
      class CustomResolver {
        @Query(_returns => [User])
        users(): any[] {
          return [
            {
              id: 1,
              name: "Test 1",
            },
            {
              id: 2,
              name: "Test 2",
            },
          ];
        }
        @Query(_returns => [Post])
        posts(): any[] {
          return [
            {
              uuid: "b0c0d78e-4dff-4cdd-ba23-9b417dc684e2",
              color: "RED",
            },
            {
              uuid: "72c8a188-3d46-45b3-b23f-7d420aa282f1",
              color: "BLUE",
            },
          ];
        }
      }

      graphQLSchema = await buildSchema({
        resolvers: [
          CustomResolver,
          UserRelationsResolver,
          PostRelationsResolver,
        ],
        validate: false,
      });
    });

    it("should properly call PrismaClient on fetching array relations", async () => {
      const document = /* graphql */ `
        query {
          users {
            name
            posts {
              uuid
              color
            }
          }
        }
      `;
      const findUniqueUserMock = jest.fn();
      const prismaMock = {
        user: {
          findUnique: findUniqueUserMock,
        },
      };
      findUniqueUserMock.mockReturnValueOnce({
        posts: jest.fn().mockResolvedValue([]),
      });
      findUniqueUserMock.mockReturnValueOnce({
        posts: jest.fn().mockResolvedValue([
          {
            uuid: "b0c0d78e-4dff-4cdd-ba23-9b417dc684e2",
            color: "RED",
          },
          {
            uuid: "72c8a188-3d46-45b3-b23f-7d420aa282f1",
            color: "BLUE",
          },
        ]),
      });

      const { data, errors } = await graphql(graphQLSchema, document, null, {
        prisma: prismaMock,
      });

      expect(errors).toBeUndefined();
      expect(data).toMatchSnapshot("users with posts mocked response");
      expect(prismaMock.user.findUnique.mock.calls).toMatchSnapshot(
        "findUniqueUser relations call args",
      );
    });

    it("should properly call PrismaClient on fetching array relations with args", async () => {
      const document = /* graphql */ `
        query {
          users {
            name
            posts(skip: 1, take: 1, where: {
              content: {
                startsWith: "test"
              }
            }) {
              uuid
              color
            }
          }
        }
      `;
      const findUniqueUserMock = jest.fn();
      const findUniqueUserPostsMock = jest.fn();
      const prismaMock = {
        user: {
          findUnique: findUniqueUserMock,
        },
      };
      findUniqueUserMock.mockReturnValueOnce({
        posts: jest.fn().mockResolvedValue([]),
      });
      findUniqueUserMock.mockReturnValueOnce({
        posts: findUniqueUserPostsMock,
      });
      findUniqueUserPostsMock.mockResolvedValue([
        {
          uuid: "b0c0d78e-4dff-4cdd-ba23-9b417dc684e2",
          color: "RED",
        },
        {
          uuid: "72c8a188-3d46-45b3-b23f-7d420aa282f1",
          color: "BLUE",
        },
      ]);

      const { data, errors } = await graphql(graphQLSchema, document, null, {
        prisma: prismaMock,
      });

      expect(errors).toBeUndefined();
      expect(data).toMatchSnapshot("users with posts mocked response");
      expect(prismaMock.user.findUnique.mock.calls).toMatchSnapshot(
        "findUniqueUser relations call args",
      );
      expect(findUniqueUserPostsMock.mock.calls).toMatchSnapshot(
        "posts() relations call args",
      );
    });

    it("should properly call PrismaClient on fetching single relation", async () => {
      const document = /* graphql */ `
        query {
          posts {
            uuid
            author {
              id
              name
            }
          }
        }
      `;
      const findUniquePostMock = jest.fn();
      const prismaMock = {
        post: {
          findUnique: findUniquePostMock,
        },
      };
      findUniquePostMock.mockReturnValue({
        author: jest.fn().mockResolvedValue({
          id: 1,
          name: "Test 1",
        }),
      });

      const { data, errors } = await graphql(graphQLSchema, document, null, {
        prisma: prismaMock,
      });

      expect(errors).toBeUndefined();
      expect(data).toMatchSnapshot("posts with authors mocked response");
      expect(prismaMock.post.findUnique.mock.calls).toMatchSnapshot(
        "findUniquePost relations call args",
      );
    });
  });

  describe("composite unique key", () => {
    let outputDirPath: string;
    let graphQLSchema: GraphQLSchema;

    beforeAll(async () => {
      outputDirPath = generateArtifactsDirPath("functional-relations");
      await fs.mkdir(outputDirPath, { recursive: true });
      const prismaSchema = /* prisma */ `
        enum Color {
          RED
          GREEN
          BLUE
        }

        model User {
          id     Int      @id @default(autoincrement())
          name   String?
          posts  Post[]
        }

        model Post {
          title     String
          color     Color
          text      String?
          author    User     @relation(fields: [authorId], references: [id])
          authorId  Int

          @@unique([title, color])
        }
      `;
      await generateCodeFromSchema(prismaSchema, { outputDirPath });
      const { PostRelationsResolver, Post } = require(outputDirPath);
      @Resolver()
      class CustomResolver {
        @Query(_returns => Post)
        post(): any {
          return {
            title: "Post 1",
            color: "BLUE",
            text: "Post text",
          };
        }
      }

      graphQLSchema = await buildSchema({
        resolvers: [CustomResolver, PostRelationsResolver],
        validate: false,
      });
    });

    it("should properly call PrismaClient on fetching single relation", async () => {
      const document = /* graphql */ `
        query {
          post {
            title
            color
            text
            author {
              id
              name
            }
          }
        }
      `;
      const findUniquePostMock = jest.fn();
      const prismaMock = {
        post: {
          findUnique: findUniquePostMock,
        },
      };
      findUniquePostMock.mockReturnValueOnce({
        author: jest.fn().mockResolvedValue({
          id: 1,
          name: "User 1",
        }),
      });

      const { data, errors } = await graphql(graphQLSchema, document, null, {
        prisma: prismaMock,
      });

      expect(errors).toBeUndefined();
      expect(data).toMatchSnapshot("post with author mocked response");
      expect(prismaMock.post.findUnique.mock.calls).toMatchSnapshot(
        "findUniquePost relations call args",
      );
    });
  });

  describe("composite unique key with name", () => {
    let outputDirPath: string;
    let graphQLSchema: GraphQLSchema;

    beforeAll(async () => {
      outputDirPath = generateArtifactsDirPath("functional-relations");
      await fs.mkdir(outputDirPath, { recursive: true });
      const prismaSchema = /* prisma */ `
        enum Color {
          RED
          GREEN
          BLUE
        }

        model User {
          id     Int      @id @default(autoincrement())
          name   String?
          posts  Post[]
        }

        model Post {
          title     String
          color     Color
          text      String?
          author    User     @relation(fields: [authorId], references: [id])
          authorId  Int

          @@unique([title, color], name: "postUniqueCompoundName")
        }
      `;
      await generateCodeFromSchema(prismaSchema, { outputDirPath });
      const { PostRelationsResolver, Post } = require(outputDirPath);
      @Resolver()
      class CustomResolver {
        @Query(_returns => Post)
        post(): any {
          return {
            title: "Post 1",
            color: "BLUE",
            text: "Post text",
          };
        }
      }

      graphQLSchema = await buildSchema({
        resolvers: [CustomResolver, PostRelationsResolver],
        validate: false,
      });
    });

    it("should properly call PrismaClient on fetching single relation", async () => {
      const document = /* graphql */ `
        query {
          post {
            title
            color
            text
            author {
              id
              name
            }
          }
        }
      `;
      const findUniquePostMock = jest.fn();
      const prismaMock = {
        post: {
          findUnique: findUniquePostMock,
        },
      };
      findUniquePostMock.mockReturnValueOnce({
        author: jest.fn().mockResolvedValue({
          id: 1,
          name: "User 1",
        }),
      });

      const { data, errors } = await graphql(graphQLSchema, document, null, {
        prisma: prismaMock,
      });

      expect(errors).toBeUndefined();
      expect(data).toMatchSnapshot("post with author mocked response");
      expect(prismaMock.post.findUnique.mock.calls).toMatchSnapshot(
        "findUniquePost relations call args",
      );
    });
  });

  describe("with namedConstraints previewFeature", () => {
    describe("composite primary key with name", () => {
      let outputDirPath: string;
      let graphQLSchema: GraphQLSchema;

      beforeAll(async () => {
        outputDirPath = generateArtifactsDirPath("functional-relations");
        await fs.mkdir(outputDirPath, { recursive: true });
        const prismaSchema = /* prisma */ `
        enum Color {
          RED
          GREEN
          BLUE
        }

        model User {
          id     Int      @id @default(autoincrement())
          name   String?
          posts  Post[]
        }

        model Post {
          title     String
          color     Color
          text      String?
          author    User     @relation(fields: [authorId], references: [id])
          authorId  Int

          @@id([title, color], name: "postIdCompoundName")
        }
      `;
        await generateCodeFromSchema(prismaSchema, {
          outputDirPath,
          previewFeatures: ["namedConstraints"],
        });
        const { PostRelationsResolver, Post } = require(outputDirPath);
        @Resolver()
        class CustomResolver {
          @Query(_returns => Post)
          post(): any {
            return {
              title: "Post 1",
              color: "BLUE",
              text: "Post text",
            };
          }
        }

        graphQLSchema = await buildSchema({
          resolvers: [CustomResolver, PostRelationsResolver],
          validate: false,
        });
      });

      it("should properly call PrismaClient on fetching single relation", async () => {
        const document = /* graphql */ `
        query {
          post {
            title
            color
            text
            author {
              id
              name
            }
          }
        }
      `;
        const findUniquePostMock = jest.fn();
        const prismaMock = {
          post: {
            findUnique: findUniquePostMock,
          },
        };
        findUniquePostMock.mockReturnValueOnce({
          author: jest.fn().mockResolvedValue({
            id: 1,
            name: "User 1",
          }),
        });

        const { data, errors } = await graphql(graphQLSchema, document, null, {
          prisma: prismaMock,
        });

        expect(errors).toBeUndefined();
        expect(data).toMatchSnapshot("post with author mocked response");
        expect(prismaMock.post.findUnique.mock.calls).toMatchSnapshot(
          "findUniquePost relations call args",
        );
      });
    });
  });
});
