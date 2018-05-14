/**
 * @file This file defines the GraphQL schema and resolvers for our server.
 *
 * Run `npm run generate-graphql-schema` to use `ts2gql` to turn this file into
 * the `schema.graphql` file that can be consumed by this and other tools.
 *
 * The output is generated in the “graphql” directory in the package root so
 * that it can be `readFileSync`’d from both `build` (during dev and production)
 * and `src` (during test).
 */
import fs from 'fs';
import path from 'path';

import { makeExecutableSchema } from 'graphql-tools';
import { Resolvers, ResolvableWith } from '@cityofboston/graphql-typescript';

import CommissionsDao, {
  DbBoard,
  DbDepartment,
  DbMember,
} from '../dao/CommissionsDao';

/** @graphql schema */
export interface Schema {
  query: QueryRoot;
}

export interface QueryRoot {
  commissions: Commission[];
  commission(args: { id: number }): Commission | null;
}

export interface Commission extends ResolvableWith<DbBoard> {
  id: number;
  name: string;
  department: Department | null;
  contactName: string;
  contactEmail: string;
  authority: string;
  term: string | null;
  stipend: number;
  seats: number;
  enablingLegislation: string | null;
  members: Member[];
}

export interface Department extends ResolvableWith<DbDepartment> {
  name: string;
}

export interface Member extends ResolvableWith<DbMember> {
  name: string;
  appointed: Date | null;
  expires: Date | null;
  status: string;
  holdover: boolean;
}

// This file is built by the "generate-graphql-schema" script from
// the above interfaces.
const schemaGraphql = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'graphql', 'schema.graphql'),
  'utf-8'
);

export interface Context {
  commissionsDao: CommissionsDao;
}

const queryRootResolvers: Resolvers<QueryRoot, Context> = {
  commissions: (_obj, _args, { commissionsDao }) =>
    commissionsDao.fetchBoards(),
  commission: (_obj, { id }, { commissionsDao }) =>
    commissionsDao.fetchBoard(id),
};

const commissionResolvers: Resolvers<Commission, Context> = {
  id: ({ BoardID }) => BoardID,
  name: ({ BoardName }) => BoardName || 'Unknown Board',
  department: async ({ DepartmentId }, _args, { commissionsDao }) =>
    DepartmentId ? await commissionsDao.fetchDepartment(DepartmentId) : null,
  contactName: ({ Contact }) => Contact || '',
  contactEmail: ({ Email }) => Email || '',
  authority: async ({ AuthorityId }, _args, { commissionsDao }) => {
    let authority;
    if (
      AuthorityId &&
      (authority = await commissionsDao.fetchAuthority(AuthorityId))
    ) {
      return authority.AuthorityType;
    } else {
      return 'Unknown';
    }
  },
  term: ({ Term }) => Term,
  stipend: ({ Stipend }) => Stipend,
  seats: ({ Seats }) => Seats,
  enablingLegislation: ({ Legislation }) => Legislation,
  members: async ({ BoardID }, _args, { commissionsDao }) =>
    // Some commissions have employees listed, which we want to remove.
    (await commissionsDao.fetchBoardMembers(BoardID)).filter(
      ({ StatusName }) => StatusName !== 'employee'
    ),
};

const departmentResolvers: Resolvers<Department, Context> = {
  name: ({ DepartmentName }) => DepartmentName || 'Unknown Department',
};

const memberResolvers: Resolvers<Member, Context> = {
  name: ({ FirstName, LastName }) =>
    `${(FirstName || '').trim()} ${(LastName || '').trim()}`.trim(),
  appointed: ({ AppointDtTm }) => AppointDtTm,
  expires: ({ ExpireDtTm }) => ExpireDtTm,
  status: ({ StatusName }) => StatusName,
  holdover: ({ StatusName }) => StatusName === 'Holdover',
};

export default makeExecutableSchema({
  typeDefs: [schemaGraphql],
  resolvers: {
    QueryRoot: queryRootResolvers,
    Commission: commissionResolvers,
    Department: departmentResolvers,
    Member: memberResolvers,
  },
  allowUndefinedInResolve: false,
});
