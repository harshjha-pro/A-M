<?php
declare(strict_types=1);

namespace AM\Kernel;

/**
 * Every user-visible message the API sends (IMPLEMENTATION §2.5 rule 6).
 * Keys are the stable error codes of API.md §2.3; Hindi can be added later
 * without touching any other file. Placeholders look like {n}.
 */
final class Strings
{
    private const EN = [
        'bad_request'              => 'Something in the request was wrong. Please close and reopen the app.',
        'bad_cursor'               => 'This list changed. Pull down to refresh.',
        'not_logged_in'            => 'Please log in again.',
        'session_ended'            => 'You were logged out. Please log in again.',
        'login_failed'             => 'Phone or password is wrong.',
        'forbidden'                => "You don't have permission to do this.",
        'csrf_failed'              => 'Please refresh the app and try again.',
        'no_money_access'          => 'You no longer have access to Money.',
        'access_ended'             => 'Your access has ended. Ask Ayush or Mahi.',
        'undo_expired'             => 'Too late to undo here. Ask Ayush or Mahi to restore it from Deleted items.',
        'purge_not_allowed_yet'    => "Deleted items can't be removed for good before 16 May 2027.",
        'not_found'                => "This item doesn't exist or was removed.",
        'method_not_allowed'       => "This action isn't allowed here. Please close and reopen the app.",
        'version_conflict'         => '{name} changed this at {time} while you were editing.',
        'record_deleted'           => '{name} deleted this at {time}.',
        'duplicate_found'          => 'Already on the list: {name}.',
        'request_in_progress'      => 'Still saving your last change. Please wait a moment.',
        'link_invalid'             => 'This link has expired or was already used. Ask Ayush or Mahi for a new one.',
        'export_expired'           => 'This export has expired. Please make a new one.',
        'body_too_big'             => 'This is too much to send at once. Please try a smaller change.',
        'file_too_big'             => 'This file is too big ({size}). Max 10 MB.',
        'file_type_not_allowed'    => 'Only photos (JPEG, PNG, WebP) and PDFs can be saved.',
        'validation_failed'        => 'Please fix {n} things below.',
        'validation_failed_one'    => 'Please fix 1 thing below.',
        'rule_blocked'             => "This can't be done right now.",
        'checksum_mismatch'        => "The file didn't arrive complete. Please try again.",
        'idempotency_key_reused'   => "This save doesn't match the first try. Please try again.",
        'update_required'          => 'Please close and reopen the app to get the latest version.',
        'version_required'         => 'Please refresh and try again.',
        'idempotency_key_required' => 'Please refresh and try again.',
        'rate_limited'             => 'Too many tries. Please wait {n} minutes.',
        'login_locked'             => 'Too many tries. Wait 15 minutes or ask Ayush or Mahi to reset your password.',
        'server_error'             => 'Something went wrong on our side. Nothing was saved. Please try again.',
        'app_updating'             => 'The app is being updated. Please try again in a few minutes.',
        'service_unavailable'      => 'The server is busy. Please try again in a minute.',
        'not_available_yet'        => 'This part of the app is not ready yet.',
        // field messages
        'field_required'           => 'Please fill this in.',
        'field_too_long'           => 'Too long. Use at most {max} characters.',
        'field_bad_text'           => 'Please type plain text here.',
        'field_bad_datetime'       => 'Use a date and time like 2026-10-08T09:12:31Z.',
        'field_not_allowed'        => "This can't be changed here.",
        'field_bad_bool'           => 'Choose yes or no.',
        'field_bad_choice'         => 'Choose one of the options.',
        'field_bad_date'           => 'Pick a date.',
        'field_bad_amount'         => 'Enter an amount, like 50000 or 1.25 lakh.',
        'field_bad_phone'          => 'Enter a 10-digit mobile number.',
        'field_bad_email'          => 'Enter an email address, like name@gmail.com.',
        'field_date_past'          => 'Pick today or a later date.',
        'field_date_future'        => 'Pick today or an earlier date.',
        'field_end_before_start'   => 'End date must be on or after the start date.',
        'field_money_admin'        => 'Ayush, Mahi and partners always see money.',
        'password_rules'           => 'Choose at least 6 letters or numbers. Not your phone number.',
        'password_too_common'      => 'This password is too easy to guess. Choose another.',
        'password_current_wrong'   => "That isn't your current password.",
        // auth
        'setup_done'               => 'The app is already set up. Please log in.',
        'member_duplicate'         => 'Already a member: {name}.',
        'owner_locked'             => "The Owner's role and access can't be changed.",
        'last_admin'               => 'There must always be at least one active admin.',
        'not_self'                 => "You can't do this to your own account. Use My account.",
        'self_name_only'           => 'You can only change your own name here.',
        'undo_not_yours'           => 'Only the person who did this can undo it. Ask Ayush or Mahi to restore it from Deleted items.',
        'undo_done'                => 'Undone.',
        'already_undone'           => 'This was already undone.',
        'already_restored'         => 'Already restored.',
        // tasks (Session 5)
        'task_duplicate'           => 'A similar task exists: {name}',
        'task_delete_own'          => 'You can delete only tasks you added or that are yours.',
        'already_done'             => 'Already done by {name}.',
        'field_bad_time'           => 'Pick a time, like 18:00.',
        'field_time_needs_date'    => 'Pick a date first.',
        'field_too_many'           => 'Choose at most {max}.',
        'field_bad_member'         => 'Choose people who are active members.',
        'field_bad_link'           => "This item doesn't exist or was removed.",
        'event_duplicate'          => '{name} is already on {date}. Add anyway?',
        'field_end_before_start_time' => 'End time must be after the start time.',
        'field_https_only'         => 'Paste a link that starts with https://',
        'calendar_range_too_long'  => 'Pick at most 93 days at a time.',
        'household_duplicate'      => 'Already on the list: {name} ({side}, added by {who})',
        'field_people_min'         => 'Add at least 1 person.',
        'field_jain_too_many'      => 'Jain people can be at most the family total.',
        'field_bad_number'         => 'Enter a number from {min} to {max}.',
        'event_no_guests'          => "This event doesn't take guest invitations.",
        'rsvp_needs_event'         => 'Pick an event to filter by Coming?.',
        'restore_phone_clash'      => '{name} has the same phone as {other}. Check for a duplicate.',
        'tag_name_taken'           => 'A tag called {name} already exists. Rename that one first.',
    ];

    /** @param array<string,string|int> $vars */
    public static function get(string $key, array $vars = []): string
    {
        $text = self::EN[$key] ?? self::EN['server_error'];
        foreach ($vars as $k => $v) {
            $text = str_replace('{' . $k . '}', (string) $v, $text);
        }
        return $text;
    }

    public static function has(string $key): bool
    {
        return isset(self::EN[$key]);
    }
}
