<?php

declare(strict_types=1);

namespace App\Sections\Question\Policies;

use App\Models\User;
use App\Sections\Question\Models\Tag;

/**
 * Tag: murid hanya baca; guru/admin boleh mengubah.
 */
class TagPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Tag $tag): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->isGuru();
    }

    public function update(User $user, Tag $tag): bool
    {
        return $user->isGuru();
    }

    public function delete(User $user, Tag $tag): bool
    {
        return $user->isGuru();
    }
}
