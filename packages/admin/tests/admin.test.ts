import { describe, it, expect, beforeEach } from 'vitest';
import { AdminResource, AdminPanel } from '../src/index.js';
import type { AdminAction } from '../src/index.js';

describe('@formwork/admin: AdminResource', () => {
  let resource: AdminResource;

  beforeEach(() => {
    resource = new AdminResource({ name: 'users', label: 'User', icon: 'users' });
    resource.id();
    resource.text('name', 'Full Name').required();
    resource.email('email').required();
    resource.select('role', [
      { label: 'Admin', value: 'admin' },
      { label: 'User', value: 'user' },
    ]);
    resource.boolean('active', 'Is Active');
    resource.timestamps();
    resource.perPage(20).defaultSort('name', 'asc').search('name', 'email');
  });

  it('defines fields', () => {
    expect(resource.getFields().length).toBeGreaterThanOrEqual(6);
  });

  it('id field hidden on create/edit', () => {
    const id = resource.getFields().find((f) => f.name === 'id')!;
    expect(id.showOnCreate).toBe(false);
    expect(id.showOnEdit).toBe(false);
    expect(id.showOnIndex).toBe(true);
  });

  it('text fields are searchable and sortable', () => {
    const name = resource.getFields().find((f) => f.name === 'name')!;
    expect(name.sortable).toBe(true);
    expect(name.searchable).toBe(true);
    expect(name.required).toBe(true);
  });

  it('select field has options and is filterable', () => {
    const role = resource.getFields().find((f) => f.name === 'role')!;
    expect(role.options).toHaveLength(2);
    expect(role.filterable).toBe(true);
  });

  it('timestamps hidden on create/edit', () => {
    const createdAt = resource.getFields().find((f) => f.name === 'created_at')!;
    expect(createdAt.showOnCreate).toBe(false);
    expect(createdAt.showOnEdit).toBe(false);
  });

  it('getIndexFields() excludes hidden', () => {
    const indexFields = resource.getIndexFields();
    expect(indexFields.every((f) => f.showOnIndex)).toBe(true);
  });

  it('getCreateFields() excludes id and timestamps', () => {
    const createFields = resource.getCreateFields();
    expect(createFields.find((f) => f.name === 'id')).toBeUndefined();
    expect(createFields.find((f) => f.name === 'created_at')).toBeUndefined();
  });

  it('config: perPage, defaultSort, search', () => {
    expect(resource.getPerPage()).toBe(20);
    expect(resource.getDefaultSort()).toEqual({ field: 'name', direction: 'asc' });
    expect(resource.getSearchColumns()).toEqual(['name', 'email']);
  });

  it('getSortableFields()', () => {
    const sortable = resource.getSortableFields();
    expect(sortable.some((f) => f.name === 'name')).toBe(true);
    expect(sortable.some((f) => f.name === 'id')).toBe(true);
  });

  it('computed fields', () => {
    resource.computed('fullInfo', (r) => `${r['name']} (${r['email']})`, 'Full Info');
    const field = resource.getFields().find((f) => f.name === 'fullInfo')!;
    expect(field.type).toBe('computed');
    expect(field.computeFn!({ name: 'Alice', email: 'a@b.com' })).toBe('Alice (a@b.com)');
    expect(field.showOnCreate).toBe(false);
  });

  it('belongsTo field', () => {
    resource.belongsTo('department_id', 'departments', 'Department');
    const field = resource.getFields().find((f) => f.name === 'department_id')!;
    expect(field.type).toBe('belongsTo');
    expect(field.relatedResource).toBe('departments');
  });

  it('actions', () => {
    const action: AdminAction = {
      name: 'deactivate', label: 'Deactivate', bulk: true, destructive: true,
      confirmMessage: 'Are you sure?',
      handler: async (records) => ({ success: true, message: `Deactivated ${records.length} users.` }),
    };
    resource.action(action);

    expect(resource.getActions()).toHaveLength(1);
    expect(resource.getBulkActions()).toHaveLength(1);
    expect(resource.getActions()[0].destructive).toBe(true);
  });

  it('action handler executes', async () => {
    resource.action({
      name: 'activate', label: 'Activate', bulk: true,
      handler: async (records) => ({ success: true, message: `Activated ${records.length}.` }),
    });
    const result = await resource.getActions()[0].handler([{ id: 1 }, { id: 2 }], {});
    expect(result.success).toBe(true);
    expect(result.message).toContain('2');
  });

  it('filters', () => {
    resource.filter({
      name: 'status', label: 'Status', type: 'select',
      options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }],
      apply: (query, value) => query,
    });
    expect(resource.getFilters()).toHaveLength(1);
  });
});

describe('@formwork/admin: AdminPanel', () => {
  let panel: AdminPanel;

  beforeEach(() => {
    panel = new AdminPanel();

    const users = new AdminResource({ name: 'users', label: 'User', icon: 'users' });
    users.id();
    users.text('name');
    users.email('email');

    const posts = new AdminResource({ name: 'posts', label: 'Post', icon: 'file-text' });
    posts.id();
    posts.text('title');
    posts.textarea('body');

    panel.register(users).register(posts);
  });

  it('registers and retrieves resources', () => {
    expect(panel.hasResource('users')).toBe(true);
    expect(panel.hasResource('posts')).toBe(true);
    expect(panel.hasResource('nope')).toBe(false);
    expect(panel.getResourceNames()).toEqual(['users', 'posts']);
  });

  it('getResource()', () => {
    const r = panel.getResource('users')!;
    expect(r.label).toBe('User');
    expect(r.getFields().some((f) => f.name === 'email')).toBe(true);
  });

  it('autoNav() generates navigation from resources', () => {
    panel.autoNav();
    const nav = panel.getNavigation();
    expect(nav).toHaveLength(2);
    expect(nav[0].label).toBe('Users');
    expect(nav[0].route).toBe('/admin/users');
    expect(nav[1].route).toBe('/admin/posts');
  });

  it('custom navigation', () => {
    panel.nav([
      { label: 'Dashboard', icon: 'home', route: '/admin' },
      { label: 'Content', children: [
        { label: 'Posts', resource: 'posts' },
        { label: 'Pages', resource: 'pages' },
      ]},
    ]);
    expect(panel.getNavigation()).toHaveLength(2);
    expect(panel.getNavigation()[1].children).toHaveLength(2);
  });

  it('dashboard widgets', async () => {
    panel.widget({ name: 'total_users', label: 'Total Users', type: 'stat', resolve: async () => 1234 });
    panel.widget({ name: 'recent_posts', label: 'Recent Posts', type: 'table', resolve: async () => [{ id: 1, title: 'Hello' }] });

    const data = await panel.resolveDashboard();
    expect(data.get('total_users')).toBe(1234);
    expect(data.get('recent_posts')).toHaveLength(1);
  });

  it('setPath()', () => {
    panel.setPath('/backend');
    expect(panel.getPath()).toBe('/backend');
    panel.autoNav();
    expect(panel.getNavigation()[0].route).toBe('/backend/users');
  });
});
