import expect from 'expect'
import { getClient } from '../helpers.js'
import getCatalog from '#/postgres/getCatalog.js'

describe('postgres/getCatalog', () => {
  // Because catalog is not mutated in these tests, we cache it.
  let catalog = null

  before(async () => (catalog = await getCatalog(await getClient())))

  it('gets schemas', () => {
    expect(catalog.getSchema('a')).toExist()
    expect(catalog.getSchema('b')).toExist()
    expect(catalog.getSchema('c')).toExist()
  })

  it('gets schema description', () => {
    expect(catalog.getSchema('a').description).toEqual('The a schema.')
    expect(catalog.getSchema('b').description).toEqual('qwerty')
    expect(catalog.getSchema('c').description).toNotExist()
  })

  it('gets tables', () => {
    expect(catalog.getTable('c', 'person')).toExist()
    expect(catalog.getTable('a', 'hello')).toExist()
  })

  it('gets table description', () => {
    expect(catalog.getTable('c', 'person').description).toEqual('Person test comment')
    expect(catalog.getTable('a', 'hello').description).toNotExist()
    expect(catalog.getTable('b', 'yo').description).toEqual('YOYOYO!!')
  })

  it('gets views', () => {
    expect(catalog.getTable('b', 'yo')).toExist()
  })

  it('gets columns', () => {
    expect(catalog.getColumn('c', 'person', 'id')).toExist()
    expect(catalog.getColumn('c', 'person', 'name')).toExist()
    expect(catalog.getColumn('c', 'person', 'about')).toExist()
    expect(catalog.getColumn('a', 'hello', 'world')).toExist()
    expect(catalog.getColumn('a', 'hello', 'moon')).toExist()
  })

  it('gets columns in definition order', () => {
    expect(catalog.getTable('a', 'hello').columns.map(({ name }) => name))
    .toEqual(['z_some', 'world', 'moon', 'abc', 'yoyo'])
  })

  it('gets columns for views', () => {
    expect(catalog.getColumn('b', 'yo', 'world')).toExist()
    expect(catalog.getColumn('b', 'yo', 'moon')).toExist()
    expect(catalog.getColumn('b', 'yo', 'constant')).toExist()
  })

  it('gets column nullability', () => {
    expect(catalog.getColumn('c', 'person', 'id').isNullable).toEqual(false)
    expect(catalog.getColumn('c', 'person', 'name').isNullable).toEqual(false)
    expect(catalog.getColumn('c', 'person', 'about').isNullable).toEqual(true)
    expect(catalog.getColumn('a', 'hello', 'world').isNullable).toEqual(true)
    expect(catalog.getColumn('a', 'hello', 'moon').isNullable).toEqual(false)
    expect(catalog.getColumn('b', 'yo', 'world').isNullable).toEqual(true)
    expect(catalog.getColumn('b', 'yo', 'moon').isNullable).toEqual(true)
    expect(catalog.getColumn('b', 'yo', 'constant').isNullable).toEqual(true)
  })

  it('gets column primary key status', () => {
    expect(catalog.getColumn('c', 'person', 'id').isPrimaryKey).toEqual(true)
    expect(catalog.getColumn('c', 'person', 'name').isPrimaryKey).toEqual(false)
    expect(catalog.getColumn('c', 'person', 'about').isPrimaryKey).toEqual(false)
    expect(catalog.getColumn('c', 'compound_key', 'person_id_1').isPrimaryKey).toEqual(true)
    expect(catalog.getColumn('c', 'compound_key', 'person_id_2').isPrimaryKey).toEqual(true)
  })

  it('gets column descriptions', () => {
    expect(catalog.getColumn('c', 'person', 'id').description).toNotExist()
    expect(catalog.getColumn('c', 'person', 'name').description).toEqual('The person’s name')
    expect(catalog.getColumn('c', 'person', 'about').description).toNotExist()
    expect(catalog.getColumn('a', 'hello', 'world').description).toEqual('Hello, world!')
    expect(catalog.getColumn('b', 'yo', 'world').description).toNotExist()
    expect(catalog.getColumn('b', 'yo', 'constant').description).toEqual('This is constantly 2')
  })

  it('gets column types', () => {
    expect(catalog.getColumn('a', 'types', 'bigint').type).toEqual(20)
    expect(catalog.getColumn('a', 'types', 'boolean').type).toEqual(16)
    expect(catalog.getColumn('a', 'types', 'varchar').type).toEqual(1043)
  })

  it('gets enums', () => {
    expect(catalog.getEnum('a', 'letter')).toExist().toInclude({ name: 'letter' })
    expect(catalog.getEnum('b', 'color')).toExist().toInclude({ name: 'color' })
    expect(catalog.getEnum('c', 'does_not_exist')).toNotExist()
  })

  it('gets enum variants', () => {
    expect(catalog.getEnum('a', 'letter').variants).toEqual(['a', 'b', 'c', 'd'])
    expect(catalog.getEnum('b', 'color').variants).toEqual(['red', 'green', 'blue'])
  })

  it('will let a column get its enum type', () => {
    expect(catalog.getColumn('a', 'types', 'enum').getEnum()).toInclude({
      name: 'color',
      variants: ['red', 'green', 'blue'],
    })
  })
})

before(() => getClient().then(client => client.queryAsync(`
drop schema if exists a cascade;
drop schema if exists b cascade;
drop schema if exists c cascade;

create schema a;
create schema b;
create schema c;

comment on schema a is 'The a schema.';
comment on schema b is 'qwerty';

create table c.person (
  id serial primary key,
  name varchar not null,
  about text
);

create table c.compound_key (
  person_id_2 int references c.person(id),
  person_id_1 int references c.person(id),
  primary key (person_id_1, person_id_2)
);

comment on table c.person is 'Person test comment';
comment on column c.person.name is 'The person’s name';

create table a.hello (
  z_some int,
  world int,
  moon int not null,
  abc int,
  yoyo int
);

comment on column a.hello.world is 'Hello, world!';

create view b.yo as
  select
    world,
    moon,
    2 as constant
  from
    a.hello;

comment on view b.yo is 'YOYOYO!!';
comment on column b.yo.constant is 'This is constantly 2';

create type a.letter as enum ('a', 'b', 'c', 'd');
create type b.color as enum ('red', 'green', 'blue');

create table a.types (
  "bigint" bigint,
  "boolean" boolean,
  "varchar" varchar,
  "enum" b.color
);
`)))