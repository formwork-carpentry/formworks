import { describe, expect, it } from 'vitest';

import { generateTypeScript, parseProto } from '../src/generators/ServiceGenerator.js';

describe('@formwork/cli: service generator', () => {
  it('parses proto messages and service methods', () => {
    const source = [
      'message GetUserRequest {',
      '  string id = 1;',
      '}',
      'message User {',
      '  string id = 1;',
      '  optional string email = 2;',
      '  repeated string roles = 3;',
      '}',
      'service UserService {',
      '  rpc GetUser(GetUserRequest) returns (User);',
      '  rpc ListUsers(Empty) returns (stream User);',
      '}',
    ].join('\n');

    const parsed = parseProto(source);

    expect(parsed.messages).toEqual([
      {
        name: 'GetUserRequest',
        fields: [{ name: 'id', type: 'string', repeated: false, optional: false }],
      },
      {
        name: 'User',
        fields: [
          { name: 'id', type: 'string', repeated: false, optional: false },
          { name: 'email', type: 'string', repeated: false, optional: true },
          { name: 'roles', type: 'string', repeated: true, optional: false },
        ],
      },
    ]);
    expect(parsed.services).toEqual([
      {
        name: 'UserService',
        methods: [
          { name: 'GetUser', inputType: 'GetUserRequest', outputType: 'User', streaming: false },
          { name: 'ListUsers', inputType: 'Empty', outputType: 'User', streaming: true },
        ],
      },
    ]);
  });

  it('generates interface, client, and handler code', () => {
    const parsed = parseProto([
      'message CreateUserRequest {',
      '  string name = 1;',
      '}',
      'message User {',
      '  string id = 1;',
      '}',
      'service UserService {',
      '  rpc CreateUser(CreateUserRequest) returns (User);',
      '}',
    ].join('\n'));

    const generated = generateTypeScript(parsed.services, parsed.messages);

    expect(generated.interface).toContain('export interface CreateUserRequest');
    expect(generated.interface).toContain('export interface IUserService');
    expect(generated.interface).toContain('CreateUser(request: CreateUserRequest): Promise<User>;');
    expect(generated.client).toContain("service: 'UserService'");
    expect(generated.client).toContain('export class UserServiceClient implements IUserService');
    expect(generated.handler).toContain('export class UserServiceHandler implements IUserService');
    expect(generated.handler).toContain("throw new Error('CreateUser not implemented')");
  });
});