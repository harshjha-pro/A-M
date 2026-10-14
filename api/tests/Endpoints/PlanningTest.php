<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiClient;
use Tests\Support\ApiTestCase;
use Tests\Support\Endpoint;

/**
 * Workspace step D (version 1.0.20): Contacts (vendors linked to workspaces, with a role; one
 * vendor in many workspaces; vendors already used here listed apart), Guest details (headcount of
 * the linked event + guest notes) and the Event timeline (purpose and duration required, time
 * optional with estimated times after it, note, attachments, tasks, move, suggested steps).
 */
final class PlanningTest extends ApiTestCase
{
    private const MEHNDI = '01JC0WS0000000000000000002';
    private const CARNIVAL = '01JC0WS0000000000000000003';
    private const RECEPTION = '01JC0WS0000000000000000006';
    private const MEHNDI_EVENT = '01M4DK5T3E6QZBMNQ0V7KQWW23';
    private const TENT_VENDOR = '01JA6ZB0000000000000000001';

    private function planning(ApiClient $c, string $ws): array
    {
        return $c->get("/workspaces/$ws")->assertStatus(200)->json('data.planning');
    }

    private function vendor(ApiClient $c, string $name, string $category = 'florist'): string
    {
        return $c->postJson('/vendors', ['name' => $name, 'category' => $category, 'phone' => '9414099887'])->assertStatus(201)->json('data.id');
    }

    #[Endpoint('POST /workspaces/{id}/contacts')]
    #[Endpoint('PATCH /workspace-contacts/{id}')]
    #[Endpoint('DELETE /workspace-contacts/{id}')]
    #[Endpoint('POST /workspace-contacts/{id}/restore')]
    public function test_contacts_are_vendors_linked_to_many_workspaces_with_a_role(): void
    {
        $c = $this->loginAs('mahi');
        $flowers = $this->vendor($c, 'Fresh Flowers Co.');
        $p = $c->postJson('/workspaces/' . self::MEHNDI . '/contacts', ['vendor_id' => $flowers, 'role' => 'Haldi and mehndi flowers'])->assertStatus(201)->json('data');
        $this->assertSame([['Fresh Flowers Co.', 'Florist', '+919414099887', 'Haldi and mehndi flowers']],
            array_map(static fn ($x) => [$x['vendor']['name'], $x['vendor']['category_label'], $x['vendor']['phone'], $x['role']], $p['contacts']));
        $c->postJson('/workspaces/' . self::RECEPTION . '/contacts', ['vendor_id' => $flowers])->assertStatus(201);
        $this->assertSame('This vendor is already a contact here.', $c->postJson('/workspaces/' . self::MEHNDI . '/contacts', ['vendor_id' => $flowers])->assertStatus(422)->json('error.fields.vendor_id'));
        $c->postJson('/workspaces/' . self::MEHNDI . '/contacts', new \stdClass())->assertStatus(422);
        $this->assertSame([['Mehndi', 'Haldi and mehndi flowers'], ['Reception', null]],
            array_map(static fn ($w) => [$w['name'], $w['role']], $c->get("/vendors/$flowers")->json('data.workspaces')), 'the vendor page lists its workspaces');

        $contact = $p['contacts'][0];
        $c->patchJson("/workspace-contacts/{$contact['id']}", ['role' => 'Flowers'], 1)->assertStatus(200);
        $d = $c->request('DELETE', "/workspace-contacts/{$contact['id']}", null, [], [], ['ifMatch' => 2])->assertStatus(200);
        $this->assertSame([], $this->planning($c, self::MEHNDI)['contacts']);
        $this->assertSame('Fresh Flowers Co.', $c->get("/vendors/$flowers")->json('data.name'), 'removing a contact only unlinks the vendor');
        $c->postJson('/undo/' . $d->json('meta.undo.batch_id'), new \stdClass())->assertStatus(200);
        $this->assertSame(['Flowers'], array_column($this->planning($c, self::MEHNDI)['contacts'], 'role'));
        foreach (['papa', 'mummy'] as $who) {
            $this->loginAs($who)->postJson('/workspaces/' . self::MEHNDI . '/contacts', ['vendor_id' => $flowers])->assertStatus(403);
        }
    }

