<?php
declare(strict_types=1);

namespace Tests\Endpoints;

use Tests\Support\ApiTestCase;
use Tests\Support\TestDb;

/**
 * 1.0.21 — the owner's report (screenshot): Workspace showed "Something went wrong on our side"
 * on a database where the newer migrations were not imported yet. Now the app says what to do.
 * Also: Workspaces are visible to everyone for now; private documents in the Vault stay private.
 */
final class WorkspaceAccessTest extends ApiTestCase
{
    private const MEHNDI = '01JC0WS0000000000000000002';

    /** Proven to fail before the fix: 500 server_error "Something went wrong on our side". */
    public function test_a_missing_table_says_which_migrations_to_import_instead_of_something_went_wrong(): void
    {
        $pdo = TestDb::connect();
        $pdo->exec('RENAME TABLE timeline_steps TO timeline_steps_hidden');
        $pdo->exec('UPDATE schema_migrations SET finished_at = NULL WHERE version = 8'); // as if 008 was never run
        $pdo->exec('DELETE FROM schema_migrations WHERE version = 8');
        try {
            $r = $this->loginAs('mahi')->get('/workspaces/' . self::MEHNDI)->assertStatus(503);
            $this->assertSame('db_update_needed', $r->json('error.code'));
            $this->assertSame('The database needs an update before this works: import migrations 008 to 008 in phpMyAdmin, in order. Nothing was saved.', $r->json('error.message'));
            $this->loginAs('ayush')->postJson('/tasks', ['title' => 'Still works'])->assertStatus(201); // the rest of the app keeps working
        } finally {
            $pdo->exec('RENAME TABLE timeline_steps_hidden TO timeline_steps');
            $pdo->exec("INSERT INTO schema_migrations (version, name, applied_by, finished_at) VALUES (8, '008_contacts_timeline', 'test', CURRENT_TIMESTAMP)");
        }
    }

    public function test_health_expects_the_newest_migration(): void
    {
        $this->assertSame(8, \AM\Kernel\AppInfo::EXPECTED_SCHEMA_VERSION, 'bump this with every new migration');
        $files = glob(TestDb::root() . '/db/migrations/*.sql');
        $this->assertSame(sprintf('%03d', \AM\Kernel\AppInfo::EXPECTED_SCHEMA_VERSION), substr(basename(end($files)), 0, 3));
    }

    public function test_everyone_sees_workspaces_family_edits_viewer_only_views(): void
    {
        $nani = $this->loginAs('nani');
        $this->assertSame('Mehndi', $nani->get('/workspaces/' . self::MEHNDI)->assertStatus(200)->json('data.name'));
        $nani->postJson('/workspaces/' . self::MEHNDI . '/timeline', ['purpose' => 'X', 'duration_min' => 5])->assertStatus(403);
        $papa = $this->loginAs('papa');
        $papa->postJson('/workspaces/' . self::MEHNDI . '/timeline', ['purpose' => 'Haldi rasam', 'duration_min' => 30])->assertStatus(201);
        $papa->postJson('/outfits', ['workspace_id' => self::MEHNDI, 'person' => 'close_male', 'title' => 'Papa – Safa'])->assertStatus(201);
    }

    public function test_private_documents_stay_private_in_the_vault(): void
    {
        $ayush = $this->loginAs('ayush');
        $pdf = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n";
        $secret = $ayush->upload('/documents', $pdf, 'agreement.pdf', ['type' => 'contract', 'title' => 'Venue agreement', 'is_private' => 'true'])->assertStatus(201)->json('data.id');
        $open = $ayush->upload('/documents', $pdf . '%open', 'menu.pdf', ['type' => 'other', 'title' => 'Menu card'])->assertStatus(201)->json('data.id');
        $titles = static fn ($c) => array_column($c->get('/attachments', ['kind' => 'document'])->json('data'), 'title');
        $this->assertContains('Venue agreement', $titles($ayush));
        $papa = $this->loginAs('papa');
        $this->assertNotContains('Venue agreement', $titles($papa));
        $this->assertContains('Menu card', $titles($papa));
        $att = TestDb::connect()->query("SELECT a.public_id FROM attachments a JOIN documents d ON d.id = a.document_id WHERE d.public_id = '$secret'")->fetchColumn();
        $papa->get("/attachments/$att")->assertStatus(404);
        $papa->get("/attachments/$att/file")->assertStatus(404);
        $ayush->get("/attachments/$att")->assertStatus(200);
        $this->assertNotEmpty($open);
    }
}
