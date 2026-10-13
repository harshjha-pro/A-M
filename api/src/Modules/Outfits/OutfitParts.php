<?php
declare(strict_types=1);

namespace AM\Modules\Outfits;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Modules\Tasks\TaskView;
use AM\Modules\Vault\AttachmentDef;
use AM\Repo\Refs;

/** Shared reads for outfits, steps and accessories: their notes, attachments and tasks (1.0.18). */
final class OutfitParts
{
    public const PERSONS = [
        'bride' => 'Bride', 'groom' => 'Groom', 'close_male' => 'Close family · Male', 'close_female' => 'Close family · Female',
        'extended_male' => 'Extended family · Male', 'extended_female' => 'Extended family · Female',
    ];
    /** The workspace section an outfit lives in. */
    public const SECTION = [
        'bride' => 'bride_outfit', 'groom' => 'groom_outfit', 'close_male' => 'family_outfit', 'close_female' => 'family_outfit',
        'extended_male' => 'family_outfit', 'extended_female' => 'family_outfit',
    ];
    public const DEFAULT_STEPS = ['Selected', 'Stitched', 'Trial done', 'Final approved'];
    /** target column on notes / attachment_links ⇄ tasks.target_type */
    public const TARGETS = ['outfit' => 'outfit_id', 'accessory' => 'accessory_id', 'outfit_step' => 'outfit_step_id'];

    /** @return list<array> */
    public static function notes(App $app, Db $db, Refs $refs, string $col, int $id): array
    {
        $rows = $db->all("SELECT * FROM notes WHERE `$col` = ? AND deleted_at IS NULL ORDER BY id DESC", [$id]);
        return array_map(static fn ($r) => NoteDef::present($app, $db, $refs, $r, null), $rows);
    }

    /** Attachments linked straight to this thing (not to its steps or accessories). @return list<array> */
    public static function attachments(App $app, Db $db, Refs $refs, string $col, int $id, ?array $viewer): array
    {
        $extra = $col === 'outfit_id' ? ' AND l.accessory_id IS NULL AND l.outfit_step_id IS NULL' : '';
        $rows = $db->all(
            "SELECT a.* FROM attachment_links l JOIN attachments a ON a.id = l.attachment_id
             WHERE l.`$col` = ? AND l.deleted_at IS NULL AND a.deleted_at IS NULL$extra ORDER BY l.id",
            [$id],
        );
        return array_map(static fn ($r) => AttachmentDef::present($app, $db, $refs, $r, $viewer), $rows);
    }

    /** @return list<array> */
    public static function tasks(App $app, Db $db, Refs $refs, string $type, int $id): array
    {
        $rows = $db->all("SELECT * FROM tasks WHERE target_type = ? AND target_id = ? AND deleted_at IS NULL ORDER BY status IN ('done','cancelled'), due_date IS NULL, due_date, id", [$type, $id]);
        return TaskView::summaries($app, $db, $refs, $rows);
    }

    /** The first photo on the moodboard, for cards. */
    public static function cover(Db $db, int $outfitId): ?string
    {
        $r = $db->one(
            "SELECT a.public_id, f.sha256 FROM attachment_links l JOIN attachments a ON a.id = l.attachment_id JOIN vault_files f ON f.id = a.file_id
             WHERE l.outfit_id = ? AND l.accessory_id IS NULL AND l.outfit_step_id IS NULL AND l.deleted_at IS NULL AND a.deleted_at IS NULL
               AND f.mime_type LIKE 'image/%' ORDER BY a.is_favourite DESC, l.id LIMIT 1",
            [$outfitId],
        );
        return $r === null ? null : '/api/v1/attachments/' . $r['public_id'] . '/file?v=' . substr((string) $r['sha256'], 0, 16);
    }
}
