<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * Workspace step C (version 1.0.19): family outfits (four groups), Theme & decoration (theme
 * name / colours, decor items with their own timeline, vendor, moodboard, props, notes, tasks)
 * and the Menu (categories, dishes Normal or Jain with ⭐ and a note, attachments, tasks, the
 * caterer, and copy a menu from another workspace with one Undo).
 */
final class DecorMenuTest extends ApiTestCase
{
    private const MEHNDI = '01JC0WS0000000000000000002';
    private const RECEPTION = '01JC0WS0000000000000000006';
    private const TENT_VENDOR = '01JA6ZB0000000000000000001';

    private function menu(ApiClient $c, string $ws): array
    {
        return $c->get("/workspaces/$ws/menu")->assertStatus(200)->json('data');
    }

    public function test_family_outfits_in_four_groups(): void
    {
        $c = $this->loginAs('mahi');
        foreach (['close_female' => 'Mausi ji – Bandhej saree', 'close_male' => 'Mama ji – Safa', 'extended_female' => 'Cousins – Lehenga', 'extended_male' => 'Cousins – Kurta'] as $person => $title) {
            $o = $c->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => $person, 'title' => $title])->assertStatus(201)->json('data');
            $this->assertSame(['family_outfit', ['Selected', 'Stitched', 'Trial done', 'Final approved']], [$o['section'], array_column($o['steps'], 'name')]);
        }
        $ws = $c->get('/workspaces/' . self::MEHNDI)->json('data');
        $this->assertSame(['close_female', 'close_male', 'extended_female', 'extended_male'], array_column($ws['outfits'], 'person'));
        $this->assertSame('Close family · Female', $ws['outfits'][0]['person_label']);
    }

    #[Endpoint('PATCH /workspaces/{id}')]
    public function test_decor_item_has_its_own_timeline_vendor_props_and_the_theme_is_on_the_workspace(): void
    {
        $c = $this->loginAs('ayush');
        $ws = $c->get('/workspaces/' . self::MEHNDI)->json('data');
        $this->assertSame([null, null, null], [$ws['theme_name'], $ws['theme_colours'], $ws['caterer']]);
        $ws = $c->patchJson('/workspaces/' . self::MEHNDI, ['theme_name' => 'Garden mehndi', 'theme_colours' => 'Pastel green, gold'], $ws['version'])->assertStatus(200)->json('data');
        $this->assertSame(['Garden mehndi', 'Pastel green, gold'], [$ws['theme_name'], $ws['theme_colours']]);

        $d = $c->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => 'decor', 'title' => 'Stage', 'vendor_id' => self::TENT_VENDOR])->assertStatus(201)->json('data');
        $this->assertSame(['decor', 'Decor', 'decor'], [$d['person'], $d['person_label'], $d['section']]);
        $this->assertSame(['Booked', 'Sample seen', 'Final approved', 'Set up'], array_column($d['steps'], 'name'));
        $this->assertSame('Shree Tent House', $d['vendor']['name']);
        $d = $c->postJson("/outfits/{$d['id']}/accessories", ['name' => 'Marigold strings'])->assertStatus(201)->json('data');
        $this->assertSame('Marigold strings', $d['accessories'][0]['name']);
        $task = $c->postJson('/tasks', ['title' => 'Confirm stage size', 'accessory_id' => $d['accessories'][0]['id']])->assertStatus(201)->json('data');
        $this->assertSame([self::MEHNDI, 'decor'], [$task['workspace']['id'], $task['workspace_section']]);
        $a = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/stage', 'title' => 'Stage idea', 'outfit_id' => $d['id']])->assertStatus(201)->json('data');
        $this->assertSame('Mehndi › Theme & decoration › Stage', $a['used_in'][0]['path']);
        $theme = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/garden', 'title' => 'Garden look', 'workspace_id' => self::MEHNDI, 'section' => 'decor'])->assertStatus(201)->json('data');
        $boards = $c->get('/workspaces/' . self::MEHNDI)->json('data.boards');
        $this->assertSame([[$theme['id']], []], [array_column($boards['decor'], 'id'), $boards['menu']], 'the theme board has only the section\'s own attachments, not the Stage\'s');
        $d = $c->patchJson("/outfits/{$d['id']}", ['vendor_id' => null], $d['version'])->assertStatus(200)->json('data');
        $this->assertNull($d['vendor']);
        $c->patchJson("/outfits/{$d['id']}", ['vendor_id' => '01JA6ZB0000000000000000999'], $d['version'])->assertStatus(422);
        $this->loginAs('papa')->patchJson('/workspaces/' . self::MEHNDI, ['theme_name' => 'X'], $ws['version'])->assertStatus(403);
    }

    #[Endpoint('GET /workspaces/{id}/menu')]
    #[Endpoint('POST /workspaces/{id}/menu-categories')]
    #[Endpoint('POST /menu-categories/{id}/items')]
    #[Endpoint('PATCH /menu-categories/{id}')]
    #[Endpoint('PATCH /menu-items/{id}')]
    public function test_menu_categories_and_dishes_normal_or_jain_with_caterer(): void
    {
        $c = $this->loginAs('mahi');
        $this->assertSame([], $this->menu($c, self::RECEPTION)['categories']);
        $m = $c->postJson('/workspaces/' . self::RECEPTION . '/menu-categories', ['name' => 'Starters'])->assertStatus(201)->json('data');
        $c->postJson('/workspaces/' . self::RECEPTION . '/menu-categories', ['name' => 'Desserts'])->assertStatus(201);
        $cat = $m['categories'][0];
        $m = $c->postJson("/menu-categories/{$cat['id']}/items", ['name' => 'Paneer tikka'])->assertStatus(201)->json('data');
        $m = $c->postJson("/menu-categories/{$cat['id']}/items", ['name' => 'Hara bhara kabab', 'diet' => 'jain', 'is_must_have' => true, 'note' => 'No onion, no garlic'])->assertStatus(201)->json('data');
        $items = $m['categories'][0]['items'];
        $this->assertSame([['Paneer tikka', 'normal', false, null], ['Hara bhara kabab', 'jain', true, 'No onion, no garlic']],
            array_map(static fn ($i) => [$i['name'], $i['diet'], $i['is_must_have'], $i['note']], $items));
        $this->assertSame(['items' => 2, 'jain' => 1], $m['counts']);
        $c->postJson("/menu-categories/{$cat['id']}/items", ['name' => 'Fish fry', 'diet' => 'non_veg'])->assertStatus(422);
        $i = $c->patchJson("/menu-items/{$items[0]['id']}", ['diet' => 'jain'], 1)->assertStatus(200)->json('data');
        $this->assertSame('jain', $i['diet']);
        $c->patchJson("/menu-items/{$items[0]['id']}", ['sort_order' => 30], 2)->assertStatus(200);
        $this->assertSame(['Hara bhara kabab', 'Paneer tikka'], array_column($this->menu($c, self::RECEPTION)['categories'][0]['items'], 'name'));
        $c->patchJson("/menu-categories/{$cat['id']}", ['name' => 'Live counters & starters'], 1)->assertStatus(200);
        $ws = $c->get('/workspaces/' . self::RECEPTION)->json('data');
        $c->patchJson('/workspaces/' . self::RECEPTION, ['caterer_id' => self::TENT_VENDOR], $ws['version'])->assertStatus(200);
        $ws = $c->get('/workspaces/' . self::RECEPTION)->json('data');
        $this->assertSame(['Shree Tent House', 'Shree Tent House', 'Live counters & starters'], [$ws['caterer']['name'], $ws['menu']['caterer']['name'], $ws['menu']['categories'][0]['name']]);
        $this->assertStringContainsString('changed Normal / Jain from Normal to Jain', implode("\n", array_column($c->get("/menu-items/{$items[0]['id']}/history")->json('data'), 'sentence')));
        foreach (['papa', 'mummy'] as $who) {
            $this->loginAs($who)->get('/workspaces/' . self::RECEPTION . '/menu')->assertStatus(403);
            $this->loginAs($who)->postJson("/menu-categories/{$cat['id']}/items", ['name' => 'X'])->assertStatus(403);
        }
    }

    #[Endpoint('DELETE /menu-categories/{id}')]
    #[Endpoint('POST /menu-categories/{id}/restore')]
    #[Endpoint('DELETE /menu-items/{id}')]
    #[Endpoint('POST /menu-items/{id}/restore')]
    public function test_dish_attachments_and_tasks_delete_category_with_its_dishes_undo(): void
    {
        $c = $this->loginAs('ayush');
        $cat = $c->postJson('/workspaces/' . self::RECEPTION . '/menu-categories', ['name' => 'Main course'])->json('data.categories.0');
        $dish = $c->postJson("/menu-categories/{$cat['id']}/items", ['name' => 'Dal makhani'])->json('data.categories.0.items.0');
        $a = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/dal', 'title' => 'Dal photo', 'menu_item_id' => $dish['id']])->assertStatus(201)->json('data');
        $this->assertSame('Reception › Menu › Dal makhani', $a['used_in'][0]['path']);
        $t = $c->postJson('/tasks', ['title' => 'Taste dal', 'menu_item_id' => $dish['id']])->assertStatus(201)->json('data');
        $this->assertSame(['menu_item', 'Dal makhani', null, self::RECEPTION, 'menu'], [$t['target']['type'], $t['target']['name'], $t['target']['outfit_id'], $t['target']['workspace_id'], $t['workspace_section']]);
        $dish = $this->menu($c, self::RECEPTION)['categories'][0]['items'][0];
        $this->assertSame([['Dal photo'], ['Taste dal']], [array_column($dish['attachments'], 'title'), array_column($dish['tasks'], 'title')]);
        $c->postJson('/notes', ['menu_item_id' => $dish['id'], 'body' => 'x'])->assertStatus(422); // a dish has its own note field

        $d = $c->request('DELETE', "/menu-items/{$dish['id']}", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame([], $this->menu($c, self::RECEPTION)['categories'][0]['items']);
        $this->assertSame([], $c->get("/attachments/{$a['id']}")->json('data.used_in'), 'the link went with the dish');
        $c->postJson("/menu-items/{$dish['id']}/restore", new \stdClass(), [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertCount(1, $c->get("/attachments/{$a['id']}")->json('data.used_in'));

        $d = $c->request('DELETE', "/menu-categories/{$cat['id']}", null, [], [], ['ifMatch' => 1])->assertStatus(200);
        $this->assertSame('Deleted Main course', $d->json('meta.undo.summary'));
        $this->assertSame([], $this->menu($c, self::RECEPTION)['categories']);
        $c->postJson('/undo/' . $d->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(['Dal makhani'], array_column($this->menu($c, self::RECEPTION)['categories'][0]['items'], 'name'));
        $this->assertSame("todo", $c->get("/tasks/{$t["id"]}")->json("data.status"), "tasks stay");
    }

    #[Endpoint('POST /workspaces/{id}/menu/copy')]
    public function test_copy_a_menu_merges_by_category_skips_dishes_already_there_and_one_undo_takes_it_back(): void
    {
        $c = $this->loginAs('mahi');
        $from = self::RECEPTION;
        $to = self::MEHNDI;
        $starters = $c->postJson("/workspaces/$from/menu-categories", ['name' => 'Starters'])->json('data.categories.0.id');
        $c->postJson("/menu-categories/$starters/items", ['name' => 'Paneer tikka', 'diet' => 'jain', 'is_must_have' => true, 'note' => 'Less spicy']);
        $c->postJson("/menu-categories/$starters/items", ['name' => 'Dahi kabab']);
        $sweets = $c->postJson("/workspaces/$from/menu-categories", ['name' => 'Desserts'])->json('data.categories.1.id');
        $c->postJson("/menu-categories/$sweets/items", ['name' => 'Moong dal halwa']);
        // Mehndi already has Starters with Dahi kabab.
        $here = $c->postJson("/workspaces/$to/menu-categories", ['name' => 'Starters'])->json('data.categories.0.id');
        $c->postJson("/menu-categories/$here/items", ['name' => 'dahi kabab']);

        $c->postJson("/workspaces/$to/menu/copy", ['from_workspace_id' => $to])->assertStatus(422);
        $c->postJson("/workspaces/$to/menu/copy", new \stdClass())->assertStatus(422);
        $key = 'b5c2c3e4-0000-4000-8000-000000000071';
        $r = $c->postJson("/workspaces/$to/menu/copy", ['from_workspace_id' => $from], ['Idempotency-Key' => $key])->assertStatus(200);
        $this->assertSame(3, $r->json('data.copied'), 'Paneer tikka, the Desserts category and Moong dal halwa');
        $cats = $r->json('data.categories');
        $this->assertSame([['Starters', ['dahi kabab', 'Paneer tikka']], ['Desserts', ['Moong dal halwa']]],
            array_map(static fn ($x) => [$x['name'], array_column($x['items'], 'name')], $cats));
        $this->assertSame(['jain', true, 'Less spicy'], [$cats[0]['items'][1]['diet'], $cats[0]['items'][1]['is_must_have'], $cats[0]['items'][1]['note']]);
        $this->assertSame('Menu copied from Reception', $r->json('meta.undo.summary'));
        $again = $c->postJson("/workspaces/$to/menu/copy", ['from_workspace_id' => $from], ['Idempotency-Key' => $key])->assertStatus(200);
        $this->assertSame(3, $again->json('data.counts.items'), 'a retry copies nothing twice');
        $this->assertSame(0, $c->postJson("/workspaces/$to/menu/copy", ['from_workspace_id' => $from])->assertStatus(200)->json('data.copied'), 'nothing new to copy');

        $c->postJson('/undo/' . $r->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame([['Starters', ['dahi kabab']]], array_map(static fn ($x) => [$x['name'], array_column($x['items'], 'name')], $this->menu($c, $to)['categories']));
        $this->assertCount(3, array_merge(...array_map(static fn ($x) => $x['items'], $this->menu($c, $from)['categories'])), 'the original menu is untouched');
    }
}