    public function test_vendors_already_used_here_are_listed_apart_until_added(): void
    {
        $c = $this->loginAs('ayush');
        $ws = $c->get('/workspaces/' . self::MEHNDI)->json('data');
        $this->assertSame([], $ws['planning']['also_used']);
        $c->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => 'decor', 'title' => 'Stage', 'vendor_id' => self::TENT_VENDOR])->assertStatus(201);
        $c->patchJson('/workspaces/' . self::MEHNDI, ['caterer_id' => self::TENT_VENDOR], $ws['version'])->assertStatus(200);
        $also = $this->planning($c, self::MEHNDI)['also_used'];
        $this->assertSame([['Shree Tent House', ['Caterer', 'Stage']]], array_map(static fn ($x) => [$x['vendor']['name'], $x['where']], $also));
        $c->postJson('/workspaces/' . self::MEHNDI . '/contacts', ['vendor_id' => self::TENT_VENDOR])->assertStatus(201);
        $p = $this->planning($c, self::MEHNDI);
        $this->assertSame([[], ['Shree Tent House']], [$p['also_used'], array_map(static fn ($x) => $x['vendor']['name'], $p['contacts'])]);
    }

    public function test_guest_details_show_the_linked_event_headcount_and_guest_notes(): void
    {
        $mummy = $this->loginAs('mummy');
        $a = $mummy->postJson('/households', ['name' => 'Sharma family', 'side' => 'bride', 'adults' => 3, 'children' => 1, 'food' => 'jain', 'invite_event_ids' => [self::MEHNDI_EVENT]])->assertStatus(201)->json('data.id');
        $mummy->postJson('/households', ['name' => 'Gupta ji', 'side' => 'groom', 'adults' => 2, 'invite_event_ids' => [self::MEHNDI_EVENT]])->assertStatus(201);
        $mummy->patchJson("/households/$a/invitations/" . self::MEHNDI_EVENT, ['rsvp' => 'coming'], 1)->assertStatus(200);
        $c = $this->loginAs('mahi');
        $g = $this->planning($c, self::MEHNDI)['guests'];
        $this->assertSame(['Mehndi', 2, 1, 0, 1, 4, 3, 1, 4], [$g['event']['name'], $g['families_invited'], $g['families_coming'], $g['families_not_coming'], $g['families_waiting'],
            $g['people_coming'], $g['adults_coming'], $g['children_coming'], $g['jain_coming']]);
        $this->assertNull($this->planning($c, self::CARNIVAL)['guests'], 'Carnival has no calendar event');
        $ws = $c->get('/workspaces/' . self::MEHNDI)->json('data');
        $ws = $c->patchJson('/workspaces/' . self::MEHNDI, ['guest_notes' => "Nani ji: front row\nPickup from station at 4 pm"], $ws['version'])->assertStatus(200)->json('data');
        $this->assertSame("Nani ji: front row\nPickup from station at 4 pm", $ws['guest_notes']);
    }

    #[Endpoint('POST /workspaces/{id}/timeline')]
    #[Endpoint('PATCH /timeline-steps/{id}')]
    #[Endpoint('DELETE /timeline-steps/{id}')]
    #[Endpoint('POST /timeline-steps/{id}/restore')]
    #[Endpoint('POST /timeline-steps/{id}/move')]
    public function test_timeline_has_suggested_steps_estimated_times_move_and_delete(): void
    {
        $c = $this->loginAs('ayush');
        $t = $this->planning($c, self::RECEPTION)['timeline'];
        $this->assertSame(['Couple entry', 'Stage greetings and photos', 'Dinner', 'Send-off'], array_column($t['steps'], 'purpose'), 'suggested by migration 008');
        $this->assertSame([240, null], [$t['total_min'], $t['steps'][0]['starts']]);
        [$entry, $stage, $dinner] = $t['steps'];
        $c->patchJson("/timeline-steps/{$entry['id']}", ['start_time' => '19:30'], 1)->assertStatus(200);
        $t = $this->planning($c, self::RECEPTION)['timeline'];
        $this->assertSame([['19:30', false, '19:45'], ['19:45', true, '21:45'], ['21:45', true, '23:15'], ['23:15', true, '23:30']],
            array_map(static fn ($s) => [$s['starts'], $s['estimated'], $s['ends']], $t['steps']));
        $c->patchJson("/timeline-steps/{$dinner['id']}", ['start_time' => '22:00', 'duration_min' => 120], 1)->assertStatus(200);
        $t = $this->planning($c, self::RECEPTION)['timeline'];
        $this->assertSame([['22:00', false], ['00:00', true]], array_map(static fn ($s) => [$s['starts'], $s['estimated']], array_slice($t['steps'], 2)), 'past midnight wraps');
        $this->assertSame('Use a time like 19:30.', $c->patchJson("/timeline-steps/{$stage['id']}", ['start_time' => '7.30 pm'], 1)->assertStatus(422)->json('error.fields.start_time'));
        $this->assertSame('Enter minutes from 1 to 1440.', $c->patchJson("/timeline-steps/{$stage['id']}", ['duration_min' => 0], 1)->assertStatus(422)->json('error.fields.duration_min'));
        $c->postJson('/workspaces/' . self::RECEPTION . '/timeline', ['purpose' => 'Cake cutting'])->assertStatus(422);
        $c->postJson('/workspaces/' . self::RECEPTION . '/timeline', ['duration_min' => 10])->assertStatus(422);
        $p = $c->postJson('/workspaces/' . self::RECEPTION . '/timeline', ['purpose' => 'Cake cutting', 'duration_min' => 10, 'note' => 'Eggless'])->assertStatus(201)->json('data');
        $cake = $p['timeline']['steps'][4];
        $this->assertSame(['Cake cutting', 10, 'Eggless', null], [$cake['purpose'], $cake['duration_min'], $cake['note'], $cake['start_time']]);

        $p = $c->postJson("/timeline-steps/{$cake['id']}/move", ['direction' => 'up'])->assertStatus(200)->json('data');
        $this->assertSame(['Couple entry', 'Stage greetings and photos', 'Dinner', 'Cake cutting', 'Send-off'], array_column($p['timeline']['steps'], 'purpose'));
        $p = $c->postJson("/timeline-steps/{$entry['id']}/move", ['direction' => 'up'])->assertStatus(200)->json('data');
        $this->assertSame('Couple entry', $p['timeline']['steps'][0]['purpose'], 'the first step cannot go higher');
        $c->postJson("/timeline-steps/{$cake['id']}/move", ['direction' => 'sideways'])->assertStatus(422);

        $d = $c->request('DELETE', "/timeline-steps/{$cake['id']}", null, [], [], ['ifMatch' => $p['timeline']['steps'][3]['version']])->assertStatus(200);
        $this->assertSame('Deleted Cake cutting', $d->json('meta.undo.summary'));
        $c->postJson("/timeline-steps/{$cake['id']}/restore", new \stdClass(), [], ['ifMatch' => $p['timeline']['steps'][3]['version'] + 1])->assertStatus(200);
        $this->assertCount(5, $this->planning($c, self::RECEPTION)['timeline']['steps']);
        $this->assertStringContainsString('changed Time from no time to 19:30', implode("\n", array_column($c->get("/timeline-steps/{$entry['id']}/history")->json('data'), 'sentence')));
        $this->loginAs('papa')->postJson('/workspaces/' . self::RECEPTION . '/timeline', ['purpose' => 'X', 'duration_min' => 5])->assertStatus(403);
    }

    #[Endpoint('POST /workspaces/{id}/timeline/suggested')]
    public function test_suggested_steps_for_a_new_workspace_and_step_attachments_and_tasks(): void
    {
        $c = $this->loginAs('mahi');
        $ws = $c->postJson('/workspaces', ['name' => 'Haldi'])->assertStatus(201)->json('data.id');
        $this->assertSame([], $this->planning($c, $ws)['timeline']['steps'], 'a new workspace starts empty, with the button');
        $key = 'b5c2c3e4-0000-4000-8000-000000000081';
        $p = $c->postJson("/workspaces/$ws/timeline/suggested", new \stdClass(), ['Idempotency-Key' => $key])->assertStatus(201)->json('data');
        $this->assertSame(['Guests arrive', 'Main ceremony', 'Food'], array_column($p['timeline']['steps'], 'purpose'));
        $this->assertCount(3, $c->postJson("/workspaces/$ws/timeline/suggested", new \stdClass(), ['Idempotency-Key' => $key])->assertStatus(201)->json('data.timeline.steps'), 'a retry replays the first reply and adds nothing');
        $this->assertSame('The timeline already has steps.', $c->postJson("/workspaces/$ws/timeline/suggested", new \stdClass())->assertStatus(409)->json('error.message'));

        $step = $p['timeline']['steps'][1];
        $a = $c->postJson('/attachments', ['kind' => 'link', 'url' => 'https://example.com/puja', 'title' => 'Puja list', 'timeline_step_id' => $step['id']])->assertStatus(201)->json('data');
        $this->assertSame('Haldi › Event timeline › Main ceremony', $a['used_in'][0]['path']);
        $task = $c->postJson('/tasks', ['title' => 'Book pandit ji', 'timeline_step_id' => $step['id']])->assertStatus(201)->json('data');
        $this->assertSame(['timeline_step', 'Main ceremony', $ws, 'timeline'], [$task['target']['type'], $task['target']['name'], $task['target']['workspace_id'], $task['workspace_section']]);
        $step = $this->planning($c, $ws)['timeline']['steps'][1];
        $this->assertSame([['Puja list'], ['Book pandit ji']], [array_column($step['attachments'], 'title'), array_column($step['tasks'], 'title')]);
        $this->assertSame([], $c->get("/workspaces/$ws")->json('data.boards.decor'));
    }
}
