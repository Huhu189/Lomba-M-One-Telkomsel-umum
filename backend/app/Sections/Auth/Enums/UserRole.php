<?php

declare(strict_types=1);

namespace App\Sections\Auth\Enums;

enum UserRole: string
{
    case Admin = 'admin';
    case Guru = 'guru';
    case Murid = 'murid';
}
