<?php
declare(strict_types=1);

namespace AM\Modules\Events;

use AM\Db\Db;
use AM\Kernel\App;
use AM\Repo\EntityDef;
use AM\Repo\Refs;

/**
 * A family invited to an event (household_events). Deleted and restored with its
 * event in the same batch (FEATURES B4). Its own screens and History lines arrive
 * with Guests (Session 8); until then the event's line describes it.
 */
final class InvitationDef extends EntityDef
{
    public const TABLE = 'household_events';
    public const TYPE = 'invitation';
    public const LABEL = 'invitation';
    public const LABEL_PLURAL = 'invitations';
    public const PUBLIC_ID = false;
    public const KEY = null;
    public const IN_ACTIVITY = false;
    public const PARENT = [EventDef::class, 'event_id'];

    public static function name(array $row): string
    {
        return 'invitation';
    }

    public static function present(App $app, Db $db, Refs $refs, array $row, ?array $viewer): array
    {
        return [];
    }
}
