import CommissionsDao from './CommissionsDao';
import {
  BoardsEntityAll,
  DepartmentsEntityAll,
  AuthorityTypesEntityAll,
  vw_BoardsWithMembersEntityAll,
} from './CommissionsDb';

const AUTHORITIES: AuthorityTypesEntityAll[] = require('../../../fixtures/Authorities.json');
const BOARDS: BoardsEntityAll[] = require('../../../fixtures/Boards.json');
const DEPARTMENTS: DepartmentsEntityAll[] = require('../../../fixtures/Departments.json');
const MEMBERS: vw_BoardsWithMembersEntityAll[] = require('../../../fixtures/BoardMembers.json');

// Using "Required" makes us duck-compatible with CommissionDao without one
// inheriting from the other or needing to maintain a separate common interface.
// In truth, we don’t actually need the "requirablity" it provides, but it’s
// nice to use the standard library.
export default class CommissionsDaoFake implements Required<CommissionsDao> {
  fetchBoards() {
    return Promise.resolve(BOARDS);
  }

  fetchBoard(id: number) {
    return Promise.resolve(
      BOARDS.find(({ BoardID }) => BoardID === id) || null
    );
  }

  fetchAuthority(id: number) {
    return Promise.resolve(
      AUTHORITIES.find(({ AuthorityId }) => AuthorityId === id) || null
    );
  }

  fetchBoardMembers(id: number) {
    return Promise.resolve(MEMBERS.filter(({ BoardID }) => BoardID === id));
  }

  fetchDepartment(id: number) {
    return Promise.resolve(
      DEPARTMENTS.find(({ DepartmentId }) => DepartmentId === id) || null
    );
  }
}
